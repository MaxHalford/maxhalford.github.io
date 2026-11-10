+++
date = "2026-11-10"
title = "Analytics engineering: building trustworthy data products"
description = "Principles for turning raw operational data into dependable products that people can understand, trust, and use."
tags = ['data-eng', 'sql']
toc = true
draft = true
+++

## The Analytics Engineering Mindset

Analytics engineering sits between data engineering and analysis. Its purpose is
to turn raw, operational data into dependable products that people can
understand, trust, and use.

The work is sometimes described as moving data from sources into reports. That
description misses the important part. Moving data is a transport problem.
Analytics engineering is largely a meaning problem: deciding what a customer is,
when an order counts as revenue, which version of a fact is authoritative, and
how a change can be made without surprising everyone downstream.

This book is about the principles that make those decisions durable. The
technologies will change. The need for explicit assumptions, stable interfaces,
reproducible transformations, and honest communication will not.

### From queries to products

A query answers a question once. A data product answers a recurring class of
questions reliably. That shift changes how we work. Logic becomes shared,
assumptions become visible, and quality becomes something we design rather than
something we inspect at the end.

A useful data product has a purpose, an owner, and consumers. It has an interface:
the fields, meanings, freshness, and level of detail that consumers may rely on.
It also has a lifecycle. It can be introduced, changed, monitored, and eventually
retired. A table without these properties may still be useful, but it is an
implementation detail rather than a product.

Product thinking does not mean polishing every dataset indefinitely. It means
matching effort to consequence. An exploratory model can be temporary and
lightly governed. A model that drives invoices or a board report needs a stronger
contract. The discipline lies in making that distinction deliberately.

### Why SQL is often the default

SQL is a strong default for analytical transformations because it describes sets
and relationships directly. It encourages established relational patterns, is
widely understood, and usually lets computation happen where the data rests.
Moving less data reduces operational complexity as well as cost.

The deeper principle is more important than the language: express transformations
in the simplest widely understood form that the execution system can optimize.
SQL is not ideal for every task. Complex statistical methods, external services,
and some kinds of parsing may call for another language. Crossing that boundary
should be an explicit choice, because every additional execution environment
adds packaging, observability, and maintenance concerns.

### A mission for the analytics system

An analytics system should help people answer questions quickly, including
questions nobody predicted when the system was designed. It should make important
answers trustworthy and keep routine refreshes from interrupting productive work.

Those aims pull in different directions. A tightly curated system is consistent
but can be slow to extend. An unrestricted system is flexible but soon contains
several meanings for the same term. Good analytics engineering does not eliminate
this tension. It creates a clear path from exploration to a governed, reusable
product.

### The shape of the book

The chapters ahead follow the life of analytical data. We first give it a useful
shape, then make its production repeatable, establish trust, define metrics and
reporting, make the system discoverable, and finally operate it as a network of
dependencies between people as well as tables.

### Operating principles

An analytics platform is a socio-technical system. Its reliability depends on
code and infrastructure, but also on ownership, communication, incentives, and
how quickly the organization can learn.

Every important product needs an owner who can decide its meaning and coordinate
changes. Technical ownership and business ownership may be different; record
both. Shared ownership without a decision process often means no ownership when
an incident occurs.

Set service expectations according to consumer need: freshness, availability,
time to recovery, and communication. Not every table needs the strongest service
level. Tiering products concentrates effort where failure has real consequence
and keeps experimental work inexpensive.

Upstream and downstream systems will change. Reduce the radius of those changes
with stable boundaries, explicit contracts, versioned logic, and impact analysis.
Prefer compatible additions, and treat renames, type changes, semantic changes,
and grain changes as migrations.

Cost includes compute, storage, developer attention, and consumer waiting time.
Optimize only after observing which resource is constrained. The cheapest query
is not necessarily part of the cheapest system.

Create a learning loop. Measure whether products are used, whether incidents
repeat, how long changes take, and where consumers still export data to repair it
manually. Retire what no longer serves a purpose, and promote useful exploratory
logic into governed products.

### Decisions need decision rights

Many apparent data disagreements are not technical disagreements. Marketing,
finance, product, and operations may all use a word such as customer, order, or
revenue differently because they act on different parts of the business. Asking
the data team to discover the single correct definition can therefore be asking
it to settle a question the organization itself has not settled.

First determine whether the definitions are genuinely in conflict. Several can
coexist when each is named and scoped clearly: a paying customer, an active user,
and a support account are different but legitimate populations. When a shared
decision requires one governing definition, someone must have authority to choose
it.

Record decision rights alongside definitions. Who proposes a change? Who must be
consulted? Who makes the final decision? Who needs to be informed? Analytics
engineers should facilitate the decision and expose its consequences, not quietly
make policy through whichever filter they happen to write.

