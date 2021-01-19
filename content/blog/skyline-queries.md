+++
date = "2019-05-21"
draft = false
title = "Skyline queries in Python"
+++

Imagine that you're looking to buy a home. If you have an analytical mind then you might want to tackle this with a quantitative. Let's suppose that you have a list of potential homes, and each home has some attributes that can help you compare them. As an example, we'll consider three attributes:

- The `price` of the house, which you want to minimize
- The `size` of the house, which you want to maximize
- The `city` where the house if located, which you don't really care about

Some houses will be objectively better than others because they will be cheaper and bigger. However, for some pairs of houses the comparison will not be as clear. It might be that house A is more expensive than house B but is also larger. In data analysis this set of best houses which are incomparable with each other is called a [skyline](https://www.wikiwand.com/en/Skyline_operator). As they say, a picture is worth a thousand words, so let's draw one.

We'll simulate some houses using a very simple random process. Each house will be located in a random city. Then, the size of the house in square meters will be sampled from a normal distribution with mean 200 and standard deviation 50. Finally, the price of the house will be obtained by multiplying the size of the house by a price per square meter sampled from a given uniform distribution. I chose as cities Bordeaux, Lyon, and Toulouse. I got the prices per square meter from [meilleursagents.com](https://www.meilleursagents.com/). In any case, none of the details really matter. The following piece of code will generate `n_houses` houses using the process I just described.

```python
import random
import pandas as pd


city_prices = {
    'Bordeaux': 4045,
    'Lyon': 4547,
    'Toulouse': 3278
}


def make_houses(n_houses, city_prices):

    cities = [city for city in city_prices for _ in range(n_houses)]

    sizes = [round(random.gauss(200, 50)) for _ in range(len(cities))]

    prices = [
        round(random.uniform(0.8, 1.2) * city_prices[city] * size)
        for city, size in zip(cities, sizes)
    ]

    return pd.DataFrame({
        'city': cities,
        'size': sizes,
        'price': prices
    })
```

To start let's generate 100 houses and display the first 5.

```python
houses = make_houses(100, city_prices)
houses.sample(5)
```

**city** | **size** | **price**
---------|----------|----------
Lyon | 170 | 733290
Lyon | 127 | 557921
Bordeaux | 227 | 857932
Lyon | 168 | 621432
Toulouse | 170 | 519786

Now let's display all of the houses using a simple scatter plot.

```python
ax = houses.plot.scatter(x='size', y='price')
ax.set_title('100 simulated houses')
```

![houses](/img/blog/skyline-queries/houses.svg)

The points that are to the bottom right are part of the skyline. Indeed they are either better or not comparable to the rest of the points. In other words, for any point in the skyline, it is impossible to find a point which is at least as good in every regard. In optimisation this is called the [Pareto frontier](https://www.wikiwand.com/en/Pareto_efficiency#/Pareto_frontier) (the link has some nice visuals).

I was surprised to find that there isn't any canonical way to do this in `pandas`, and that not many people at all discuss how to find a skyline using Python. On the other hand skylines are really useful for specific tasks, such as ranking items online. For example if you're looking for a hotel you might to find one that is cheap, big, and close to the beach. Instead of looking at each hotel you could first compute the skyline and check those instead. Of course there will be always some attributes that are impossible to rank because they depend on a person's taste, but you get the idea. Some things are just objectively better.

I decided to first code a very naive implementation so that I could use it as a baseline. The idea is simply to search for the skyline using brute force. Each row is compared with the rest of the rows and discarded if it is dominated by at least one of them. To make things as clear as possible I first wrote a `a_dominated_b` function to check if a row called `a` dominates another row called `b`.

```python
def a_dominates_b(a, b, to_min, to_max):

    n_better = 0

    for f in to_min:
        if a[f] > b[f]:
            return False
        n_better += a[f] < b[f]

    for f in to_max:
        if a[f] < b[f]:
            return False
        n_better += a[f] > b[f]

    if n_better > 0:
        return True
    return False
```

The implementation is quite simple. The `to_min` parameter lists the attributes that have to be minimized while `to_max` lists those that have to be, you guessed it, maximized. The only quirk happens when `a` and `b` are equal. In this case the expected -- and intended -- behavior is that `a_dominates_b` returns `False`.

For the sake of the example here's a sample usage where `a` dominates `b` because it is cheaper.

```python
>>> a = {'price': 100_000, 'size': 230}
>>> b = {'price': 120_000, 'size': 200}
>>> a_dominates_b(a, b, to_min=['price'], b=['size'])
True
```

Now we simply have to implement the nested `for` loops that searches for the skyline.

```python
def find_skyline_brute_force(df, to_min, to_max):

    rows = df.to_dict(orient='index')

    skyline = set()

    for i in rows:

        dominated = False

        for j in rows:

            if i == j:
                continue

            if a_dominates_b(rows[j], rows[i], to_min, to_max):
                dominated = True
                break

        if not dominated:
            skyline.add(i)

    return pd.Series(df.index.isin(skyline), index=df.index)
```

In my implementation I return a `pandas.Series` which contains `bool`s that indicate whether or not a row is part of the skyline. Let's use this function to search for the skyline of the houses we generated earlier on, and then display them.

```python
skyline = find_skyline_brute_force(houses, to_min=['price'], to_max=['size'])

colors = skyline.map({True: 'C1', False: 'C0'})
ax = houses.plot.scatter(x='size', y='price', c=colors, alpha=0.8)
ax.set_title('Houses skyline')
```

![skyline](/img/blog/skyline-queries/skyline.svg)

I'm too lazy to write unit tests, but this seems correct, right? As expected, the running time of this algorithm grows quadratically with the size of the dataset, and basically isn't viable above 10,000 rows. It turns out there are many other algorithms which are much more efficient. I picked a simple one which uses a [block nested loop (BNL)](http://lmgtfy.com/?q=block+nested+loop+skyline). It seems to perform well for common cases, at least according to the few papers I skimmed through. The idea is to maintain a skyline and compare each incoming row with each element of the skyline. One of three cases can occur:

1. The point is dominated by one of the elements in the skyline.
2. The point dominates one or more points in the skyline.
3. The point is neither better nor worse than all of the points in the skyline.

In case 1 the point is simply ignored. In cases 2 and 3 the point will be inserted in the skyline. In case 2 the points in the skyline that are dominated are also deleted from the skyline. All in all the algorithm is quite simple but it took me some time to convince myself. I scratched my head a bit to get this to keep rows that are equal in all regards. Anyway, here is the code.

```python
def count_diffs(a, b, to_min, to_max):
    n_better = 0
    n_worse = 0

    for f in to_min:
        n_better += a[f] < b[f]
        n_worse += a[f] > b[f]

    for f in to_max:
        n_better += a[f] > b[f]
        n_worse += a[f] < b[f]

    return n_better, n_worse


def find_skyline_bnl(df, to_min, to_max):
    """Finds the skyline using a block-nested loop."""

    rows = df.to_dict(orient='index')

    # Use the first row to initialize the skyline
    skyline = {df.index[0]}

    # Loop through the rest of the rows
    for i in df.index[1:]:

        to_drop = set()
        is_dominated = False

        for j in skyline:

            n_better, n_worse = count_diffs(rows[i], rows[j], to_min, to_max)

            # Case 1
            if n_worse > 0 and n_better == 0:
                is_dominated = True
                break

            # Case 3
            if n_better > 0 and n_worse == 0:
                to_drop.add(j)

        if is_dominated:
            continue

        skyline = skyline.difference(to_drop)
        skyline.add(i)

    return pd.Series(df.index.isin(skyline), index=df.index)
```

The `count_diffs` method returns two counters which indicated one many attributes are better and how many are worse given two rows. The counters can then be used to map to one of the three cases listed above. Case 1 corresponds to `n_worse > 0 and n_better == 0` while `n_better > 0 and n_worse == 0` refers to case 2. Note that the case where `n_worse` and `n_better` are both equal to 0 means that `a` and `b` are identical. I have to say I am not 100% happy with the implementation, indeed my gut tells me there is a simpler way. But at least it does the trick.

A nice thing we can now do is compare `find_skyline_bnl` with `find_skyline_brute_force` to check that they output the same results. We can do so using the `assert_series_equal` function from `pandas`.

```python
for _ in range(30):
    houses = make_houses(n_houses=random.randint(120, 140), city_prices=city_prices)

    pd.testing.assert_series_equal(
        find_skyline_brute_force(df=houses, to_min=['price'], to_max=['size']),
        find_skyline_bnl(df=houses, to_min=['price'], to_max=['size'])
    )
```

Next we can compare the running time of both algorithms on a dataset of, say, 5000 houses.

```python
import time

houses = make_houses(n_houses=5_000, city_prices=city_prices)

tic = time.time()
skyline = find_skyline_brute_force(df=houses, to_min=['price'], to_max=['size'])
print(f'Brute-force took {time.time() - tic:.3f} seconds')

tic = time.time()
skyline = find_skyline_bnl(df=houses, to_min=['price'], to_max=['size'])
print(f'Block nested loop took {time.time() - tic:.3f} seconds')
```

This outputs the following:

```
Brute-force took 10.658 seconds
Block nested loop took 0.320 seconds
```

In this case the block nested loop is over 30 times faster than the brute-force approach, which is great. Finally let's look at how the execution time of the block nested loop method evolves with the number of rows. I simply recorded the execution time for sizes between 10,000 and 100,000 with a step of 10,000. I repeated the results 10 times in order to compute an average and a standard deviation which can be displayed using [seaborn](https://seaborn.pydata.org).

```python
import seaborn as sns

def measure_time(n):
    houses = make_houses(n_houses=n, city_prices=city_prices)
    tic = time.time()
    skyline = find_skyline_bnl(df=houses, to_min=['price'], to_max=['size'])
    return time.time() - tic

durations = pd.DataFrame([
    {'size': n, 'duration': measure_time(n)}
     for n in np.arange(10000, 110_000, 10000) for i in range(10)
])

ax = sns.lineplot(x='size', y='duration', data=durations)
ax.grid()
ax.set_title('Running time in seconds of the BNL algorithm')
```

![durations](/img/blog/skyline-queries/durations.svg)

I didn't take the time to code any other algorithm but I'm rather satisfied with this for the moment. I'm going to open an issue on `pandas` and see if there is any interest to pursue this further. One property of the block nested loop algorithm that might have gone unnoticed is that it works for streaming scenarios, and I will thus be adding an implementation to [creme](https://github.com/creme-ml/creme) in the upcoming days.

I hope you enjoyed the read. Feel free to get in touch if anything bugs you or if you know any better algorithm.
