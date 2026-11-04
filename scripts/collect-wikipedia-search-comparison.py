#!/usr/bin/env python3

import argparse
import concurrent.futures
import datetime as dt
import json
import threading
import time
import urllib.error
import urllib.parse
import urllib.request


NQ_URL = (
    "https://raw.githubusercontent.com/google-research-datasets/"
    "natural-questions/master/nq_open/NQ-open.dev.jsonl"
)
OURS_URL = "https://wikipedia-web-cfscc6ofha-uc.a.run.app/api/search"
WIKIPEDIA_URL = "https://en.wikipedia.org/w/rest.php/v1/search/page"
USER_AGENT = "wikipedia-turbopuffer-search-comparison/1.0 (maxhalford25@gmail.com)"


class RequestGate:
    def __init__(self, interval):
        self.interval = interval
        self.lock = threading.Lock()
        self.next_request = 0.0

    def wait(self):
        with self.lock:
            now = time.monotonic()
            delay = max(0.0, self.next_request - now)
            self.next_request = max(now, self.next_request) + self.interval
        time.sleep(delay)


WIKIPEDIA_GATE = RequestGate(0.35)


def get_json(url, attempts=8, gate=None):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(attempts):
        if gate:
            gate.wait()
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if attempt == attempts - 1:
                raise
            retry_after = error.headers.get("Retry-After")
            time.sleep(float(retry_after) if retry_after else min(60, 2**attempt))
        except Exception:
            if attempt == attempts - 1:
                raise
            time.sleep(min(60, 2**attempt))


def get_queries(limit):
    request = urllib.request.Request(NQ_URL, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return [json.loads(line)["question"] for _, line in zip(range(limit), response)]


def search_wikipedia(query):
    parameters = urllib.parse.urlencode({"q": query, "limit": 10})
    pages = get_json(f"{WIKIPEDIA_URL}?{parameters}", gate=WIKIPEDIA_GATE)["pages"]
    return [
        {
            "id": str(page["id"]),
            "title": page["title"],
            "key": page["key"],
        }
        for page in pages
    ]


def search_ours(query):
    parameters = urllib.parse.urlencode({"q": query, "mode": "keyword"})
    results = get_json(f"{OURS_URL}?{parameters}")["results"][:10]
    return [
        {
            "id": str(result["id"]),
            "title": result["title"],
            "key": urllib.parse.unquote(result["url"].split("/wiki/", 1)[1]),
        }
        for result in results
    ]


def compare(item):
    index, query = item
    ours = search_ours(query)
    wikipedia = search_wikipedia(query)
    ours_ids = [page["id"] for page in ours]
    wikipedia_ids = [page["id"] for page in wikipedia]
    shared = set(ours_ids) & set(wikipedia_ids)
    return {
        "index": index,
        "query": query,
        "overlap": len(shared),
        "top1": bool(ours_ids and wikipedia_ids and ours_ids[0] == wikipedia_ids[0]),
        "ours": ours,
        "wikipedia": wikipedia,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=500)
    parser.add_argument("--workers", type=int, default=5)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    queries = get_queries(args.limit)
    comparisons = [None] * len(queries)
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = [executor.submit(compare, item) for item in enumerate(queries)]
        for completed, future in enumerate(concurrent.futures.as_completed(futures), 1):
            comparison = future.result()
            comparisons[comparison["index"]] = comparison
            if completed % 25 == 0 or completed == len(queries):
                print(f"Compared {completed}/{len(queries)} queries", flush=True)

    output = {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "ours_mode": "keyword",
        "queries": comparisons,
    }
    with open(args.output, "w", encoding="utf-8") as file:
        json.dump(output, file, ensure_ascii=False, separators=(",", ":"))
        file.write("\n")


if __name__ == "__main__":
    main()