Incentives matter. A metric tied to compensation or public performance will
attract pressure. Changing it may redistribute status, budget, or responsibility.
Transparent definitions, versioned decisions, and visible reconciliation make
the politics manageable even when they cannot make it disappear.

### From exploration to a governed product

Not every question deserves a permanent model. Exploration is intentionally fast
and disposable: assumptions are provisional, the audience is small, and the aim
is to learn. Governance becomes worthwhile when the same logic is reused, when
others depend on it, or when an incorrect answer has meaningful consequences.

A practical promotion path has several stages. An analyst first proves that a
question is useful. Repeated logic is then named and shared. Its grain, owner,
inputs, and limitations are documented. Important claims become tests, and the
asset receives a freshness expectation and change policy. Only then is it
presented as a supported interface.

Promotion should be deliberate but not ceremonial. Production-level controls
before an idea finds a consumer create an expensive queue of unused work. Leaving
successful prototypes in place forever creates fragile production by accident.
The trigger is evidence of reuse or consequence, not the age of the query.
## The art of data modelling

Defining what a good data model should look like is difficult, simply because the right answer depends on the context. Two different people may came up with different data models given a business context.

### Everything Everywhere All in One Place

Many organizations become messy as they grow. Most successful endeavours inevitably take shortcuts to accomplish their goals. A hospital's mandate is to save lives, not to possess a spotless IT landscape.

There are a million reasons why organizations accumulate technical debt and complexity over time. Many books, studies, and recommendations are produced about this topic.

---

### A model is not a schema

A data model represents a shared understanding of reality. A schema implements
that understanding in tables, fields, keys, files, or another storage structure.
Confusing the two encourages teams to debate physical details before agreeing on
what the data means.

It helps to reason at three levels. A conceptual model names the important
entities, events, relationships, and vocabulary of the business. A logical model
adds attributes, identities, cardinality, history, and rules without committing
to one storage engine. A physical model makes implementation choices such as
tables, partitions, indexes, and materialization.

The distinction creates data independence. One business concept can be expressed
through several physical schemas, and the schema can change without forcing the
organization to rediscover what a customer or order means.

### Model from both directions

Top-down modelling starts with decisions and business processes, then identifies
the concepts needed to describe them. Bottom-up modelling starts with existing
sources and discovers what the organization actually records. Either direction
alone is incomplete. A purely top-down model can describe an ideal world that the
data cannot support; a purely bottom-up model can faithfully reproduce source
systems while missing the business they serve.

Move between the two. Follow a business event through its lifecycle and ask who,
what, when, where, why, how, and how many. Then compare that story with real
records, including corrections and exceptional paths. Concrete examples expose
ambiguity earlier than abstract diagrams.

### Modelling is a social process

Definitions reflect incentives and authority. Finance, marketing, and support
may each have a legitimate but different definition of customer. The modeller's
job is not always to force one winner. It is to expose the distinction, establish
which definition governs each decision, and record who can resolve disputes.

Models therefore encode organizational choices as well as facts. Build them with
domain experts, explain the consequence of disagreement, and deliver in small
increments that people can test against their work. No single modelling technique
fits every use case: a star schema suited to reporting may be wrong for an
operational graph or a real-time decision. Choose the representation for the
questions it must support.

### Begin with grain

The grain of a table is what one row represents. It might be one order, one order
line, one customer on one day, or one account status change. State the grain in a
sentence before designing columns. Many data errors are really grain errors: a
join silently multiplies rows, a measure is counted twice, or two facts at
different levels are combined as though they were comparable.

A key should identify that grain. A declared key does more than make joins
convenient; it makes the table's claim testable. If no stable source key exists,
the model may need a composite or generated key, but the business identity it
represents should still be documented.

### Identity: deciding what counts as one

Grain depends on identity. Before counting customers, orders, sessions, or
products, decide what makes two observations the same thing. A row identifier
answers a storage question; a business identifier answers a meaning question.
They are often, but not always, the same.

One person can have several accounts, email addresses, devices, or customer
numbers. Conversely, several people can share an account or household. A source
system may recycle an identifier, merge two records, or split one entity into
several operational roles. None of these cases can be solved by `COUNT(*)`.

Identity rules should state their domain and confidence. An exact government
identifier may establish identity strongly but be inappropriate to collect. An
email match is convenient but changes over time. A probabilistic match can be
useful for analysis while remaining unsuitable for financial or legal decisions.
Preserve source identities even when creating a conformed analytical identity so
that merges can be explained and reversed.

Generated keys isolate consumers from unstable source keys and make several
systems conform to one entity. They do not themselves solve identity. The mapping
and its stewardship are the real product. When identity changes, decide whether
historical facts follow the new identity or retain the interpretation known at
the time.

### Relationships are contracts

A relationship makes a claim about how instances can be connected. Cardinality
states how many: one-to-one, one-to-many, or many-to-many. Optionality states
whether participation is required. These properties are business rules before
they are join syntax.

