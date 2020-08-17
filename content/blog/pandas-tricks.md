+++
date = "2020-08-17"
title = "A few intermediate pandas tricks"
toc = true
+++

I want to use this post to share some `pandas` snippets that I find useful. I use them from time to time, in particular when I'm doing [time series competitions](https://www.kaggle.com/search?q=time+series+in%3Acompetitions) on Kaggle. Like any data scientist, I perform similar data processing steps on different datasets. Usually, I put repetitive patterns in [`xam`](https://github.com/MaxHalford/xam), which is my personal data science toolbox. However, I think that the following snippets are too small and too specific for being added into a library.

Some of the following code assumes you're using [version `1.0` of `pandas`](https://pandas.pydata.org/docs/whatsnew/v1.0.0.html), which in particular added support for [typed missing values](https://pandas.pydata.org/docs/whatsnew/v1.0.0.html#experimental-na-scalar-to-denote-missing-values). Note that the following code is not guaranteed to be the optimal way of proceeding. If you have a quicker solution, then feel welcome to post a comment at the bottom of this post.

## Time since/until event

Take the following series of weather indications:

```py
import pandas as pd

weather = ['rain', 'sun', 'snow', 'snow', 'snow', 'sun', 'rain', 'rain']
weather = pd.Series(weather, dtype='category')
weather
```

| weather   |
|:----------|
| rain      |
| sun       |
| snow      |
| snow      |
| snow      |
| sun       |
| rain      |
| rain      |

Depending on the problem, it might be interesting to extract the time since an event occurred. For instance, we might want to produce a feature that indicates how long ago the `'rain'` value occurred. For the sake of simplicity, I'm going to assume that the period between each row is constant, and thus will simply count the number of steps since each value appeared. Ideally, we want to have one column for each distinct value. Here is the code I use for doing so:

```py
def steps_since(series):

    features = pd.DataFrame(index=series.index)

    for cat in series.cat.categories:
        counts = series.eq(cat).cumsum()
        since = counts.groupby(counts).cumcount().astype('Int64')
        since[counts.eq(0)] = pd.NA
        features[f'steps_since_{cat}'] = since

    return features

steps_since(weather)
```

|   steps_since_rain | steps_since_snow   | steps_since_sun   |
|-------------------:|-------------------:|------------------:|
|                  0 | NA                 | NA                |
|                  1 | NA                 | 0                 |
|                  2 | 0                  | 1                 |
|                  3 | 0                  | 2                 |
|                  4 | 0                  | 3                 |
|                  5 | 1                  | 0                 |
|                  0 | 2                  | 1                 |
|                  0 | 3                  | 2                 |

I've assumed that the provided series contains [categorical data](https://pandas.pydata.org/pandas-docs/stable/user_guide/categorical.html). This allows us to access the list of categories via `series.cat.categories`. You could use `series.unique()` instead. I've also taken care of inserting `NA`s whenever a given value never occurred before. Before version `1.0`, missing values were commonly indicated with `np.nan`, but this required the series to be of type `float64`. The modern approach is to use the `Int64` type in combination of `pd.NA` to store nullable integers.

How about the following dataset?

```py
weather_per_country = pd.DataFrame({
    'country': pd.Categorical(['France'] * 4 + ['Germany'] * 4),
    'weather': weather
})
weather_per_country
```

| country   | weather   |
|:----------|:----------|
| France    | rain      |
| France    | sun       |
| France    | snow      |
| France    | snow      |
| Germany   | snow      |
| Germany   | sun       |
| Germany   | rain      |
| Germany   | sun       |

In this case, we might want to extract the time since each event within each country. We can this via a `groupby`:

```py
pd.concat(
    steps_since(g['weather']).assign(country=country)
    for country, g in weather_per_country.groupby('country')
)
```

| steps_since_rain   | steps_since_snow   | steps_since_sun   | country   |
|-------------------:|-------------------:|------------------:|:----------|
| 0                  | NA                 | NA                | France    |
| 1                  | NA                 | 0                 | France    |
| 2                  | 0                  | 1                 | France    |
| 3                  | 0                  | 2                 | France    |
| NA                 | 0                  | NA                | Germany   |
| NA                 | 1                  | 0                 | Germany   |
| 0                  | 2                  | 1                 | Germany   |
| 0                  | 3                  | 2                 | Germany   |

