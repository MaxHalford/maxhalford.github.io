+++
date = "2021-12-24"
title = "Weighted sampling without replacement in pure Python"
+++

I'm working on a problem where I need to sample `k` items from a list without replacement. The sampling has to be weighted. In Python, `numpy` has `random.choice` method which allows doing this:

```py
import numpy as np

n = 10
k = 3

np.random.seed(42)
population = np.arange(n)
weights = np.random.dirichlet(np.ones_like(population))

np.random.choice(population, size=k, replace=False, p=weights)
```

```py
array([0, 9, 8])
```

I'm always wary of using `numpy` without thinking because I know it incurs some overhead. This overhead is usually meaningful when small amounts of data are involved. In such a case, a pure Python implementation may be faster.

Python has a [`random` module](https://docs.python.org/3/library/random.html) in its standard library. This module provides a [`choices` function](https://docs.python.org/3/library/random.html#random.choices) to do random sampling. But this function doesn't support sampling without replacement.

I therefore set out to find a nice and simple algorithm to implement in pure Python. I knew that weighted sampling with replacement can be done with [Vose's alias method](https://www.keithschwarz.com/darts-dice-coins/) -- which I have implemented [here](https://github.com/MaxHalford/vose) in Cython. I also knew that simple (non-weighted) sampling without replacement can be done with [reservoir sampling](https://www.wikiwand.com/en/Reservoir_sampling). But I'd never looked into weighted sampling without replacement.

After some research, I found the algorithm of Efraimidis and Spirakis, which is succintely presented in section 3.2 of [this](https://arxiv.org/pdf/1012.0256.pdf) paper. It's very simple, and from what I can tell it runs in $\mathcal{O}(nlog(n))$ time. Here is a Python implementation:

```py
import random

def weighted_sample_without_replacement(population, weights, k, rng=random):
    v = [rng.random() ** (1 / w) for w in weights]
    order = sorted(range(len(population)), key=lambda i: v[i])
    return [population[i] for i in order[-k:]]

rng = random.Random(42)
weighted_sample_without_replacement(population, weights, k, rng)
```

```
[2, 0, 8]
```

Before worrying about speed, the first thing to check is if it's actually correct. We can do this by simulating many samples, tallying the results, and comparing those tallies to results from `numpy.random.choice`, as well as theoretical figures. Sadly I haven't found any closed-form expression that gives the probability of being sampled for each element. But those probabilities can be obtained with some deterministic code, provided you're confident.

<details>
  <summary>Click to see the code</summary>

```py
from collections import defaultdict
from itertools import permutations
from functools import partial, reduce
import operator

def calculate_theoretical_probas(population, weights, k):

    product = partial(reduce, operator.mul)

    P = {
        perm: product(
            weights[i] / (sum(weights) - sum(weights[j] for j in perm[:step]))
            for step, i in enumerate(perm)
        )
        for perm in permutations(population, k)
    }

    P_per_element = defaultdict(float)
    for perm, p in P.items():
        for element in perm:
            P_per_element[element] += p

    return P_per_element

P = calculate_theoretical_probas(population, weights, k)

print('element', '  weight', '  P(sampled)')
for el in sorted(P.keys(), key=lambda el: P[el]):
    print(f'{el:>7}', f'{weights[el]:>8.2%}', f'{P[el]:>12.2%}')
```

</details>

```
element   weight   P(sampled)
      6    0.58%        2.18%
      5    1.65%        6.12%
      4    1.65%        6.12%
      0    4.57%       16.40%
      3    8.89%       30.27%
      8    8.95%       30.45%
      9   11.99%       39.14%
      2   12.82%       41.35%
      7   19.58%       56.64%
      1   29.31%       71.32%
```

Now we can do a bar chart to compare these figures and see that our implementation is correct. I like this kind of eyeballing method. It doesn't replace a statistical test, but it's good enough for the purpose of a blog post.

<details>
  <summary>Click to see the code</summary>

```py
from collections import Counter
import matplotlib.pyplot as plt
import numpy as np

repetitions = 10_000

counts_with_numpy = Counter()
for _ in range(repetitions):
    sample = np.random.choice(population, p=weights, size=k, replace=False)
    counts_with_numpy.update(sample)

counts = Counter()
for _ in range(repetitions):
    sample = weighted_sample_without_replacement(population, weights, k)
    counts.update(sample)

P = calculate_theoretical_probas(population, weights, k)

with plt.xkcd():

    fig, ax = plt.subplots(figsize=(10, 7))
    width = 0.8

    ax.bar(
        label='numpy',
        x=[5 * p - width * 1.5 for p in population],
        height=[counts_with_numpy[i] for i in population],
        width=width,
    )
    ax.bar(
        label='Efraimidis and Spirakis',
        x=[5 * p for p in population],
        height=[counts[i] for i in population],
        width=width
    )
    ax.bar(
        label='In theory',
        x=[5 * p + width * 1.5 for p in population],
        height=[repetitions * P[i] for i in population],
        width=width
    )

    ax.set_xlabel('Population')
    ax.set_ylabel('Times sampled')
    plt.xticks([5 * p for p in population], population)
    ax.legend()
```
</details>

![bar_chart](/img/blog/weighted-sampling-without-replacement/bar_chart.svg)

Let's now concern ourselves with speed. I've been sampling 3 elements from a list of length 10 in the above examples. Admittedly, those are small numbers. Let's see how this algorithm fairs against numpy.

**numpy.random.choice**

```py
%timeit np.random.choice(population, p=weights, size=k, replace=False)
```
```
70.9 µs ± 2.93 µs per loop (mean ± std. dev. of 7 runs, 10000 loops each)
```

**Efraimidis and Spirakis**

```py
%timeit weighted_sample_without_replacement(population, weights, k)
```
```
4.19 µs ± 223 ns per loop (mean ± std. dev. of 7 runs, 100000 loops each)
```

As you can see, the pure Python implementation is roughly 17 times faster. You might say that numpy is at a disavantage because it first has to cast the provided Python lists to numpy arrays. In fact that doesn't matter too much.

**numpy.random.choice with arrays**

```py
population_array = np.asarray(population)
weights_array = np.asarray(weights)
%timeit np.random.choice(population_array, p=weights_array, size=k, replace=False)
```
```
69.3 µs ± 1.76 µs per loop (mean ± std. dev. of 7 runs, 10000 loops each)
```

Naturally, numpy would beat the pure Python implementation if the list of elements were longer. It's losing here because it incurs too much overhead. There's actually a sweet spot after which numpy starts winning. We can find it visually by using the [`perfplot` library](https://github.com/nschloe/perfplot)

<details>
  <summary>Click to see the code</summary>

```py
import perfplot

k = 5

with plt.xkcd():

    out = perfplot.bench(
        setup=lambda n: (
            (population := list(range(n))),
            (weights := np.random.dirichlet(np.ones_like(population)).tolist()),
            np.asarray(population),
            np.asarray(weights)
        ),
        kernels=[
            lambda params: weighted_sample_without_replacement(params[0], params[1], k),
            lambda params: np.random.choice(params[0], p=params[1], size=k, replace=False),
            lambda params: np.random.choice(params[2], p=params[3], size=k, replace=False)
        ],
        labels=['Efraimidis and Spirakis', 'numpy_without_array', 'numpy_with_array'],
        n_range=[10, 20, 100, 200, 300, 500],
        xlabel='n',
        equality_check=None
    )

        out.save('perfplot.svg', time_unit='auto')
```
</details>

![perfplot](/img/blog/weighted-sampling-without-replacement/perfplot.svg)

This is a nice example of the trade-off when using numpy. The takeaway is that numpy isn't always better. It always depends on how much data is involved.

So there you go. I hope this post was useful to you. I'm going back to enjoying X-mas.