Joins are safest when their cardinality is known. Joining many orders to one
customer preserves the order grain. Joining orders to several promotions can
multiply order rows and revenue unless the relationship is represented and
aggregated deliberately. A junction table makes a many-to-many relationship
explicit and can carry attributes such as allocation weight or effective dates.

Relationships change with intent. An operational system may normalize customers,
addresses, and orders to protect writes. An analytical model may attach the
customer address that was valid at purchase time directly to the order fact. The
physical expression differs because the analytical relationship must preserve
historical context.

Unmatched references need an explicit policy. Dropping them silently changes
totals. Failing the entire refresh may be excessive. An unknown member preserves
facts while exposing the quality gap.

### Tidy data and practical repetition

Tidy data offers a useful default: each variable is a column, each observation a
row, and each kind of observation a table. This shape makes filtering, grouping,
and combining data predictable.

Analytical models need not remove every repeated value. Repeating a parent key on
each child row is practical because it makes the relationship explicit. A long
table, where categories appear as values in rows, can also absorb new categories
without a schema change. A wide table may be easier for a stable, well-known set
of measures. The right shape follows the questions and the expected rate of
change.

At the far end of denormalization is the one big table: a broad relation prepared
for a family of analytical questions. It can make common queries simple and fast,
but its grain can become ambiguous, repeated attributes can drift, and unrelated
use cases can turn it into a permanent dumping ground. Treat it as a deliberate
consumer-facing product, not as the default shape of the entire platform.

### Normalization and denormalization

Normalization separates facts so that each is recorded in one place. It protects
updates: changing a customer's address should not require editing every order.
Constraints between normalized relations can prevent invalid states. These
properties make normalization a natural fit for operational systems with frequent
writes.

Analytics is dominated by reads, historical comparisons, and broad scans.
Denormalization moves context closer to facts, reducing joins and presenting a
shape that is easier to query. The price is duplication and the possibility that
copied values disagree.

Neither form is intrinsically mature. Normalize when independent updates and
integrity matter. Denormalize when repeated read patterns and usability justify
it. A common analytical architecture receives normalized operational data,
conforms entities in a reusable core, and publishes denormalized views for
particular consumers.

Be especially cautious about denormalizing facts at different grains. Copying a
customer attribute onto every order is usually understandable. Copying a monthly
budget onto every daily transaction creates a number that appears additive but
is not. Convenience must not obscure mathematical behavior.

### Dimensional modelling

Dimensional modelling separates measurable events, called facts, from the
descriptive context used to group them, called dimensions. A sales fact may carry
an amount and keys to date, product, customer, and location dimensions. The model
makes common analytical operations—filtering, grouping, and comparing—obvious.

The enduring lesson from dimensional modelling is to organize data around
business processes and stable grains. Dimensions often flatten descriptive
hierarchies so consumers can combine attributes without navigating an arbitrary
web of source tables. This duplicates some data in exchange for usability and
consistent semantics.

Measures differ in how they can be combined. Revenue can generally be added
across customers and time. An account balance can be added across accounts but
not across daily snapshots. A conversion rate should usually be recomputed from
its numerator and denominator, not summed or averaged from displayed rates. These
additivity rules belong in the model's definition.

Missing dimension references deserve an explicit unknown member rather than a
null foreign key. This preserves joins and makes data-quality gaps visible.
Unknown is a real analytical category; silently dropping those rows is not.

Some relationships need additional structures. A junction table represents a
many-to-many relationship, such as customers belonging to several segments.
Slowly changing dimensions preserve changes to descriptive attributes when
history matters. Polymorphic associations—one key referring to several kinds of
entity—can be convenient in operational systems but are difficult to validate
and should usually be resolved into explicit analytical relationships.

### Events, states, and snapshots

An event records that something happened: an order was placed, a payment failed,
or a subscription was cancelled. Events are naturally append-oriented and carry
an identity and occurrence time. They are valuable because a sequence of events
can explain how the current condition came to be.

A state records the latest known condition: the current plan, balance, or address.
It is easy to consume but usually overwrites the path that produced it. A snapshot
records state at selected intervals, such as one account balance at the end of
each day. Snapshots make historical questions convenient while accepting that
changes between snapshots may be invisible.

Choose the representation from the questions. Events support replay and detailed
behavioral analysis, but consumers need rules for ordering, duplication, reversal,
and missing events. Current-state tables support simple lookup but cannot answer
what was believed last month. Snapshots simplify trends but add storage and can
be misaggregated across time.

Many useful systems retain more than one representation: an event history as
evidence, a current-state projection for simple reads, and selected snapshots for
common historical analysis. These are related products with different grains,
not interchangeable copies.

### Time has several meanings

Time is part of a fact's meaning, not merely a column used for partitioning. Four
times commonly diverge:

- event time is when something happened in the world;
- ingestion time is when the analytical system received its record;
- processing time is when a computation handled it;
- valid time is the interval during which a value was true in the world.

An order placed on Monday may reach the warehouse on Wednesday and be processed
on Thursday. A corrected address entered on Friday may be valid from the previous
month. Calling every timestamp `created_at` hides distinctions that determine
freshness, incrementality, and historical truth.

Some questions need a second historical axis: when did the system know a fact?
Valid time answers what was true on a date. System time answers what the database
believed on a date. Keeping both permits bitemporal questions such as, "What did
we report at month end using the information available then?" and, "What is our
corrected view of that same month now?"

Bitemporal models cost more to store and query. Use them where corrections,
auditability, or restatement matter. Elsewhere, a clear valid interval and an
update timestamp may be sufficient. The essential discipline is to say which
history is preserved and which is intentionally lost.

### Model business processes, not source applications

Source boundaries reflect how software and teams were organized. Analytical
questions often cross them. A sale may involve acquisition, ordering, payment,
fulfilment, delivery, and support systems. Mirroring each application faithfully
does not by itself create a coherent view of the sale.

Start with business processes and their measurable events. For each process,
identify its grain, measures, and descriptive dimensions. A simple matrix of
processes against shared dimensions—date, customer, product, location, channel—
reveals where definitions and identities must conform.

Conformed dimensions allow facts from different processes to be compared using
the same categories. They do not require every process to expose every attribute,
nor do they erase legitimate local meaning. They define the shared portion and
make differences explicit.

Domain boundaries remain useful for ownership and vocabulary. The aim is not one
enterprise model designed in advance. It is a connected set of models whose
interfaces allow important processes to reconcile.

### Master data and reference data

Master data identifies enduring business entities such as customers, products,
suppliers, and locations. Reference data supplies controlled classifications such
as currencies, country codes, status types, or accounting periods. Both stabilize
meaning across processes.

An analytical platform is rarely the sole creator of master data, but it often
has to reconcile several versions. Declare which system is authoritative for
each attribute, how conflicts are resolved, and who stewards the mapping. A
"golden record" without provenance conceals uncertainty rather than eliminating
it.

Reference values change too. Countries are renamed, product taxonomies evolve,
and organizational hierarchies are reorganized. Version reference data when past
reports must retain past classifications. Apply the current taxonomy only when
the analytical question genuinely asks for a restated history.

### Layers are responsibilities, not colours

Many platforms describe bronze, silver, and gold layers. The names matter less
than the responsibilities:

- source-aligned data preserves what arrived and supports investigation;
- conformed entity models reconcile identifiers, types, and shared definitions;
- consumer-facing models encode calculations and present stable interfaces.

The boundaries should reduce coupling. A source change can be absorbed before it
reaches consumers, and a reporting change need not rewrite ingestion. But layers
are not a reason to create a thin chain of models where each step merely renames
the previous one. Every boundary should perform a meaningful task or establish a
useful contract.

Entities and calculated views also age differently. A customer or order tends to
be reused widely and deserves a stable core representation. A view created for a
particular decision can remain closer to its consumer. Mixing both into one layer
makes ownership and change harder to reason about.

### One source of truth, many useful views

"Single source of truth" should mean that shared business logic has an
authoritative home. It should not mean that every consumer must use one enormous
table or one report. Different views can serve different tasks while deriving
important definitions from the same governed components.

Keep durable logic close to the data rather than duplicating it in reporting
tools. Otherwise two dashboards can give different answers while appearing to
use the same source. Centralization also makes definitions reviewable, testable,
and available to uses beyond dashboards.

A semantic layer can centralize dimensions, measures, relationships, and access
rules while composing queries dynamically. It is useful when many tools and users
need consistent answers at different grains. It does not remove the need for good
physical models; it is an interface over them.

### Names create a shared language

Names should be obvious, explicit, and consistent. Prefer `customer_id` to a
context-dependent `id`, and full words to local acronyms. Use the same term for
the same concept and different terms for different concepts. Clever brevity is
usually paid for by every future reader.

Write definitions down, including exclusions and edge cases. A field called
active customer is incomplete until its time window, qualifying activity, and
treatment of refunds or test accounts are known.

Own the organization's taxonomy, but borrow standards where they help. Standard
country codes and time-zone identifiers improve interoperability. A standard
that cannot represent a legitimate business distinction should not be allowed to
erase it. Translate at the boundary and retain the richer internal meaning.

### Recognizing model smells

A smell is not proof of a bad model; it is a reason to investigate. Common smells
include:

- nobody can state the grain in one sentence;
- a table mixes entities, events, and aggregates;
- the same business rule appears in many consumer queries;
- joins routinely require `distinct` to repair unexpected multiplication;
- important columns use overloaded flags or unexplained nulls;
- names encode implementation history rather than business meaning;
- a model has many thin dependencies but no meaningful boundary;
- current and historical values coexist without temporal rules;
- a published table has no identifiable owner or consumer;
- every change requires coordinated edits across unrelated products.