Finally, what about obtaining the number of steps *until* an event, rather than *since* an event? This can be done by reusing the code `steps_since` function, and inverting the series before counting:

```py
def steps_until(series):

    features = pd.DataFrame(index=series.index)

    for cat in series.cat.categories:
        counts = series.eq(cat).iloc[::-1].cumsum()
        until = counts.groupby(counts).cumcount().astype('Int64')
        until[counts.eq(0)] = pd.NA
        features[f'steps_until_{cat}'] = until

    return features

steps_until(weather)
```

| steps_until_rain   | steps_until_snow   |   steps_until_sun |
|-------------------:|-------------------:|------------------:|
| 0                  | 2                  |                 1 |
| 5                  | 1                  |                 0 |
| 4                  | 0                  |                 3 |
| 3                  | 0                  |                 2 |
| 2                  | 0                  |                 1 |
| 1                  | NA                 |                 0 |
| 0                  | NA                 |                NA |
| 0                  | NA                 |                NA |

## Longest event streak

Next, take the following series of temperature measurements:

```py
temperature = [18, pd.NA, pd.NA, pd.NA, 21, pd.NA, pd.NA, 19]
temperature = pd.Series(temperature, name='temperature')
temperature
```

| temperature   |
|--------------:|
| 18            |
| NA            |
| NA            |
| NA            |
| 21            |
| NA            |
| NA            |
| 19            |

