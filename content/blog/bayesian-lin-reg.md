+++
date = "2019-06-02"
draft = true
title = "Bayesian, online, linear, regression"
+++

## Motivation

Suppose you have an infinite stream of features $x_i$ and targets $y_i$. Your goal is to estimate $y_i$ *before* it is revealed to you. To do so, you have a model which is composed of parameters denoted $w_i$. For example, $w_i$ represents the feature weights when using linear regression. After a while $y_i$ will be revealed, which enables you to update $w_i$ using whatever rule you like. What I just described is called *online learning*. The difference with the more traditional *batch learning* is that the model learns on the fly, and updating $w_i$ is almost always a very cheap operation. Online learning solves a lot of pain points in production, mostly because it doesn't require retraining models from scratch every time new data arrives.

Most online learning models are built around some form of stochastic gradient descent. Moreover, they estimate $y_i$ using a single value via maximum likelihood estimation, yada yada yada. A different approach is to estimate $y_i$ using a distribution. In other words, instead of predicting a single value we would rather like to know the probability of every possible outcome. This is one of the many benefits *Bayesian inference* brings to the table.

## A simple view of Bayesian inference

I've stumbled on many blogs, posts, textbooks, slides, that discussed Bayesian inference. In my opinion it's a hard topic, and it has many rabbit holes that go on for ever. [Bishop's classical book](https://cds.cern.ch/record/998831/files/9780387310732_TOC.pdf) is a very good reference, but it leaves me unsatisfied with regards to the sequential aspect of inference. There's a solid chance that this is because I am too stupid to understand everything written in Bishop's book. However, I would like to present a (my) pragmatic view of Bayesian inference, focused on online machine learning and practical aspects. I've chosen a notation that is particularly suited to online machine learning.

<p style="border:3px; border-style:solid; border-color:forestgreen; padding: 1em">
I like to think of a Bayesian model as a set of blocks. For forecasting purposes, the block we're interested in is called the {{<color forestgreen "predictive distribution">}}. The predictive distribution is the distribution of the target $y_i$ given a set of features $x_i$. We'll write it down as so:

{{<color forestgreen "$$p(y_i | x_i)$$">}}

{{<color forestgreen "This is the distribution we want">}}. It's the goal of many practitioners who want to take into account predictive uncertainty. Later on we'll see how the predictive distribution is obtained by assembling the rest of the blocks.
</p>

<p style="border:3px; border-style:solid; border-color:crimson; padding: 1em">
The next block is the {{<color crimson likelihood>}}, which is the probability distribution of an observation $y_i$ conditioned on the current model parameters $w_i$ and a set of features $x_i$. In other words, given the current state of the model, the likelihood tells you how realistic it is to predict $y_i$ when receiving $x_i$. We'll write it down as follows:

{{<color crimson "$$p(y_i | w_i, x_i)$$">}}

The thing is that the likelihood is usually imposed by the problem you're dealing with. For example you could assume that $y_i$ is related to $x_i$ and that the relationship has Gaussian noise in it. Most of the time the likelihood is presented as a Gaussian distribution or a Bernoulli distribution, mostly because these distributions occur naturally. However the likelihood can be any parametric distribution. The point I want to make is that {{<color crimson "the likelihood is something you have to choose">}}.
</p>

<p style="border:3px; border-style:solid; border-color:royalblue; padding: 1em">
Next, we have the {{<color royalblue "prior distribution">}} of the model parameters. From an online learning perspective, I like to think of this as the current distribution of the model parameters. This will get clearer later on, I promise! We'll simply denote the prior distribution as so:

{{<color royalblue "$$p(w_{i})$$">}}

Choosing a prior is important, because for our case it can add regularization to our model. The trick is that if we choose a prior distribution that is so-called <i>conjugate</i> for the {{<color crimson likelihood>}}, then we get access to analytical formulas for updating the model parameters. If however the prior and the likelihood are not compatible with each other, then we have to resort to using approximate methods such as <a href="ttps://twiecki.io/blog/2015/11/10/mcmc-sampling">MCMC</a> and <a href="https://www.wikiwand.com/en/Variational_Bayesian_methods">variational inference</a>. As cool as they may be, these tools are designed for situations where all the data is available at once. In other words they are not applicable in a streaming context, whereas analytical formulas are.
</p>

<p style="border:3px; border-style:solid; border-color:blueviolet; padding: 1em">
Finally, the {{<color blueviolet "posterior distribution">}} represents the distribution of the model parameters $w_{i+1}$ once we've received a new pair $(x_{i}, y_{i})$. For online learning purposes, here is how we're going to write it down:

{{<color blueviolet "$$p(w_{i+1} | w_{i}, x_{i}, y_{i})$$">}}

As you might have understood, the {{<color blueviolet "posterior distribution">}} is obtained by combining the {{<color crimson likelihood>}} of $(x_{i}, y_{i})$ and the {{<color royalblue "prior distribution">}} of the current model parameters $w_{i}$. As a mnemonic, {{<color crimson red>}} $+$ {{<color royalblue blue>}} $=$ {{<color blueviolet purple>}}.
</p>

Now that we have all our blocks, we need to put them together. It's quite straightforward once you understand how the blocks are related. {{<color crimson "You start off with the likelihood, which is a probability distribution you have to choose">}}. For example if you're looking to predict counts then you would use a Poisson distribution. I'm refraining from giving a more detailed example simply because we will be going over one later on. What matters for the while is to develop an intuition, and for that I want to keep the notation as general as possible. {{<color royalblue "Once you have settled on a likelihood, you need to choose a prior distribution for the model parameters">}}. Because our focus is on online learning, we want to have access to quick analytical formulas, and not MCMC voodoo. In order to so, we need to pick a prior distribution which is conjugate to the likelihood. Note that most distributions have at least one other distribution which is conjugate to them, as detailed [here](https://www.wikiwand.com/en/Conjugate_prior#/Table_of_conjugate_distributions). {{<color blueviolet "Now that you have decided which likelihood to use and what prior to associate with it, you may derive the posterior distribution of the model parameters">}}. This operation is the cornerstone of Bayesian inference, and is done via Bayes' rule:

$$\color{blueviolet} p(w_{i+1} | w_i, x_i, y_i) \color{black} = \frac{\color{crimson} p(y_i | w_i, x_i) \color{royalblue} p(w_i)}{\color{black} p(x_i | y_i)}$$

On a side-note, check out [this recent video by 3Blue1Brown](https://www.youtube.com/watch?v=HZGCoVF3YvM) on Bayes' rule. Now you may be wondering what $p(x_i | y_i)$ is. It turns out it is the distribution of the data, and is something that we don't know! If we knew it, then we wouldn't have to be doing machine learning in the first place: we would know the process which generates the data. The trick is that we can determine it by integrating the numerator with respect to $w_i$, which gives us:

$$\color{blueviolet} p(w_{i+1} | w_i, x_i, y_i) \color{black} = \frac{\color{crimson} p(y_i | w_i, x_i) \color{royalblue} p(w_i)}{\color{black} \int \color{crimson} p(y_i | \textbf{w}, x_i) \color{royalblue} p(\textbf{w}) \color{black} d\textbf{w}}$$

In the general case, the denominator has no analytical solution, which explains why one has to use MCMC methods. Meanwhile, analytical solutions do exist when the likelihood and the prior are conjugate to each other, which is the case in which we are interested for online learning. To keep things general, we will simply write down:

$$\color{blueviolet} p(w_{i+1} | w_i, x_i, y_i) \color{black} \propto \color{crimson} p(y_i | w_i, x_i) \color{royalblue} p(w_i)$$

The previous statement simply expresses the fact that the posterior distribution of the model parameters is proportional to the product of the likelihood and the prior distribution. In other words, in can be obtained using an analytical formula that is specific to the chosen likelihood and prior distribution.

If we're being pragmatic, what we're really interested in is to obtain the {{<color forestgreen "predictive distribution">}}, which is obtained by marginalizing over the model parameters $w_{i}$:

$$\color{forestgreen} p(y\_i | x\_i) \color{black} = \int p(\textbf{w}, y\_i | x\_i) d\textbf{w} = \int \color{crimson} p(y\_i | \textbf{w}, x\_i) \color{royalblue} p(\textbf{w}) \color{black} d\textbf{w}$$

Again, this isn't analytically tractable, except if the likelihood and the prior are conjugate to each other. The equation does make sense though, because essentially we're computing a weighted average of the potential $y_i$ values for each possible model parameter $\textbf{w}$.

$$\color{forestgreen} p(y\_i | x\_i) \color{black} \propto \color{crimson} p(y_i | w_i, x_i) \color{royalblue} p(w_i)$$

Basically, the thing to remember is that the predictive distribution can be obtained by using the likelihood and the current distribution of the weights.

## Online belief updating

The important result of the previous section is that we can

$$\color{blueviolet} p(w_{i+1} | w_i, x_i, y_i) \color{black} \propto \color{crimson} p(x_i, y_i | w_i) \color{royalblue} p(w_i)$$

Before any data comes in, the model parameters follow the initial distribution we picked, which is $p(w_0)$. Next, once the first observation $(x_0, y_0)$ arrives, we can obtain the distribution of $w_1$:

$$\color{blueviolet} p(w_1 | w_0, x_0, y_0) \color{black} \propto \color{crimson} p(x_0, y_0 | w_0) \color{royalblue} p(w_0)$$

Once the second observation $(x_1, y_1)$ is available, the distribution of the model parameters is obtained in the same way:

$$\color{blueviolet} p(w_2 | w_1, x_1, y_1) \color{black} \propto \color{crimson} p(x_1, y_1 | w_1) \color{black} \underbrace{\color{crimson} p(x_0, y_0 | w_0) \color{royalblue} p(w_0)}\_{\color{royalblue} p(w_1)}$$

The nice thing is that the relationship between each step is recursive. The posterior distribution at step $i$ actually becomes the prior distribution at step $i+1$. This simple fact is the reason why analytical Bayesian inference can naturally be used for online learning. Indeed, we only need to store the current distribution of the weights to make everything work.


## The case of linear regression

Up until now we didn't give any useful example. We will now see to perform a linear regression using Bayesian inference.

$$y\_i = w\_i x\_i^t + \epsilon_i$$

Each prediction is the scalar product between $p$ features $x_i$ and $p$ weights $w_i$. The trick here is that we're going to assume that the noise $\epsilon_i$ follows a given distribution. By doing so, we're also assuming that the target follows the same distribution, but at a different scale.

### Gaussian prior

https://www.youtube.com/watch?v=nrd4AnDLR3U&list=PLD0F06AA0D2E8FFBA&index=61

The likelihood is a Gaussian distribution:

$$\color{crimson} p(y_i | w_i, x_i) = \mathcal{N}(w_i x_i^t, \beta^{-1})$$

The appropriate prior distribution for the weights is a multivariate distribution, i.e.

$$\color{royalblue} p(w_0) = \mathcal{N}(m_0, S_0)$$

$$m\_0 = (0, \dots , 0)$$

$$S\_0 = \begin{pmatrix} \alpha^{-1} & \dots & \dots \\\ \dots & \alpha^{-1} & \dots \\\ \dots & \dots & \alpha^{-1} \end{pmatrix}$$

We can now determine the posterior distribution of the weights:

$$\color{blueviolet} p(w\_{i+1} | w\_i, x\_i, y\_i) = \mathcal{N}(m\_{i+1}, S\_{i+1})$$

$$S\_{i+1} = (S\_i^{-1} + \beta x\_i^t x_i)^{-1}$$

$$m\_{i+1} = S\_{i+1}(S\_i m\_i + \beta x_i y_i)$$

We can also obtain the predictive distribution:

$$\color{forestgreen} p(y_i) = \mathcal{N}(m_i, S_i)$$

$$m\_i = w\_i x\_i^t$$

$$S\_i = \frac{1}{\beta} + x\_i S\_n x\_i^t$$

```python
import numpy as np

class Normal:

    def __init__(self, mean, var):
        self.mean = mean
        self.var = var

    def __str__(self):
        return f'𝒩(μ={self.mean:.3f}, 𝜎={self.var ** 0.5:.3f})'
```

```python
class BayesLinReg:

    def __init__(self, p, alpha, beta):
        self.mean = np.zeros(p)
        self.cov_inv = np.identity(p) * alpha
        self.beta = beta

    def update(self, x, y):

        # Update the inverse covariance matrix (Bishop eq. 3.51)
        cov_inv = self.cov_inv + self.beta * np.outer(x, x)

        # Update the mean vector (Bishop eq. 3.50)
        cov = np.linalg.inv(cov_inv)
        mean = cov @ (self.cov_inv @ self.mean + self.beta * x * y)

        self.cov_inv = cov_inv
        self.mean = mean

    def predict(self, x):

        # Obtain the predictive mean (Bishop eq. 3.58)
        y_pred_mean = np.dot(self.mean, x)

        # Obtain the predictive variance (Bishop eq. 3.59)
        w_cov = np.linalg.inv(self.cov_inv)
        y_pred_var = 1 / self.beta + x @ w_cov @ x.T

        return Normal(y_pred_mean, y_pred_var)
```

```python
from creme import metrics
from creme import stream

# Load the data
dataset = datasets.load_boston()
X_y = zip(dataset.data, dataset.target)

# Initialize the model
n_features = len(dataset.data[0])
model = BayesLinReg(p=13, alpha=3, beta=20)

# Choose a metric
metric = metrics.MAE()

# Learn online
for x, y in X_y:
    y_pred = model.predict(x)
    metric.update(y, y_pred.mean)
    model.update(x, y)

# Show the final metric
print(metric)
```

## One step further: learning $\beta$

## Zero-mean isotropic Gaussian prior

## Isotropic Gaussian prior

## Going further

- [A Bayesian Approach to Online Learning - Manfred Opper (paper)](https://www.ki.tu-berlin.de/fileadmin/fg135/publikationen/opper/Op98b.pdf)
- [Bayesian $\propto$ Streaming Algorithms - Vincent Warmerdam (blog post)](http://koaning.io/bayesian-propto-streaming-algorithms.html)
- [Bayesian Linear Regression - Sargur Srihari (slides)](https://cedar.buffalo.edu/~srihari/CSE574/Chap3/3.4-BayesianRegression.pdf)
