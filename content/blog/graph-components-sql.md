+++
date = "2023-04-12"
title = "Finding graph components in SQL"
toc = true
draft = true
tags = ['data-science', 'sql']
+++

Graph problems are quite common. However, it's rare to have access to a database that offers graph semantics. There are graph databases, such as [Neo4j](https://neo4j.com/) and [GraphX](https://spark.apache.org/docs/latest/graphx-programming-guide.html), but it's difficult to justify setting one of these up. One could use [networkx](https://networkx.org/) in Python, which is simpler, but that only works if the graph fits in memory. From a practical angle, the fact is that people are querying data warehouses in SQL. These are all good reasons to write graph algorithms in SQL. And anyway, one may argue that graphs are a special case of the [relational model](https://www.wikiwand.com/en/Relational_model).

An ex-colleague recently shared a problem he was pulling his hair on:

> I have a list of companies. Each company can have several admins. An admin may administrate several companies. Companies share a link because they might have at least one admin in common, and vice-versa.
>
> Question: *How can I find groups of companies and admins that are connected with each other?*

As you might guess, this boils down to finding [components](https://www.wikiwand.com/en/Component_(graph_theory)) in a graph. My ex-colleague had a few tens of thousands of rows sitting in a Snowflake table. Each row representing a link between an admin and a company. It took us an hour to obtain a working solution in SQL -- partly thanks to ChatGPT 😅. But it involved a recursive query with an uninspired stopping condition based on the recursion depth. Moreover, the query took a (painful) few minutes to run.

This post is an attempt at sharing a clean and reasonably fast solution.

Let me illustrate with an example, which will also serve as a unit test. Let's say there are customers $\\{1, ..., 8\\}$ that have visited restaurants $\\{A, ..., G\\}$. Some customers may have visited several restaurants, some none at all.

<div align="center" >
<figure style="width: 90%; margin: 0;">
    <img style="box-shadow: none;" src="/img/blog/graph-components-sql/directed.svg">
    <figcaption>A toy graph of 15 nodes with 5 components</figcaption>
</figure>
</div>
</br>

Let's say we want to find groups of customers/restaurants that are connected to each other, either directly or indirectly. For instance, this may be because it's COVID, and we want to notify customers that have were at a restaurant which was visited by an infected person.

The above graph is [bipartite](https://www.wikiwand.com/en/Bipartite_graph), in that the edges always go from a customer to a restaurant -- and not, say, from a customer to a customer. This is just a special case of a graph. If we have an algorithm to find components in a graph, then it will also work for a bipartite graph.