Smells guide questions, not automatic rewrites. A broad table may be exactly right
for a stable interface. A duplicated calculation may be appropriate during
exploration. The problem is not deviation from a textbook form; it is accidental
complexity whose trade-off nobody can explain.
## When and how to refresh data

Data at rest becomes useful through a repeatable sequence of transformations.
Think of this sequence as a directed acyclic graph: each asset depends on upstream
assets, and work proceeds in dependency order. The graph is not merely a
scheduler's input. It is the map used to understand impact, failures, ownership,
and freshness.

### The anatomy of an analytical transformation

Most analytical transformations perform a small set of operations: select the
relevant records, clean and standardize values, establish grain, join context,
derive measures, and publish a stable result. Keeping these stages legible makes
review easier than compressing them into a single ingenious expression.

Cleaning is modelling. Choosing how to interpret an empty string, invalid date,
or duplicated event changes meaning. Preserve the raw evidence, make the chosen
rule explicit, and measure how often it is invoked. Flexibility at an input
boundary should not become ambiguity inside the system.

### Think in assets, not only tasks

A task describes work: run this query, execute this script, copy this file. An
asset describes the result consumers care about: a customer model, daily revenue
table, or certified metric. Orchestration needs tasks, but operating the system
from the asset perspective produces better questions.

Is the asset current? Which inputs produced it? Which code and configuration were
used? Was it validated before publication? Which consumers are affected if it is
late? A task can report success while producing an empty or stale table. Asset
health connects execution to usefulness.

Dependencies should describe data requirements rather than incidental execution
order. If two assets can be produced independently, an arbitrary sequence makes
the graph slower and more coupled. If one requires a particular version or
partition of another, that dependency should be explicit.

Partitioned assets add another level. Yesterday's data may be healthy while
today's is missing. Record health and provenance at the smallest operational unit
that can be rebuilt or consumed independently.

### Declarative and imperative transformations

Imperative work specifies the steps to perform. Declarative work specifies the
result or relationship wanted and lets a system choose the execution. SQL is
largely declarative: it says which rows should result rather than how to scan and
join them physically.

Declarative definitions make intent inspectable. A framework can infer lineage,
generate repetitive work, compare desired and actual state, and optimize across
assets. The trade-off is that behavior now depends on the framework's planner and
abstractions. When something fails, engineers must understand both the declared
intent and the generated execution.

Use declarations for stable patterns with meaningful constraints: dependencies,
schemas, tests, schedules, and publication policies. Use imperative code where
the sequence itself carries meaning or where the abstraction would conceal
important behavior. Avoid escaping into custom code merely because a declarative
form requires more precise thinking.

### Idempotency and rebuildability

A refresh is idempotent when running it again with the same inputs produces the
same result. This property turns retries from a special recovery procedure into
a normal operation. It also makes backfills and local reproduction safer.

Hidden mutable state is the enemy of this property. State is sometimes necessary,
but every piece must be stored, observed, and repaired. Prefer transformations
whose output can be derived from declared inputs. When state is unavoidable,
define its ownership and recovery procedure.

Rebuildability is the broader goal. A system should be able to reproduce a past
or current result from known code, inputs, configuration, and time assumptions.
That requires versioning more than transformation code: reference data, business
rules, and relevant source snapshots may matter too.

### Schedules are promises

A refresh schedule is a promise to consumers. If data is reliably ready at 08:00,
people will organize work around it. An ambitious schedule that often slips is
less useful than a modest one that can be trusted.

Define freshness from the consumer's perspective. A pipeline can finish on time
while its source is a day behind. Record both when data was observed and the
business period it covers, and state which one the service expectation concerns.

Orchestration should encode dependencies, retries, timeouts, and notifications.
It should also make failure policy explicit. Some failures should stop downstream
publication; others can serve the last known good version with a visible warning.

Blue-green publication builds a new version away from consumers, validates it,
and switches readers only when it is ready. This prevents half-refreshed graphs.
Deferral follows a related principle during development: unchanged dependencies
can refer to trusted production assets while only the changed portion is built.
Both patterns separate construction from publication.

### Know your sources

Source systems were usually designed to run operations, not preserve analytical
meaning. Learn who owns each source, how records are created and corrected, which
timestamps can change, and whether deletion is represented. A schema is only the
visible part of the contract.

Source drift can be technical or semantic. A column can change type, but a team
can also change how it fills the same column. Ad hoc spreadsheets are especially
prone to renamed tabs, reformatted dates, and new categories. Be liberal about
superficial variations that can be normalized safely and strict about ambiguity
that could change meaning.

Validate prospective changes before synchronization when possible. A dry run in
a proposed change can compare schemas, row counts, accepted values, and sample
outputs before production is affected.

