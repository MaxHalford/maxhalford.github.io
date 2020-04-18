+++
date = "2020-05-20"
title = "The correct way to evaluate online machine learning models"
toc = true
+++

## Motivation

Most supervised machine learning algorithms work in the batch setting, whereby they are fitted on a training set offline, and are used to predict the outcomes of new samples. The only way for batch machine learning algorithms to learn from new samples is to train them from scratch with both the old samples and the new ones. Meanwhile, some learning algorithms are online, and can predict as well as update themselves when new samples are available. This encompasses any model trained with [stochastic gradient descent](https://leon.bottou.org/publications/pdf/compstat-2010.pdf) -- which includes deep neural networks, [factorisation machines](https://www.csie.ntu.edu.tw/~b97053/paper/Rendle2010FM.pdf), and [SVMs](https://www.cs.huji.ac.il/~shais/papers/ShalevSiSrCo10.pdf) -- as well as [decision trees](https://homes.cs.washington.edu/~pedrod/papers/kdd00.pdf), [metric learning](https://ai.stanford.edu/~ang/papers/icml04-onlinemetric.pdf), and [naïve Bayes](https://people.csail.mit.edu/jrennie/papers/icml03-nb.pdf).

Online models are usually weaker than batch models when trained on the same amount of data. However, this discrepancy tends to get smaller as the size of the training data increases. Researchers try to build online models that are guaranteed to reach the same performance as a batch model when the size of the data grows -- they call this *convergence*. But comparing online models to batch models isn't really fair, because they're not meant to solve the same problems.

<img src="/img/blog/online-learning-evaluation/meme.png" width="30%">
<br>

Batch models are meant to be used when you can afford to retrain your model from scratch every so often. Online models, on the contrary, are meant to be used when you want your model to learn from a stream of data, and therefore never have to restart from scratch. Learning from a stream of data is something a batch model can't do, and is very much different to the usual train/test split paradigm that machine learning practitioners are used to. In fact, there are other ways to evaluate the performance of an online model that make more sense than, say, cross-validation.

## Cross-validation

To begin with, I'm going to compare scikit-learn's [`SGDRegressor`](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.SGDRegressor.html) and [`Ridge`](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.Ridge.html). In a nutshell, `SGDRegressor` has the same model parameters as a `Ridge`, but is trained via stochastic gradient descent, and can thus learn from a stream of data. In practice this happens via the [`partial_fit`](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.SGDRegressor.html#sklearn.linear_model.SGDRegressor.partial_fit) method. Both can be seen as linear regression with some L2 regularisation thrown into the mix. Note that scikit-learn provides [a list](https://scikit-learn.org/stable/modules/computing.html#incremental-learning) of it's estimators that support "incremental learning", which is a synonym of online learning.

As a running example in this blog post, I'm going to be using the [New-York City taxi trip duration dataset](https://www.kaggle.com/c/nyc-taxi-trip-duration) from Kaggle. This dataset contains 6 months of taxi trips and is a perfect usecase for online learning. We'll start by loading the data and tidying it up a bit:

```py
import pandas as pd

taxis = pd.read_csv(
    'nyc_taxis/train.csv',
    parse_dates=['pickup_datetime', 'dropoff_datetime'],
    index_col='id',
    dtype={'vendor_id': 'category', 'store_and_fwd_flag': 'category'}
)
taxis = taxis.rename(columns={
    'pickup_longitude': 'pickup_lon',
    'dropoff_longitude': 'dropoff_lon',
    'pickup_latitude': 'pickup_lat',
    'dropoff_latitude': 'dropoff_lat'
})
taxis.head()
```

| id        |   vendor_id | pickup_datetime     | dropoff_datetime    |   passenger_count |   pickup_lon |   pickup_lat |   dropoff_lon |   dropoff_lat | store_and_fwd_flag   |   trip_duration |   l1_dist |    l2_dist |   day |   weekday |   hour |
|:----------|------------:|:--------------------|:--------------------|------------------:|-------------:|-------------:|--------------:|--------------:|:---------------------|----------------:|----------:|-----------:|------:|----------:|-------:|
| id0190469 |           2 | 2016-01-01 00:00:17 | 2016-01-01 00:14:26 |                 5 |     -73.9817 |      40.7192 |      -73.9388 |       40.8292 | N                    |             849 | 0.152939  | 0.118097   |     1 |         4 |      0 |
| id1665586 |           1 | 2016-01-01 00:00:53 | 2016-01-01 00:22:27 |                 1 |     -73.9851 |      40.7472 |      -73.958  |       40.7175 | N                    |            1294 | 0.0567207 | 0.0401507  |     1 |         4 |      0 |
| id1210365 |           2 | 2016-01-01 00:01:01 | 2016-01-01 00:07:49 |                 5 |     -73.9653 |      40.801  |      -73.9475 |       40.8152 | N                    |             408 | 0.031929  | 0.0227259  |     1 |         4 |      0 |
| id3888279 |           1 | 2016-01-01 00:01:14 | 2016-01-01 00:05:54 |                 1 |     -73.9823 |      40.7513 |      -73.9913 |       40.7503 | N                    |             280 | 0.0100403 | 0.00910266 |     1 |         4 |      0 |
| id0924227 |           1 | 2016-01-01 00:01:20 | 2016-01-01 00:13:36 |                 1 |     -73.9701 |      40.7598 |      -73.9894 |       40.743  | N                    |             736 | 0.0360603 | 0.0255567  |     1 |         4 |      0 |

The dataset contains a few anomalies, such as trips that last an very large amount of time. For simplicity we'll only consider the trips that last under an hour, which is the case for over 99% of the them.

```py
taxis.query('trip_duration < 3600', inplace=True)
```

Now let's add a few features.

```py
# Distances
taxis['l1_dist'] = taxis.eval('abs(pickup_lon - dropoff_lon) + abs(pickup_lat - dropoff_lat)')
taxis['l2_dist'] = taxis.eval('sqrt((pickup_lon - dropoff_lon) ** 2 + (pickup_lat - dropoff_lat) ** 2)')

# The usual suspects
taxis['day'] = taxis['pickup_datetime'].dt.day
taxis['weekday'] = taxis['pickup_datetime'].dt.weekday
taxis['hour'] = taxis['pickup_datetime'].dt.hour
```

Cross-validation is a well-known machine learning technique, so allow me not to disgress on it. The specifity of our case is that our observations have timestamps. Therefore, performing a cross-sampling with folds chosen at random is a mistake. Indeed, if our goal is to get a faithful idea of the performance of our model for future data, then we need to take into account the temporal aspect of the data. For more material on this, I recommend reading [this research paper](https://www.google.com/search?client=firefox-b-d&q=temporal+cross-validation) and [this CrossValidated thread](https://stats.stackexchange.com/questions/14099/using-k-fold-cross-validation-for-time-series-model-selection). To keep things simple, we can split our dataset in two. The test set will be the last month in our dataset, which is June, whilst the training set will contain all the months before that. This isn't cross-validation per say, but what matters here is the general idea.

```py
from sklearn import preprocessing

is_test = taxis['pickup_datetime'].dt.month == 6  # i.e. the month of June
not_features = [
    'vendor_id', 'pickup_datetime', 'dropoff_datetime',
    'store_and_fwd_flag', 'trip_duration'
]

X = taxis.drop(columns=not_features)
X[:] = preprocessing.scale(X)
y = taxis['trip_duration']

X_train = X[~is_test]
y_train = y[~is_test]

X_test = X[is_test]
y_test = y[is_test]
```

Now obtaining a performance score for a batch model is simple: we train it on the training set and we make predictions on the test set. In our case we'll calculate the mean absolute error because this implies that the error will be measured in seconds.

```py
from sklearn import linear_model
from sklearn import metrics

lin_reg = linear_model.Ridge()

lin_reg.fit(X_train, y_train)
y_pred = lin_reg.predict(X_test)

score = metrics.mean_absolute_error(y_test, y_pred)
```

As for the `SGDRegressor`, we can also train it on the whole training set and evaluate it on the test set. However, we can also train it incrementally by batching the training set. For instance, we can split the training set in 5 cunks and call `partial_fit` on each chunk. We can therefore see much the amount of training data affects the performance on the test set. Note that we choose 5 because this is equivalent to the number of months in the training set.

```py
import numpy as np

sgd = linear_model.SGDRegressor(
    learning_rate='constant',
    eta0=0.01,
    random_state=42
)

n_rows = 0
scores = {}

for X_chunk in np.array_split(X_train.iloc[::-1], 5):
    y_chunk = y_train.loc[X_chunk.index]

    sgd = sgd.partial_fit(X_chunk, y_chunk)
    y_pred = sgd.predict(X_test)

    n_rows += len(X_chunk)
    scores[n_rows] = metrics.mean_absolute_error(y_test, y_pred)
```

Let's see how this looks on a chart.

<details>
  <summary>Click to see the code</summary>

```py
fig, ax = plt.subplots(figsize=(14, 8))

ax.axhline(score, label='Batch linear regression')

ax.scatter(
    list(scores.keys()),
    list(scores.values()),
    label='Incremental linear regression'
)

ax.legend(loc='lower center')
ax.set_ylim(0, score * 1.1)
ax.ticklabel_format(style='sci', axis='x', scilimits=(0, 0))
ax.grid()
ax.set_xlabel('Number of observations', labelpad=10)
ax.set_ylabel('Mean absolute error', labelpad=10)
ax.set_title('Batch vs. incremental linear regression', pad=16)
fig.savefig('batch_vs_incremental.svg', bbox_inches='tight')
```

</details>

![batch_vs_incremental](/img/blog/online-learning-evaluation/batch_vs_incremental.svg)

As we can see, both models seem to be performing just as well. The average error is just north of 5 minutes. It seems that the amount of data doesn't have too much of an impact on performance. But this isn't telling the whole story.

## Progressive validation

In the case of online learning, the shortcoming of cross-validation is that it doesn't faithfully reproduce the steps that the model will undergo. Cross-validation assumes that the model is trained once and remains static from thereon. However, an online model keeps learning, and can make predictions at any point in it's lifetime. Remember, our goal is to obtain a measure of how well the model would perform in a production environment. Cross-validation will produce a proxy of this measure, but we can do even better.

In the case of online machine learning, we have another validation tool at our disposal called [progressive validation](http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.153.3925&rep=rep1&type=pdf). In an online setting, observations arrive from a stream in sequential order. Each observation can be denoted as $(x_i, y_i)$, where $x_i$ is a set of features, $y_i$ is a label, and $i$ is used to denote time (i.e., it can be an integer or a timestamp). Before updating the model with the pair $(x_i, y_i)$, we can ask the model to predict the output of $x_i$, and thus obtain $\hat{y}_i$. We can then update a live metric by providing it with $y_i$ and $\hat{y}_i$. Indeed, common metrics such as accuracy, MSE, and ROC AUC are all sums and can thus be updated online. By doing so, the model is trained with all the data in a single pass, and all the data is as well used as a validation set. Think about that, because it's quite a powerful idea. Moreover, the data is processed in the order in which it arrives, which means that it is virtually impossible to introduce [data leakage](https://www.quora.com/Whats-data-leakage-in-data-science) -- including [target leakage](https://www.datarobot.com/wiki/target-leakage/).

Let's apply progressive validation to our `SGDRegressor` on the whole taxi trips dataset. I encourage you to go through the code because it's quite self-explanatory. I've added comments to separate the sequences of steps that are performed. In short these are: 1) get the next sample, 2) make a prediction, 3) update a running average of the error, 4) update the model. A [exponentially weighted average](https://www.wikiwand.com/en/Moving_average#/Exponential_moving_average) of the MAE is stored in addition to the overall running average. This allows to get an idea of the recent performance of the model at every point in time. To keep things clear in the resulting chart, I've limited the number of samples to 38,000, which roughly corresponds to a week of data.

```py
from sklearn import exceptions

sgd = linear_model.SGDRegressor(
    learning_rate='constant',
    eta0=0.01,
    random_state=42
)
scores = []
exp_scores = []
running_mae = 0
exp_mae = 0

X_y = zip(X.to_numpy(), y.to_numpy())
dates = taxis['pickup_datetime'].to_numpy()

for i, date in enumerate(dates, start=1):

    xi, yi = next(X_y)

    # Make a prediction before the model learns
    try:
        y_pred = sgd.predict([xi])[0]
    except exceptions.NotFittedError:  # happens if partial_fit hasn't been called yet
        y_pred = 0.

    # Update the running mean absolute error
    mae = abs(y_pred - yi)
    running_mae += (mae - running_mae) / i

    # Update the exponential moving average of the MAE
    exp_mae = .1 * mae + .9 * exp_mae

    # Store the metric at the current time
    if i >= 10:
        scores.append((date, running_mae))
        exp_scores.append((date, exp_mae))

    # Finally, make the model learn
    sgd.partial_fit([xi], [yi])

    if i == 38000:
        break
```

Now let's how this looks:

<details>
  <summary>Click to see the code</summary>

```py
import matplotlib.dates as mdates

fig, ax = plt.subplots(figsize=(14, 8))

hours = mdates.HourLocator(interval=8)
h_fmt = mdates.DateFormatter('%A %H:%M')

ax.plot(
    [d for d, _ in scores],
    [s for _, s in scores],
    linewidth=3,
    label='Running average',
    alpha=.7
)

ax.plot(
    [d for d, _ in exp_scores],
    [s for _, s in exp_scores],
    linewidth=.3,
    label='Exponential moving average',
    alpha=.7
)

ax.legend()
ax.set_ylim(0, 600)
ax.xaxis.set_major_locator(hours)
ax.xaxis.set_major_formatter(h_fmt)
fig.autofmt_xdate()
ax.grid()
ax.set_xlabel('Time', labelpad=10)
ax.set_ylabel('Mean absolute error', labelpad=10)
ax.set_title('Progressive validation', pad=16)
fig.savefig('progressive_validation.svg', bbox_inches='tight')
```

</details>

![progressive_validation](/img/blog/online-learning-evaluation/progressive_validation.svg)

There are two interesting things to notice. First of all, the average performance of the online model is around 200 seconds, which is better than when using cross-validation. This should make sense, because in this online paradigm the model gets to learn every time a sample arrives, whereas previously it was static. You could potentially obtain the same performance with a batch model, but you would need to retrain it from scratch every time a sample arrives. At the very least it would have to be retrained as frequently as possible. The other thing to notice is that the performance of the model seems to oscillate periodically. This could mean that there is an underlying seasonality that the model is not capturing. It could also mean that the variance of the durations changes along time. In fact, this can be verified by looking at the average and the variance of the trip durations per hour of the day.

<details>
  <summary>Click to see the code</summary>

```py
agg = (
    taxis.assign(hour=taxis.pickup_datetime.dt.hour)
    .groupby('hour')['trip_duration']
    .agg(['mean', 'std'])
)

fig, ax = plt.subplots(figsize=(14, 8))

color = 'tab:red'
agg['mean'].plot(ax=ax, color=color)
ax.set_ylabel('Average trip duration', labelpad=10, color=color)
ax.set_ylim(0, 1000)

ax2 = ax.twinx()
color = 'tab:blue'
agg['std'].plot(ax=ax2, color=color)
ax2.set_ylabel('Trip duration standard deviation', labelpad=10, color=color)
ax2.set_ylim(0, 750)

ax.grid()
ax.set_xticks(range(24))
ax.set_xlabel('Hour of departure', labelpad=10)
ax.set_title('Trip duration distribution per hour', pad=16)
fig.savefig('hourly_averages.svg', bbox_inches='tight')
```

</details>

![hourly_averages](/img/blog/online-learning-evaluation/hourly_averages.svg)

We can see that there is much more variance for trips that depart at the beginning of the afternoon than there is for those that occur at night. There are many potential explanations, but that isn't the topic of this blog post. The above chart just helps to explain where the cyclicity in the model's performance is coming from.

In an online setting, progressive validation is a natural method and is often used in practice. For instance, it is mentioned in subsection 5.1 of [*Ad Click Prediction: a View from the Trenches*](https://static.googleusercontent.com/media/research.google.com/fr//pubs/archive/41159.pdf). In this paper, writter by Google researchers, they use progressive validation to evaluate an ad [click–through rate (CTR)](https://www.wikiwand.com/en/Click-through_rate) model. The authors of the paper remark that models which are based on the gradient of a loss function require computing a prediction anyway, in which case progressive validation can essentially be performed for free. Progressive validation is appealing because it attempts to simulate a live environment wherein the model has to predict the outcome of $x_i$ before the ground truth $y_i$ is made available. For instance, in the case of a CTR task, the label $y_i \in \{0, 1\}$ is available once the user has clicked on the ad (i.e., $y_i = 1$), has navigated to another page (i.e., $y_i = 0$), or a given amount of time has passed (i.e., $y_i = 0$). Indeed, in a live environment, there is a delay between the query (i.e., predicting the outcome of $x_i$) and the answer (i.e., when $y_i$ is revealed to the model). Note that machine learning is used in the first place because we want to guess $y_i$ before it happens. The larger the delay, the lesser the chance that $x_i$ and $y_i$ will arrive in perfect sequence. Before $y_i$ is made available, any of $x_{i+1}, x_{i+2}, \dots$ could potentially arrive and require predictions to be made. However, when using progressive validation, we implicitly assume that there is no delay. In other words the model has access to $y_i$ immediately after having produced $\hat{y}_i$. Therefore, progressive validation is not necessarily a faithful simulation of a live environment. In fact progressive validation is overly optimistic when the data contains seasonal patterns.

## Delayed progressive validation

In a CTR task, the delay between the query $x_i$ and the answer $y_i$ is usually quite small and can be measured in seconds. However, for other tasks, the gap can be quite large because of the nature of the problem. If a model predicts the duration of a taxi trip, then obviously the duration of the trip, is only known once the taxi arrives at the desired destination. However, when using progressive validation, the model is given access to the true duration right after it has made a prediction. If the model is then asked to predict the duration of another trip which departs at a similar time as the previous trip, then it will be cheating because it knows how long the previous trip lasts. In a live environment this situation can't occur because the future is obviously unknown. However, in a local environment this kind of leakage can occur if one is not careful. To accurately simulate a live environment and thus get a reliable estimate of the performance of a model, we thus need to take into account the delay in arrival times between $x_i$ and $y_i$. The problem with progressive validation is that it doesn't take said delay into account.

The gold standard is to have a log file with the arrival times of each set of features $x_i$ and each outcome $y_i$. We can then ask the model to make a prediction when $x_i$ arrives, and update itself with $(x_i, y_i)$ once $y_i$ is available. In a fraud detection system for credit card transactions, $x_i$ would contain details about the transaction, whilst $y_i$ would be made available once a human expert has confirmed the transaction as fraudulent or not. However, a log file might not always be available. Indeed, most of the time datasets do not indicate the times at which both the features and the targets arrived.

A method for alleviating this issue is called "delayed progressive validation". I've added quotes because I actually coined it myself. The short story is that I wanted to publish a paper on the topic. A short while after, during an exchange with [Albert Bifet](http://albertbifet.com/), he told me that his team had very recently published [a paper on the topic](https://link.springer.com/article/10.1007/s10618-019-00654-y). I cursed a tiny bit and decided to write a blog post instead!

Delayed progressive validation is quite intuitive. Instead of updating the model immediately after it has made a prediction, the idea is to update it once the ground truth *would* be available. This way the model learns and predicts samples without leakage. To do so, we can pick a delay $d > 0$ and append a quadruplet $(i + d, x_i, y_i, \hat{y}_i)$ into a sorted list which we'll call $Q$. Once we reach $i + d$, the model is given access to $y_i$ and can therefore be updated, whilst the metric can be updated with $y_i$ and $\hat{y}_i$. We can check if we've reached $i + d$ every time a new observation comes in.

For various reasons you might not be able to assign an exact value to $d$. The nice thing is that $d$ can be anything you like, and doesn't necessarily have to be the same for every observation. This provides the flexibility of either using a constant, a random variable, or a value that depends on one or more attributes of $x_i$. For instance, in a credit card fraud detection task, it might be that the delay varies according to the credit card issuer. In the case of taxi trips, $d$ is nothing more than the duration of the trip.

Initially, $Q$ is empty, and grows every time the model makes a prediction. Once the next observation arrives, we loop over $Q$ in insertion order. For each quadruplet in $Q$ which is old enough, we update the model and the metric, before removing the quadruplet from $Q$. Because $Q$ is ordered, we can break the loop over $Q$ whenever a quadruplet is not old enough. Once we have depleted the stream of data, $Q$ will still contain some quadruplets, and so the final step of the procedure is to update the metric with the remaining quadruplets.

On the one hand, delayed progressive validation will perform as many predictions and model updates as progressive validation. Indeed, every observation is used once for making prediction, and once for updating the model. The only added cost comes from inserting $(x_i, y_i, \hat{y}_i, i + d)$ into $Q$ so that $Q$ remains sorted. This can be done in $\mathcal{O}(log(|Q|))$ time by using the bisection method, with $|Q|$ being the length of $Q$. In the special case where the delay $d$ is constant, the bisection method can be avoided because each quadruplet $(x_i, y_i, \hat{y}_i, i + d)$ can simply be inserted at the beginning of $Q$. Other operations, namely comparing timestamps and picking a delay, are trivial. On the other hand, the space complexity is higher than progressive validation because $Q$ has to be maintained in memory.

Naturally, the size of the queue is proportional to the delay. For most cases this shouldn't be an issue because the observations are being processed one at a time, which means that quadruplets are added and dropped from the queue at a very similar rate. You can also place an upper bound on the expected size of $Q$ by looking at the average value of $d$ and the arrival rate, but we'll skip that for the time being. In practice, if the amount of available memory runs out, then $Q$ can be written out to the disk, but this is very much an edge case. Finally, note that progressive validation can be seen as a special case of delayed progressive validation when the delay is set to 0. Indeed, in this case $Q$ will contain at most one element, whilst the predictions and model updates will be perfectly interleaved.

Let's go about implementing this. We'll use Python's [`bisect`](https://docs.python.org/3/library/bisect.html) module to insert quadruplets into the queue. Each quadruplet is a tuple that stands for a trip. We place the arrival date at the start of the tuple in order to be able to compare trips according to their arrival time. Indeed, Python compares tuples position by position, as explained in [this](https://stackoverflow.com/questions/5292303/how-does-tuple-comparison-work-in-python) StackOverflow post.

```py
import bisect
import datetime as dt

def simulate_qa(X_y, departure_dates):

    trips_in_progress = []

    for i, departure_date in enumerate(departure_dates, start=1):

        # Go through the trips and progress and check if they're finished
        while trips_in_progress:
            trip = trips_in_progress[0]
            arrival_date = trip[0]
            if arrival_date < departure_date:
                yield trip
                del trips_in_progress[0]
                continue
            break

        xi, yi = next(X_y)

        # Show the features, hide the target
        yield departure_date, i, xi, None

        # Store the trip for later use
        arrival_date = departure_date + dt.timedelta(seconds=int(yi))
        trip = (arrival_date, i, xi, yi)
        bisect.insort(trips_in_progress, trip)

    # Terminate the rest of the trips in progress
    yield from trips_in_progress
```

To differentiate between departures and arrivals, we're yielding a trip with a duration set to `None`. In other words, a `None` value implicitely signals a taxi departure which requires a prediction. This also avoids any leakage concerns that may occur. Let's do a quick sanity check to verify that our implementation behaves correctly. The following example also helps to understand and visualise what the above implementation is doing.

```py
time_table = [
    (dt.datetime(2020, 1, 1, 20,  0, 0),  900),
    (dt.datetime(2020, 1, 1, 20, 10, 0), 1800),
    (dt.datetime(2020, 1, 1, 20, 20, 0),  300),
    (dt.datetime(2020, 1, 1, 20, 45, 0),  400),
    (dt.datetime(2020, 1, 1, 20, 50, 0),  240),
    (dt.datetime(2020, 1, 1, 20, 55, 0),  450)
]

X_y = ((None, duration) for _, duration in time_table)
departure_dates = (date for date, _ in time_table)

for date, i, xi, yi in simulate_qa(X_y, departure_dates):

    if yi is None:
        print(f'{date} - trip #{i} departs')
    else:
        print(f'{date} - trip #{i} arrives after {yi} seconds')
```

```
2020-01-01 20:00:00 - trip #1 departs
2020-01-01 20:10:00 - trip #2 departs
2020-01-01 20:15:00 - trip #1 arrives after 900 seconds
2020-01-01 20:20:00 - trip #3 departs
2020-01-01 20:25:00 - trip #3 arrives after 300 seconds
2020-01-01 20:40:00 - trip #2 arrives after 1800 seconds
2020-01-01 20:45:00 - trip #4 departs
2020-01-01 20:50:00 - trip #5 departs
2020-01-01 20:51:40 - trip #4 arrives after 400 seconds
2020-01-01 20:54:00 - trip #5 arrives after 240 seconds
2020-01-01 20:55:00 - trip #6 departs
2020-01-01 21:02:30 - trip #6 arrives after 450 seconds
```

Now let's re-evaluate our model with delayed progressive cross-validation. There is very little we have to modify in the existing evaluation code. The biggest change is that we need to store the predictions while we wait for their associated ground truths to be available. We can release the prediciton from memory once the relevant ground truth arrives -- i.e. a taxi arrives.

```py
from sklearn import linear_model

sgd = linear_model.SGDRegressor(
    learning_rate='constant',
    eta0=0.01,
    random_state=42
)
scores = []
exp_scores = []
running_mae = 0
exp_mae = 0

X_y = zip(X.to_numpy(), y.to_numpy())
departure_dates = taxis['pickup_datetime']
trips = simulate_qa(X_y, departure_dates)

predictions = {}
n_preds = 0

for date, trip_id, xi, yi in trips:

    if yi is None:

        # Make a prediction
        try:
            y_pred = sgd.predict([xi])[0]
        except exceptions.NotFittedError:  # happens if partial_fit hasn't been called yet
            y_pred = 0.

        predictions[trip_id] = y_pred
        continue

    # Update the running mean absolute error
    y_pred = predictions.pop(trip_id)
    mae = abs(y_pred - yi)
    n_preds += 1
    running_mae += (mae - running_mae) / n_preds

    # Update the exponential moving average of the MAE
    exp_mae = .1 * mae + .9 * exp_mae

    # Store the metric at the current time
    if trip_id >= 10:
        scores.append((date, running_mae))
        exp_scores.append((date, exp_mae))

    # Finally, make the model learn
    sgd.partial_fit([xi], [yi])

    if n_preds == 38000:
        break
```

I agree that the code can seem a bit verbose. However, it's very easy to generalise and the logic can be encapsulated in a higher-level function, including the `simulate_qa` function. In fact, the [`creme`](https://github.com/creme-ml/creme) library has a `progressive_val_score` function in it's `model_selection` module that does just that. Now let's see what that the performance looks like on a chart.

<details>
  <summary>Click to see the code</summary>

```py
fig, ax = plt.subplots(figsize=(14, 8))

hours = mdates.HourLocator(interval=8)
h_fmt = mdates.DateFormatter('%A %H:%M')

ax.plot(
    [d.to_datetime64() for d, _ in scores],
    [s for _, s in scores],
    linewidth=3,
    label='Running average',
    alpha=.7
)

ax.plot(
    [d.to_datetime64() for d, _ in exp_scores],
    [s for _, s in exp_scores],
    linewidth=.3,
    label='Exponential moving average',
    alpha=.7
)

ax.legend()
ax.set_ylim(0, 600)
ax.xaxis.set_major_locator(hours)
ax.xaxis.set_major_formatter(h_fmt)
fig.autofmt_xdate()
ax.grid()
ax.set_xlabel('Time', labelpad=10)
ax.set_ylabel('Mean absolute error', labelpad=10)
ax.set_title('Delayed progressive validation', pad=16)
fig.savefig('delayed_progressive_validation.svg', bbox_inches='tight')
```

</details>

![delayed_progressive_validation](/img/blog/online-learning-evaluation/delayed_progressive_validation.svg)

If this looks similar to the previous chart, that's because it is. The errors line are slightly higher but that's about it. For this particular dataset, taking into account the delay doesn't affect the metric too much. But that conclusion may be different for other datasets. The point is with delayed progressive validation, we are now 100% sure that our estimate of the model's performance is reliable. We are certain of this fact because delayed progressive validation reproduces the real state of things by taking into account the order in which events transpire. Cross-validation and plain progressive validation, on the other, do not.

I recommend for futher reading the papers I mentionned throughout this post, namely:

- [Beating the hold-out: Bounds for K-fold and progressive cross-validation](https://dl.acm.org/doi/pdf/10.1145/307400.307439)
- [Delayed labelling evaluation for data streams](https://link.springer.com/article/10.1007/s10618-019-00654-y)
- [Ad Click Prediction: a View from the Trenches](https://static.googleusercontent.com/media/research.google.com/fr//pubs/archive/41159.pdf), in particular subsection 5.1.

Peace out.
