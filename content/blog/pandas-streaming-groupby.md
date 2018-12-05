+++
date = "2018-12-05"
draft = false
title = "Streaming groupbys in pandas for big datasets"
+++

If you've done a bit of Kaggling then you've probably been typing a fair share of `df.groupby(some_col)`. That is, if you're using Python. If you're handling tabular data, then a lot of your features will revolve around computing *aggregate statistics*. This is very true for the ongoing [PLAsTiCC Astronomical Classification challenge](https://www.kaggle.com/c/PLAsTiCC-2018). The goal of the competition is to classify objects in the sky into one of 14 groups. The bulk of the available is a set of so-called *light curve*. A light curve being a sequence of brightness measures observations along time. Each light curve is filtered at different passbands. The idea is that there is one light curve per passband and per object and that the shape of each light curve should tell us what kind of object we're looking at. Yada yada.

The reason why I'm talking about this particular competition is that the data is [fairly large](https://www.kaggle.com/c/PLAsTiCC-2018/data). It's nothing *crazy* but performing a groupby in memory is a pain in the neck. I have a laptop with 24 gigs of RAM so I can just about handle it, but it's not fun. While the groupby is running my computer isn't as responsive as I would like it to be. What's more, doing the groupby in memory is simply not possible for even larger datasets. Computing large groupbys comes up a lot in data science, and it seems datasets are getting larger and larger -- at least on Kaggle. There isn't a canonical way to handle this with Python/pandas so I decided to spend some time and figure out a good reusable solution. Ideally I would want my solution to:

1. Consume a limited amount of RAM so that I can simply run it in the background.
2. Effectively make use of parallelism.
3. Handle failures so that I don't have to start from scratch if my laptop turns off.
4. To be written in Python so that I can use a proper data science toolkit.

After a lot of playing around I found a good solution compatible with `pandas`. The trick is to do what I call a *streaming groupby*. The key idea is that we want to process the dataset in chunks. That is, we want to split the dataset in chunks of manageable size and apply the groupby to each chunk. In the end we simply have to merge results of each groupby. I've basically just described what MapReduce does. There are two downsides with this approach that don't suit my needs. The first downside is that the way in which the results have to be merged in the final step strongly depends on the type of aggregate you're doing. For example if you're just counting then you simply have to sum the counts of each groupby. However if you're computing a rolling kurtosis then it isn't as straightforward. In the MapReduce framework the user is expected to provide the `reduce` function. So far I've been assuming that different groupbys might contain group keys in common, which is why we care about how the results are merged. This is the second downside of MapReduce in my opinion. The thing is that during the lifetime of a MapReduce job all the groups are maintained in memory. This works if you're called Google and have a cluster of computers available, but not if your workhorse is a laptop.

Okay I'm done with my rant. The trick I want to use is that groupbys can be performed sequentially as long as the grouping key is sorted in the dataset. For example take a look at the following dataset, which looks somewhat like the data from the PLAsTiCC competition.

| object_id | passband | flux | mjd |
|-----------|----------|------|-----|
| 615 | $u$ | 52.91 | 59750 |
| 615 | $g$ | 381.95 | 59750 |
| 615 | $g$ | 384.18 | 59751 |
| 615 | $u$ | 153.49 | 59751 |
| 615 | $y$ | -111.06 | 59750 |
| 713 | $y$ | -180.23 | 59751 |
| 713 | $u$ | 61.06 | 59753 |
| 713 | $u$ | 107.64 | 59754 |
| 713 | $y$ | -133.42 | 59752 |
| 713 | $u$ | 118.74 | 59755 |

Say I want to calculate the average flux per object and per passband. With `pandas` I could be done with a simple `df.groupby(['object_id', 'passband'])['flux'].mean()`, but that's too kosher. The thing is that I know that my dataset is ordered by object identifier and by time ("mjd" stands for *Modified Julian Date*). I could thus read the data object by object and perform my groupby inside each object chunk. This is pretty easy to do with a sequential scan because every time I see a new object identifier it means that I've got all the data for the current one.

Now the thing is that performing a groupby for each group will incur a lot of overhead, especially if there are many keys and the groups are small. On the one hand the simple approach with pandas loads all the data, whereas the approach I'm proposing loads the data object by object. Why not do something in the middle, say perform the groupby on $k$ adjacent groups? Well in fact this turns out to be a very good approach. The algorithm to do so is:

1. Load the next $k$ rows from a dataset
2. Identify the last group from the $k$ rows
3. Put the $m$ rows corresponding to the last group aside (I call them *orphans*)
4. Perform the groupby on the remaining $k - m$ rows
5. Repeat from step 1, and add the orphan rows at the top of the next chunk

For example let's assume your data contains 42 gazillion rows (basically a lot of rows), sorted by the key attribute you want to do your groupby. You first start by reading the first $k$ rows, say 10000. These $k$ rows will contain a certain number of distinct key values (anything from 1 to $k$ actually). The insight is that apart from the last key all the data for the rest of the keys is contained in the chunk. As for the last key there is some ambiguity. Indeed it could well be that there are rows in the next chunk that also belong to the last key. We thus have to put the rows that belong the last key aside because we'll put them on top of the next chunk.

It turns out that this is pretty easy to do with pandas.

```python
import pandas as pd

def stream_groupby_csv(path, key, agg, chunk_size=1e6):

    # Tell pandas to read the data in chunks
    chunks = pd.read_csv(p, chunksize=chunk_size)

    results = []
    orphans = pd.DataFrame()

    for chunk in chunks:

        # Add the previous orphans to the chunk
        chunk = pd.concat((orphans, chunk))

        # Determine which rows are orphans
        last_val = chunk[key].iloc[-1]
        is_orphan = chunk[key] == last_val

        # Put the new orphans aside
        chunk, orphans = chunk[~is_orphan], chunk[is_orphan]

        # Perform the aggregation and store the results
        result = agg(chunk)
        results.append(result)

    return pd.concat(results)
```

Let's go through the code. We can use the `chunksize` parameter of the `read_csv` method to tell pandas to iterate through a CSV file in chunks of a given size. We'll store the results from the groupby in a list of `pandas.DataFrame`s which we'll simply call `results`. The orphan rows are store in a `pandas.DataFrame` which is obviously empty at first. Every time we read a chunk we'll start by concatenating it with the orphan rows. Then we'll look at the last row of the chunk to determine the last key value. This will then allow us to put the new orphan rows aside and remove them from the chunk. Then we simply have to perform the groupby on the chunk and add the results to the list of results. The groupby happens in the `agg` function, which is provided by the user. The idea is to give the user the maximum amount of flexibility by letting provide the `agg` function. An example `agg` function could be:

```python
agg = lambda chunk: chunk.groupby('passband')['flux'].mean()
```

You can even compute multiple aggregates on more than one field:

```python
agg = lambda chunk: chunk.groupby('passband').agg({
    'flux': ['mean', 'std'],
    'mjd': ['min', 'max']
})
```

One thing to notice in above Python code is that the results are stored in a list and then concatenated into a single `pandas.DataFrame` at the end. In other words the results are kept in memory. Usually this is fine because the aggregate results are tiny in comparison with the underlying dataset. However it goes without saying that you could smarter things instead. For example you write the partial results into a database at the end of each iteration.

I would like to say there is more to my approach than what I've just said but that's really it. It's nothing crazy but it really works well. Whatever the size of the dataset of the dataset you can process with a very limited amount of RAM usage. There isn't any reason why this approach should be slower than performing a single groupby of one go. However the downside of this approach is that it has to perform more function calls than a single groupby, but depending on your data the incurred overhead might be negligible.

A natural thing we could next is to process the groupbys concurrently. Indeed we could use a [worker pool](https://www.wikiwand.com/en/Thread_pool) to run the successive `agg` calls. Thankfully this is trivial to implement with Python's [multiprocessing module](https://docs.python.org/3.6/library/multiprocessing.html?highlight=process) which is included in the default library.

```python
import itertools
import multiprocessing as mp
import pandas as pd


def stream_groupby_csv(path, key, agg, chunk_size=1e6, pool=None, **kwargs):

    # Make sure path is a list
    if not isinstance(path, list):
        path = [path]

    # Chain the chunks
    kwargs['chunksize'] = chunk_size
    chunks = itertools.chain(*[
        pd.read_csv(p, **kwargs)
        for p in path
    ])

    results = []
    orphans = pd.DataFrame()

    for chunk in chunks:

        # Add the previous orphans to the chunk
        chunk = pd.concat((orphans, chunk))

        # Determine which rows are orphans
        last_val = chunk[key].iloc[-1]
        is_orphan = chunk[key] == last_val

        # Put the new orphans aside
        chunk, orphans = chunk[~is_orphan], chunk[is_orphan]

        # If a pool is provided then we use apply_async
        if pool:
            results.append(pool.apply_async(agg, args=(chunk,)))
        else:
            results.append(agg(chunk))

    # If a pool is used then we have to wait for the results
    if pool:
        results = [r.get() for r in results]

    return pd.concat(results)
```

I've added some extra sugar in addition to the new `pool` argument. The `path` argument can now be a list of strings, all of the listed will then we processed sequentially. This is pretty easy to do with `itertools.chain` method. The `pool` argument has to be a class with an `apply_async` method. I've implemented it so that it will work even you don't provided any `pool`. From what I'm aware of the `multiprocessing` library has two different `pool` implementations, namely `multiprocessing.Pool` which uses processes and `multiprocessing.pool.ThreadPool` which uses threads. As a general rule of thumb threads are good for I/O bound tasks processes are good for CPU bound tasks.

To conclude here is an example of how to use the `stream_groupby_csv` method:

```python
def agg(chunk):
    """lambdas can't be serialized so we need to use a function"""
    return chunk.groupby('some_sub_key')['some_column'].mean()

results = results = stream_groupby_csv(
    path=[
        'path/to/first/dataset.csv',
        'path/to/second/dataset.csv',
    ],
    key='some_key',
    agg=agg,
    chunk_size=100000,
    pool=mp.Pool(processes=8)
)
```

That's all for now. I think the implementation is pretty fine as is, what's more I'm using quite successfully for Kaggle competitions. My laptop is creating loads of features while only consuming up to 100MB of RAM. In the future I will probably add this to my [xam library](https://github.com/MaxHalford/xam). Feel free to send me an email if you think of any improvements that could be made!