### Know your consumers

Every published asset can become a dependency, even when labelled temporary.
Expose a conservative, intentional surface and keep intermediate models private.
Before changing a public asset, identify its consumers and distinguish compatible
extensions from breaking changes.

A data contract captures this boundary: grain, fields, types, semantics,
freshness, quality expectations, ownership, and change policy. Contracts need not
begin as machinery. A concise documented agreement that teams actually maintain
is more valuable than an elaborate specification nobody trusts.

### Incrementality is a trade-off

Incremental processing reduces time and cost by updating only affected data. It
also introduces state: the system must know what has already been processed and
what can still change. Use it when full rebuilding is measurably impractical, not
as an automatic mark of maturity.

A robust incremental model answers several questions. What identifies a record?
Can records arrive late or be corrected? How far back can changes occur? What
happens when the schema changes? How is a complete rebuild performed?

Time-based incrementality requires a boundary, and that boundary censors the
world: records arriving before or after it may be missed or counted twice. An
overlapping lookback window plus idempotent merging is often safer than assuming
arrival is perfectly ordered. Periodic full reconciliation can detect errors
that daily increments conceal.

Streaming changes latency, not the underlying obligations. Events still need
identity, ordering rules, deduplication, schemas, and observable failures. Choose
streaming when the value of a faster decision justifies continuously operating a
more stateful system.

### Late data, corrections, and watermarks

Event time and arrival time rarely align perfectly. Mobile devices reconnect,
partners resend files, operational records are corrected, and clocks disagree.
A refresh policy must say how long it waits for late data and when a period is
considered complete.

A watermark is the system's claim that events before a point in event time are
unlikely to arrive. It is an operational boundary, not a law of nature. A strict
watermark produces timely results but excludes more late facts. A generous one
improves completeness but delays publication or repeatedly changes recent totals.

Different products can make different choices. An operational dashboard may show
provisional data within minutes. A financial report may wait, reconcile, and then
close a period. Label provisional and closed states explicitly, and define whether
late corrections restate the past or appear as adjustments in the current period.

### Backfills and replay

A backfill recomputes a historical range after code, reference data, or source
records change. Replay rebuilds state from an event history. Both test whether the
system is truly derived from declared inputs rather than hidden state.

Before a backfill, establish its range, source availability, code version,
publication method, and downstream impact. A transformation that is correct for
new data may not be valid for old schemas or definitions. Historical reference
data may also have changed.

Build the replacement away from consumers when possible. Compare counts, key
distributions, and important metrics with the published version. Explain expected
differences, switch atomically, and retain enough provenance to reverse or
investigate the change.

Backfills can trigger downstream work many times larger than the initial repair.
Impact analysis should distinguish assets that must be recomputed from those whose
meaning is unaffected. A bounded correction is safer than reflexively replaying
the whole graph.

### Schema evolution

Schemas change as sources and products evolve. Adding an optional field is often
compatible. Removing or renaming a field, changing its type, grain, or meaning is
usually breaking even if a query still runs.

Separate structural compatibility from semantic compatibility. A numeric column
can retain its type while changing from gross to net revenue. Conversely, a wider
numeric type may be structurally different but semantically harmless. Tests and
contracts need to cover both.

For a breaking change, publish old and new forms together during a migration,
identify consumers, and set a removal date. When input schemas drift, preserve
the received form and adapt it at a controlled boundary rather than spreading
source-specific exceptions through every downstream model.

### Testing and Trust

Trust is not the belief that data is always correct. It is justified confidence
that important errors will be prevented, detected, explained, and repaired in a
time appropriate to their consequences.

#### Test claims, not implementation details

Every model makes claims. A key is unique. A foreign key has a known parent. An
amount is non-negative. A daily partition is complete. A business rule produces
a known result for a representative case. Tests should encode these claims at the
closest useful boundary.

Useful test families include:

- structural tests for types, required fields, uniqueness, and relationships;
- domain tests for accepted ranges, states, and business invariants;
- reconciliation tests against sources or independent totals;
- freshness and volume tests for operational change;
- scenario tests for tricky business logic and boundary conditions.

Not every anomaly is a failure. Weekend volume may be lower; a new country code
may be legitimate. Tests should have an owner and a response. An alert that is
routinely ignored is not protection—it is evidence that the threshold or process
needs repair.

#### Put controls at boundaries

Validate data when it enters the platform, when its meaning changes, and before a
high-consequence product is published. This localizes failures. Testing only the
final dashboard makes it difficult to tell whether the source, transformation,
or presentation is responsible.

Changes deserve tests before and after deployment. A representative preview can
compare row counts, distributions, key metrics, and schema with the current
version. The aim is not to prove that nothing changes, but to make intended and
unintended changes distinguishable.

#### Observability completes testing

