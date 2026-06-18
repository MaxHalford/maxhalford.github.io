+++
date = "2025-02-08"
title = "Minimizing the runtime of a SQL DAG"
tags = ['data-eng', 'python']
+++

I recently looked into reducing the runtime of [Carbonfact](https://www.carbonfact.com/)'s SQL DAG. Our DAG is made up of roughly 160 SQL queries. It takes about 10 minutes to run with BigQuery, using on-demand pricing. It's decent. However, the results of our DAG feed customer dashboards, and we have the (bad) habit of refreshing the DAG several times a day. Reducing the runtime by a few minutes can be a nice quality-of-life improvement.

There are essentially two options to reduce the runtime of a SQL DAG:

1. Reduce the runtime of individual queries.
2. Remove dependencies between queries.

The first option is rather straightforward. We process a lot of JSON data at Carbonfact, so I presume the queries involved need some optimization. I also have my eyes on the second option. Indeed, I suspect some key queries are bottlenecks; the runtime of the DAG could be reduced if these key queries were run earlier in the DAG.

The crux of the matter is to determine which queries to optimize, as well as which dependencies to remove. In a DAG, everything is running in parallel, so it's not exactly clear which queries are the bottleneck.

I was surprised to find little to no resources on this topic online. [Transitive reduction](https://en.wikipedia.org/wiki/Transitive_reduction) is a well-known concept in graph theory, but it's not exactly what I'm looking for. There's also the field of [queueing theory](https://en.wikipedia.org/wiki/Queueing_theory), but I haven't been able to find any practical resources on how to apply it to a DAG.

We're not using [dbt](https://www.getdbt.com/) or [SQLMesh](https://sqlmesh.com/) at Carbonfact. Instead we're using lea, which is a homegrown tool. But it's basically the same thing: a tool to execute a DAG of SQL queries asynchronously. lea produces logs, which messages like this:

```
[15:27:07] SUCCESS
           int-data-kaya-prod.kaya_preview_main_39cdd31a.core.releases___audit,
           took 0:00:07, cost $0.00, contains 444 rows, weighs 171KB
```

I wrote a Python script to parse these logs and extract the duration of each query. I also got lea to spit out the DAG structure. I created aliases for each table, in order to not reveal our table names in this blog post. Here are both resulting files:

<div><a href="/files/datasets/minimizing-sql-dag-runtime/dag_durations.txt"><b>dag_durations.txt</b></a></div>
<div><a href="/files/datasets/minimizing-sql-dag-runtime/dag_dependencies.txt"><b>dag_dependencies.txt</b></a></div>
<br>

You should be able to use the code below if you are able to produce these two files with whatever system it is you're using.

First of all, here's some Python code to read the files:

```python
import collections
import pathlib

durations = {
    line.split(': ')[0]: int(line.split(': ')[1])
    for line in pathlib.Path('dag_durations.txt').read_text().splitlines()
}

dependencies = collections.defaultdict(set)
for line in pathlib.Path('dag_dependencies.txt').read_text().splitlines():
    src, dst = line.split(' -> ')
    dependencies[dst].add(src)
```

I made a little data structure to hold the DAG logic:

```python
import dataclasses
import graphlib

@dataclasses.dataclass
class DAG:
    dependencies: dict[str, set[str]]
    durations: dict[str, float]

    @property
    def total_duration(self) -> float:
        """Return the total duration of the DAG."""

        topo_order = graphlib.TopologicalSorter(self.dependencies).static_order()
        finish_time = {}

        for node in topo_order:
            if node not in self.dependencies or not self.dependencies[node]:
                finish_time[node] = self.durations[node]
            else:
                max_dependency_time = max(finish_time[dep] for dep in self.dependencies[node])
                finish_time[node] = self.durations[node] + max_dependency_time

        return max(finish_time.values())

    def remove_dependency(self, src: str, dst: str) -> DAG:
        """Return same DAG with one dependency removed."""
        dependencies = {
            node: deps - {src} if node == dst else deps
            for node, deps in self.dependencies.items()
        }
        return DAG(dependencies, self.durations)

    def set_duration(self, node: str, duration: float) -> DAG:
        """Return same DAG with duration of one node updated."""
        durations = {**self.durations, node: duration}
        return DAG(self.dependencies, durations)
```

This says the total duration of my DAG is ~9 minutes:

```python
>>> dag = DAG(dependencies, durations)
>>> dag.total_duration
```

```
539
```

This is slightly under the 10 minutes I mentioned earlier. That's because of some non-DAG stuff in the GitHub Action counting towards the 10 minutes, as well as rounding errors. Anyway, it doesn't matter. The point is that I have a number to optimize against.

Here's a ranking of the top 10 queries by duration:

```
#01 00:04:00 #46
#02 00:02:38 #69
#03 00:02:28 #51
#04 00:01:37 #45
#05 00:01:07 #118
#06 00:01:06 #56
#07 00:00:56 #91
#08 00:00:56 #116
#09 00:00:56 #117
#10 00:00:36 #63

```

That top query `#46` appears as a low hanging fruit to optimize. But it turns out it's not a bottleneck, and there's actually no point optimizing it:

```python
>>> dag.set_duration('#46').total_duration
```

```
539
```

Why? Because even if it's taking a long time to run, it's doing so in parallel with other queries. The total duration of the DAG is not affected by the duration of this query.

Likewise, I had a hunch removing the dependency between `#83` and `#84` would help, but it doesn't:

```python
>>> dag.remove_dependency('#83', '#84').total_duration
```

```
539
```

Reducing the runtime of a DAG isn't that straightforward. Again, because everything is running in parallel, it's not clear how to assess the impact of a change. I thus opted for a brute-force strategy: try out all possible changes, and rank them by impact. I started by considering all the single dependencies that I could remove. I searched for candidate removals as long as they led to an improvement:

```python
current_dag = dag
current_cost = current_dag.total_cost

while True:
    candidates = {
        (node, dep): (
            current_dag
            .remove_dependency(src=dep, dst=node)
            .total_cost
        )
        for node, dependencies in current_dag.dependencies.items()
        for dep in dependencies
    }
    best_candidate, best_candidate_cost = min(candidates.items(), key=lambda x: x[1])
    if best_candidate_cost >= current_cost:
        break
    current_cost = best_candidate_cost
    print(f'Cut {current_dag.total_cost - current_cost:.0f} seconds by removing {best_candidate[1]} -> {best_candidate[0]}')
    current_dag = current_dag.remove_dependency(src=best_candidate[1], dst=best_candidate[0])

print(f'{dag.total_cost - current_dag.total_cost:.0f} seconds can be cut in total')
print(f"That's a potential {(dag.total_cost - current_dag.total_cost) / dag.total_cost:.0%} improvement")

```

```
Cut 45 seconds by removing #117 -> #116
Cut 26 seconds by removing #52 -> #53
Cut 22 seconds by removing #54 -> #49
Cut 11 seconds by removing #114 -> #69
Cut 11 seconds by removing #45 -> #69
Cut 11 seconds by removing #150 -> #118
Cut 4 seconds by removing #116 -> #140
Cut 6 seconds by removing #118 -> #140
Cut 4 seconds by removing #116 -> #69
140 seconds can be cut in total
That's a potential 26% improvement
```

Not bad. I also tried reducing each query's duration by 50%. Same, I kept searching for candidates as long as there were improvements:

```python
current_dag = dag
current_duration = current_dag.total_duration
already_optimized = set()

while True:
    candidates = {
        node: (
            current_dag
            .set_duration(node, current_dag.durations[node] // 2)
            .total_duration
        )
        for node in current_dag.dependencies
        if node not in already_optimized
    }
    best_candidate, best_candidate_duration = min(candidates.items(), key=lambda x: x[1])
    if best_candidate_duration >= current_duration:
        break
    current_duration = best_candidate_duration
    print(f'Cut {current_dag.total_duration - current_duration:.0f} seconds by optimizing {best_candidate}')
    current_dag = current_dag.set_duration(best_candidate, current_dag.durations[best_candidate] // 2)
    already_optimized.add(best_candidate)

print(f'{dag.total_duration - current_dag.total_duration:.0f} seconds can be cut in total')
print(f"That's a potential {(dag.total_duration - current_dag.total_duration) / dag.total_duration:.0%} improvement")
```

```
Cut 79 seconds by optimizing #69
Cut 26 seconds by optimizing #56
Cut 20 seconds by optimizing #116
Cut 13 seconds by optimizing #54
Cut 8 seconds by optimizing #53
Cut 8 seconds by optimizing #49
Cut 4 seconds by optimizing #87
158 seconds can be cut in total
That's a potential 29% improvement
```

Also not bad.

I'm not sure how much of these suggestions I'll implement. But now at least I know where to focus my efforts. I hope this blog post will inspire you to do the same!

_Part of the reason I'm posting this half-baked solution is to manifest Cunningham's Law. If you have a better solution, please let me know! 🙏_
