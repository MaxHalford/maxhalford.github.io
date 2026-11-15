+++
date = "2026-11-09"
title = "The impact of perfect cardinality estimates"
tags = ['sql', 'data-eng']
draft = true
+++

Cardinality estimation is often described as the cornerstone of query optimization.

There's a few papers:

- [How Good Are Query Optimizers, Really? (2015)](https://www.vldb.org/pvldb/vol9/p204-leis.pdf)
- [Query Optimization Through the Looking Glass, and What We Found Running the Join Order Benchmark](https://db.in.tum.de/~leis/papers/lookingglass.pdf)
- [Still Asking: How Good Are Query Optimizers, Really? (2025)](https://www.vldb.org/pvldb/vol18/p5531-viktor.pdf)

---

I recently wanted to know how much DuckDB would gain from perfect [cardinality estimates](/blog/phd-about/). A query optimizer has to guess how many rows each part of a query will produce. It uses those guesses to choose a join order and decide which side of each hash join to build.

Cardinality estimation is often described as the weak link in query optimization. That sounds plausible. If the optimizer knew the exact row counts, surely it would choose faster plans?

I decided to give it the answers and measure what happens.

I patched DuckDB v2.0.0 to log every cardinality question asked by its join-order optimizer. For example: how many rows does `users JOIN posts JOIN badges` produce after the filters?

I then ran an exact `COUNT(*)` for each question and fed the result back into the optimizer. Changing the estimates can make DuckDB consider new joins, so I repeated this until every new question had an answer. Counting the rows can take much longer than running the original query. That work happens before the benchmark and is not timed.

This is an oracle, not a practical estimator. Its only purpose is to isolate the effect of cardinality estimates from everything else. The [benchmark code](https://github.com/MaxHalford/cardinal/tree/main/research) contains the DuckDB patch, exact-count queries and runtime harness.

There is an important distinction here. The plan chosen with exact cardinalities is not necessarily the fastest plan. It is only the plan DuckDB's cost model prefers once its row counts are correct. Testing the fastest candidate plan is a different experiment: it tests the cardinality estimator, cost model and plan search together.

There is one limitation. I can count inner equi-joins over base tables. I leave estimates for outer joins, non-equi joins and intermediate results from a CTE to DuckDB. This mostly affects LDBC SNB BI, whose queries contain many CTEs, outer joins and recursive queries.

I used eight workloads:

- [JOB-light](https://github.com/andreaskipf/learnedcardinalities) and [JOB](https://github.com/gregrahn/join-order-benchmark) on IMDB.
- [JOB-Complex](https://github.com/DataManagementLab/JOB-Complex), which adds non-key joins, string joins and complex filters to JOB.
- [STATS-CEB](https://github.com/Nathaniel-Han/End-to-End-CardEst-Benchmark) on a Stack Exchange dump.
- TPC-H and [DSB](https://github.com/microsoft/dsb) at scale factor 10.
- [LDBC SNB BI](https://github.com/duckdb/duckdb/tree/main/benchmark/ldbc) at scale factor 0.1.
- The [Star Schema Benchmark](https://www.cs.umb.edu/~poneil/StarSchemaB.PDF) at scale factor 10, or roughly 60 million fact rows.

Each measurement runs in a fresh DuckDB process on a 15-core Apple M5 Pro with 48 GB of memory. Short queries get a warm-up and up to five timed runs. Long queries run until they use a five-second budget. I keep the median. Planning is included because it is part of the latency you observe.

Here are the results. A query counts as faster or slower when its time changes by more than 10% and 10 ms:

| Benchmark | Queries | Changed plans | Total time | Faster / same / slower |
|---|---:|---:|---:|---:|
| JOB-light | 70 | 70 | 5.3 s → 5.6 s | 0 / 70 / 0 |
| JOB | 113 | 113 | 4.2 s → 4.2 s | 1 / 112 / 0 |
| JOB-Complex | 30 | 30 | 1.4 s → 1.4 s | 0 / 30 / 0 |
| STATS-CEB | 146 | 146 | 121.6 s → 119.6 s | 1 / 145 / 0 |
| TPC-H, SF10 | 22 | 13 | 1.4 s → 1.5 s | 2 / 18 / 2 |
| DSB, SF10 | 219 | 219 | 3.1 s → 3.1 s | 0 / 219 / 0 |
| LDBC SNB BI, SF0.1 | 13 | 4 | 0.1 s → 0.1 s | 0 / 13 / 0 |
| SSB, SF10 | 13 | 13 | 0.6 s → 0.6 s | 0 / 13 / 0 |

Diddly squat.

The oracle changes the join plan for 608 of the 626 queries. Only four queries get faster, and only by 14–21%. Two get slower. Those six queries take between 49 and 179 ms, so I would not read much into them.

Adding the totals is dubious because these workloads and scale factors differ. For what it is worth, they go from 137.6 to 136.0 seconds -- a 1.2% improvement.

JOB-Complex deserves a closer look. Its [authors report](https://www.vldb.org/2025/Workshops/VLDB-Workshops-2025/AIDB/AIDB25_8.pdf) that PostgreSQL's plans take 593.5 seconds in total, versus 53.3 seconds for the fastest plans they tried. That is an 11.13× optimization gap. They generated about 200 candidates per query, so their "optimal" plan is the fastest measured candidate. It is not the plan PostgreSQL chooses with exact cardinalities.

DuckDB's estimates also look bad on this workload. Giving it exact counts changes all 30 plans. The median plan becomes 4.7 times cheaper under DuckDB's cardinality-based cost proxy. The 95th percentile improves by 364 times. Yet both sets of plans take 1.4 seconds in total.

I also tried to make memory matter. At 512 MB, both still take 1.4 seconds. At 256 MB, the same four queries fail for both. Exact row counts do not rescue them.

Finally, I sampled up to 200 connected left-deep join orders per JOB-Complex query. I planned each candidate first, then timed execution alone. DuckDB's plans take 1.250 seconds in total and the exact-cardinality plans take 1.254 seconds. Taking the fastest plan I observed for each query brings the total down to 1.116 seconds. Four queries improve by more than 10% and 10 ms. The largest is 2.26 times faster.

That is a 1.12× observed optimization gap, versus PostgreSQL's 11.13× gap in the paper. My candidates are not exhaustive and only cover left-deep plans. Still, they confirm the important bit: DuckDB has faster plans available, but exact cardinalities do not find them. The remaining problem lies in plan search and costing.

Query 58 from STATS-CEB makes the result less abstract. It joins posts, links, users, history edits, votes and badges. The filters leave 36,624 users, and the final join produces 17,849,233,970 rows.

DuckDB's estimates lead it to join badges early. That creates a 58,582,347-row intermediate result. With exact estimates, DuckDB joins votes and badges together on one side, and posts, links, users and history on the other. Those sides produce 1,052,150 and 352,054 rows before the final join.

If I exclude the unavoidable final result, the sum of the intermediate cardinalities falls from 58,954,269 to 1,424,072. The exact plan looks 41 times cheaper.

It takes the same time:

```
DuckDB estimates: 33.3 s
Exact estimates:  32.6 s, then 33.9 s
```

The 17.8-billion-row final join dominates both plans. There is another wrinkle. I found a plan with the same join groups that takes about 17 seconds. The main difference is which side of one hash join DuckDB builds. One side is smaller, but contains duplicate keys. The other is larger, but its key is unique. DuckDB's cardinality-based join cost treats the orientations alike, even though their hash tables behave differently.

In other words, exact cardinalities can lead to the right logical j                       oin order and still make the wrong physical choice.sfdf$er^f-er of        z e  d

The result makes sense in hindsight. The [Looking Glass paper](https://db.in.tum.de/~leis/papers/lookingglass.pdf) makes almost the same distinction.
               w           bn,;
After disabling non-index nested-loop joins and adding dynamic hash-table resizing, fewer than 4% of PostgreSQL's JOB queries become twice as slow as the plans chosen with true cardinalities. Add foreign-key indexes, and 40% become at least twice as slow. Index scans and nested-loop joins create more opportunities for a bad estimate to become a bad runtime decision.

So I would not say cardinality estimates matter to PostgreSQL but not DuckDB. They matter more when an engine offers access paths and operators with very different failure modes. PostgreSQL often does. DuckDB's scan-and-hash design is more forgiving.

TPC-H, DSB and SSB contain many primary-key/foreign-key joins. Their intermediate results stay tame whichever dimension DuckDB joins first. JOB has more joins, but the queries are short and DuckDB's vectorized hash joins forgive a lot. STATS-CEB has severe skew and enormous intermediate results, yet its slowest queries also have enormous final results.

More importantly, a cost model needs more than row counts. It needs to know about unique keys, duplicate chains, row widths, hash table construction, data layout, memory pressure and parallelism. Perfect cardinalities only make one input perfect.

This does not mean cardinality estimation is useless. A bad estimate can still cause a catastrophic plan, especially with indexes, nested loops, disk access or a less forgiving execution engine. It means the usual experiment -- improve q-error, then expect runtime to follow -- skips a few steps.

I expected a clearer win. Instead, DuckDB changed almost every plan and ran almost every query in the same time. My conclusion is narrower than "cardinality estimation does not matter": its value depends on what the optimizer can do with it. If you know a DuckDB workload where exact estimates make a large difference, please send it my way.
