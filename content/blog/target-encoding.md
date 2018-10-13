+++
date = "2018-10-13"
draft = false
title = "Target encoding done the right way"
+++

When you're doing supervised learning you often have to deal with categorical variables. That is, variables which don't have a natural numerical representation. The problem is that most machine learning algorithms require the input data to be numerical. At some point or another a data science pipeline will require converting categorical variables to numerical variables.

There are many ways to do so:

- [Label encoding](http://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.LabelEncoder.html) where you choose an arbitrary number for each category
- [One-hot encoding](http://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.OneHotEncoder.html) where you create one binary column per category
- [Vector representation](https://www.tensorflow.org/tutorials/representation/word2vec) a.k.a. word2vec where you find a low dimensional subspace that fits your data
- [Optimal binning](https://github.com/Microsoft/LightGBM/blob/master/docs/Advanced-Topics.rst#categorical-feature-support) where you rely on tree-learners such as LightGBM or CatBoost
- [Target encoding](http://www.saedsayad.com/encoding.htm) where you average the target value by category

Each and every one of these method has it's pros and cons, and it usually depends on your data and your requirements. If a variable has a lot of categories then a one-hot encoding scheme will produce many columns which can cause memory issues. In my experience relying on LightGBM/CatBoost is the best out-of-the-box method. Label encoding is useless and you should never use it. However if your categorical variable happens to be ordinal then you can and should represent it with increasing numbers (for example "cold" becomes 0, "mild" becomes 1, and "hot" becomes 2). word2vec and others such methods are cool and good but they require some fine-tuning and don't always work out.

Target encoding is a fast way to get the most out of your categorical variables with little effort. The idea is quite simple. Say you can have a categorical variable $x$ and a target $y$ -- $y$ can be binary or continuous, it doesn't matter. For each distinct element in $x$ you're going to compute the average of the corresponding values in $y$. Then you're going to replace each $x_i$ with the according mean. This is rather easy to do in Python and the `pandas` library.

First let's create some dummy data.

```python
import pandas as pd

df = pd.DataFrame({
    'x_0': ['a'] * 5 + ['b'] * 5,
    'x_1': ['a'] * 9 + ['b'] * 1,
    'y': [1, 1, 1, 1, 0, 1, 0, 0, 0, 0]
})
```

| $x_0$ | $x_1$ | $y$ |
|-------|-------|-----|
| $a$ | $c$ | 1 |
| $a$ | $c$ | 1 |
| $a$ | $c$ | 1 |
| $a$ | $c$ | 1 |
| $a$ | $c$ | 0 |
| $b$ | $c$ | 1 |
| $b$ | $c$ | 0 |
| $b$ | $c$ | 0 |
| $b$ | $c$ | 0 |
| $b$ | $d$ | 0 |

We can start by computing the means of the $x_0$ column.

```python
means = df.groupby('x_0')['y'].mean()
```

This results in the following dictionary.

```python
{
    'a': 0.8,
    'b': 0.2
}
```

We can then replace each value in $x_0$ with the matching mean.

```python
df['x_0'] = df['x_0'].map(means)
```

We now have the following data frame.

| $x_0$ | $x_1$ | $y$ |
|-------|-------|-----|
| 0.8 | $c$ | 1 |
| 0.8 | $c$ | 1 |
| 0.8 | $c$ | 1 |
| 0.8 | $c$ | 1 |
| 0.8 | $c$ | 0 |
| 0.2 | $c$ | 1 |
| 0.2 | $c$ | 0 |
| 0.2 | $c$ | 0 |
| 0.2 | $c$ | 0 |
| 0.2 | $d$ | 0 |

We can do the same for $x_1$.

```python
df['x_1'] = df['x_1'].map(df.groupby('x_1')['y'].mean())
```

| $x_0$ | $x_1$ | $y$ |
|-------|-------|-----|
| 0.8 | 0.444 | 1 |
| 0.8 | 0.444 | 1 |
| 0.8 | 0.444 | 1 |
| 0.8 | 0.444 | 1 |
| 0.8 | 0.444 | 0 |
| 0.2 | 0.444 | 1 |
| 0.2 | 0.444 | 0 |
| 0.2 | 0.444 | 0 |
| 0.2 | 0.444 | 0 |
| 0.2 | 0 | 0 |

Target encoding is good because it picks up values that can explain the target. In this silly example value $a$ of variable $x_0$ has an average target value of $0.8$. This can greatly help the machine learning classifications algorithms used downstream.

The problem of target encoding has a name: **over-fitting**. Indeed relying on an average value isn't always a good idea when the number of values used in the average is low. You've got to keep in mind that the dataset you're training on is a sample of a larger set. This means that whatever artifacts you may find in the training set might not hold true when applied to another dataset (i.e. the test set).

In the example, the value $d$ of variable $x_1$ is replaced with a 0 because it only appears once and the corresponding value of $y$ is a 0. In this case we're over-fitting because we don't have enough values to be *sure* that 0 is in fact the mean value of $y$ when $x_1$ is equal to $d$. In other words only relying on each group mean is too reckless.

There are various ways to handle this. A popular way is to use cross-validation and compute the means in each out-of-fold dataset. This is [what H20 does](http://docs.h2o.ai/h2o/latest-stable/h2o-docs/data-munging/target-encoding.html) and what many Kagglers do too. Another approach which I much prefer is to use [additive smoothing](https://www.wikiwand.com/en/Additive_smoothing). This is supposedly [what IMDB uses to rate it's movies](https://www.wikiwand.com/en/Bayes_estimator#/Practical_example_of_Bayes_estimators).

The intuition is as follows. Imagine a new movie is posted on IMDB and it receives three ratings. Taking into account the three ratings gives the movie an average of 9.5. This is surprising because most movies tend to hover around 7, and the very good ones rarely go above 8. The point is that these first three ratings are extreme values that can't been trusted. The trick is to "smooth" the average by **including the average rating over all movies**. In other words, if there aren't many ratings we should rely on the global average rating, whereas if there enough ratings then we can safely rely on the local average.

Mathematically this is equivalent to:

$$\mu = \frac{n \times \bar{x} + m \times w}{n + m}$$

where

- $\mu$ is the mean we're trying to compute (the one that's going to replace our categorical values)
- $n$ is the number of values you have
- $\bar{x}$ is your estimated mean
- $m$ is the "weight" you want to assign to the overall mean
- $w$ is the overall mean

In this notation $m$ is the only parameter you have to set. The idea is that the higher $m$ is, the more you're going to rely on the overall mean $w$. If $m$ is equal to 0 then you're simply going to compute the empirical mean, which is:

$$\mu = \frac{n \times \bar{x} + 0 \times w}{n + 0} = \frac{n \times \bar{x}}{n} = \bar{x}$$

In other words you're not doing any smoothing whatsoever.

Again this is quite easy to do in Python. First we're going to write a method that computes a smooth mean. It's going to take as input a `pandas.DataFrame`, a categorical column name, the name of the target column, and a weight $m$.

```python
def calc_smooth_mean(df, by, on, m):
    # Compute the global mean
    mean = df[on].mean()

    # Compute the number of values and the mean of each group
    agg = df.groupby(by)[on].agg(['count', 'mean'])
    counts = agg['count']
    means = agg['mean']

    # Compute the "smoothed" means
    smooth = (counts * means + m * mean) / (counts + m)

    # Replace each value by the according smoothed mean
    return df[by].map(smooth)
```

Let's see what this does in the previous example with a weight of, say, 10.

```python
df['x_0'] = calc_smooth_mean(df, by='x_0', on='y', m=10)
df['x_1'] = calc_smooth_mean(df, by='x_1', on='y', m=10)
```

| $x_0$ | $x_1$ | $y$ |
|-----|----------|---|
| 0.6 | 0.526316 | 1 |
| 0.6 | 0.526316 | 1 |
| 0.6 | 0.526316 | 1 |
| 0.6 | 0.526316 | 1 |
| 0.6 | 0.526316 | 0 |
| 0.4 | 0.526316 | 1 |
| 0.4 | 0.526316 | 0 |
| 0.4 | 0.526316 | 0 |
| 0.4 | 0.526316 | 0 |
| 0.4 | 0.454545 | 0 |

It's should be quite noticeable that each computed value is much closer to the overall mean of 0.5. This is because a weight of 10 is rather large for a dataset of only 10 values. The value $d$ of variable $x_1$ has been replaced with 0.454545 instead of the 0 we got earlier. The equation for obtaining it was:

$$d = \frac{1 \times 0 + 10 \times 0.5}{1 + 10} = \frac{0 + 5}{11} \simeq 0.454545$$

Meanwhile the new value for replacing the value $a$ of variable $x_0$ was:

$$a = \frac{5 \times 0.8 + 10 \times 0.5}{5 + 10} = \frac{4 + 5}{15} \simeq 0.6$$

Computing smooth means can be done extremely quickly. What's more you only have to choose a single parameter, which is $m$. I find that setting to something like 300 works well in most cases. It's quite intuitive really: you're saying that you require that there must be at least 300 values for the sample mean to overtake the global mean. There are other ways to do target encoding, such as [this one](https://kaggle2.blob.core.windows.net/forum-message-attachments/225952/7441/high%20cardinality%20categoricals.pdf) which is rather popular on Kaggle. However it produces encoded variables which are very correlated with the output of additive smoothing, at the cost of requiring two parameters.

I'm well aware that there are many well-written posts about target encoding elsewhere. I just want to do my bit and help spread the word: don't use vanilla target encoding! Go Bayesian and use priors. For those who are interested in using a scikit-learn compatible implementation, I did just that [here](https://github.com/MaxHalford/xam/blob/master/docs/feature-extraction.md#smooth-target-encoding).
