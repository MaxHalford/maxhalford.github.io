+++
date = "2022-08-24"
title = "Matrix inverse mini-batch updates"
tags = ['online-machine-learning']
+++

The inverse covariance matrix, also called [precision matrix](https://www.wikiwand.com/en/Precision_matrix), is useful in many places across the field of statistics. For instance, in machine learning, it is used for [Bayesian regression](/blog/bayesian-linear-regression) and [mixture modelling](https://scikit-learn.org/stable/modules/mixture.html#gmm).

What's interesting is that any batch model which uses a precision matrix can be turned into an online model. That is, provided the precision matrix can be estimated in a streaming fashion. For instance, scikit-learn's [elliptic envelope](https://scikit-learn.org/stable/modules/generated/sklearn.covariance.EllipticEnvelope.html#sklearn.covariance.EllipticEnvelope) method could have an online variant with a `partial_fit` method.

Thankfully, there is a way to (efficiently) estimate a precision matrix online, through the use of the [Sherman-Morrison formula](https://www.wikiwand.com/en/Sherman%E2%80%93Morrison_formula). Markus Thill provides details [here](https://markusthill.github.io/math/stats/ml/online-estimation-of-the-inverse-covariance-matrix/) with some accompanying R code.

Of course, one could just estimate the covariance matrix online, and invert the matrix at each step. But that would be too expensive, due to the fact matrix inversion takes $\mathcal{O}(n^3)$ time. The Sherman-Morrison formula runs in $\mathcal{O}(n^2)$ time. The downside is that the result is not exact, although the error margin is small enough for machine learning purposes -- at least in my experience.

Here is some Python code for estimating the precision matrix, online, using the Sherman-Morrison formula:

```py
import numpy as np
import scipy as sp

def sherman_morrison(A, u, v):
    Au = A @ u
    vT = v.T
    alpha = -1 / (1 + vT @ Au)
    sp.linalg.blas.dger(
        alpha=alpha,
        x=Au,
        y=vT @ A,
        a=A, overwrite_a=1
    )

n = 100
p = 3
rng = np.random.default_rng(seed=42)
X = rng.normal(size=(n, p))

w = 0
mean = np.zeros(p)
M = np.asfortranarray(np.eye(p))

for x in X:
    w += 1
    diff = x - mean
    mean += diff / w
    sherman_morrison(A=M, u=diff, v=x - mean)

inv_cov = len(X) * M
print(inv_cov)
```

```
array([[ 1.22900496, -0.04588473, -0.01030462],
       [-0.04588473,  1.08510258, -0.20780225],
       [-0.01030462, -0.20780225,  1.22256802]])
```

As you can compare, this is somewhat close to the basic batch implementation:

```py
print(np.linalg.inv(np.cov(X.T)))
```

```
array([[ 1.23187713, -0.04647389, -0.01035858],
       [-0.04647389,  1.08650005, -0.21055135],
       [-0.01035858, -0.21055135,  1.22576677]])
```

The inplace `sherman_morrison` function is a bit cryptic. This is because it's using the [DGER](https://netlib.org/lapack/explore-html/d7/d15/group__double__blas__level2_ga458222e01b4d348e9b52b9343d52f828.html#ga458222e01b4d348e9b52b9343d52f828) routine, which is nicely exposed by SciPy. This requires the input to be in F(ortran) order -- don't ask me why -- which explains the call to `np.asfortranarray`.

I didn't invent this trick, I got it from Tim Vieira's [excellent article](https://timvieira.github.io/blog/post/2021/03/25/fast-rank-one-updates-to-matrix-inverse/) about optimizing the Sherman-Morrison formula for NumPy.

The Sherman-Morrison formula is great, but processing $n$ samples with $p$ features still requires a non-negligible $\mathcal{O}(np^2)$ amount of computing time. That may be prohibitive, depending on the use case. This is emphasized in a mini-batch scenario -- think scikit-learn's `partial_fit` -- where hardware acceleration can be used to process a batch of data faster than one sample at a time.

As it just so happens, the Sherman-Morrison formula is a special case of the [Woodbury matrix identity](https://www.wikiwand.com/en/Woodbury_matrix_identity). Here it is, implemented in NumPy:

```py
def woodbury_identity(A, U, V):
    I = np.eye(len(V))
    AU = A @ U
    A -= AU @ np.linalg.inv(I + V @ AU) @ V @ A

w = 0
mean = np.zeros(p)
M = np.asfortranarray(np.eye(p))

for Xb in np.split(X, 4):
    diff = Xb - mean
    mean = (
        (w * mean + len(Xb) * Xb.mean(axis=0)) /
        (w + len(Xb))
    )
    w += len(Xb)
    woodbury_identity(A=M, U=diff.T, V=Xb - mean)

inv_cov = len(X) * M
print(inv_cov)
```

```
array([[ 1.22900496, -0.04588473, -0.01030462],
       [-0.04588473,  1.08510258, -0.20780225],
       [-0.01030462, -0.20780225,  1.22256802]])
```

The results are identical to the single-instance version. Here I've split the `X` matrix into 4 batches of 25 rows. This results in having only to make 4 calls to `woodbury_identity`, instead of 100 calls to `sherman_morrison`. Of course, this doesn't necessarily mean the former method is faster. Especially considering the Woodbury matrix identity still requires performing one matrix inversion. The latter applies to the `V @ AU` matrix, which is of shape `(k, k)`, with `k` being the length of each mini-batch.

Of course, why try to guess when we can measure. We can easily measure how much faster/slower the mini-batch method is compared to the streaming method for different values of `k` (number of samples) and `p` (number of features).

<details>
  <summary>Benchmark code</summary>

```python
def streaming(X):
    p = X.shape[1]
    w = 0
    mean = np.zeros(p)
    M = np.asfortranarray(np.eye(p))

    for x in X:
        w += 1
        diff = x - mean
        mean += diff / w
        sherman_morrison(A=M, u=diff, v=x - mean)

def mini_batch(X):
    p = X.shape[1]
    w = 0
    mean = np.zeros(p)
    M = np.asfortranarray(np.eye(p))

    diff = X - mean
    mean = (w * mean + len(X) * X.mean(axis=0)) / (w + len(X))
    w += len(X)
    woodbury_matrix(A=M, U=diff.T, V=X - mean)

def workload():
    rng = np.random.default_rng(seed=42)
    K = [2 ** k for k in range(13)]
    P = np.ceil(np.logspace(0.3, 3, 10)).astype(int)
    for k in K:
        for p in P:
            X = rng.normal(size=(k, p))
            yield X

def run():
    for X in workload():
        k, p = X.shape
        t_streaming = %timeit -o -q streaming(X)
        t_mini_batch = %timeit -o -q mini_batch(X)
        yield k, p, t_streaming.average / t_mini_batch.average

results = [
    {'k': k, 'p': p, 'speed_up': speed_up}
    for k, p, speed_up in run()
]

pd.DataFrame(results).to_csv('results.csv', index=False)
```
</details>

<details>
  <summary>Visualization code</summary>

```python
import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns

fig, ax = plt.subplots(figsize=(10, 10))

df = (
    pd.read_csv('results.csv')
    .pivot('n', 'p', 'speed_up')
    .sort_index(ascending=False)
)

sns.set(font_scale=2)
sns.heatmap(
    df,
    cmap='Spectral_r',
    center=1,
    #square=True,
    linewidth=3,
    annot=True,
    fmt='.2f',
    annot_kws={
        'fontsize': 16,
        'fontweight': 'bold'
    },
    ax=ax,
    cbar=False
)
ax.set_ylabel('batch size', labelpad=10)
ax.set_xlabel('number of features', labelpad=20)

plt.savefig('speed-up.svg', bbox_inches='tight')
```
</details>

<div align="center">
<figure >
    <img src="/img/blog/matrix-inverse-mini-batch/speed-up.svg" style="box-shadow: none;">
    <figcaption><i>Speed-up summary. A <span style="color: indianred;">red</span> value means the mini-batch version is faster, whereas a <span style="color: greenyellow;">green</span> value means the streaming version is preferable.</i></figcaption>
</figure>
</div>

The interpretation of this benchmark is a bit disappointing, albeit interesting. The mini-batch variant is faster for batches of length around 100. In practice, it might be possible to devise some heuristic based on `(k, p)` to select the fastest method, but that seems to me a bit far-fetched. There's no free lunch!

## Appendix

The fastest solution in Tim Vieira's article uses the [DGER](https://netlib.org/lapack/explore-html/d7/d15/group__double__blas__level2_ga458222e01b4d348e9b52b9343d52f828.html#ga458222e01b4d348e9b52b9343d52f828) operator to speed things up. This is a level 2 linear algebra operation, because it performs matrix-vector operations. The Woodbury matrix identity necessitates matrix-matrix operations, and is thus a level 3 operation. From what I could tell, the [DGEMM](https://netlib.org/lapack/explore-html/d1/d54/group__double__blas__level3_gaeda3cbd99c8fb834a60a6412878226e1.html) operator is appropriate. I managed to make this work, as so:

```py
def woodbury_matrix(A, U, V):
    I = np.eye(len(V))
    AU = A @ U
    return sp.linalg.blas.dgemm(
        alpha=-1,
        a=AU @ np.linalg.inv(I + V @ AU),
        b=V @ A,
        beta=1, c=A
    )

w = 0
mean = np.zeros(p)
M = np.asfortranarray(np.eye(p))

for Xb in np.split(X, 4):
    w += len(Xb)
    diff = Xb - mean
    mean = (w * mean + len(Xb) * Xb.mean(axis=0)) / (w + len(Xb))
    M = woodbury_matrix(A=M, U=diff.T, V=Xb - mean)

inv_cov = len(X) * M
```

Alas, this didn't result in a significant speed-up for me, which is why I'm leaving it the appendix. I believe this is because most of the computation happens in `np.linalg.inv(I + V @ AU)`, which occurs before calling the DGEMM routine.

I would also like to echo Tim Vieira's suggestion that using the [Cholesky factorisation](https://www.wikiwand.com/en/Cholesky_decomposition) is a better way for estimating a covariance matrix, as well as a precision matrix. This saves some computation by leveraging the fact both matrices are symmetric. The Cholesky factorisation should also result in more stable and accurate results. I haven't yet come around to trying this out, but if I do I'll start by checking out Tim Vieira's code [here](https://github.com/timvieira/arsenal/blob/master/arsenal/maths/cholesky.py).

We've [recently added](https://github.com/online-ml/river/pull/999) an online precision matrix to [River](https://github.com/online-ml/river). It implements the Sherman-Morrison formula, as well as the Woodbury matrix identity. This precision matrix is likely going to become the building block for higher-level algorithms. We're thus always on the lookout for faster solutions. Please feel welcome sharing any insight you way have 👐
