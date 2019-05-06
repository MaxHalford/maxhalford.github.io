+++
date = "2019-05-06"
draft = false
title = "SQL subquery enumeration"
+++

I recently stumbled on a rather fun problem during my PhD. I wanted to generate all possible subqueries from a given SQL query. In this case an example is easily worth a 1000 thousand words. Take the following SQL query:

```sql
SELECT *
FROM
    customers AS c,
    purchases AS p,
    shops AS s
WHERE
    p.customer_id = c.id AND
    p.shop_id = s.id
AND
    c.nationality = 'Swedish' AND
    c.hair = 'Blond' AND
    s.city = 'Stockholm'
```

Here all the possible subqueries that can be generated from the above query.

```sql
-- 1
SELECT *
FROM customers AS c
WHERE c.nationality = 'Swedish'

-- 2
SELECT *
FROM customers AS c
WHERE c.hair = 'Blond'

-- 3
SELECT *
FROM customers AS c
WHERE c.nationality = 'Swedish'
AND c.hair = 'Blond'

-- 4
SELECT *
FROM customers AS c, purchases AS p
WHERE c.nationality = 'Swedish'
AND p.customer_id = c.id

-- 5
SELECT *
FROM customers AS c, purchases AS p
WHERE c.hair = 'Blond'
AND p.customer_id = c.id

-- 6
SELECT *
FROM customers AS c, purchases AS p
WHERE c.nationality = 'Swedish'
AND c.hair = 'Blond'
AND p.customer_id = c.id

-- 7
SELECT *
FROM customers AS c, purchases AS p, shops AS s
WHERE c.nationality = 'Swedish'
AND p.customer_id = c.id
AND p.shop_id = s.id

-- 8
SELECT *
FROM customers AS c, purchases AS p, shops AS s
WHERE c.hair = 'Blond'
AND p.customer_id = c.id
AND p.shop_id = s.id

-- 9
SELECT *
FROM customers AS c, purchases AS p, shops AS s
WHERE c.nationality = 'Swedish'
AND c.hair = 'Blond'
AND p.customer_id = c.id
AND p.shop_id = s.id

-- 10
SELECT *
FROM customers AS c, purchases AS p, shops AS s
WHERE c.nationality = 'Swedish'
AND s.city = 'Stockholm'
AND p.customer_id = c.id
AND p.shop_id = s.id

-- 11
SELECT *
FROM customers AS c, purchases AS p, shops AS s
WHERE c.hair = 'Blond'
AND s.city = 'Stockholm'
AND p.customer_id = c.id
AND p.shop_id = s.id

-- 12
SELECT *
FROM customers AS c, purchases AS p, shops AS s
WHERE c.nationality = 'Swedish'
AND c.hair = 'Blond'
AND s.city = 'Stockholm'
AND p.customer_id = c.id
AND p.shop_id = s.id

-- 13
SELECT *
FROM customers AS c, purchases AS p, shops AS s
AND s.city = 'Stockholm'
AND p.customer_id = c.id
AND p.shop_id = s.id

-- 14
SELECT *
FROM purchases AS p, shops AS s
AND s.city = 'Stockholm'
AND p.shop_id = s.id

-- 15
SELECT *
FROM shops AS s
AND s.city = 'Stockholm'
```

You might notice that I've omitted subqueries that don't include a `WHERE` statement. Indeed I'm only interested in queries that filter on some attribute. Regardless, the number of possible subqueries is HUGE in comparison with the simplicity of the query (at least, in my opinion). I'm lazy so I didn't take the time to find a nice formula that could tell me exactly how many subqueries to expect. However I wrote a Python script that enumerates all subqueries and saves to a JSON file. It took me some time to figure out so I thought it would be worth sharing.

I'll go through the steps of my code and then give you the link to the research project I'm using it for on GitHub. The code is rather short and it doesn't require any dependencies. However, the code is a bit of a mouthful and isn't easy to understand without a little effort. Anyway, here goes.

I first wrote a function to parse an SQL query. This function, `parse_query`, returns a 3 `dict`s that contain the different part of the query.

