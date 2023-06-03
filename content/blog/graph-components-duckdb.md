+++
date = "2023-06-03"
title = "Graph components with DuckDB"
toc = true
tags = ['data-science', 'sql']
+++

## Introduction

Graph problems are quite common. However, it's rare to have access to a database offering graph semantics. There are graph databases, such as [Neo4j](https://neo4j.com/) and [GraphX](https://spark.apache.org/docs/latest/graphx-programming-guide.html), but it's difficult to justify setting one of those up. One could simply use [networkx](https://networkx.org/) in Python. But that only works if the graph fits in memory.

From a practical angle, the fact is that people are querying data warehouses in SQL. There are many good reasons to write graph algorithms in SQL. And anyway, one may argue that graphs are a special case of the [relational model](https://www.wikiwand.com/en/Relational_model).

An ex-colleague recently shared a problem he was pulling his hair on:

> I have a list of companies. Each company can have several admins. An admin may administrate several companies. Companies share a link because they might have at least one admin in common, and vice versa.
>
> Question: *How can I find groups of companies and admins that are connected with each other?*

As you might guess, this boils down to finding [components in a graph](https://www.wikiwand.com/en/Component_(graph_theory)).

My ex-colleague had a few tens of thousands of rows sitting in a Snowflake table. Each row linking an admin to a company. It took us an hour to obtain a working solution in SQL. But it involved a recursive query with an uninspired stopping condition based on the recursion depth. Moreover, the query took a (painful) few minutes to run.

This post is an attempt at sharing a clean and reasonably fast solution.

## Toy example

Let me illustrate with an example, which will also serve as a unit test. Let's say there are customers $\\{1, ..., 8\\}$ that have visited restaurants $\\{A, ..., G\\}$. Some customers may have visited several restaurants, some none at all.

<div align="center" >
<figure style="width: 90%; margin: 0;">
    <img style="box-shadow: none;" src="/img/blog/graph-components-duckdb/directed.svg">
    <figcaption>A toy graph of 15 nodes with 5 components</figcaption>
</figure>
</div>
</br>

Let's say we have to find groups of customers/restaurants that are connected to each other, either directly or indirectly. For instance, this may be because it's COVID, and we want to notify customers that were at a restaurant which was visited by an infected person. We won't worry about visiting times, though -- people should only care if they visited the restaurant at the same time.

The above graph is [bipartite](https://www.wikiwand.com/en/Bipartite_graph), in that the edges always go from a customer to a restaurant -- and not, say, from a customer to a customer. This is just a special case of a graph. If we have an algorithm to find components in any graph, then it would also work for bipartite graphs.

## A working implementation

I'll use DuckDB as an example. A nice thing about DuckDB is that it plays nicely with Python. DuckDB query convert to pandas dataframes without any fuss, and vice versa. First, let's list the visits from customers to restaurants:

```sql
-- visits
SELECT *
FROM (
    VALUES
    -- Component #1
    ('1', 'A'),
    ('2', 'A'),
    -- Component #4
    ('4', 'C'),
    ('4', 'D'),
    -- Component #5
    ('5', 'E'),
    ('6', 'E'),
    ('6', 'F'),
    ('7', 'F'),
    ('7', 'G'),
    ('8', 'G')
) AS visits(person, place)
```

I've only written down the SQL code, and omitted the Python part. But the latter simple, as you can see after clicking on the details below. I like this way of being able to break a large query into steps, as it allows inspecting intermediary results.

<details>
  <summary>Python code</summary>

```py
import duckdb

visits = duckdb.sql('''
SELECT *
FROM (
    VALUES
    -- Component #1
    ('1', 'A'),
    ('2', 'A'),
    -- Component #4
    ('4', 'C'),
    ('4', 'D'),
    -- Component #5
    ('5', 'E'),
    ('6', 'E'),
    ('6', 'F'),
    ('7', 'F'),
    ('7', 'G'),
    ('8', 'G')
) AS visits(person, place)
''').to_df()
```
</details>

I've omitted the 2nd and 3rd components. That's because they only have a single node. We'll have to make sure they're not omitted, because they are valid components. Before that, let's turn this bipartite graph into a more general undirected graph. We do that by duplicating the `visits` and switching the two columns.

```sql
-- edges
SELECT person AS src, place AS dst
FROM visits
UNION
SELECT place AS src, person AS dst
FROM visits
```

```
┌─────────┬─────────┐
│   src   │   dst   │
│ varchar │ varchar │
├─────────┼─────────┤
│ A       │ 1       │
│ A       │ 2       │
│ C       │ 4       │
│ D       │ 4       │
│ E       │ 5       │
│ E       │ 6       │
│ F       │ 6       │
│ F       │ 7       │
│ G       │ 7       │
│ G       │ 8       │
│ 1       │ A       │
│ 2       │ A       │
│ 4       │ C       │
│ 4       │ D       │
│ 5       │ E       │
│ 6       │ E       │
│ 6       │ F       │
│ 7       │ F       │
│ 7       │ G       │
│ 8       │ G       │
├─────────┴─────────┤
│      20 rows      │
└───────────────────┘
```

This yields a table with double the amount of rows. We can derive the list of nodes from this `edges` table:

```sql
-- nodes
SELECT DISTINCT src AS node
FROM edges
UNION
SELECT *
FROM ( VALUES ('3'), ('B') )
```

```
┌─────────┐
│  node   │
│ varchar │
├─────────┤
│ 3       │
│ B       │
│ A       │
│ C       │
│ D       │
│ E       │
│ F       │
│ G       │
│ 1       │
│ 2       │
│ 4       │
│ 5       │
│ 6       │
│ 7       │
│ 8       │
├─────────┤
│ 15 rows │
└─────────┘
```

That was a bit of data munging to get the list of nodes and edges. But you might already have that in some different shape. What follows is the crux of this article. Indeed, we have everything needed to implement a connected components algorithm. This is [usually done](https://www.wikiwand.com/en/Connected_component_(graph_theory)#Algorithms) with a search algorithm, be it [BFS](https://www.wikiwand.com/en/Breadth-first_search) or [DFS](https://www.wikiwand.com/en/Depth-first_search). A variation is necessary to function with relational semantics.

I have to admit, I got an implementation from Torsten Grust's [tutorial](https://www.youtube.com/watch?v=L967JqNFxkw). He calls it *parallel walks*, and it's admittedly rather elegant. The following code is more or less copy/pasted from that tutorial.

```sql
WITH RECURSIVE

    walks(node, front) AS (
        SELECT node, node AS front
        FROM nodes
        UNION
        SELECT walks.node, edges.dst AS front
        FROM walks, edges
        WHERE walks.front = edges.src
    ),

    components AS (
        SELECT node, MIN(front) AS component
        FROM walks
        GROUP BY node
    )

SELECT *
FROM components
ORDER BY component, node
```

```
┌─────────┬───────────┐
│  node   │ component │
│ varchar │  varchar  │
├─────────┼───────────┤
│ 1       │ 1         │
│ 2       │ 1         │
│ A       │ 1         │
│ 3       │ 3         │
│ 4       │ 4         │
│ C       │ 4         │
│ D       │ 4         │
│ 5       │ 5         │
│ 6       │ 5         │
│ 7       │ 5         │
│ 8       │ 5         │
│ E       │ 5         │
│ F       │ 5         │
│ G       │ 5         │
│ B       │ B         │
├─────────┴───────────┤
│ 15 rows   2 columns │
└─────────────────────┘
```

The assignments are correct. There's 15 nodes grouped into 5 components. The component names are not labeled from 1 to 5, but that's because I used `MIN(node)` to label each component. There are other ways to proceed.

The algorithm is quite straightforward:

1. Start by listing each node, and build a "front" for each node, which at first only contains said node.
2. Join each front with the edge sources, and append the edges destinations with the front.
3. Repeat step 2 with the new front, using recursion.

The stopping condition isn't obvious, though. The query works because of the `UNION` operator. Initially, the nodes are listed by themselves, and each node's front is composed of only said node. Then, the front is joined with the edge sources, and the front is extended by including the edge destinations. However, these new pairs are only added to the new front if they aren't already in the existing front. This is how the recursion stops. Torsten Grust provides a good visualization, working out the recursion on a toy example:

{{< youtube id="L967JqNFxkw?start=1281" autoplay="false" >}}
</br>

Having a working implementation is already a success. It's cleaner than the hacky solution we came up with my colleague.

Now how about performance?

## Performance

The only issue with the above implementation is its inefficiency. Before the `MIN(front) ... GROUP BY` reduction, the `walks` CTE contains 69 rows. What's happening is that the `walks` table lists all the pairs of nodes that are linked to each other in some way. Indeed, the 69 figure decomposes as

$$69 = 3^2 + 1^2 + 1^2 + 3^2 + 7^2$$

This is clearly problematic. In a real dataset, it's not unreasonable to expect components with some tens of thousands of nodes. $10,000^2 = 100,000,000$ is a large number and will rapidly saturate a computer's main memory. In the worst case, where there is a single component containing all `n` nodes, there would be $n^2$ components.

In fact, I've tried running the above logic on the [title.principals.tsv.gz](https://developer.imdb.com/non-commercial-datasets/#titleprincipalstsvgz) file shared by IMDb. This dataset contains 56,328,578 rows, representing actors who played in movies. The query didn't take long to crash.

```
duckdb.OutOfMemoryException
Out of Memory Error
could not allocate block of 262144 bytes
(13743722496/13743895347 used)
```

As a reminder, our goal boils down to determining which nodes are part of the same set. The fundamental issue is that we're representing these sets in the most inefficient way possible. The memory footprint of a set should be linear, because there's only a need to mention each node once. But here we're explicitly listing each pair within each component, which results in quadratic memory usage.

That said, the idea of extending a front of nodes is the right one. It's simply that we're not using the right data structure to materialize said front. Ideally, each front would be represented with an actual set, on which set semantics could be applied. The fronts would then be [disjoint sets](https://www.wikiwand.com/en/Disjoint_sets). If two nodes are adjacent to one another, then their fronts would be merged. This is reminiscent of [Kruskal's algorithm](https://www.wikiwand.com/en/Kruskal's_algorithm).

The only issue is that I have no idea how to do this with DuckDB! The latter has a [`List` data type](https://duckdb.org/docs/sql/data_types/list), but not an equivalent for sets. I leave it to the reader to take up the baton 🦆
