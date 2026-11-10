+++
date = "2026-11-10"
title = "Analytics engineering is mostly about meaning"
description = "The principles I use to turn raw data into trustworthy models, metrics, and reports."
tags = ['data-eng', 'sql']
toc = true
draft = true
+++

I recently started writing a [little book about analytics engineering](https://github.com/MaxHalford/little-book-of-analytics-engineering). After a few chapters, I realised I did not actually want to write a book. I wanted somewhere to put down the principles I use at work, without pretending they add up to a grand theory. A long blog post will do just fine.

Analytics engineering sits somewhere between data engineering and analysis. The usual description is that it turns raw data into clean tables for analysts. That is true, but it misses the difficult part. Moving data is a transport problem. Analytics engineering is mostly a meaning problem.

What is a customer? When does an order count as revenue? Which timestamp represents when an event happened? What should happen to last month's report when a late payment arrives today? The SQL usually comes after these questions. Alas, SQL is the easy bit.

My working definition is this: analytics engineering turns organisational knowledge into data products. A query answers one question once. A data product answers a recurring class of questions reliably. It has a purpose, an owner, some consumers, and an interface they can rely on. It also has a lifecycle: it can be introduced, changed, monitored, and eventually retired.

This does not mean every table deserves a product manager and a quarterly roadmap. An exploratory model can be temporary and lightly governed. A table which drives invoices or a board report deserves more care. The trick is to match the engineering effort to the consequence of being wrong.

## A model is not a schema

A data model is a shared understanding of reality. A schema is how that understanding is represented in tables, fields, keys, and types. Teams often debate the second before agreeing on the first.

It helps me to separate three levels. The conceptual model names the entities, events, and relationships in the business. The logical model adds identities, cardinalities, history, and rules. The physical model turns those choices into tables, partitions, and materialisations. The distinction sounds academic, but it is useful. It lets a schema change without forcing everyone to rediscover what an order means.

There are two ways to get the model wrong. A top-down model can describe an ideal business which the source data does not support. A bottom-up model can reproduce the source systems perfectly whilst missing the business they serve. The sensible approach is to move in both directions.

I like to follow one business event from start to finish. Who did what, when, where, why, and for how much? Then I compare that story with the actual records, including cancellations, corrections, and other annoying cases. Concrete examples flush out ambiguity faster than boxes and arrows.

Modelling is also a social process. Finance, marketing, product, and support can have different definitions of a customer because they interact with different parts of the business. Sometimes one definition has to win. Often several can coexist, as long as they are named and scoped: `paying_customer`, `active_user`, and `support_account` may all be legitimate populations.

When a shared decision needs one definition, someone needs the authority to choose it. Analytics engineers should expose the consequences and facilitate the decision. They should not quietly make company policy through whichever `WHERE` clause they happen to write.

### Begin with the grain

The grain of a table is what one row represents. It might be one order, one order line, one customer on one day, or one change to an account's status. I try to state it in one sentence before thinking about columns.

Many data bugs are really grain bugs. A join silently multiplies rows. A monthly budget is copied onto every daily transaction. A conversion rate is averaged even though its groups have different denominators. The query runs and returns a plausible number, which is the most dangerous kind of wrong.

A key should identify the grain. Declaring a key does more than make joins convenient: it turns the model's claim into something testable. If a table claims to contain one row per order, then `order_id` had better be unique.

Grain depends on identity, and identity is rarely as simple as it looks. One person can have several accounts, emails, or devices. Several people can share a household or a company account. A source system can merge two records or recycle an identifier. None of this can be solved with a more enthusiastic `COUNT(*)`.

Generated keys are useful because they protect consumers from unstable source keys. They do not solve identity. The mapping does, and that mapping is a product in its own right. It needs an owner, provenance, and a policy for what happens when identities are merged or split.

Relationships make claims too. Their cardinality -- one-to-one, one-to-many, or many-to-many -- is a business rule before it is join syntax. Joining many orders to one customer preserves the order grain. Joining an order to three promotions does not. A `DISTINCT` after the join may hide the multiplication, but it does not explain how the revenue should be allocated.

### Choose what kind of history to preserve

The same business concept can be represented as an event, a state, or a snapshot. These shapes answer different questions.

An event records that something happened: an order was placed, a payment failed, or a subscription was cancelled. Events preserve evidence, but consumers need rules for ordering, duplication, reversal, and missing records. A state table keeps the latest known condition, such as the current plan or address. It is easy to query, but it discards the path which produced that condition. A snapshot records the state at regular intervals. It makes historical analysis convenient, at the cost of storage and missing changes between snapshots.

Useful systems often retain all three. An event log acts as evidence, a current-state projection supports simple lookups, and daily or monthly snapshots cover common historical questions. They are related products, not interchangeable copies.

Time has several meanings as well. I find these four particularly useful:

- Event time is when something happened in the world.
- Ingestion time is when the analytical system received it.
- Processing time is when a computation handled it.
- Valid time is the period during which a value was true in the world.

An order placed on Monday may arrive in the warehouse on Wednesday and be processed on Thursday. A correction entered on Friday may be valid from the previous month. Calling every timestamp `created_at` is convenient, but it throws away distinctions which determine freshness and historical truth.

Some systems also need to know when they first believed a fact. This gives two historical axes: what was true, and what the system knew at the time. It enables questions such as “What did we report at month end with the information available then?” Bitemporal models are expensive and fiddly. They are worthwhile for audits, corrections, and restatements, but poppycock for most other tables.

The important part is not preserving every possible history. It is saying which history is preserved and which is intentionally lost.

### Layers should have a job

People like to call data layers bronze, silver, and gold. Medals are nice, but responsibilities matter more. I usually think in terms of three broad boundaries:

- Source-aligned data preserves what arrived and makes investigation possible.
- Conformed models reconcile identities, types, and shared definitions.
- Consumer-facing models encode calculations and expose stable interfaces.

Each boundary should reduce coupling or establish a useful contract. A chain of ten models which each rename one column is not an architecture. It is a treasure hunt.

The same goes for the “single source of truth”. I do not think every consumer should query one enormous table or use one dashboard. The useful interpretation is that shared business logic has an authoritative home. Different views can serve different tasks, as long as important definitions come from the same governed components.

Durable logic should generally live close to the data, not in a dashboard. Otherwise two reports can disagree whilst appearing to use the same source. A [semantic layer](https://en.wikipedia.org/wiki/Semantic_layer) can centralise dimensions, measures, relationships, and access rules at query time. It does not save a bad physical model. It is an interface over that model.

## Refreshes are promises

Once a model has a useful shape, it needs to be produced repeatedly. Analytical transformations naturally form a directed acyclic graph: every asset depends on upstream assets, and work proceeds in dependency order.

The graph is more than input for a scheduler. It is the map used to answer operational questions. What is stale? Which inputs produced this table? Which consumers are affected by a failure? What has to be rebuilt after a change?

This is why I prefer thinking in assets rather than tasks. A task says “run this query”. An asset says “produce the daily revenue table people use at 08:00”. The task can succeed and still produce an empty, partial, or stale table. Asset health connects execution to usefulness.

A refresh schedule is a promise to consumers. If the data is reliably ready at 08:00, people will organise their work around it. An ambitious schedule which often slips is worse than a modest one which can be trusted.

Freshness should also be defined from the consumer's perspective. A pipeline can finish on time while its source is a day behind. It helps to record both when the data was observed and which business period it covers. “The job ran five minutes ago” is not the same thing as “the data is five minutes old”.

### Make retries boring

A refresh is idempotent when running it again with the same inputs produces the same result. This turns retries from a delicate recovery procedure into normal operation. It also makes backfills and local reproduction much less frightening.

Rebuildability is the broader goal. A result should be reproducible from known code, inputs, configuration, and time assumptions. Transformation code is only part of the story. Reference data, mappings, source snapshots, and business definitions can all change the result.

Hidden mutable state is the enemy here. State is sometimes necessary -- incremental processing relies on it -- but each piece needs to be stored, observed, and repairable. If nobody knows how to perform a full rebuild, the incremental model is a one-way door.

This is one reason full refreshes are an excellent default. Incrementality reduces compute by processing only what changed, but it introduces boundaries. Can old records be corrected? How late can new records arrive? What happens when the schema changes? How far back should a refresh look?

Time-based incrementality censors the world at a chosen point. Records on the wrong side may be missed or counted twice. An overlapping lookback window combined with an idempotent merge is usually safer than assuming events arrive in perfect order. A periodic full reconciliation can detect errors which daily increments quietly preserve.

Streaming changes the latency, not the obligations. Events still need identities, schemas, ordering rules, deduplication, and observable failures. I would only choose it when the value of a faster decision pays for continuously operating a more stateful system.

### Know both sides of the contract

Source systems were built to run operations, not to preserve analytical meaning. Learn who owns each source, how records are corrected, which timestamps can change, and what a deletion looks like. A schema only describes the visible part of the contract.

Source drift can be structural or semantic. A column may change type. More subtly, a team may change how it fills the same column. The second change passes most schema checks and can still invalidate a metric.

The other side of the contract is the consumer. Every published table can become a dependency, even if its creator called it temporary. Expose a small and intentional surface. Keep intermediate models private. Before changing a public model, find its consumers and separate compatible additions from breaking changes.

A data contract can record the grain, fields, types, semantics, freshness, quality expectations, owner, and change policy. It does not need to start as a YAML cathedral. A short agreement which people maintain is more useful than a specification nobody trusts.

Breaking changes deserve migrations. Publish the old and new forms together, identify consumers, and set a removal date. Structural and semantic compatibility are different. Changing a number from gross to net revenue is breaking even if the type remains `DECIMAL` and every query still runs.

The same care applies to backfills. Build the replacement away from consumers, compare it with the published version, explain the expected differences, and switch atomically. A small repair can trigger downstream work much larger than the original change, so impact analysis matters.

This is the idea behind the [efficient ELT refresh setup](/blog/efficient-data-transformation/) we use at Carbonfact. In pull requests, we build modified views and their descendants against frozen production inputs. This gives us a meaningful apples-to-apples comparison without rebuilding the whole graph.

## Trust comes from claims you can check

Trust does not mean believing the data is always correct. It means having justified confidence that important errors will be prevented, detected, explained, and repaired quickly enough for their consequences.

Every model makes claims. Its key is unique. Its foreign keys refer to known parents. Its amount is non-negative. Its daily partition is complete. A given business scenario produces a known result. Tests should encode those claims at the closest useful boundary.

I find five families of tests cover most needs:

- Structural tests check types, required fields, uniqueness, and relationships.
- Domain tests check accepted ranges, states, and business invariants.
- Reconciliation tests compare sources or independent totals.
- Freshness and volume tests detect operational changes.
- Scenario tests exercise difficult rules and boundary conditions.

Not every anomaly is a failure. Weekend volume may be lower. A new country code may be legitimate. Every alert needs an owner and a response. An alert which is routinely ignored is not protection; it is evidence that the threshold or process needs repair.

Controls are most useful where data enters the platform, where its meaning changes, and before a consequential product is published. Testing only the final dashboard makes it difficult to tell whether the source, transformation, or presentation is responsible.

Tests cover expected conditions. Observability helps investigate the rest. Record run duration, freshness, row counts, rejected records, lineage, and the code version which produced each asset. Good alerts point to an owner and show which consumers are affected.

Trust also requires restraint. Correct data can still cause harm if it is exposed too broadly or used outside its purpose. Minimise sensitive fields, make access intentional, and document what a dataset should not be used for. Privacy and security are data quality properties too.

## A metric is an interface

A report is an interface between a model of the business and a decision. Its job is not to display all available data. It should establish context, direct attention, and make the next useful question easier to ask.

A metric needs a name, purpose, formula, grain, dimensions, time basis, owner, and caveats. It should behave predictably as new data arrives. A report for January should not change in March merely because the query ran later, unless late corrections are part of the definition and clearly labelled.

I call this refresh-time invariance: a metric should depend on its business inputs, not accidentally on the clock of the computation. Avoid filters such as “before now” when the intended reporting cutoff can be passed explicitly.

Counting is a good illustration. `COUNT(*)` counts rows and `COUNT(DISTINCT account_id)` counts account identifiers. Neither necessarily counts people, households, customers, or active relationships. A meaningful count specifies the entity, identity rule, scope, and time window.

“Monthly active users” is incomplete until you define the user identity, qualifying activity, calendar boundaries, timezone, bots, employees, deleted accounts, and late events. These choices are the metric. They are not supporting trivia.

Distinct counts are not additive. Daily active users cannot be summed into monthly active users because one person can appear on several days. Ratios and averages have similar traps. Preserve the numerator, denominator, and weighting basis so the measure can be recomputed at a new grain. An average of displayed averages gives the same weight to groups of ten and ten million.

Aggregation is controlled information loss. Transactions become daily product totals; daily totals become a monthly category total. Each step creates a new grain and discards detail. A join can change grain just as surely as a `GROUP BY`, so every such change should be deliberate.

This is also why I like tables. They expose exact values, missingness, ordering, and detail. Charts are useful when position, shape, or change makes a comparison easier to see. A clear table is better than a chart which conceals its scale or grain.

### Consistency beats imaginary precision

I have [argued before](/blog/consistent-metrics/) that metric correctness matters less than consistency. Every business metric contains assumptions. The useful goal is not a number revealed by nature, but a definition which is good enough, stable enough, and understood well enough to support a decision.

This does not mean correctness is irrelevant. A metric still needs to be roughly right and sensitive to the thing it claims to measure. But there is little value in polishing the sixth decimal place whilst two teams use different populations.

Machine-readable definitions help. A system can prevent a non-additive measure from being summed, constrain invalid joins, expose lineage, and generate the same query for several tools. Human-readable explanations remain necessary because syntax cannot capture purpose and every possible misuse.

Not every calculation belongs in a central metric catalogue. Exploration should stay cheap. Promote a metric when it is reused, consequential, or needed for reconciliation. The trigger is evidence of reuse or consequence, not the age of the query.

This creates a natural path from exploration to a governed product. An analyst first proves a question is useful. Repeated logic is named and shared. Its grain, owner, inputs, and limitations are documented. Important claims become tests. The asset gets a freshness expectation and a change policy. Only then is it presented as a supported interface.

Doing all this before an idea finds a consumer creates a queue of beautifully governed unused work. Leaving successful prototypes in place forever creates fragile production by accident. There is a middle ground.

## Agents make semantics more important

Natural-language and agentic query systems make it cheap to produce SQL. They do not make the SQL meaningful. If anything, they increase the value of clear metadata and constrained interfaces.

An agent needs several kinds of context. Schema metadata tells it which fields exist. Semantic metadata explains entities, grains, metrics, valid relationships, and time rules. Operational metadata exposes freshness and quality. Decision context explains why the question is being asked and what happens if the answer is wrong.

The best approach is to constrain the space of valid queries instead of writing a heroic prompt. Expose certified products, allowed joins, governed measures, representative examples, and explicit exclusions. Apply the same access controls used for humans.

The answer should also be auditable. Retain the interpreted question, selected definitions, generated query, source versions, freshness, and result. An explanation which cannot be traced back to these artefacts is presentation, not evidence.

Review should scale with consequence. Exploration can tolerate an answer labelled as uncertain. A decision which affects customers, money, safety, or legal obligations needs stronger validation and usually a human in the loop.

This is why I think analytics engineering is a good name for the discipline. The warehouse, orchestrator, modelling framework, and BI tool will all change. The enduring work is to make meaning explicit, production repeatable, and changes unsurprising.

I am sure I have missed important principles, and I expect some of mine to change. That is another advantage of a blog post over a book: editing it will be much less dramatic. If you think something belongs here, please let me know 🙏
