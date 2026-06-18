+++
date = "2026-02-06"
title = "Text classification with Python 3.14's zstd module"
description = "Python 3.14 added Zstandard to stdlib; its incremental API finally makes classify-by-compression practical."
tags = ['machine-learning', 'text-processing', 'python']
+++

Python 3.14 [introduced](https://docs.python.org/3/whatsnew/3.14.html#whatsnew314-zstandard) the [`compression.zstd`](https://docs.python.org/3/library/compression.zstd.html) module. It is a standard library implementation of Facebook's [Zstandard (Zstd)](https://en.wikipedia.org/wiki/Zstd) compression algorithm. It was developed a decade ago by Yann Collet, who holds a [blog](https://fastcompression.blogspot.com/) devoted to compression algorithms.

I am not a compression expert, but Zstd caught my eye because it supports incremental compression. You can feed it data to compress in chunks, and it will maintain an internal state. It's particularly well [suited](https://facebook.github.io/zstd/) for compressing small data. It's perfect for the classify text via compression trick, which I described in [a previous blog post](/blog/text-classification-by-compression/) 5 years ago.

My previous blog post was based on a suggestion from [Artificial Intelligence: A Modern Approach](https://www.goodreads.com/book/show/27543.Artificial_Intelligence), and is rooted in the idea that compression length approximates [Kolmogorov complexity](https://en.wikipedia.org/wiki/Kolmogorov_complexity). There's a 2023 paper called ["Low-Resource" Text Classification: A Parameter-Free Classification Method with Compressors](https://aclanthology.org/2023.findings-acl.426.pdf) that revisits this approach with encouraging results.

The problem with this approach is practical: popular compression algorithms like gzip and LZW don't support incremental compression. They might algorithmically speaking, but in reality they don't expose an incremental API. So you have to recompress the training data for each test document, which is very expensive. But Zstd does, which changes everything. The fact Python 3.14 added Zstd to its standard library got me excited.

Before delving into the machine learning part, I'll provide a snippet to build some intuition. The main class we're interested in is [`ZstdCompressor`](https://docs.python.org/3/library/compression.zstd.html#compression.zstd.ZstdCompressor). It has a `compress` method that takes a chunk of data and returns the compressed output. The data it compresses is then added to its internal state. You can also provide a `ZstdDict` to the compressor, which is a pre-trained dictionary that gives it a head start.

```py
>>> from compression.zstd import ZstdCompressor, ZstdDict

>>> tacos = b"taco burrito tortilla salsa guacamole cilantro lime " * 50
>>> zd_tacos = ZstdDict(tacos, is_raw=True)
>>> comp_tacos = ZstdCompressor(zstd_dict=zd_tacos)

>>> padel = b"racket court serve volley smash lob match game set " * 50
>>> zd_padel = ZstdDict(padel, is_raw=True)
>>> comp_padel = ZstdCompressor(zstd_dict=zd_padel)

>>> input_text = b"I ordered three tacos with extra guacamole"

>>> len(comp_tacos.compress(input_text, mode=ZstdCompressor.FLUSH_FRAME))
43
>>> len(comp_padel.compress(input_text, mode=ZstdCompressor.FLUSH_FRAME))
51

```

The input text can be classified as "tacos" rather than "padel" because the compressor with the "tacos" dictionary produces a smaller compressed output. This can be turned into a simple classifier by building a compressor for each class, and then classifying a new document by finding the compressor that produces the smallest compressed output for that document.

Note that the `compress` method doesn't only return the compressed output. It also updates the internal state of the compressor. From a machine learning perspective, this means it is corrupting each compressor with data that does not belong to its class. Unfortunately, and there is no public or private method to compress without updating the internal state.

The trick is to rebuild the compressor every time a new labelled document is received. Thankfully, instantiating a `ZstdCompressor` with a `ZstdDict` is very fast -- tens of microseconds in my experiments. This makes it affordable to rebuild the compressor very frequently.

Here are the steps to take to turn this into a learning algorithm:

1. For each class, maintain a buffer of text that belongs to that class.
2. When a new labelled document is received, append it to the buffer of its class.
3. Rebuild the compressor for that class with the updated buffer.
4. To classify a new document, find the compressor that produces the smallest compressed output for that document.

There are several parameters that can be tuned to balance between throughput and correctness:

- Window size: the maximum number of bytes to keep in the buffer for each class. A smaller window means less data to compress, which means faster compressor rebuilding and compression. But it also means less data to learn from, which can hurt accuracy -- or not depending on how much the data drifts.
- Compression level: Zstd has 22 levels of compression, from 1 (fastest) to 22 (slowest). The higher the level, the better the compression ratio and thus the accuracy, but the slower the compression.
- Rebuild frequency: how many new documents to receive for a class before rebuilding its compressor. Rebuilding the compressor is cheap but not free, so you don't necessarily have to rebuild it for every sample. But if you don't do it often enough, the compressor's internal state will be too corrupted and not up to date, which can hurt accuracy.

I picked some sane defaults for these parameters in the implementation below, but they can be tweaked to fit the use case. It's always handy to have some knobs to turn. Anyway, here is the implementation of the `ZstdClassifier` class that implements the learning algorithm described above:

```py
from compression.zstd import ZstdCompressor, ZstdDict

class ZstdClassifier:

    def __init__(
        self,
        window: int = 1 << 20,
        level: int = 3,
        rebuild_every: int = 5
    ):
        self.window = window
        self.level = level
        self.rebuild_every = rebuild_every
        self.buffers: dict[str, bytes] = {}
        self.compressors: dict[str, ZstdCompressor] = {}
        self.since_rebuild: dict[str, int] = {}

    def learn(self, text: bytes, label: str):

        # Simply append the text to the buffer for
        # this label, and drop the oldest bytes if
        # the buffer is full.
        buf = self.buffers.get(label, b"") + text
        if len(buf) > self.window:
            buf = buf[-self.window:]
        self.buffers[label] = buf

        # Delete the compressor for this label, if we
        # have seen enough new data since the last
        # time the compressor was built.
        n = self.since_rebuild.get(label, 0) + 1
        if n >= self.rebuild_every:
            self.compressors.pop(label, None)
            self.since_rebuild[label] = 0
        else:
            self.since_rebuild[label] = n

    def classify(self, text: bytes) -> str | None:

        # Can't classify if we don't have at
        # least two classes to compare.
        if len(self.buffers) < 2:
            return None

        # (Re-)build compressors for all classes.
        for label in self.buffers:
            if label in self.compressors:
                continue
            self.compressors[label] = ZstdCompressor(
                level=self.level,
                zstd_dict=ZstdDict(
                    self.buffers[label],
                    is_raw=True
                )
            )

        # argmin: find the label whose compressor
        # produces the smallest compressed
        # size for the input text.
        best_label = None
        best_size = 0x7FFFFFFF
        mode = ZstdCompressor.FLUSH_FRAME
        for label, comp in self.compressors.items():
            size = len(comp.compress(text, mode))
            if size < best_size:
                best_size = size
                best_label = label
        return best_label
```

I just love how simple this is. There are no matrices, no gradients, no backpropagation. All the learning is delegated to the compression algorithm. The `ZstdClassifier` class is just a thin wrapper around it that feeds it the right data and interprets its output.

Being simple is not enough. Does it learn? Is it accurate? How fast is it? I ran the benchmark script below on the [20 newsgroups](https://scikit-learn.org/stable/datasets/real_world.html#newsgroups-dataset) dataset, similar to what I did in my [previous blog post](/blog/text-classification-by-compression/).

<details>
  <summary>Benchmark script</summary>


```py
import random
import time

from compression.zstd import ZstdCompressor, ZstdDict
from sklearn.datasets import fetch_20newsgroups
from sklearn.metrics import classification_report

CATEGORIES = ["alt.atheism", "talk.religion.misc", "comp.graphics", "sci.space"]

def load_docs() -> list[tuple[str, str]]:
    data = fetch_20newsgroups(subset="all", categories=CATEGORIES)
    return [
        (text, data.target_names[target])
        for text, target in zip(data.data, data.target)
    ]

def main():
    docs = load_docs()
    random.seed(42)
    random.shuffle(docs)

    n = len(docs)
    classes = sorted(set(label for _, label in docs))
    print(f"{n} documents, {len(classes)} classes\n")

    clf = ZstdClassifier()
    all_true: list[str] = []
    all_pred: list[str] = []
    correct = 0
    total = 0
    recent_correct = 0
    recent_total = 0
    t0 = time.perf_counter()
    lap = t0

    for i, (text, label) in enumerate(docs):
        text_bytes = text.encode("utf-8", errors="replace")

        pred = clf.classify(text_bytes)
        if pred is not None:
            hit = pred == label
            total += 1
            correct += hit
            recent_total += 1
            recent_correct += hit
            all_true.append(label)
            all_pred.append(pred)

        clf.learn(text_bytes, label)

        if (i + 1) % 1000 == 0:
            now = time.perf_counter()
            recent = recent_correct / recent_total if recent_total else 0
            print(
                f"  [{i + 1:>6}/{n}]"
                f"  cumulative = {correct / total:.1%}"
                f"  last 1k = {recent:.1%}"
                f"  [{now - lap:.1f}s]"
            )
            recent_correct = 0
            recent_total = 0
            lap = now

    elapsed = time.perf_counter() - t0
    print(f"\nFinal: {correct / total:.1%}  ({correct}/{total})  [{elapsed:.1f}s]")
    print(f"\n{classification_report(all_true, all_pred, zero_division=0)}")

if __name__ == "__main__":
    main()

```

</details>

```
3387 documents, 4 classes

  [  1000/3387]  cumulative = 82.7%  last 1k = 82.7%  [0.3s]
  [  2000/3387]  cumulative = 88.4%  last 1k = 94.1%  [0.6s]
  [  3000/3387]  cumulative = 90.6%  last 1k = 95.0%  [0.7s]

Final: 91.0%  (3076/3382)  [1.9s]

                    precision    recall  f1-score   support

       alt.atheism       0.88      0.92      0.90       799
     comp.graphics       0.96      0.89      0.92       969
         sci.space       0.92      0.96      0.94       986
talk.religion.misc       0.87      0.85      0.86       628

          accuracy                           0.91      3382
         macro avg       0.91      0.90      0.90      3382
      weighted avg       0.91      0.91      0.91      3382
```

The results are good: it reaches 91% accuracy in less than 2 seconds. To put this into perspective, the LZW-based implementation I made 5 years ago reached 89% accuracy in about 32 minutes. So this is a significant improvement, both in terms of accuracy and speed.

To give another element of comparison, I ran a batch TF-IDF + logistic regression baseline on the same dataset. The model is retrained every 100 iterations, on all previously seen data for the given iteration.

<details>
  <summary>Batch TF-IDF + logistic regression comparison</summary>

```py
import random
import time

from sklearn.datasets import fetch_20newsgroups
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
from sklearn.pipeline import make_pipeline

CATEGORIES = ["alt.atheism", "talk.religion.misc", "comp.graphics", "sci.space"]

def load_docs() -> list[tuple[str, str]]:
    data = fetch_20newsgroups(subset="all", categories=CATEGORIES)
    return [
        (text, data.target_names[target])
        for text, target in zip(data.data, data.target)
    ]

def main():
    docs = load_docs()
    random.seed(42)
    random.shuffle(docs)

    n = len(docs)
    classes = sorted(set(label for _, label in docs))
    print(f"{n} documents, {len(classes)} classes\n")

    retrain_every = 100

    texts_seen: list[str] = []
    labels_seen: list[str] = []
    model = None

    all_true: list[str] = []
    all_pred: list[str] = []
    correct = 0
    total = 0
    recent_correct = 0
    recent_total = 0
    t0 = time.perf_counter()
    lap = t0

    for i, (text, label) in enumerate(docs):
        # Classify with current model (if one exists)
        if model is not None:
            pred = model.predict([text])[0]
            hit = pred == label
            total += 1
            correct += hit
            recent_total += 1
            recent_correct += hit
            all_true.append(label)
            all_pred.append(pred)

        # Store example
        texts_seen.append(text)
        labels_seen.append(label)

        # Retrain periodically
        if (i + 1) % retrain_every == 0 and len(set(labels_seen)) >= 2:
            model = make_pipeline(
                TfidfVectorizer(max_features=50_000, sublinear_tf=True),
                LogisticRegression(max_iter=1000, solver="saga"),
            )
            model.fit(texts_seen, labels_seen)

        if (i + 1) % 1000 == 0:
            now = time.perf_counter()
            recent = recent_correct / recent_total if recent_total else 0
            print(
                f"  [{i + 1:>6}/{n}]"
                f"  cumulative = {correct / total:.1%}"
                f"  last 1k = {recent:.1%}"
                f"  [{now - lap:.1f}s]"
            )
            recent_correct = 0
            recent_total = 0
            lap = now

    elapsed = time.perf_counter() - t0
    print(f"\nFinal: {correct / total:.1%}  ({correct}/{total})  [{elapsed:.1f}s]")
    print(f"\n{classification_report(all_true, all_pred, zero_division=0)}")

if __name__ == "__main__":
    main()
```

</details>

```
3387 documents, 4 classes

  [  1000/3387]  cumulative = 86.6%  last 1k = 86.6%  [1.8s]
  [  2000/3387]  cumulative = 89.2%  last 1k = 91.6%  [3.5s]
  [  3000/3387]  cumulative = 91.2%  last 1k = 95.1%  [4.9s]

Final: 91.8%  (3017/3287)  [12.0s]

                    precision    recall  f1-score   support

       alt.atheism       0.87      0.93      0.90       775
     comp.graphics       0.94      0.97      0.95       948
         sci.space       0.93      0.96      0.95       958
talk.religion.misc       0.95      0.74      0.83       606

          accuracy                           0.92      3287
         macro avg       0.92      0.90      0.91      3287
      weighted avg       0.92      0.92      0.92      3287
```

As expected, the batch TF-IDF + logistic regression baseline is (slightly) more accurate than the Zstd-based classifier, but it's also slower. What's interesting is that this confirms the Zstd-based classifier is learning something non-trivial, and that it is competitive with a standard machine learning approach.

Anyway, don't take my word for it. Try it yourself! I'm not sure I'd advise running this stuff in production, but it does have the merit of being easy to maintain and understand. Now that Zstd is in Python's standard library, and given the decent throughput, it's worth benchmarking against some text classification datasets you may have lying around.
