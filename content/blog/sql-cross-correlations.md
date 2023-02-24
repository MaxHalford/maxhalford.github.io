+++
date = "2020-11-17"
title = "Computing cross-correlations in SQL"
tags = ['sql']
+++

## Introduction

I'm currently working on a problem at work where I have to measure the impact of a <span style="color: SlateBlue;">growth initiative</span> on a <span style="color: MediumSeaGreen;">performance metric</span>. Hypothetically, this might to answer the following kind of question:

> I've spent <span style="color: SlateBlue;">X amount of money</span>, what is the impact on the <span style="color: MediumSeaGreen;">number of visitors on my website</span>?

Of course, there are many measures that can be taken to answer such a question. I decided to measure the correlation between the <span style="color: SlateBlue;">initiative</span> and the <span style="color: MediumSeaGreen;">metric</span>, with the latter being shifted forward in time. This measure is called the [cross-correlation](https://www.wikiwand.com/en/Cross-correlation). It's different from [serial correlation](https://www.wikiwand.com/en/Autocorrelation), which is the correlation of a series with a shifted version of itself.

Computing the cross-correlation between two series of numbers $X$ and $Y$ is simple. Assuming that we want to measure the impact of $X$ on $Y$, we just have to shift $Y$ forward and compute the correlation between $X$ and the shifted version of $Y$. Of course, one has to decide by how much to shift $Y$. Ideally, we would like to measure the impact of $X$ on multiple shifted versions of $Y$. Indeed, we might want to know how increasing $X$ affects $Y$ in one week, two weeks, three weeks, etc.

## Cross-correlation for two variables

I'm going to be using PostgreSQL 12.3. I'm be using a fair amount of [common table expressions](https://www.postgresql.org/docs/9.1/queries-with.html) in order to clarify the steps to take. First, let's pick some dummy data:

```sql
WITH dummy AS (
    SELECT * FROM (
    VALUES
        ('2020-01-01'::DATE, 1, 10),
        ('2020-01-02'::DATE, 2, 20),
        ('2020-01-03'::DATE, 3, 50),
        ('2020-01-04'::DATE, 0, -1000),
        ('2020-01-05'::DATE, -5, 0)
    ) AS dummy (date, x, y)
)
```

As mentioned, we would like our code to work for an arbitrary number of steps forward. Therefore, let's define a range of delta values by which will be used to shift `Y` forward:

```sql
, delta AS (
    SELECT *
    FROM generate_series(1, 3) delta
)
```

Now let's add the deltas to the `date` field in order to define the future dates:

```sql
, dates AS (
    SELECT
        date AS present,
        delta,
        date + delta * '1 day'::interval AS future
    FROM dummy
    CROSS JOIN delta
)
```

```sql
>>> SELECT * FROM dates LIMIT 8;
present     delta   future
2020-01-01  1       2020-01-02
2020-01-02  1       2020-01-03
2020-01-03  1       2020-01-04
2020-01-04  1       2020-01-05
2020-01-05  1       2020-01-06
2020-01-01  2       2020-01-03
2020-01-02  2       2020-01-04
2020-01-03  2       2020-01-05
```

We can now join the dates with the values from the initial table:

```sql
, pairwise AS (
    SELECT
        dates.present,
        dates.future,
        dates.delta,
        present.x AS present_x,
        future.y AS future_y
    FROM
        dates,
        dummy AS present,
        dummy AS future
    WHERE dates.present = present.date
        AND dates.future = future.date
)
```

```sql
>>> SELECT * FROM pairwise ORDER BY present, delta;
present     future      delta   present_x   future_y
2020-01-01  2020-01-02  1       1           20
2020-01-01  2020-01-03  2       1           50
2020-01-01  2020-01-04  3       1           -1000
2020-01-02  2020-01-03  1       2           50
2020-01-02  2020-01-04  2       2           -1000
2020-01-02  2020-01-05  3       2           0
2020-01-03  2020-01-04  1       3           -1000
2020-01-03  2020-01-05  2       3           0
2020-01-04  2020-01-05  1       0           0
```

Finally, we just have to compute the correlation within each group. The groups are defined by the `delta` field. In other words, we will compute the correlation for all values that match $(X_t, Y_{t+1})$, $(X_t, Y_{t+2})$, and $(X_t, Y_{t+3})$.

```sql
, cross_corrs AS (
    SELECT
        delta,
        CORR(present_x, future_y) AS pearson
    FROM pairwise
    GROUP BY delta
    ORDER BY delta
)
```

```sql
>>> SELECT * FROM cross_corrs;
delta   pearson
1       -0,7487619679833206
2       -0,042207495591251455
3       1
```

That's it, we're done. You can click on the toggle below if you want to copy/paste the full example.

<details>
  <summary>Click to see the full example</summary>

```sql
WITH dummy AS (
    SELECT * FROM (
    VALUES
        ('2020-01-01'::DATE, 1, 10),
        ('2020-01-02'::DATE, 2, 20),
        ('2020-01-03'::DATE, 3, 50),
        ('2020-01-04'::DATE, 0, -1000),
        ('2020-01-05'::DATE, -5, 0)
    ) AS dummy (date, x, y)
)

, delta AS (
    SELECT *
    FROM generate_series(1, 3) delta
)

, dates AS (
    SELECT
        date AS present,
        delta,
        date + delta * '1 day'::interval AS future
    FROM dummy
    CROSS JOIN delta
)

, pairwise AS (
    SELECT
        dates.present,
        dates.future,
        dates.delta,
        present.x AS present_x,
        future.y AS future_y
    FROM
        dates,
        dummy AS present,
        dummy AS future
    WHERE dates.present = present.date
        AND dates.future = future.date
)

, cross_corrs AS (
    SELECT
        delta,
        CORR(present_x, future_y) AS pearson
    FROM pairwise
    GROUP BY delta
    ORDER BY delta
)

SELECT * FROM cross_corrs;
```
</details>

## Different kinds of correlations

Up until now, I've been making the common assumption that "correlation" refers to the [Pearson correlation](https://www.wikiwand.com/en/Pearson_correlation_coefficient). There are other kinds of correlations, such as [Spearman's rank correlation](https://www.wikiwand.com/en/Spearman%27s_rank_correlation_coefficient). The latter is not available in PostgreSQL 12.3, but it is easy to calculate, as it is just the Pearson correlation of the ranks of the values of $X$ and $Y$. In SQL, this translates to:

```sql
SELECT
    delta
    RANK () OVER (
        PARTITION BY delta
        ORDER BY x
    ) AS x_rank,
    RANK () OVER (
        PARTITION BY delta
        ORDER BY y
    ) AS y_rank
FROM dummy
```

```sql
0.9
```

Ideally, we would like to calculate both kinds of correlations (Pearson and Spearman) for each delta value. This is quite straightforward to do, albeit slightly verbose.

```sql
WITH dummy AS (
    SELECT * FROM (
    VALUES
        ('2020-01-01'::DATE, 1, 10),
        ('2020-01-02'::DATE, 2, 20),
        ('2020-01-03'::DATE, 3, 50),
        ('2020-01-04'::DATE, 0, -1000),
        ('2020-01-05'::DATE, -5, 0)
    ) AS dummy (date, x, y)
)

, delta AS (
    SELECT *
    FROM generate_series(1, 3) delta
)

, dates AS (
    SELECT
        date AS present,
        delta,
        date + delta * '1 day'::interval AS future
    FROM dummy
    CROSS JOIN delta
)

, pairwise AS (
    SELECT
        dates.present,
        dates.future,
        dates.delta,
        present.x AS present_x,
        future.y AS future_y
    FROM
        dates,
        dummy AS present,
        dummy AS future
    WHERE dates.present = present.date
        AND dates.future = future.date
)

, cross_corrs AS (
    SELECT
        delta,
        CORR(present_x, future_y) AS pearson
    FROM pairwise
    GROUP BY delta
    ORDER BY delta
)

, pairwise_ranks AS (
    SELECT
    	delta,
        RANK () OVER (
            PARTITION BY delta
            ORDER BY present_x
        ) AS present_x_rank,
        RANK () OVER (
            PARTITION BY delta
            ORDER BY future_y
        ) AS future_y_rank
    FROM pairwise
)

, cross_rank_corrs AS (
    SELECT
        delta,
        CORR(present_x_rank, future_y_rank) AS spearman
    FROM pairwise_ranks
    GROUP BY delta
    ORDER BY delta
)

, corrs AS (
    SELECT
        cc.delta,
        cc.pearson,
        crc.spearman
    FROM cross_corrs cc
    LEFT JOIN cross_rank_corrs crc
        ON cc.delta = crc.delta
)
```

```sql
>>> SELECT * FROM corrs;
delta   pearson                 spearman
1       -0,7487619679833206     -0,2
2       -0,042207495591251455   -0,5
3       1                       1
```

## Multiple $X$s and $Y$s

We now have a framework to compute different kinds of cross-correlations between two variables over multiple time steps. Let's push the envelope and make it so that can compute the cross-correlations for multiple variables. To be precise, we would like to compute cross-correlations between <span style="color: SlateBlue;">a group of initiatives ($X$s) </span> and <span style="color: MediumSeaGreen;">a group of metrics ($Y$s)</span>.

First of all, let's create some more dummy data. We'll also split the $X$s from the $Y$s. We're also going to [melt](https://pandas.pydata.org/pandas-docs/stable/reference/api/pandas.melt.html) (or "unpivot" as some like to say) both groups. The reason why we do this is that it will simplify the subsequent code.

```sql
WITH dummy AS (
    SELECT * FROM (
    VALUES
        ('2020-01-01'::DATE, 1, 4, 10, 15),
        ('2020-01-02'::DATE, 2, 8, 20, 12),
        ('2020-01-03'::DATE, 3, -2, 50, -44),
        ('2020-01-04'::DATE, 0, 3, -1000, 12),
        ('2020-01-05'::DATE, -5, 10, 0, 14)
    ) AS dummy (date, x1, x2, y1, y2)
)

, xs AS (
    SELECT
        date,
        UNNEST(ARRAY['x1', 'x2']) AS var,
        UNNEST(ARRAY[x1, x2]) AS val
    FROM dummy
)

, ys AS (
    SELECT
        date,
        UNNEST(ARRAY['y1', 'y2']) AS var,
        UNNEST(ARRAY[y1, y2]) AS val
    FROM dummy
)
```

```sql
>>> SELECT * FROM xs ORDER BY date, var;
date        var   val
2020-01-01  x1    1
2020-01-01  x2    4
2020-01-02  x1    2
2020-01-02  x2    8
2020-01-03  x1    3
2020-01-03  x2    -2
2020-01-04  x1    0
2020-01-04  x2    3
2020-01-05  x1    -5
2020-01-05  x2    10
```

Note that this way of representing data agrees with the [Tidy Data](https://vita.had.co.nz/papers/tidy-data.pdf) principles advocated by [Hadley Wickam](http://hadley.nz/). Essentially, flattening/melting a table eases the manipulation of said table.

Next, we're going to be generating future dates in the exact same way as we did previously.

```sql
, delta AS (
    SELECT *
    FROM generate_series(1, 3) delta
)

, dates AS (
    SELECT
        date AS present,
        delta,
        date + delta * '1 day'::interval AS future
    FROM dummy
    CROSS JOIN delta
)
```

We do however need to change the definition of the `pairwise` CTE. It's quite straightforward as long as you're concentrating a minimum. Here goes:

```sql
, pairwise AS (
    SELECT
        dates.present,
        dates.future,
        dates.delta,
        xs.var AS x_var,
        xs.val AS x_val,
        ys.var AS y_var,
        ys.val AS y_val
    FROM
        dates,
        xs,
        ys
    WHERE dates.present = xs.date
        AND dates.future = ys.date
    ORDER BY present, delta, x_var, y_var
)
```

```sql
>>> SELECT * FROM pairwise LIMIT 5;
present     future       delta  x_var x_val y_var   y_val
2020-01-01  2020-01-02   1      x1    1     y1      20
2020-01-01  2020-01-02   1      x1    1     y2      12
2020-01-01  2020-01-02   1      x2    4     y1      20
2020-01-01  2020-01-02   1      x2    4     y2      12
2020-01-01  2020-01-03   2      x1    1     y1      50
```

We can now compute all the correlations we want by grouping over `(delta, x_var, y_var)`. Again, this is still relatively simple as long as you proceed step by step:

```sql
, cross_corrs AS (
    SELECT
        delta,
        x_var AS x,
        y_var AS y,
        'pearson' AS kind,
        CORR(x_val, y_val) AS correlation
    FROM pairwise
    GROUP BY delta, x_var, y_var
)

, pairwise_ranks AS (
    SELECT
    	delta,
    	x_var AS x,
    	y_var AS y,
        RANK () OVER (
            PARTITION BY delta, x_var, y_var
            ORDER BY x_val
        ) AS x_rank,
        RANK () OVER (
            PARTITION BY delta, x_var, y_var
            ORDER BY y_val
        ) AS y_rank
    FROM pairwise
)

, cross_rank_corrs AS (
    SELECT
        delta,
        x,
        y,
        'spearman' AS kind,
        CORR(x_rank, y_rank) AS correlation
    FROM pairwise_ranks
    GROUP BY delta, x, y
)

, corrs AS (
    SELECT * FROM cross_corrs
    UNION
    SELECT * FROM cross_rank_corrs
    ORDER BY delta, x, y, kind
)
```

```sql
>>> SELECT * FROM corrs;
delta   x   y        kind       correlation
1       x1  y1       pearson     -0,7487619679833206
1       x1  y1       spearman    -0,2
1       x1  y2       pearson     -0,2823436901242271
1       x1  y2       spearman    -0,7181848464596079
1       x2  y1       pearson     0,8708519999050144
1       x2  y1       spearman    1
1       x2  y2       pearson     -0,7618694949404378
1       x2  y2       spearman    -0,5129891760425771
2       x1  y1       pearson     -0,042207495591251455
2       x1  y1       spearman    -0,5
2       x1  y2       pearson     0,8808122718846411
2       x1  y2       spearman    1
2       x2  y1       pearson     -0,777082191335969
2       x2  y1       spearman    -0,5
2       x2  y2       pearson     -0,144827299193112
2       x2  y2       spearman    -0,5
3       x1  y1       pearson     1
3       x1  y1       spearman    1
3       x1  y2       pearson     1
3       x1  y2       spearman    1
3       x2  y1       pearson     1
3       x2  y1       spearman    1
3       x2  y2       pearson     1
3       x2  y2       spearman    1
```

That's all folks!