In this case, you might want to [interpolate](https://pandas.pydata.org/pandas-docs/stable/reference/api/pandas.DataFrame.interpolate.html) the missing values before feeding the data to a machine learning model. However, in order for your interpolation to be robust, you might want to verify that the maximum number of consecutive values isn't too large. You can calculate the latter as so:

```py
missing = temperature.isnull()
missing.groupby((~missing).cumsum()).sum().max()
```

```
3
```

Naturally, you can adapt this code to count consecutive values of arbitrary events. Indeed, the `missing` series definition could be replaced by a different condition altogether. For instance, we can determine the longest streak of rainy days like this:

```py
rainy = weather.eq('rain')
rainy.groupby((~rainy).cumsum()).sum().max()
```

```
2
```

## Target encoding for time series

The one thing I do in every time series competition is [target encoding](http://contrib.scikit-learn.org/category_encoders/targetencoder.html). In short, the goal of target encoding is to replace a category by the average of the target values of the rows that belong to said category. Naturally, you're not limited to using an average. You can also use [Bayesian target encoding](https://maxhalford.github.io/blog/target-encoding/) if some of your categories are rare.

Target encoding is very important for time series data. It has been used in almost every top model on Kaggle time series competitions, such as [ASHRAE](https://www.kaggle.com/c/ashrae-energy-prediction), [Recruit Restaurants](https://www.kaggle.com/c/recruit-restaurant-visitor-forecasting), and [Wikipedia Web Traffic](https://www.kaggle.com/c/web-traffic-time-series-forecasting). When you do target encoding on temporal data, you need to be wary of not leaking current and future information into the aggregate of each row. Basically, you need to shift the target values within each group backwards. Indeed, for any given moment, we want our aggregate to pertain to past data only. As an example, consider the following toy dataset:

```py
readings = pd.DataFrame(
    [
        ('A', 'Saturday', 101),
        ('A', 'Sunday', 88),
        ('A', 'Saturday', 103),
        ('A', 'Sunday', 82),
        ('A', 'Saturday', 100),
        ('B', 'Saturday', 27),
        ('B', 'Sunday', 13),
        ('B', 'Saturday', 21),
        ('B', 'Sunday', 17),
        ('B', 'Saturday', 25)
    ],
    columns=['building', 'day', 'reading']
)
readings
```

| building   | day      |   reading |
|:-----------|:---------|----------:|
| A          | Saturday |       101 |
| A          | Sunday   |        88 |
| A          | Saturday |       103 |
| A          | Sunday   |        82 |
| A          | Saturday |       100 |
| B          | Saturday |        27 |
| B          | Sunday   |        13 |
| B          | Saturday |        21 |
| B          | Sunday   |        17 |
| B          | Saturday |        25 |

Let's say we want to calculate some target encodings for different column combinations. I like to define each target encoding as a tuple `(on, lag, by, how)` where:

- `on` is the column on which to perform the aggregate.
- `lag` is the size of the window.
- `by` determines on which column to do the grouping.
- `how` indicates the statistics to compute.

I then store all the tuples I want to compute in a list:

```python
AGGS = [
    ('reading', 2, ['building'], ['mean']),
    ('reading', 3, ['building'], ['mean']),
    ('reading', 3, ['day'], ['mean', 'max']),
    ('reading', 3, ['building', 'day'], ['mean'])
]
```

I then proceed as follows:

```py
features = readings.copy()

for on, lag, by, hows in AGGS:

    agg = readings.groupby(by)[on].apply(lambda x: (
        x
        .shift(1)
        .rolling(window=lag, min_periods=1)
        .agg(hows)
    ))
    agg = agg.rename(columns={
        how: f'{how}_of_last_{lag}_{on}_by_' + '_and_'.join(by)
        for how in hows
    })

    features = features.join(agg)

features
```

| building   | day      |   reading |   mean_of_last_3_reading_by_building |   mean_of_last_3_reading_by_day |   max_of_last_3_reading_by_day |   mean_of_last_3_reading_by_building_and_day |
|:-----------|:---------|----------:|-------------------------------------:|--------------------------------:|-------------------------------:|---------------------------------------------:|
| A          | Saturday |       101 |                             nan      |                        nan      |                            nan |                                          nan |
| A          | Sunday   |        88 |                             101      |                        nan      |                            nan |                                          nan |
| A          | Saturday |       103 |                              94.5    |                        101      |                            101 |                                          101 |
| A          | Sunday   |        82 |                              97.3333 |                         88      |                             88 |                                           88 |
| A          | Saturday |       100 |                              91      |                        102      |                            103 |                                          102 |
| B          | Saturday |        27 |                             nan      |                        101.333  |                            103 |                                          nan |
| B          | Sunday   |        13 |                              27      |                         85      |                             88 |                                          nan |
| B          | Saturday |        21 |                              20      |                         76.6667 |                            103 |                                           27 |
| B          | Sunday   |        17 |                              20.3333 |                         61      |                             88 |                                           13 |
| B          | Saturday |        25 |                              17      |                         49.3333 |                            100 |                                           24 |

Note that I set `min_periods` to 1 so that statistics are still computed when there are less than `lag` values in a given window. As you can see, the `nan`s are present when there is not a single value in the past to aggregate on. When I do a Kaggle competition, I run the above code on a small subset of the data and manually check that it's doing what I want it to do. This is akin to [pointing and calling](https://www.wikiwand.com/en/Pointing_and_calling), and I highly recommend doing it in any data science endeavour.

You might have noticed that I used `apply` to shift the values backwards before aggregating. Since version `1.0`, it's also possible to define a custom window that does the shifting for us. This may be done by subclassing `pd.api.indexers.BaseIndexer`:

```python
import numpy as np

class ShiftedWindow(pd.api.indexers.BaseIndexer):

    def __init__(self, window_size):
        self.window_size = window_size

    def get_window_bounds(self, num_values, min_periods, center, closed):

        starts = np.arange(-self.window_size, num_values - self.window_size)
        ends = starts + self.window_size
        starts[:self.window_size] = 0

        return starts, ends
```

This allows us to rewrite the above snippet as follows:

```py
features = readings.copy()

for on, lag, by, hows in AGGS:

    agg = (
        readings
        .groupby(by)[on]
        .rolling(ShiftedWindow(lag), min_periods=1)
        .agg(hows)
    )
    agg = agg.rename(columns={
        how: f'{how}_of_last_{lag}_{on}_by_' + '_and_'.join(by)
        for how in hows
    })

    features = features.join(agg)
```

However, [it turns out](https://github.com/pandas-dev/pandas/issues/35755#issuecomment-674584559) that custom windows within a `groupby` will only work once version `1.1.1` is released. As of writing this blog post, the above code will not produce the expected output, even though it won't raise any exception.

That's all for now! I purposefully didn't go into the detail of each line of code. I rather expect people to copy/paste the above snippets to (hopefully) play around with them by themselves. Feel free to drop a comment if you have any question whatsoever.