Tests evaluate expected conditions. Observability helps investigate what was not
anticipated. Record run duration, freshness, row counts, rejected records,
lineage, and the code version that produced each asset. Logs and alerts are most
useful when they point to an owner and show which consumers are affected.

When an incident occurs, communicate impact and freshness plainly, restore a safe
service, and then learn from the failure. A review should improve the system—by
adding a control, clarifying ownership, or reducing coupling—not merely identify
the person nearest the mistake.

#### Trust also requires restraint

Correct data can still cause harm when it is exposed too broadly or interpreted
outside its purpose. Access should follow need, sensitive fields should be
minimized, and retention should be intentional. Privacy and security are data
quality properties because an unsafe product is not a good product.
## Reporting clearly and confidently

A report is an interface between a model of the business and a decision. Its job
is not to display all available data. It should establish context, direct
attention, and make the next useful question easier to ask.

### What makes a good metric

A metric needs a clear name, purpose, formula, grain, dimensions, time basis,
owner, and caveats. It should behave predictably as new data arrives. A report for
last January should not change in March merely because the refresh ran later,
unless the business allows late corrections and labels them accordingly.

That property can be called refresh-time invariance: the metric depends on its
defined business inputs, not accidentally on the clock of the computation. Avoid
implicit filters such as "before now" when the intended reporting cutoff can be
passed explicitly.

Metrics should connect to action. Input metrics describe levers a team can move;
output metrics describe desired results. Both matter. Output alone arrives too
late to guide action, while input alone can reward activity that produces no
value.

### Counting begins with identity

Counting looks objective because the operation is simple. The difficult part is
defining what constitutes one. `COUNT(*)` counts rows. `COUNT(DISTINCT account_id)`
counts account identifiers. Neither necessarily counts people, households,
customers, or active relationships.

A meaningful count specifies its entity, identity rule, scope, and time window.
"Monthly active users" is incomplete until user identity, qualifying activity,
calendar boundaries, time zone, bots, employees, deleted accounts, and late
events are addressed. These choices should be part of the metric, not tribal
knowledge surrounding its implementation.

Distinct counts are not additive. Daily unique users cannot be summed to obtain
monthly unique users because one person can appear on several days. Either count
again from the lower-grain identity data or use a representation designed to
merge sets with a known accuracy trade-off.

### Aggregation is controlled information loss

Aggregation changes many observations into fewer summaries. A transaction becomes
a daily product total; daily totals become a monthly category total. Each step
creates a new grain and discards detail. The result is a new analytical object
with its own identity and rules.

Make every grain change explicit. A join can change grain just as surely as a
`group by`. If an order is joined to three promotion records, aggregating afterward
does not automatically restore the original meaning. The model needs a rule for
allocation, precedence, or intentional overlap.

Disjoint groups reconcile cleanly because each observation belongs to exactly
one group. Overlapping groups can be useful—a customer may belong to several
behavioral segments—but their subtotals must not be presented as parts of one
additive whole. Show the overlap or provide a residual rather than forcing a
false decomposition.

Ratios and averages deserve special care. Preserve the numerator, denominator,
and weighting basis so the metric can be recomputed at a new grain. Averaging
displayed averages gives each group equal weight whether it contains ten records
or ten million.

### Decompose before you decorate

A top-level measure becomes useful when it can be decomposed. Revenue might be
expressed through customers, purchase frequency, and order value. A metric tree
makes these relationships explicit and separates genuine drivers from convenient
cuts of the data.

Move between three levels:

- macro: the overall outcome and long-term direction;
- meso: segments, processes, or components that explain movement;
- micro: records and events used to investigate a particular cause.

The levels should reconcile. A mutually exclusive and collectively exhaustive
decomposition avoids double counting and unexplained remainder, but real
business categories are not always naturally tidy. When overlap exists, state it
rather than forcing a false partition.

### Tables before charts

A table is often the best first representation because it exposes exact values,
missingness, ordering, and level of detail. Formatting is analytical work:
rounding, units, signs, denominators, and totals can change interpretation.

Charts become valuable when position, shape, or change makes a pattern easier to
see. Choose one because it supports a comparison, not because a dashboard has an
empty space. A clear table is better than a chart that conceals scale or grain.

### Persisted logic and query-time semantics

Business meaning can be computed before a question is asked or assembled at query
time. Persisted transformations materialize a result at a chosen grain. They make
execution predictable, can validate a stable interface before publication, and
work well for expensive or widely reused logic. They consume storage and must be
refreshed when definitions change.

A semantic layer composes governed measures, dimensions, relationships, and
access rules when a consumer asks a question. It allows many combinations without
materializing every possible table and can expose the same definitions to reports,
notebooks, applications, and agents.

The boundary should follow stability and cost. Stable entity reconciliation,
complex cleaning, and expensive shared calculations generally belong in persisted
models. Flexible slicing and metric composition often belong at query time. Some
logic may be defined semantically and accelerated through transparent caches or
pre-aggregations.

