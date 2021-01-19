+++
date = "2019-12-17"
draft = false
title = "Under-sampling a dataset with desired ratios"
+++

## Introduction

I've just spent a few hours looking at under-sampling and how it can help a classifier learn from an imbalanced dataset. The idea is quite simple: randomly sample the majority class and leave the minority class untouched. There are more sophisticated ways to do this -- for instance by creating synthetic observations from the minority class *à la* [SMOTE](http://rikunert.com/SMOTE_explained) -- but I won't be discussing that here.

I checked out the [`imblearn`](https://imbalanced-learn.readthedocs.io/en/stable/index.html) library and noticed they have an implementation of random under-sampling aptly named [`RandomUnderSampler`](https://imbalanced-learn.readthedocs.io/en/stable/generated/imblearn.under_sampling.RandomUnderSampler.html#imblearn.under_sampling.RandomUnderSampler). It contains a `sampling_strategy` parameter which gives some control over the sampling. By the default the observations are resampled so that each class is equally represented:

```python
import collections
from sklearn import datasets
from imblearn import under_sampling

X, y = datasets.make_classification(
    n_classes=3,
    weights=[.1, .6, .3],
    n_informative=3,
    n_samples=1000,
    random_state=42
)
print('Original dataset shape %s' % collections.Counter(y))

rus = under_sampling.RandomUnderSampler(sampling_strategy='auto', random_state=42)
X_res, y_res = rus.fit_resample(X, y)
print('Resampled dataset shape %s' % collections.Counter(y_res))
```

On my machine this outputs the following:

```python
Original dataset shape Counter({1: 597, 2: 301, 0: 102})
Resampled dataset shape Counter({0: 102, 1: 102, 2: 102})
```

The `sampling_strategy` parameter also accepts a dictionary which specifies the desired counts of each class. For example:

```python
X, y = datasets.make_classification(
    n_classes=3,
    weights=[.1, .6, .3],  # The actual class ratios
    n_informative=3,
    n_samples=1000,
    random_state=42
)
rus = under_sampling.RandomUnderSampler(
    sampling_strategy={
        0: 50,
        1: 300,
        2: 100
    },
    random_state=42
)
X_res, y_res = rus.fit_resample(X, y)
print('Resampled dataset shape %s' % collections.Counter(y_res))
```

Which gives:

```python
Resampled dataset shape Counter({1: 300, 2: 100, 0: 50})
```

Now how about if we want to specify desired ratios instead of counts? For instance we might want class 0 to appear 20% of the time, class 1 30%, and class 2 50%. I was surprised to find out that as of writing this blog post `imblearn` doesn't support this -- I'm using version `0.5.0`. For instance you can't specify `sampling_strategy={0: .2, 1: .3, 2: .5}`. It does however allow to do this for binary classification, albeit not directly.

I was initially interested in doing this for online machine learning purposes. I thus went to `imblearn` for inspiration and found out that specifying a desired class distribution in terms of ratios wasn't supported. In batch learning this isn't so much an issue because you know how many observations you have and can thus specify class counts instead. However in an online context you don't know how many observations you will encounter and thus need to be able to specify a class distribution in terms of ratios and not in terms of counts. I did some Googling, alas in vain, and thus decided to work it out myself. I found a solution which works for both the batch and online situations.

## The case of 2 classes

I'll start with the case where there are 2 classes. I'll be reasoning in terms of ratios because it makes sense for both the batch and online situations. Now suppose you have a dataset with the following actual class distribution:

```python
actual = {
    True: .1,
    False: .9
}
```

Your dataset is somewhat imbalanced because there are more `False`s than `True`s. Now say you would like your dataset to have the following desired distribution:

```python
desired = {
    True: .4,
    False: .6
}
```

This would make your dataset more balanced. Intuitively, by comparing `actual` and `desired`, we can understand that we have to remove some `False` observations in order to balance the dataset. Indeed, because `.4` is higher than `.1`, we might as well keep all the `True` observations and only discard `False` observations. The question is thus, how many `False` observations do we have to remove to obtain the desired class distribution? The question can be reformulated as so: out of 90% percent of `False`s in the initial dataset, how many do I need to pick in order to obtain 60% in the resampled dataset? Well it's actually `.6 / (.4 / .1) / .9`. I actually can't remember how I got to the formula but I mostly found it by playing around with the numbers in my head.

```python
>>> (desired[False] * actual[True]) / (desired[True] * actual[False])
0.16666666666666663
```

This means that for each `False` observation in the dataset, we can pick a random number between 0 and 1, and keep the observation only if the random number is lower than `0.166...`. Let's try this out; we'll first simulate a stream of `True`s and `False`s:

```python
import random

rng = random.Random(42)

def stream_values(n):
    for _ in range(n):
        p = rng.random()
        if p < .1:
            yield True
        else:
            yield False


n = 100000
values = list(stream_values(n))
for v, c in sorted(collections.Counter(values).items()):
    print(f'{v}: {c} ({c / n})')
```

This gives me:

```python
False: 89951 (0.89951)
True: 10049 (0.10049)
```

Now let's sample the values using our methodology:

```python
rng = random.Random(42)

rates = {
    True: 1,
    False: (desired[False] * actual[True]) / (desired[True] * actual[False])
}

sample = []
for v in values:
    p = rng.random()
    if p < rates[v]:
        sample.append(v)

for v, c in sorted(collections.Counter(sample).items()):
    print(f'{v}: {c} ({c / len(sample)})')
```

This gives us:

```python
False: 14867 (0.5966848611334082)
True: 10049 (0.40331513886659176)
```

This works well because we can see that the obtained distribution is very close to distribution we want.

## Handling 3 classes and more

Let's now move on to the case where there are multiple classes. Let us first notice that the method we just presented for two cases doesn't work if we want to lower the ratio of `True`s instead of increasing it. Indeed the formula just wouldn't make sense. However, it would work if we reversed `False` and `True` in the equation. This stems from the fact that if we are reducing the ratio of `True`s, then automatically we are increasing the ratio of `False`s. There is thus always a class ratio which you want to increase. I like to call this class the "pivot". We will now see how using a pivot class enables us to balance a dataset with more than two classes. Let's simulate some data:

```python
rng = random.Random(42)

def stream_values(n):
    for _ in range(n):
        p = rng.random()
        if p < .1:
            yield 'a'
        elif p < 0.7:
            yield 'b'
        else:
            yield 'c'

n = 100000
values = list(stream_values(n))
for v, c in sorted(collections.Counter(values).items()):
    print(f'{v}: {c} ({c / n})')
```

Here are the ratios:

```python
a: 10039 (0.10039)
b: 59903 (0.59903)
c: 30058 (0.30058)
```

The actual distribution is thus:

```python
actual = {
    'a': .1,
    'b': .6,
    'c': .3
}
```

Now let's say we want to attain the following distribution:

```python
desired = {
    'a': .2,
    'b': .4,
    'c': .4
}
```

We thus want to increase the percentage of `a`s as well as of `c`s. However, the relative increase for `a` is larger than that of `c`, and `a` will thus act as the pivot. We can thus select the pivot by selecting the value with the highest multiplicative increase.

```python
pivot = max(actual.keys(), key=lambda x: desired[x] / actual[x])
```

Now we can calculate the sampling rates:

```python
rates = {
    k: (desired[k] * actual[pivot]) / (desired[pivot] * actual[k])
    for k in actual
}
```

In our case this gives us:

```python
{
    'a': 1.0,
    'b': 0.3333333333333334,
    'c': 0.6666666666666669
}
```

Now let's sample:

```python
rng = random.Random(42)

sample = []
for v in values:
    p = rng.random()
    if p < rates[v]:
        sample.append(v)

for v, c in sorted(collections.Counter(sample).items()):
    print(f'{v}: {c} ({c / len(sample)})')
```

Which gives us:

```python
a: 10039 (0.2004752775780813)
b: 19928 (0.3979551082354821)
c: 20109 (0.4015696141864366)
```

It worked! 10039 `a`s have been sampled, which is exactly the number of actual `a`s in the initial set of values. This is because `a` is the pivot: it is the value that does not have to be under-sampled.

## The online setting

In the examples we just saw the actual value distribution is known. However, in an online setting we don't know it. It can be provided, but in general it has to estimated online. In Python we can do this by incrementing a `collections.defaultdict(int)` -- or a `collections.Counter`, as you wish. Naturally this means the pivot can change, which has to be taken care of. I haven't thought about it too much and thus in the following example I simply recalculate the pivot at each iteration. There might be a more efficient way to go about it.

```python
rng = random.Random(42)
n = 100000
sample_counts = collections.defaultdict(int)
actual = collections.defaultdict(int)
desired = {'a': .5, 'b': .3, 'c': .2}


def stream_values(n):
    for _ in range(n):
        p = rng.random()
        if p < .1:
            yield 'a'
        elif p < .7:
            yield 'b'
        else:
            yield 'c'


for v in stream_values(n):

    actual[v] += 1
    pivot = max(actual.keys(), key=lambda x: desired[x] / actual[x])
    ratio = (desired[v] * actual[pivot]) / (desired[pivot] * actual[v])

    p = rng.random()
    if p < ratio:
        sample_counts[v] += 1

for v, c in sorted(sample_counts.items()):
    print(f'{v}: {c} ({c / sum(sample_counts.values())})')
```

This gives us:

```python
a: 10022 (0.500999800039992)
b: 6021 (0.3009898020395921)
c: 3961 (0.19801039792041591)
```

I'm quite satisfied by this result. I'll probably be adding an implementation to [`creme`](https://github.com/creme-ml/creme) in the next few days.

I've written this post in a hurry because I'm very busy but I wanted to jot something down. If you have any questions/remarks feel free to get in touch!