```python
import collections
import re


def remove_whitespaces(string):
    """remove_whitespaces(' cake  ') => 'cake'"""
    return string.lstrip().rstrip()


def replace_between(query):
    """replace_between('BETWEEN 1 AND 3') => '>= 1 AND <= 3'"""
    while 'BETWEEN' in query:
        idx = query.find('BETWEEN')
        right_val = re.search("AND (['a-zA-Z0-9]+)?", query[idx:]).group().split(' ')[1]
        att = remove_whitespaces(query[:idx].split('AND')[-1])
        query = query[:idx] + re.sub(r'AND .+?\s', f'AND {att} <= {right_val}', query[idx:], 1)
        query = query.replace('BETWEEN', '>=', 1)
    return query


def parse_query(query):
    query = query.replace('\n', ' ')

    from_part = query.split('FROM')[1].split('WHERE')[0]
    where_part = query.split('WHERE')[1]
    where_part = replace_between(where_part)

    froms = dict(
        reversed(list(map(remove_whitespaces, name.split('AS'))))
        for name in from_part.split(',')
    )

    joins = {}
    wheres = collections.defaultdict(list)

    # Parse the WHERE statement
    for where in list(map(remove_whitespaces, re.split(r'AND\s*(?![^()]*\))', where_part))):

        if 'OR' in where:
            rel = where.split('.')[0][1:]
            wheres[rel].append(where)
            continue

        op = re.search('|'.join(f'({op})' for op in OPERATORS), where).group()
        left, right = where.split(op)

        left = remove_whitespaces(left)
        right = remove_whitespaces(right)
        op = remove_whitespaces(op)

        if op == '=' and '.' in right:
            l_rel = left.split('.')[0]
            r_rel = right.split('.')[0]
            joins[tuple(sorted([l_rel, r_rel]))] = where
            continue

        rel = left.split('.')[0]
        wheres[rel].append(where)

    return froms, wheres, joins
```

I know, it's not very pretty. But you can at least understand the outputs. `froms` is a `dict` where the keys are the relation aliases and the values are the relation names.

```python
{
    'c': 'customers',
    'p': 'purchases',
    's': 'shops'
}
```

As for `wheres`, it lists the `WHERE` clauses of each relation.

```python
{
    'c': ["c.nationality = 'Swedish'", "c.hair = 'Blond'"],
    's': ["s.city = 'Stockholm'"]
}
```

Finally, `joins` maps pairs of relations to their associated join clause.

```python
{
    ('c', 'p'): 'p.customer_id = c.id',
    ('p', 's'): 'p.shop_id = s.id'
}
```

The `parse_query` function is the weakest part of my script. It relies on the fact that the provided query has a certain structure that I won't dwell on. Basically each relation must have an alias (e.g. `shops AS s`) and the `WHERE` conditions should all be separated by `AND`s (not `OR`s). I tailored this to work for the TPC-DS benchmark queries. If you wanted to reuse my script for other types of queries, then I believe that you would mostly have to tinker with `parse_query`.

The second main function I wrote is called `yield_subqueries`. It's a generator that will return each subquery one by one.

```python
def powerset(iterable):
    """powerset([1,2,3]) => (1,) (2,) (3,) (1, 2) (1, 3) (2, 3) (1, 2, 3)"""
    s = list(iterable)
    return itertools.chain.from_iterable(
        itertools.combinations(s, r)
        for r in range(1, len(s) + 1)
    )


def yield_subqueries(query):

    froms, wheres, joins = parse_query(query)
    relations = list(sorted(froms.keys()))

    adjacencies = [[0 for _ in range(len(relations))] for _ in range(len(relations))]
    for pair in joins.keys():
        i, j = relations.index(pair[0]), relations.index(pair[1])
        adjacencies[i][j] = adjacencies[j][i] = 1

    combos = set()

    def enum(i, combo, seen):

        candidates = []

        for j, ok in enumerate(adjacencies[i]):
            if j not in seen and ok:
                candidates.append(j)

        for pick in powerset(candidates):
            yield combo + [relations[p] for p in pick]

            for p in pick:
                for new_combo in enum(p, combo + [relations[p] for p in pick], {*seen, *candidates}):
                    yield new_combo

    for i, rel in enumerate(relations):
        combos.add((rel,))
        for combo in enum(i, [rel], {i}):
            combos.add(tuple(sorted(combo)))

    for combo in combos:

        relevant_joins = list(filter(
            None.__ne__,
            [joins.get(tuple(sorted(pair))) for pair in itertools.combinations(combo, 2)]
        ))
        relevant_wheres = list(itertools.chain(*[wheres[r] for r in combo]))

        from_stmt = ', '.join(f'{froms[rel]} AS {rel}' for rel in combo)
        join_stmt = ' AND '.join(relevant_joins)
        sql = f'SELECT * FROM {from_stmt}'
        if join_stmt:
            sql += ' AND ' + join_stmt

        for where_combo in powerset(relevant_wheres):
            subquery = (sql + ' AND ' + ' AND '.join(where_combo)).replace('AND', 'WHERE', 1)
            subquery = subquery = re.sub('\s+', ' ', subquery).strip()
            yield subquery
```

