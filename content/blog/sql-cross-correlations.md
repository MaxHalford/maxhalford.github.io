+++
date = "2020-11-16"
draft = false
title = "Computing cross-correlations in SQL"
+++

I'm currently working on a problem at work where I have to measure the impact of a <span style="color: SlateBlue;">growth initiative</span> on a <span style="color: MediumSeaGreen;">performance metric</span>. Hypothetically, this might to answer the following kind of question:

> I've spent <span style="color: SlateBlue;">X amount of money</span>, what is the impact on the <span style="color: MediumSeaGreen;">number of visitors on my website</span>?

Of course, there are many measures that can be taken to answer such a question. I decided to measure the correlation between the <span style="color: SlateBlue;">initiative</span> and the <span style="color: MediumSeaGreen;">metric</span>, with the latter being shifted forward in time. This measure is called the [cross-correlation](https://www.wikiwand.com/en/Cross-correlation). It's different from [serial correlation](https://www.wikiwand.com/en/Autocorrelation), which is the correlation of a series with a shifted version of itself.

Computing the cross-correlation between two series of numbers $X$ and $Y$ is simple. Assuming that we want to measure the impact of $X$ on $Y$, we just have to shift $Y$ forward and compute the correlation between $X$ and the shifted version of $Y$. Of course, one has to decide by how much to shift $Y$. Ideally, we would like to measure the impact of $X$ on multiple shifted versions of $Y$. Indeed, we might want to know how increasing $X$ affects $Y$ in one week, two weeks, three weeks, etc.

I'm going to be using PostgreSQL 12.3. I'm be using a fair amount of [common table expressions](https://www.postgresql.org/docs/9.1/queries-with.html) in order to clarify the steps the take. First, let's pick some dummy data:

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

As mentioned, we would like our code to work for arbitrary number of steps forward. Therefore, let's define a range of delta values by which will be used to shift `Y` forward:

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
2020-01-01  1       2020-01-02 00:00:00
2020-01-02  1       2020-01-03 00:00:00
2020-01-03  1       2020-01-04 00:00:00
2020-01-04  1       2020-01-05 00:00:00
2020-01-05  1       2020-01-06 00:00:00
2020-01-01  2       2020-01-03 00:00:00
2020-01-02  2       2020-01-04 00:00:00
2020-01-03  2       2020-01-05 00:00:00
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
present     future              delta   present_x   future_y
2020-01-01  2020-01-02 00:00:00 1       1           20
2020-01-01  2020-01-03 00:00:00 2       1           50
2020-01-01  2020-01-04 00:00:00 3       1           -1000
2020-01-02  2020-01-03 00:00:00 1       2           50
2020-01-02  2020-01-04 00:00:00 2       2           -1000
2020-01-02  2020-01-05 00:00:00 3       2           0
2020-01-03  2020-01-04 00:00:00 1       3           -1000
2020-01-03  2020-01-05 00:00:00 2       3           0
2020-01-04  2020-01-05 00:00:00 1       0           0
```

Finally, we just have the compute the correlation within each group. The groups are defined by the `delta` field. In other words, we will compute the correlation for all values that match $(X_t, Y_{t+1})$, $(X_t, Y_{t+2})$, and $(X_t, Y_{t+3})$.

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

Note that I've made the common assumption that "correlation" refers to the [Pearson correlation](https://www.wikiwand.com/en/Pearson_correlation_coefficient). There are other kinds of correlations, such as [Spearman's rank correlation coefficient](https://www.wikiwand.com/en/Spearman%27s_rank_correlation_coefficient). The latter is not available in PostgreSQL 12.3, but it is easy to calculate, as it is just the Pearson correlation of the ranks of the values of $X$ and $Y$. In SQL, this translates to:

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

, ranks AS (
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
)
```

```sql
>>> SELECT CORR(x_rank, y_rank) FROM ranks;
0.9
```

Ideally, we would like to calculate both kinds of correlations for each delta value. This is quite straighforward to do, albeit slightly verbose.

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

That's all folks!