A semantic layer is another production system, not a substitute for modelling.
Generated queries can be incorrect or slow. Dialects and engines behave
differently. Caches become stale. Access rules and joins need testing. Definitions
need owners, versions, and deprecation. Centralizing logic reduces duplication but
also concentrates operational consequence.

### Metrics as maintained interfaces

A metric definition should be versioned and reviewed like any other public
interface. The implementation may be SQL, a declarative specification, or code;
the enduring artifact is the contract: meaning, grain, allowed dimensions,
temporal behavior, owner, and change history.

Machine-readable definitions enable validation and reuse. A system can prevent a
non-additive measure from being summed, constrain invalid joins, expose lineage,
and generate consistent queries for several presentation tools. Human-readable
explanation remains necessary because syntax cannot capture purpose or every
misuse.

Not every calculation belongs in the central metric set. Promote metrics that
are reused, consequential, or needed for reconciliation. Allow local exploratory
measures to exist without presenting them as certified company definitions.

### Scope through feedback

Begin with the decision, audience, cadence, and consequence of being wrong. Then
ship the smallest version that can collect real feedback. Early delivery is not
an excuse to ignore definitions; it is a way to discover which definitions and
breakdowns actually matter before overbuilding.

Define self-service for the organization. It might mean that anyone can explore
certified dimensions and metrics, that analysts can build new governed models,
or simply that common questions have documented answers. Self-service without
boundaries transfers hidden engineering work to consumers.

Natural-language and agentic query systems do not remove the semantic problem.
They make clear metadata, constrained interfaces, representative examples, and
auditable query execution more important. An agent can produce SQL quickly; it
cannot infer an organization's unstated meaning reliably.

### A correctness boundary for agents

An agent needs context at several levels. Schema metadata tells it what fields
exist. Semantic metadata explains entities, metrics, grains, valid relationships,
and time rules. Operational metadata exposes freshness and quality. Decision
context explains why the question is being asked and the consequence of error.

Constrain the space of valid queries rather than relying on a longer prompt.
Expose certified products, allowed joins, governed measures, representative
examples, and clear exclusions. Apply the same access controls that govern human
users. Treat retrieved comments and documentation as untrusted inputs when they
can influence executable queries.

Make the answer auditable. Retain the interpreted question, selected definitions,
generated query, source versions, freshness, and result. An explanation that
cannot be traced to these artifacts is presentation, not evidence.

Review should scale with consequence. Exploration can tolerate an explicitly
labelled uncertain answer. A decision affecting customers, money, safety, or legal
obligations requires stronger validation and often human approval. Feedback from
accepted and rejected answers should improve the governed context rather than
remain private to one conversation.

### Documentation and Discovery

Documentation reduces the distance between finding data and using it correctly.
It should answer practical questions: What does this represent? At what grain?
Where did it come from? How fresh is it? Who owns it? May I rely on it?

#### Documentation is part of the interface

Place definitions near the thing they describe and version them with changes.
Document tables and important fields, but also document relationships,
assumptions, exclusions, freshness, and examples. A generated column list is an
inventory, not an explanation.

Good documentation includes negative knowledge. State what a dataset should not
be used for, where coverage begins, which records are excluded, and which apparent
comparisons are invalid. These warnings often prevent more harm than another
paragraph describing the happy path.

#### Make the trustworthy path the easy path

Discovery is more than search. People need signals of ownership, certification,
usage, freshness, and deprecation. A small curated surface with strong descriptions
is easier to navigate than a catalogue containing every intermediate table.

Examples are executable explanations. A short query showing a correct join or
time filter conveys details that prose may miss. Keep examples tested when
possible so they do not decay as schemas change.

Machine-readable metadata matters alongside prose. Lineage, keys, metric
definitions, and ownership allow catalogues and agents to guide users. Agent
instruction files can explain local conventions and safe workflows, but they
should point to the same maintained contracts humans use rather than create a
second source of truth.

#### Deprecation is a feature

An interface that can only grow will eventually become incomprehensible. Mark
replacements, identify consumers, provide a migration period, and then remove old
assets. Clear deprecation makes the supported surface more trustworthy.

### Enduring principles

The details of an analytics stack are temporary. The core obligations are stable:

- model business meaning at an explicit grain;
- centralize shared logic while allowing purposeful views;
- make transformations reproducible and safe to retry;
- publish small, intentional interfaces and manage their change;
- test the claims that matter and observe the unexpected;
- define metrics so they reconcile with decisions and with time;
- document ownership, limitations, and examples;
- match reliability, latency, and cost to actual consequence;
- treat feedback from consumers as part of system design.

Analytics engineering turns organizational knowledge into durable products
through explicit meaning, repeatable work, and responsible stewardship.
