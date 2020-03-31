+++
date = "2020-03-31"
draft = false
title = "Speeding up scikit-learn for single predictions"
+++

It is now common practice to train machine learning models offline before putting them behind an API endpoint to serve predictions. Specifically, we want an API route which can make a prediction for a single row/instance/sample/data point/individual ([call it what you want](https://www.youtube.com/watch?v=1prhCWO_518)). Nowadays, we have great tools to do this that care of the nitty-gritty details, such as [Cortex](https://github.com/cortexlabs/cortex), [MLFlow](https://www.mlflow.org/docs/latest/models.html), [Kubeflow](https://www.kubeflow.org/docs/components/serving/), and [Clipper](https://github.com/ucbrise/clipper). There are also paid services that hold your hand a bit more, such as [DataRobot](https://www.datarobot.com/), [H2O](https://www.h2o.ai/), and [Cubonacci](https://www.cubonacci.com/). One could argue that deploying machine learning models has never been easier.

These solutions usually assume that you're going to be using a popular library from the data science ecosystem, such as [scikit-learn](https://scikit-learn.org/stable/), [Keras](https://keras.io/), [PyTorch](https://pytorch.org/), or [LightGBM](https://github.com/microsoft/LightGBM), or maybe even [Surprise](https://github.com/NicolasHug/Surprise) if you're building a recommender system. The trick is that most of these libraries were never designed to make predictions. In fact, a large part of them were initiated well before putting a machine learning model behind an API endpoint became cool. On the contrary, these libraries are designed to make batch predictions. They are faster at processing 1000 samples 1 time than they are at processing 1 sample 1000 times. This is mostly because they rely on [SIMD operations](https://www.wikiwand.com/en/SIMD) and linear algebra tricks that scale well with a lot of data. Therefore these libraries are not optimal for making individual predictions. However, there are some hacks that can make things faster.

In this post I want to focus on scikit-learn. First of all the [*Computing with scikit-learn*](https://scikit-learn.org/stable/modules/computing.html) document is a must-read if you're going to use or all already using scikit-learn in production. It includes a lot of tips and tricks for making things faster in general. I'm going to be focusing on prediction speed, which in the context of machine learning is sometimes referred to as "latency" .

To start off, let's go a ahead and measure the prediction speed of scikit-learn's [`LinearRegression`](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LinearRegression.html) on a single row. I'll be using IPython's [`%timeit`](https://ipython.readthedocs.io/en/stable/interactive/magics.html) command to get a reliable estimate. I'll also be the latest version of scikit-learn, which as of now is `0.22.2`.

```py
from sklearn import datasets
from sklearn import linear_model

X, y = datasets.load_boston(return_X_y=True)
lin_reg = linear_model.LinearRegression()
lin_reg.fit(X, y)
%timeit lin_reg.predict(X[[0]])[0]
```

```
44.4 µs ± 3.7 µs per loop (mean ± std. dev. of 7 runs, 10000 loops each)
```

44.4 microseconds doesn't seem like a lot of time, but it turns out that we can do much better. The thing is that scikit-learn does a lot of checks every time you call `predict`. For example, it checks that you have provided a 2D numpy array, that the number of features is correct, that non of the values are missing, etc. In many cases these checks might be redundant because you might have already done them yourself as part of a validation step in your application. Therefore, we can write a "barebones" implementation which skips the details and gets down to the essential, which is evaluating the linear regression. In essence, a linear regression is just a sum of an intercept and a dot product between some weights and the input features. We can implement this ourselves. To do so, we'll define a `BarebonesLinearRegression` class with a `predict_single` method which takes as input a 1D array.

```py
import numpy as np

class BarebonesLinearRegression(linear_model.LinearRegression):

    def predict_single(self, x):
        return np.dot(self.coef_, x) + self.intercept_
```

Let's see how fast this is:

```py
bb_lin_reg = BarebonesLinearRegression()
bb_lin_reg.fit(X, y)
%timeit bb_lin_reg.predict_single(X[0])
```

```
1.38 µs ± 31.7 ns per loop (mean ± std. dev. of 7 runs, 1000000 loops each)
```

The barebones implementation is on average **32 times faster that scikit-learn implementation**. I'll let you be the judge of the significance of this result. To be fair, if you're using an API then most of the latency comes the HTTP protocol, so the benefit of this trick might be amortized. Still, I think it's a cool trick to know, and it has it's applications elsewhere. For instance, it was critical in my team's [winning solution](https://github.com/MaxHalford/idao-2020-qualifiers) to the [qualifiers of the 2020 edition of the IDAO](https://idao.world/results/), where we needed to provide a model which had to make a bunch of predictions under a time limit.

We can apply this trick to other models, such as scikit-learn's [`LogisticRegression`](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LogisticRegression.html#sklearn.linear_model.LogisticRegression). Let's first evaluate the default implementation:

```py
from sklearn import datasets
from sklearn import preprocessing

X, y = datasets.load_digits(return_X_y=True)
X = preprocessing.scale(X)
log_reg = linear_model.LogisticRegression()
log_reg.fit(X, y)
%timeit log_reg.predict_proba(X[[0]])[0]
```

```
153 µs ± 1.31 µs per loop (mean ± std. dev. of 7 runs, 10000 loops each)
```

We can implement a `predict_single` method with scipy's [`softmax`](https://docs.scipy.org/doc/scipy/reference/generated/scipy.special.softmax.html) function:

```py
from scipy import special

class BarebonesLogisticRegression(linear_model.LogisticRegression):

    def predict_proba_single(self, x):
        return special.softmax(np.dot(self.coef_, x) + self.intercept_)
```

Let's see if we've gained anything:

```py
bb_log_reg = BarebonesLogisticRegression()
bb_log_reg.fit(X, y)
%timeit bb_log_reg.predict_proba_single(X[0])
```

```sh
71.3 µs ± 3.59 µs per loop (mean ± std. dev. of 7 runs, 10000 loops each)
```

That's definitely a boost, but it's nothing to brag home about. We can check what's taking the most time with IPython's [`%prun`](https://ipython.readthedocs.io/en/stable/interactive/magics.html#magic-prun) command:

```py
%prun -l 10 [bb_log_reg.predict_proba_single(X[0]) for _ in range(100000)]
```

```sh
        4400004 function calls in 4.414 seconds

Ordered by: internal time
List reduced from 34 to 10 due to restriction <10>

ncalls  tottime  percall  cumtime  percall filename:lineno(function)
100000    1.068    0.000    3.504    0.000 _logsumexp.py:9(logsumexp)
200000    0.530    0.000    0.530    0.000 {method 'reduce' of 'numpy.ufunc' objects}
300000    0.315    0.000    1.376    0.000 {built-in method numpy.core._multiarray_umath.implement_array_function}
100000    0.257    0.000    3.761    0.000 _logsumexp.py:132(softmax)
100000    0.254    0.000    4.316    0.000 <ipython-input-145-3bbdfc107533>:5(predict_proba_single)
200000    0.245    0.000    0.578    0.000 _ufunc_config.py:39(seterr)
100000    0.232    0.000    0.383    0.000 _util.py:200(_asarray_validated)
200000    0.226    0.000    0.868    0.000 fromnumeric.py:73(_wrapreduction)
200000    0.201    0.000    0.222    0.000 _ufunc_config.py:139(geterr)
100000    0.095    0.000    0.520    0.000 fromnumeric.py:2092(sum)
```

The culprit is quite obvious: it's the [`logsumexp`](https://docs.scipy.org/doc/scipy-0.19.0/reference/generated/scipy.misc.logsumexp.html) function that is called by `special.softmax`. The way `special.softmax` is implemented avoids potential numeric underflows and overflows, as explained [here](https://stackoverflow.com/questions/42599498/numercially-stable-softmax). However, it seems to be slower than a custom implementation which is still stable:

```py
def custom_softmax(x):
    z = x - max(x)
    numerator = np.exp(z)
    denominator = np.sum(numerator)
    return numerator / denominator

class BarebonesLogisticRegression(linear_model.LogisticRegression):

    def predict_proba_single(self, x):
        return custom_softmax(np.dot(self.coef_, x) + self.intercept_)
```

This produces the following performance:

```py
bb_log_reg = BarebonesLogisticRegression()
bb_log_reg.fit(X, y)
%timeit bb_log_reg.predict_proba_single(X[0])
```

```sh
14.7 µs ± 682 ns per loop (mean ± std. dev. of 7 runs, 100000 loops each)
```

This is 4.8 faster than with `special.softmax`, and 10.4 times than scikit-learn's default implementation. Not bad!

Linear and logistic regression might be simple methods, but according to a [very recent survey paper](https://arxiv.org/abs/1912.09536) by a team at Microsoft they are two of the most used classes in scikit-learn, so they merit attention. Now how about scikit-learn [`StandardScaler`](https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.StandardScaler.html)? It's a common preprocessing step before any linear model, and as such is likely to be used in conjunction with the two models above. As usual let's start off by measuring the performance of the default implementation:

```py
from sklearn import preprocessing

scaler = preprocessing.StandardScaler()
scaler.fit(X)
%timeit scaler.transform(X[[0]])[0]
```

```sh
43 µs ± 1.07 µs per loop (mean ± std. dev. of 7 runs, 10000 loops each)
```

A standard scaling step requires nothing more than subtracting the column-wise mean and dividing by the column-wise standard deviation of the data, as so:

```py
class BarebonesStandardScaler(preprocessing.StandardScaler):

    def transform_single(self, x):
        return (x - self.mean_) / self.var_ ** .5
```

This gives us the following performance:

```py
bb_scaler = BarebonesStandardScaler()
bb_scaler.fit(X)
%timeit bb_scaler.transform_single(X[0])
```

```sh
1.7 µs ± 34.6 ns per loop (mean ± std. dev. of 7 runs, 1000000 loops each)
```

Now what if we want to use our custom `BarebonesStandardScaler` with `BarebonesLinearRegression` or `BarebonesLogisticRegression` at the same time? Well the canonical way to compose modeling steps in scikit-learn is through the use of [pipelines](https://scikit-learn.org/stable/modules/compose.html). We can implement a custom pipeline class, which inherits from scikit-learn's [pipeline.Pipeline](https://scikit-learn.org/stable/modules/generated/sklearn.pipeline.Pipeline.html) and provides a `predict_single` function as well as a `predict_proba_single` function. Here goes:

```py
from sklearn import pipeline

class BarebonesPipeline(pipeline.Pipeline):

    def predict_single(self, x):
        for _, transformer in self.steps[:-1]:
            x = transformer.transform_single(x)
        return self.steps[-1][1].predict_single(x)

    def predict_proba_single(self, x):
        for _, transformer in self.steps[:-1]:
            x = transformer.transform_single(x)
        return self.steps[-1][1].predict_proba_single(x)
```

Let's see what execution speed we obtain:

```py
bb_pp = BarebonesPipeline([('bb_scaler', bb_scaler), ('bb_lin_reg', bb_lin_reg)])
bb_pp.fit(X, y)
%timeit bb_pp.predict_single(X[0])
```

```sh
3.96 µs ± 184 ns per loop (mean ± std. dev. of 7 runs, 100000 loops each)
```

Now let's compare that with the default implementation from scikit-learn:

```py
pp = pipeline.Pipeline([('scaler', scaler), ('lin_reg', lin_reg)])
pp.fit(X, y)
%timeit pp.predict(X[[0]])[0]
```

```sh
97.6 µs ± 4.19 µs per loop (mean ± std. dev. of 7 runs, 10000 loops each)
```

Our custom implementation is around 24.7 times faster. Finally, we can check that our implementation produces the correct outputs:

```py
for xi in X:
    assert pp.predict([xi])[0] == bb_pp.predict_single(xi)
```

That wraps this blog post up! I hope you enjoyed it. The takeaway is that you can speed up making predictions with scikit-learn, but it requires knowing how the algorithms actually work and how they are implemented, which isn't necessarily a bad thing. You can find all the code used in this notebook in [this gist](https://gist.github.com/MaxHalford/47cd83f7cb8e23d2db5616ba9b177ea9). I've also included an attempt at speeding up scikit-learn's [`DecisionTreeRegressor`](https://scikit-learn.org/stable/modules/generated/sklearn.tree.DecisionTreeRegressor.html), but to little avail. Feel free to drop me a line if you have any similar hacks and want to talk about it!
