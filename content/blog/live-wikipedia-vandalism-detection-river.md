+++
date = "2026-06-17"
title = "Live Wikipedia vandalism detection with online machine learning"
tags = ['online-machine-learning', 'river', 'streaming', 'wikipedia']
draft = true
+++

Roughly 6.7% of edits on Wikipedia get reverted. Wikimedia runs a production
ML service called [Lift Wing](https://api.wikimedia.org/wiki/Lift_Wing_API/Reference)
that scores every edit for "revert risk" -- it's the successor to
[ORES](https://wikitech.wikimedia.org/wiki/ORES), which was decommissioned in
early 2024. Anti-vandalism bots like [ClueBot NG](https://en.wikipedia.org/wiki/User:ClueBot_NG)
use signals like this to auto-revert obvious damage.

This is a tidy problem for online learning. The patterns of vandalism drift
over time (new memes, new geopolitical events, new schools letting out). The
labels are delayed -- you only learn an edit was vandalism when someone reverts
it. And edits arrive forever, as a stream you can subscribe to over SSE. So I
wired up a small demo that consumes that stream live, runs three models in
parallel -- one online, one batch-retrained daily, one is Wikimedia's own
production model -- and shows what's happening on a dashboard.

- **Repo**: [github.com/MaxHalford/river-vandalism-demo](https://github.com/MaxHalford/river-vandalism-demo) <!-- TODO: confirm URL -->
- **Live demo**: [river-vandalism.up.railway.app](https://river-vandalism.up.railway.app) <!-- TODO: replace with real URL once deployed -->

The point is not to ship a better vandalism detector than Wikimedia. They have
a [multilingual transformer](https://arxiv.org/abs/2306.01650) that beats this
on accuracy. The point is to show what online learning on a real stream
actually feels like -- the features that fall out of the streaming setting,
the way labels arrive, the comparison against batch.

## Architecture

```
recentchange SSE ─┐
                  ├─► ingest ─► event_queue ─► ml ─► edits ─► dashboard
tags-change SSE ──┘   (postgres)              │     (postgres)
                                              ├─ River online learner
                                              ├─ scikit-learn batch (daily)
                                              └─ Lift Wing API client
```

Three application services plus Postgres.

- **`ingest`** subscribes to two Wikimedia SSE streams (`recentchange` and
  `mediawiki.revision-tags-change`), filters to the configured wikis +
  namespace, and inserts them into a Postgres `event_queue` table. Wikimedia's
  [User-Agent policy](https://meta.wikimedia.org/wiki/User-Agent_policy) is
  strict -- forgetting it gives you a 403.
- **`ml`** drains the queue with `SELECT ... FOR UPDATE SKIP LOCKED`,
  extracts features, runs all three models, and writes results to the
  `edits` table. When a `mw-reverted` tag arrives, the edit gets label=1;
  if no revert tag arrives within 48 hours, label=0. This is Wikimedia
  Research's [convention](https://meta.wikimedia.org/wiki/Research:Revert).
- **`dashboard`** is FastAPI + [Perspective](https://perspective.finos.org/),
  pushing updates to the browser over a WebSocket.

A Postgres table with `SKIP LOCKED` is genuinely the right queue at this
volume. Wikipedia's `recentchange` stream emits ~10 events/sec across all the
filters we apply, which a single Postgres instance handles with the queue
table churning under a thousand rows at steady state. The same `ingest` and
`ml` services can run unchanged in front of Kafka or Redpanda if you ever
need horizontal fan-out -- the queue interface is two functions
(`enqueue_events`, `drain_events`) in [`store.py`](https://github.com/MaxHalford/river-vandalism-demo/blob/main/src/common/store.py).

## The interesting features

Most published vandalism detectors lean on diff content -- ratio of caps,
profanity, repeated characters. We don't have that here: the `recentchange`
event tells us the edit happened and how many bytes changed, but not what
changed. (You can fetch the diff via the MediaWiki API, but that's a separate
round trip per edit.) Instead, this demo leans hard on **stateful streaming
features** that fall out of the stream itself:

- per-user: edits in the last hour and day, seconds since last edit, recent
  revert rate as an exponential moving average
- per-page: edits in the last hour, distinct editors in the last hour, recent
  revert rate
- per-(user, page): has this user edited this page before, how many times in
  the last hour

These are awkward to compute in batch -- you need point-in-time joins to
avoid leaking future information into the past. In a streaming setting they
are dictionaries of deques, updated in O(1) on every event. The whole feature
extractor [is one file](https://github.com/MaxHalford/river-vandalism-demo/blob/main/src/common/features.py).

The same feature dict feeds all three models, so the comparison is apples to
apples on features -- only the model differs.

## The three models

**River online** is a logistic regression with `StandardScaler`:

```python
from river import compose, linear_model, optim, preprocessing

model = (
    compose.Select(*NUMERIC_FEATURES)
    | preprocessing.StandardScaler()
    | linear_model.LogisticRegression(optimizer=optim.Adam(0.01), l2=1e-4)
)
```

`learn_one(x, y)` runs once per labeled edit. The standard scaler maintains
running mean and variance per feature, so we don't need to normalize ahead of
time.

**Batch** is LightGBM, retrained once a day on the last 7 days of labeled
edits, with 3-fold CV. Pickled into Postgres so the ml service can hot-swap
without restarting.

**Lift Wing** is one HTTP call per edit to Wikimedia's
`revertrisk-language-agnostic` endpoint. No training -- it's their production
model. It costs us a few hundred milliseconds of latency and a public API.

## Delayed labels

This is where online learning really earns its keep. We make a prediction the
moment the edit arrives, but the label arrives anywhere from a few seconds
(ClueBot NG is fast) to a few hours later -- if at all. Most edits never get
reverted, and we only know that with confidence after some cutoff.

So the ml service has two tasks running in parallel:

```python
async def _tag_worker(tags_q, pool):
    async for ev in tags_q:
        await store.mark_reverted(pool, ev["_rev_id"], now())

async def _negative_sweeper(pool):
    while True:
        await asyncio.sleep(300)
        await store.expire_negatives(pool, ttl_hours=48)
```

When the label finally lands, an `_online_learner` task pulls the labeled
edit and calls `learn_one`. The order of operations matters: we want metrics
to reflect what the model would have shown live, so we always score with the
features we had *at edit time* and stored, not with current state.

## Backtesting and delayed progressive validation

The thing that makes online learning hard to evaluate is the same thing that
makes it work in production: **the order of events matters**. You can't shuffle
the data, can't take a random 20% holdout, can't even split by time naively.
The honest way to evaluate a candidate online model is to replay the *exact*
sequence of `predict` and `learn` events the live system saw, in the order
they arrived, and apply the same label delays. This is what the River authors
call [delayed progressive validation](https://riverml.xyz/0.21.2/recipes/on-delayed-predictions/).

For that to be possible, we have to record two timestamps per edit, not one:

| Column                | Meaning                                                       |
| --------------------- | ------------------------------------------------------------- |
| `edit_ts`             | When the edit happened (from the SSE event).                  |
| `label_available_ts`  | Earliest wall-clock instant we could have known the label.    |

The second one is the subtle bit. For positives it's **the timestamp on the
revert-tag event itself**, not when our system processed it (we might be
hours behind in a backlog). For negatives it's `edit_ts + 48 hours`, not the
wall-clock time at which our negative sweeper ran. Getting this wrong makes
backtests look better than they should.

The replay engine then merges both event types into one chronological stream:

```python
for ts, kind, row in chronological_merge(edits):
    if kind == "predict":
        score = candidate.predict_proba_one(row["features"])
        pending[row["rev_id"]] = score
    else:  # learn
        score = pending.pop(row["rev_id"])
        metric.update(row["label"], score)
        candidate.learn_one(row["features"], row["label"])
```

This is just `scripts/backtest.py` plus a few model factories in
[`src/backtest/candidates.py`](https://github.com/MaxHalford/river-vandalism-demo/blob/main/src/backtest/candidates.py).
You can run it against the deployed instance's history at any time:

```sh
uv run python scripts/backtest.py \
    --since 2026-06-10T00:00:00Z \
    --until 2026-06-17T00:00:00Z \
    --candidates default,arf,sgd,gnb
```

The output is a per-minute rolling-AUC CSV plus a per-prediction CSV, both
suitable for plotting. Crucially, running this with `--candidates default`
should reproduce (very nearly — modulo metric-buffer alignment) the rolling
AUC the live dashboard showed for the online model. If it doesn't, the
backtest has a bug.

This is also what unlocks the autoresearch loop in the next section.

## Autoresearch

The dashboard has a panel I haven't mentioned yet: a list of model candidates
proposed by an LLM, with their backtest results and whether they were
promoted into production. Once a day, the ml service does this:

1. Snapshots the current incumbent model code, recent rolling metrics, and a
   handful of "hard examples" — high-confidence misses and false alarms.
2. Calls `gpt-5` with a strict contract: return Python code defining
   `make_model()` and optionally `featurize(event, state)`, with a
   `# hypothesis:` comment up top.
3. Runs the returned code through an AST allowlist (rejects anything that
   imports `os`, calls `eval`, touches dunders, etc.).
4. Pickles the last 48h of recorded edits, spawns a subprocess with RLIMITs
   (1 GiB memory, 120s CPU), and replays the candidate through the same
   delayed progressive validation engine.
5. Reruns the incumbent on the *same* event stream so we have aligned
   per-revision predictions.
6. Computes a paired bootstrap on per-prediction log-loss differences.
7. If Δ-AUC > 0.005 *and* p < 0.05, hot-swaps the candidate into the running
   ml service. (The candidate watcher polls a `candidates` table and exec's
   the promoted code into a fresh namespace, after re-validating the AST.)

The threshold is conservative on purpose — we'd rather miss a real
improvement than ship a regression that lives until the next nightly cycle.
The promoted candidate is also a candidate for *demotion*: the next cycle
treats it as the incumbent and can replace it. Drift in either direction is
visible.

```python
# what gpt-5 sees:
# - the incumbent online.py
# - the feature dict keys
# - rolling rocauc/logloss/brier
# - 10 hard examples (full feature vector, score, label)
# - your last 5 proposals and their outcomes (so it doesn't repeat itself)
```

This is intentionally Karpathy-flavored — an autoresearch loop that improves
the live system without humans. It works here because the eval is honest
(delayed progressive validation) and the action space is bounded (River
pipelines).

It is also, very obviously, **a sharp tool**. The combination of "LLM writes
Python" and "Python runs in production" merits the sandbox, the statistical
gate, the human-readable candidate table, and the ability to rip out the
whole feature with a single env var:

```sh
AUTORESEARCH_ENABLED=false
```

The interesting failure modes — overfitting to a 48h window, proposal
degeneration, regressions that pass the gate — are exactly what the
candidate-history view in the dashboard is there to expose.

## What the dashboard shows

<!-- TODO: screenshot -->

The dashboard is one HTML page with two
[`<perspective-viewer>`](https://perspective.finos.org/) components. The top
one is a line chart of rolling ROC-AUC for the three models over the last six
hours; the bottom is a live, sortable table of the last 2,000 edits with
their scores. Both update over WebSocket as new data lands in Postgres.

Perspective is overkill for the volume of data here (a few hundred edits per
minute), but the live update story is fantastic, and you get sortable
columns, filters, and pivots for free.

## Observations from running it for a week

<!-- TODO: fill in after running for a week -->

- Rolling ROC-AUC settles around X for online, Y for batch, Z for Lift Wing.
- Online needs about an hour of label-flow before it starts being useful;
  before that, predictions hover around the base rate.
- The biggest swings in feature importance come from the per-user revert
  rate, which dominates after enough history accumulates.
- A drift event around <date> shifted the distribution of <feature>; the
  online model adjusted within hours, the batch model needed its next nightly
  retrain.

## Honest limits

- **No diff content.** Adding caps-ratio, profanity counts, and link-change
  features would close most of the gap to Lift Wing's older XGBoost model.
- **Limited multilingual.** Setting `WIKI_FILTERS=enwiki,dewiki,frwiki,...`
  works (the ingest filter, the Lift Wing `lang` parameter, and the per-page
  stateful features are all wiki-aware), but the River and batch models
  don't yet include the wiki as a feature, so they share one global weight
  vector across languages. Lift Wing's multilingual transformer covers 47
  languages with proper content features and beats both of ours.
- **Cold start.** The first hour of running this from scratch is mostly
  noise; the stateful features need history.
- **Class imbalance.** Anonymous edits are reverted ~30% of the time;
  registered edits ~5%. Sampling could help the online model.
- **Demo, not infra.** Single Redpanda broker, single Postgres, no schema
  registry, no DLQ. Don't run a bank on this.
- **Throughput.** enwiki actually only emits about 5–10 edits/sec, so the
  default config never breaks a sweat. The architecture is sized for ~1k
  evt/s via three knobs: a `SAMPLE_RATE` at ingest, batched Postgres INSERTs
  in the ml service, and a `LIFTWING_SAMPLE_RATE` to keep the external API
  call rate sane. Past that you'd need to shard the ml consumer.

## Reproduce

```sh
git clone https://github.com/MaxHalford/river-vandalism-demo
cd river-vandalism-demo
cp .env.example .env
docker compose up --build
open http://localhost:8000
```

Deploy steps for Railway are in [`DEPLOY.md`](https://github.com/MaxHalford/river-vandalism-demo/blob/main/DEPLOY.md).

If you find a way to make the online model match Lift Wing without
exfiltrating diff content, please open a PR.