Again, it's hard to understand but it's worked really well for me and is quite fast. The idea is to build an adjacency matrix which tells us which relations each relation is connected to in the query. In our case this would be:

```python
[
    [0, 1, 0],  # customers
    [1, 0, 1],  # purchases
    [0, 1, 0]   # shops
]
```

The idea is to then loop over each row and "walk" the adjacency matrix until having enumerated all possible join combinations. For each join combination we're also going to enumerate all the possible `WHERE` statements. These are called `relevant_joins` and `relevant_wheres`. `combos` is a set that contains all the possible join combinations. I know, it's a bit of a mouthful.

Inside the `main()` of my `script` I simply looped over the TPC-DS benchmark queries and saved all the subqueries I could enumerate.

```python
import glob
import json


def main():

    results = []

    for path in sorted(glob.glob('join-order-benchmark/*.sql')):

        query_name = os.path.basename(path).split(".")[0]
        if query_name in ('fkindexes', 'schema'):
            continue

        # Load and tidy the query
        query = open(path).read().rstrip().rstrip(';')

        # Enumerate the subqueries and save them
        for i, subquery in enumerate(yield_subqueries(query)):
            print(subquery)
            results.append({'mother_query': query_name, 'sql': subquery})

        print(f'Enumerated {i + 1} subqueries for query {query_name}')

        break

    with open('results.json', 'w') as f:
        json.dump(results, f)
```

The TPC-DS benchmark contains 113 queries. My script produces a total of 5.122.790 queries in under 4 minutes. Here's the breakdown per query:

```sh
Query 10a: 477
Query 10b: 225
Query 10c: 140
Query 11a: 1842
Query 11b: 1842
Query 11c: 1471
Query 11d: 869
Query 12a: 1730
Query 12b: 922
Query 12c: 1730
Query 13a: 261
Query 13b: 981
Query 13c: 981
Query 13d: 261
Query 14a: 760
Query 14b: 1424
Query 14c: 1032
Query 15a: 4724
Query 15b: 12946
Query 15c: 2504
Query 15d: 596
Query 16a: 258
Query 16b: 54
Query 16c: 122
Query 16d: 258
Query 17a: 63
Query 17b: 38
Query 17c: 38
Query 17d: 38
Query 17e: 38
Query 17f: 38
Query 18a: 241
Query 18b: 3678
Query 18c: 279
Query 19a: 64218
Query 19b: 115806
Query 19c: 12945
Query 19d: 2393
Query 1a: 88
Query 1b: 124
Query 1c: 68
Query 1d: 68
Query 20a: 1063
Query 20b: 1504
Query 20c: 1063
Query 21a: 5598
Query 21b: 5598
Query 21c: 5598
Query 22a: 10337
Query 22b: 10337
Query 22c: 10337
Query 22d: 2993
Query 23a: 5586
Query 23b: 3289
Query 23c: 5586
Query 24a: 33458
Query 24b: 69108
Query 25a: 852
Query 25b: 2340
Query 25c: 852
Query 26a: 4400
Query 26b: 4400
Query 26c: 2608
Query 27a: 28616
Query 27b: 16904
Query 27c: 28616
Query 28a: 41839
Query 28b: 41839
Query 28c: 41839
Query 29a: 2245875
Query 29b: 1302387
Query 29c: 832050
Query 2a: 16
Query 2b: 16
Query 2c: 16
Query 2d: 16
Query 30a: 7302
Query 30b: 12550
Query 30c: 4678
Query 31a: 2421
Query 31b: 11141
Query 31c: 1908
Query 32a: 7
Query 32b: 7
Query 33a: 12339
Query 33b: 6609
Query 33c: 12339
Query 3a: 25
Query 3b: 25
Query 3c: 25
Query 4a: 68
Query 4b: 68
Query 4c: 68
Query 5a: 178
Query 5b: 358
Query 5c: 178
Query 6a: 32
Query 6b: 32
Query 6c: 32
Query 6d: 32
Query 6e: 32
Query 6f: 19
Query 7a: 3901
Query 7b: 2137
Query 7c: 6547
Query 8a: 1540
Query 8b: 13679
Query 8c: 52
Query 8d: 52
Query 9a: 7771
Query 9b: 7771
Query 9c: 874
Query 9d: 486
```

I'm sure it's possible to do this faster and with more obvious code, but this is as could I judged necessary with respect to the rest of my PhD work. The full script is available in [this GitHub repository](https://github.com/MaxHalford/online-selectivity-correction) in the `scripts` directory.

I hope someday this helps someone!
