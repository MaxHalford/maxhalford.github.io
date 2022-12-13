+++
date = "2019-09-16"
draft = false
title = "Finding fuzzy duplicates with pandas"
tags = ['data-eng']
+++

Duplicate detection is the task of finding two or more instances in a dataset that are in fact identical. As an example, take the following toy dataset:

|   | **First name** |  **Last name** |       **Email**      |
|:-:|:----------:|:----------:|:----------------:|
| 0 |   Erlich   |   Bachman  | eb@piedpiper.com |
| 1 |   Erlich   |  Bachmann  | eb@piedpiper.com |
| 2 |    Erlik   |   Bachman  |  eb@piedpiper.co |
| 3 |   Erlich   |  Bachmann  | eb@piedpiper.com |

Each of these instances (rows, if you prefer) corresponds to the same "thing" -- note that I'm not using the word "entity" because [entity resolution](https://www.wikiwand.com/en/Record_linkage#/Entity_resolution) is a different, and yet related, concept. In my experience there are two main reasons why data duplication may occur:

1. Somebody made a spelling mistake when entering data somewhere.
2. Some (very naughty) people create fake accounts to gain freebies for newly registered accounts.

For a comprehensive review, I highly recommend ["An Introduction to Duplicate Detection"](https://epdf.pub/an-introduction-to-duplicate-detection.html) by [Felix Naumann](https://scholar.google.com/citations?user=Pqf21y0AAAAJ&hl=en) and [Melanie Herschel](https://scholar.google.com/citations?user=K5VPw-IAAAAJ&hl=en).

Note that in this case our notion of "duplicate" doesn't mean there is an exact match. On the contrary here we are interested in so-called *fuzzy duplicates* that "look" the same. In general we will have a function which tells us if yes or no two instances match. Here is an example using [fuzzywuzzy](https://github.com/seatgeek/fuzzywuzzy):

```python
from fuzzywuzzy import fuzz

def is_same_user(user_1, user_2):
    return fuzz.partial_ratio(user_1['first_name'], user_2['first_name']) > 90
```

The matching function entirely depends on your application. There is no silver bullet that will work for each and every case. Note that nowadays some people are [using machine learning](https://www.datarobot.com/use-cases/finding-duplicate-customer-records-database/) to find a good matching function. In this post I mostly want to talk about *how to search for duplicates*, given that a matching function has been established.

A little twist to duplicate detection is the notion of *transitive duplicates*. Suppose you have 3 instances A, B, and C. Your matching function finds that A matches B and that B matches C. The matching function did not find any match between A and C. However, by applying transitivity, we can see that A and C in fact match because they are linked by B. A and C are thus transitive duplicated. Finding transitive duplicates is straightforward but costly. Indeed, from what I have gleaned the standard way to proceed is as follows:

1. Compare each combination of pairs of instances and check if they match.
2. Organize the pairs into an undirected graph.
3. Enumerate the connected subgraphs.

To my surprise, I could not find any straightforward way to identify duplicates using Python's data science stack. Sure, `pandas` has a [`.duplicated()` method](https://pandas.pydata.org/pandas-docs/stable/reference/api/pandas.DataFrame.duplicated.html), but it seems that it only handles exact duplicates and not fuzzy duplicates. There is also the rather popular [`dedupe` library](https://github.com/dedupeio/dedupe), but it looks overly complex. I thus decided to implement my own solution:

```python
import numpy as np
import pandas as pd


def find_partitions(df, match_func, max_size=None, block_by=None):
    """Recursive algorithm for finding duplicates in a DataFrame."""

    # If block_by is provided, then we apply the algorithm to each block and
    # stitch the results back together
    if block_by is not None:
        blocks = df.groupby(block_by).apply(lambda g: find_partitions(
            df=g,
            match_func=match_func,
            max_size=max_size
        ))

        keys = blocks.index.unique(block_by)
        for a, b in zip(keys[:-1], keys[1:]):
            blocks.loc[b, :] += blocks.loc[a].iloc[-1] + 1

        return blocks.reset_index(block_by, drop=True)

    def get_record_index(r):
        return r[df.index.name or 'index']

    # Records are easier to work with than a DataFrame
    records = df.to_records()

    # This is where we store each partition
    partitions = []

    def find_partition(at=0, partition=None, indexes=None):

        r1 = records[at]

        if partition is None:
            partition = {get_record_index(r1)}
            indexes = [at]

        # Stop if enough duplicates have been found
        if max_size is not None and len(partition) == max_size:
            return partition, indexes

        for i, r2 in enumerate(records):

            if get_record_index(r2) in partition or i == at:
                continue

            if match_func(r1, r2):
                partition.add(get_record_index(r2))
                indexes.append(i)
                find_partition(at=i, partition=partition, indexes=indexes)

        return partition, indexes

    while len(records) > 0:
        partition, indexes = find_partition()
        partitions.append(partition)
        records = np.delete(records, indexes)

    return pd.Series({
        idx: partition_id
        for partition_id, idxs in enumerate(partitions)
        for idx in idxs
    })

```

Admittedly, this is quite hard to take in by itself. I designed this algorithm during a Master's internship where I needed to find duplicates in an SQL table. When preparing this blog post, I realized that the algorithm was wrong and wouldn't work in one edge-case. I've double-checked and now everything should work fine. The core of the algorithm happens in the `find_partition` function. The idea is to recursively expand a set of instances that match. The fact that two instances match is decided by the `match_func` parameter which has to be provided by the user. The algorithm returns a `pandas.Series` which contains integers that associate each index value with an entity identifier. I also added a few improvements of which I'll show the benefits further on:

1. The `max_size` parameter can be used if you know how many times an instance can be duplicated at most.
2. The `block_by` parameter can be used if you know that duplicates can't occur between values of a given column.

As an example, I'll be using the [restaurants dataset](https://hpi.de/naumann/projects/repeatability/datasets/restaurants-dataset.html) from the Hasso Platner Institute -- the place where Felix Naumann works. Here are the first five rows of the dataset:

<table class="dataframe">
  <thead>
    <tr style="text-align: center; font-weight: bold;">
      <th>id</th>
      <th>address</th>
      <th>city</th>
      <th>name</th>
      <th>phone</th>
      <th>type</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>1</th>
      <td>435 s la cienega blv</td>
      <td>los angeles</td>
      <td>arnie morton s of chicago</td>
      <td>310 246 1501</td>
      <td>american</td>
    </tr>
    <tr>
      <th>2</th>
      <td>435 s la cienega blvd</td>
      <td>los angeles</td>
      <td>arnie morton s of chicago</td>
      <td>310 246 1501</td>
      <td>steakhouses</td>
    </tr>
    <tr>
      <th>3</th>
      <td>12224 ventura blvd</td>
      <td>studio city</td>
      <td>art s delicatessen</td>
      <td>818 762 1221</td>
      <td>american</td>
    </tr>
    <tr>
      <th>4</th>
      <td>12224 ventura blvd</td>
      <td>studio city</td>
      <td>art s deli</td>
      <td>818 762 1221</td>
      <td>delis</td>
    </tr>
    <tr>
      <th>5</th>
      <td>701 stone canyon rd</td>
      <td>bel air</td>
      <td>hotel bel air</td>
      <td>310 472 1211</td>
      <td>californian</td>
    </tr>
  </tbody>
</table>

The dataset contains 864 instances, of which 112 are duplicates -- the list of duplicates is also available from the website. It took me two hours to design a rule-based function which would tell me if yes or no two given restaurants were duplicates or not. Here goes:

```python
from fuzzywuzzy import fuzz


def same_phone(r1, r2):
    return r1['phone'] == r2['phone']


def same_area_code(r1, r2):
    return r1['phone'].split(' ')[0] == r2['phone'].split(' ')[0]


def same_name(r1, r2):
    return fuzz.ratio(r1['name'], r2['name']) > 75


def similar_address(r1, r2):
    return (
        fuzz.ratio(r1['address'], r2['address']) > 55 or
        fuzz.partial_ratio(r1['address'], r2['address']) > 75
    )

def similar_name(r1, r2):
    return fuzz.partial_ratio(r1['name'], r2['name']) > 50


def manual_ritz(r1, r2):
    if 'ritz carlton' in r1['name']:
        for term in ['cafe', 'dining room', 'restaurant']:
            if term in r1['name']:
                return term in r2['name']
    return True


def manual_le_marais(r1, r2):
    return not (
        r1['name'] == 'le marais' and r2['name'] == 'le madri' or
        r1['name'] == 'le madri' and r2['name'] == 'le marais'
    )


def same_restaurant(r1, r2):
    return (
        (
            (
                same_phone(r1, r2) and
                similar_name(r1, r2)
            ) or
            (
                same_area_code(r1, r2) and
                same_name(r1, r2) and
                similar_address(r1, r2)
            )
        ) and
        manual_ritz(r1, r2) and
        manual_le_marais(r1, r2)
    )
```

I know, it's a bit of a mouthful, but it works perfectly and makes no mistakes. As I mentioned earlier, this blog post isn't about finding an appropriate matching function, but instead about how to apply the function in order to retrieve the duplicates. Here is how to run the algorithm on the restaurants dataset:

```python
import pandas as pd

restaurants = pd.read_csv('restaurants/data.tsv', sep='\t', index_col='id')

restaurants['real_id'] = find_partitions(
    df=restaurants,
    match_func=same_restaurant
)
```

Here is a subset of the result, using `restaurants.loc[33:38]`:

<table class="dataframe">
  <thead>
    <tr style="text-align: center; font-weight: bold;">
      <th>id</th>
      <th>address</th>
      <th>city</th>
      <th>name</th>
      <th>phone</th>
      <th>type</th>
      <th>real_id</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>33</th>
      <td>5955 melrose ave</td>
      <td>los angeles</td>
      <td>patina</td>
      <td>213 467 1108</td>
      <td>californian</td>
      <td>16</td>
    </tr>
    <tr>
      <th>34</th>
      <td>5955 melrose ave</td>
      <td>los angeles</td>
      <td>patina</td>
      <td>213 467 1108</td>
      <td>californian</td>
      <td>16</td>
    </tr>
    <tr>
      <th>35</th>
      <td>1001 n alameda st</td>
      <td>los angeles</td>
      <td>philippe s the original</td>
      <td>213 628 3781</td>
      <td>american</td>
      <td>17</td>
    </tr>
    <tr>
      <th>36</th>
      <td>1001 n alameda st</td>
      <td>chinatown</td>
      <td>philippe the original</td>
      <td>213 628 3781</td>
      <td>cafeterias</td>
      <td>17</td>
    </tr>
    <tr>
      <th>37</th>
      <td>12969 ventura blvd</td>
      <td>los angeles</td>
      <td>pinot bistro</td>
      <td>818 990 0500</td>
      <td>french</td>
      <td>18</td>
    </tr>
    <tr>
      <th>38</th>
      <td>12969 ventura blvd</td>
      <td>studio city</td>
      <td>pinot bistro</td>
      <td>818 990 0500</td>
      <td>french bistro</td>
      <td>18</td>
    </tr>
  </tbody>
</table>

Note that finding the duplicates took around 8 seconds. Even though the dataset only contains 864 rows, a total of ${864 \choose 2} = 372,816$ comparisons have to be made in order to be exhaustive. However, as I mentioned there are two tricks I implemented which you can use. First, if you know in advance the number of times an instance can be duplicated, then you can tell the algorithm to stop searching once it has found said number of copies. In the restaurants example, it turns out that every duplicated restaurant is only duplicated once. In other word, each partition of duplicates is necessarily composed of just two elements. We can thus set the `max_size` parameter to 2 and hopefully shave off some time:

```python
restaurants['real_id'] = find_partitions(
    df=restaurants,
    match_func=same_restaurant,
    max_size=2
)
```

This brings us down to 6 seconds, which means we saved 2 seconds. The second trick is to use a "block key" in order to reduce the number of comparisons even more. The insight is that some rules completely determine by themselves if two instances are *not* duplicates. Indeed, in this case the restaurants that are duplicated always have a phone number that begins with the same area code. In the USA, the area code is represented by the first three digits of the phone number. This means that we only have to search for duplicates within each block defined by each area code.

```python
restaurants['area_code'] = restaurants['phone'].str.split(' ', expand=True)[0]

restaurants['real_id'] = find_partitions(
    df=restaurants,
    match_func=same_restaurant,
    block_by='area_code',
    max_size=2
)
```

This brings us down to 4 seconds, which is 50% times faster that the plain variant without any tricks. I checked and most of the remaining computation time is taken by `fuzzywuzzy` library. Designing a better matching function is probably the next step to take in order to get this to go any faster.

I hope you enjoyed this post. I apologize for going through the explanations a bit quickly. I mostly wrote this because I wasn't able to find anything that satisfied my needs online. Hopefully some other people will find useful for their own problems. Feel free to shoot me an email if you have any remarks and/or questions.
