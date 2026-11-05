+++
date = "2026-11-04"
title = "Indexing Wikipedia on turbopuffer"
description = "A Redpanda Connect pipeline keeps English Wikipedia indexed in turbopuffer for keyword, semantic, and hybrid search."
tags = ['data-eng', 'nlp']
images = ["/img/blog/wikipedia-on-turbopuffer/search-tuscany.png"]
toc = true
+++

*TLDR: I use Redpanda Connect to keep 7.26M English Wikipedia articles indexed in turbopuffer for keyword, semantic, and hybrid search. The pipeline targets a 30s p95 ingestion SLO and costs roughly $60/month, including embedding inference. Demo [here](https://wikipedia-web-559056160005.us-central1.run.app/).*

Today is "h4x day" at [turbopuffer](https://turbopuffer.com/). It's basically a 24-hour hackathon fueled by good food, electrolytes, and high beats per second music. Everyone picks a project, ideally something they would not have tackled in their regular work stream. It's very energizing. I'm grateful to be surrounded by so many smart and thoughtful people. I feel clumsy around my new colleagues.

The ingestion aspect of a search engine has piqued my interest. turbopuffer is only 3 years old, so its scope is intentionally limited. We "only" handle the hardcore write/storage/query database stuff. Whatever has to happen before writing the data into turbopuffer is out of scope, so far. We basically tell people to write a script and orchestrate it themselves. But this part can be a maintenance nightmare. Judging by the success of companies that solve ingestion (e.g. [Fivetran](https://www.fivetran.com/) and [Airbyte](https://airbyte.com/)), it is a problem worth addressing.

## Why Wikipedia?

I thought it would be educational to hack in this direction. A nice use case is Wikipedia. Let's say you have an app/agent that wants to search over it. You could index one of their [dumps](https://dumps.wikimedia.org/) whenever a new one is published. But that's not good enough, because the data will be stale -- e.g. *who won the midterm elections?*. This is the same reason why you don't want agents to answer some questions via whatever they internalized at training time. You want a search index that is in sync with the current content.

There are companies that cater to searching over the internet for agents (e.g. [Exa](https://exa.ai/), [Tavily](https://www.tavily.com/), [Firecrawl](https://www.firecrawl.dev/)). Google Search is excellent at sending a human to a relevant webpage. An agent needs a different interface: a stable API, clean extracted text, useful metadata, and enough provenance to cite its sources. A page of blue links is only half the job. These companies bundle search, crawling, and extraction into something an agent can consume directly.

Wikipedia provides its own [search API](https://en.wikipedia.org/w/rest.php/v1/search/page?q=Nelson%20Mandela&limit=10). Their search is powered by [OpenSearch](https://opensearch.org/) and kept up to date by a [Flink streaming updater](https://wikitech.wikimedia.org/wiki/Search/CirrusStreamingUpdater).

There's also a [live feed](https://wikitech.wikimedia.org/wiki/Event_Platform/EventStreams_HTTP_Service) of public changes across Wikimedia projects. That gives me everything I need to build a smaller version.

For the sake of simplicity, I've limited myself to English Wikipedia: roughly 7.26M articles and 5k edits/hour by my estimate. These are small numbers. I'm convinced a reduced version can be run cheaply.

## Building the search index

### Picking an ingestion tool

I think Flink is too complex for my ingestion part. Wikimedia's production updater merges several Kafka streams, deduplicates events, handles rerenders and backfills, and writes to multiple search clusters. It has genuine stateful work to do. My reduced prototype boils down to moving data from a source (SSE events) to a sink (turbopuffer), with very little business logic in the middle.

I considered [Airbyte](https://airbyte.com/) and [Fivetran](https://www.fivetran.com/), but their usual abstraction is a scheduled sync. Here I wanted a process that keeps Wikimedia's event stream open.

I went with [Redpanda Connect](https://docs.redpanda.com/connect/home/), which is built on top of [Benthos](https://github.com/redpanda-data/benthos). Despite the name, Redpanda Connect does not require a [Redpanda](https://www.redpanda.com/) cluster. It is a lightweight stream processor where pipelines are described as an input, a sequence of processors, and an output. The input reads messages, the processors transform them, and the output delivers them somewhere. A Unix pipe for data systems, basically.

Why not write a regular Go/Python script? Indeed, the happy path would be straightforward. The annoying part is everything around it: reconnecting to a stream, retrying HTTP requests, backing off when Wikipedia returns a `429`, limiting concurrency, batching writes, applying backpressure, exposing health checks, and flushing the current batch during a graceful shutdown. Redpanda Connect already handles these details. The pipeline itself boils down to YAML. This is part of the category of software you don't want your coding agent to reimplement.

There was no turbopuffer output, so I built one and [proposed contributing it upstream](https://github.com/redpanda-data/connect/issues/5147). In Redpanda Connect terminology, an output is the connector for a destination. The [`output/turbopuffer.go`](https://github.com/MaxHalford/wikipedia-turbopuffer/blob/main/output/turbopuffer.go) file is that connector, not a separate script. It defines the `turbopuffer` YAML block, receives batches of JSON documents, and turns them into turbopuffer [`upsert_rows` requests](https://turbopuffer.com/docs/write#param-upsert_rows). It also tells Redpanda Connect how many requests may run concurrently and returns failed writes to the runtime so they can be retried. If the same Wikipedia page occurs more than once in a batch, the latest version wins.

The connector is generic -- it is not tied to Wikipedia -- so any Redpanda Connect pipeline can use it. The complete prototype lives in a [public repository](https://github.com/MaxHalford/wikipedia-turbopuffer). For now the connector lives there rather than in Redpanda Connect's built-in component catalogue.

### Indexing Wikipedia online

The long-running system has two write paths and one read path:

```text
Live updates:
Wikipedia event stream -> batch changes -> fetch Cirrus documents -> turbopuffer

Reconciliation (after gaps):
MediaWiki recent changes -> fetch current pages -> turbopuffer watermark

Search:
Browser -> small Go web app -> turbopuffer (BM25 + native embeddings)
```

Every article write produces the same document:

```json
{
  "id": "45371",
  "title": "Toulouse",
  "text": "Toulouse is the prefecture of...",
  "embedding_text": "Toulouse\n\nToulouse is the prefecture of...",
  "url": "https://en.wikipedia.org/wiki/Toulouse",
  "revision_id": 1383749154,
  "updated_at": "2026-11-04T16:27:07Z"
}
```

The Wikipedia page ID becomes the turbopuffer document ID. Retrying a page therefore replaces the same row instead of creating a duplicate. In data engineering jargon, the write is *idempotent*.

The `title` and complete article `text` are indexed for [BM25](https://turbopuffer.com/docs/query#full-text-search) and highlighting. A separate `embedding_text` attribute contains the title and the article's lead section. Every ingestion path writes through the same [native embedding](https://turbopuffer.com/docs/embedding) schema:

```yaml
output:
  turbopuffer:
    distance_metric: cosine_distance
    schema:
      embedding_text:
        type: string
        embed:
          model: nvidia/nemotron-3.5-embed-1b
          dims: 1024
          dtype: f16
```

turbopuffer sends `embedding_text` through [Nemotron 3.5 Embed 1B](https://huggingface.co/nvidia/Nemotron-3.5-Embed-1B-BF16) during each write, stores the resulting vector, and maintains an [ANN index](https://turbopuffer.com/docs/query) over it. Query text goes through the same model at search time.

The fast path listens to Wikimedia's `recentchange` stream. It keeps new pages and edits from the English article namespace, and discards the rest. A change event does not contain the full article, so the ingester groups five seconds of events and fetches their current [CirrusSearch documents](https://www.mediawiki.org/wiki/Extension:CirrusSearch) in one MediaWiki API request. Each document contains both the complete article text and its `opening_text`, so the online path uses the same semantic input as the dump.

Not every edit changes the lead. At the current estimate, re-embedding it costs roughly $9/month, which is not enough to justify maintaining separate diffing state.

Here's the shape of the configuration:

```yaml
input:
  batched:
    child:
      http_client:
        url: https://stream.wikimedia.org/v2/stream/recentchange
        stream:
          enabled: true
          reconnect: true
    policy:
      count: 500
      period: 5s

pipeline:
  processors:
    - mapping: |
        root = if this.wiki == "enwiki" && this.namespace == 0 {
          this
        } else {
          deleted()
        }
    - wikipedia_hydrate:
        api_url: https://en.wikipedia.org/w/api.php

output:
  turbopuffer:
    namespace: wikipedia-en-live
    batching:
      count: 100
      period: 1s
```

The stream gives low latency, but it is not the source of truth. After an interruption, I run a reconciliation pass against MediaWiki's [`recentchanges` API](https://www.mediawiki.org/wiki/API:RecentChanges/en). Each pass chooses a fixed end time, lists everything that changed since the previous watermark, and fetches the current CirrusSearch document for every affected page. That covers edits which arrived while the SSE connection was down, as well as moves and deletes that the fast path does not handle.

The watermark is another small document stored in turbopuffer. It only advances after the complete window has been reconciled. If the process dies halfway through, it repeats the same window. Repetition is safe because writes and deletes check the Wikipedia revision ID. The stream makes changes visible quickly, whilst reconciliation makes the index converge to Wikipedia's current state.

I gave the prototype a 30-second freshness SLO: 95% of page changes should reach turbopuffer within 30 seconds. At the time of writing, the p95 over the previous hour was 4.80 seconds.

### Bootstrapping from a dump

The online ingester only sees changes that happen after it starts. Starting with it would give me a fresh index containing almost diddly squat. I therefore bootstrap the index from Wikimedia's weekly [CirrusSearch dumps](https://dumps.wikimedia.org/other/cirrus_search_index/).

The snapshot I used is split into 66 compressed shards. A shard is simply one slice of the dump, containing a different subset of Wikipedia pages. Splitting the dump this way means the files can be downloaded and processed in parallel.

I run one Redpanda Connect job per shard on [Cloud Run](https://cloud.google.com/run), with 33 jobs running at once. Each job downloads its shard, decompresses it as a stream, parses one page at a time, and sends batches to turbopuffer. The compressed file sits on local disk, but the decompressed contents never have to fit in memory.

CirrusSearch provides the article's lead section as `opening_text`. I combine it with the title for `embedding_text`, whilst keeping the complete article for full-text search. This matches the semantic input used by the online ingester. The backfill therefore loads the articles and builds their vectors in one pass, without a separate embedding service.

I sampled 50 random English articles to check the effect of using the lead. Their complete text totalled 185KB, versus 22KB for `opening_text`: an 8.3× reduction. Besides reducing inference work, the lead should be better semantic input because it is supposed to summarize the page.

The resulting writes average roughly 122 billed tokens per article. Across 7.26M articles, a clean backfill requires about 884M tokens. At [Nemotron 1B's current price](https://turbopuffer.com/docs/embedding#models) of $0.02 per million tokens, embedding the whole English Wikipedia costs roughly $18.

Before adding embeddings, the same 66-shard dump loaded 7,259,406 articles in 35 minutes and 25 seconds. That's roughly 3,400 articles/second end to end with eight workers.

With native embeddings enabled, 33 workers loaded the same dump in 1 hour, 37 minutes, and 30 seconds. That's roughly 1,240 articles/second end to end.

## Comparing the search results

Wikipedia's regular page-search endpoint goes through [CirrusSearch](https://www.mediawiki.org/wiki/Extension:CirrusSearch) in lexical, full-text mode. I therefore scoped this comparison to turbopuffer's full-text search too.

That does not make Wikipedia's search plain BM25. [CirrusSearch's scoring](https://www.mediawiki.org/wiki/Extension:CirrusSearch/Scoring) gives title and redirect matches special treatment, then rescores results using phrase matches, incoming links, recency, and other page-quality signals. It is a mature lexical ranker.

On the turbopuffer side, BM25 ranks the full title and article text, with the title given twice the weight. This makes the comparison much cleaner: two full-text search engines over the same Wikipedia pages. The rankers are still different, but at least they are solving the same problem.

I used the first 500 questions from the development split of Google's [Natural Questions](https://github.com/google-research-datasets/natural-questions) dataset. They are real queries whose answers were annotated from Wikipedia. For each query, I fetched the top 10 pages from both APIs and counted how many appeared in both lists.

| Metric | Result |
|---|---:|
| Queries | 500 |
| Same result at rank 1 | 131/500 (26.2%) |
| Shared pages in each top 10 | 1.62 on average |
| No shared pages in the top 10 | 167/500 (33.4%) |

The averages hide what the two systems are actually returning. Pick a question below to compare the two top tens. Green rows have the same rank, whilst orange rows appear elsewhere in the other list. Hover over either one to find its match.

<link rel="stylesheet" href="/css/wikipedia-search-explorer.css">
<div class="search-explorer" id="search-comparison-explorer" data-source="/data/blog/wikipedia-on-turbopuffer/search-comparison.json">
  <div class="search-explorer__controls">
    <div class="search-explorer__picker">
      <label for="search-comparison-query">Question</label>
      <select id="search-comparison-query" data-query-select></select>
    </div>
    <button type="button" data-random-query>Random</button>
  </div>
  <div class="search-explorer__status" data-status>Loading the comparisons…</div>
  <div class="search-explorer__summary" data-summary aria-live="polite"></div>
  <div class="search-explorer__rankings" data-rankings aria-live="polite">
  </div>
</div>
<script src="/js/wikipedia-search-explorer.js" defer></script>

The low overlap does not tell us which system is better. Wikipedia's ranker is a useful reference, not ground truth. A proper evaluation would need relevance judgements for each result. This experiment only says that the two rankers disagree substantially.

In terms of final output, I made a simple search [frontend](https://wikipedia-web-559056160005.us-central1.run.app/):

<div align="center">
<figure style="width: 100%; margin: 2rem 0;">
    <img src="/img/blog/wikipedia-on-turbopuffer/search-tuscany.png" alt="The Wikipedia on turbopuffer frontend showing search results for Tuscany and p95 ingestion latency below five seconds." style="border: 1px solid #cbd5e1; border-radius: 10px; box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);">
    <figcaption><i>Searching 7.3M English Wikipedia articles, with p95 ingestion latency below the 30-second SLO.</i></figcaption>
</figure>
</div>

## What does it cost?

The [turbopuffer Launch plan](https://turbopuffer.com/pricing) starts at $16/month. The always-on Cloud Run ingester uses one vCPU and 512MiB in `us-central1`, billed at the [published Cloud Run rates](https://cloud.google.com/run/pricing). At 5k changes/hour and roughly 122 tokens per lead, the back-of-the-envelope calculation is:

```text
turbopuffer Launch plan                        $16.00
Cloud Run CPU             730h × $0.04536      $33.11
Cloud Run memory          730h × $0.00252       $1.84
Embedding writes          ~445M tokens          $8.90
                                                -----
                                         $59.85/month
```

Call it ~$60/month. This assumes the turbopuffer workload stays below the Launch plan's $16 minimum and excludes the one-off backfill. The lightly used search frontend costs almost nothing. Query embeddings depend on search traffic, so I have left them out too.

That's it! Admittedly, my coding agent did most of the heavy lifting. I still found the architectural choices interesting, especially picking an ingestion tool and making the live index converge after failures.
