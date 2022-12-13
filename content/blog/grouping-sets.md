+++
date = "2021-09-10"
title = "Dashboards and GROUPING SETS"
toc = true
tags = ['data-eng']
+++

## Motivation

At [Alan](https://alan.com/), we do almost all our data analysis in SQL. Our data warehouse used to be [PostgreSQL](https://www.postgresql.org/), and have since switched to [Snowflake](https://www.snowflake.com/) for performance reasons. We load data into our warehouse with [Airflow](https://airflow.apache.org/). This includes dumps of our production database, third-party data, and health data from other actors in the health ecosystem. This is raw data. We transform this into prepared data via an in-house tool that resembles [dbt](https://www.getdbt.com/). You can read more about it [here](https://medium.com/alan/how-we-solve-the-problem-of-sharing-actionable-data-with-the-team-7e4afeff3cac).

Our data analysis is done on top of our prepared data. We use [Metabase](https://www.metabase.com/) to create dashboards. Recently, we've been having a lot of discussion around our setup. Metabase allows querying the data warehouse with SQL. This gives us the liberty to do whatever we want between the data warehouse and the visualisation. This sounds great... but it's not. Indeed, it's too permissive.

One of the issues we're facing is that we have a lot of business logic that is stored in Metabase, rather than being versioned in our analytics codebase. There is also business logic that is duplicated in many places across Metabase. Moreover, when we make a change to our prepared data, it's burdensome to propagate the changes into our dashboards.

Generally speaking, we wish to change our relationship with Metabase. We've agreed that the less SQL code is in Metabase, the better. We're addressing this via various initiatives. One of them is to prepare data in such a way that it can be consumed in a dashboard with minimal effort. We recently discovered that Snowflake has a [`GROUPING SETS`](https://docs.snowflake.com/en/sql-reference/constructs/group-by-grouping-sets.html) operator. This has unlocked quite a powerful pattern for us. Before delving into said pattern, let us start by dwelling on what this operator does.

## What `GROUPING SETS` does

Let's use a toy example to illustrate.

As a health insurance company, it is key for us is to keep track of our margin. We do this by comparing premiums, which is the money we receive from the people we cover, with claims, which are the healthcare expenses we reimburse. Assuming we've collected these figures at a company level, this might result in such a [tidy](https://cran.r-project.org/web/packages/tidyr/vignettes/tidy-data.html) dataset:

| week       | country | industry | premiums | claims |
|------------|:-------:|:-------:|---------:|-------:|
| 2021-01-01 |    🇫🇷   | 🏥 | 10,000   | 8,000  |
| 2021-01-01 |    🇫🇷   | 🏭 | 5,000    | 7,000  |
| 2021-01-08 |    🇫🇷   | 🏥 | 11,000   | 8,500  |
| 2021-01-08 |    🇫🇷   | 🏭 | 4,000    | 6,000  |
| 2021-01-01 |    🇪🇸   | 🏥 | 2,000    | 1,800  |
| 2021-01-01 |    🇪🇸   | 🏭 | 3,000    | 3,500  |

<details>
  <summary>Table definition in SQL</summary>

```sql
WITH accounts AS (
    SELECT week, country, industry, premiums, claims
    FROM VALUES
        ('2021-01-01', '🇫🇷', '🏥', 10000, 8000),
        ('2021-01-01', '🇫🇷', '🏭', 5000, 7000),
        ('2021-01-08', '🇫🇷', '🏥', 11000, 8500),
        ('2021-01-08', '🇫🇷', '🏭', 4000, 6000),
        ('2021-01-01', '🇪🇸', '🏥', 2000, 1800),
        ('2021-01-01', '🇪🇸', '🏭', 3000, 3500)
    AS accounts (week, country, industry, premiums, claims)
)

SELECT *
FROM accounts
```
</details>

Typically, we compute a [loss ratio](https://www.wikiwand.com/en/Loss_ratio) by comparing the premiums with the claims:

```sql
SELECT SUM(claims) / SUM(premiums) AS loss_ratio
FROM accounts
```

```
0.994286
```

We would like to break this metric down across a few dimensions to get a better understanding. We might want to look at the evolution through time, the country the company is based in, as well as the type of industry it belongs to. But we're greedy, so we also want to look at combinations of these dimensions.

The naïve approach in SQL would be to write down many queries with different `GROUP BY` statements. This can quickly get verbose and difficult to maintain. This is exactly what the `GROUPING SETS` operator is meant for. Let's start with a small example:

```sql
SELECT
    week,
    industry,
    SUM(claims) / SUM(premiums) AS loss_ratio
FROM accounts
WHERE country = '🇫🇷'
GROUP BY GROUPING SETS (
    (week),
    (industry),
    (week, industry)
)
```

| week | industry | loss_ratio |
| :--- | :--: | :--- |
| 2021-01-01 | 🏥 | 0.80 |
| 2021-01-01 | 🏭 | 1.40 |
| 2021-01-08 | 🏥 | 0.77 |
| 2021-01-08 | 🏭 | 1.50 |
| 2021-01-01 | NULL | 1.00 |
| 2021-01-08 | NULL | 0.97 |
| NULL | 🏥 | 0.79 |
| NULL | 🏭 | 1.44 |

This is in fact the concatenation of three smaller tables:

**(`week`, `industry`)**

| week | industry | loss_ratio |
| :--- | :--: | :--- |
| 2021-01-01 | 🏥 | 0.80 |
| 2021-01-01 | 🏭 | 1.40 |
| 2021-01-08 | 🏥 | 0.77 |
| 2021-01-08 | 🏭 | 1.50 |

**(`week`)**

| week | industry | loss_ratio |
| :--- | :--: | :--- |
| 2021-01-01 | NULL | 1.00 |
| 2021-01-08 | NULL | 0.97 |

**(`industry`)**

| week | industry | loss_ratio |
| :--- | :--: | :--- |
| NULL | 🏥 | 0.79 |
| NULL | 🏭 | 1.44 |

In fact, you could just as well implement a `GROUPING SET` yourself by concatenating many `GROUP BY` query results together via some `UNION` operators. This is nicely illustrated [here](https://docs.microsoft.com/en-us/previous-versions/sql/sql-server-2008-r2/bb510427(v=sql.105)). That's it really, the `GROUPING SET` operator simply performs and collates many `GROUP BY` in one fell swoop.

## A pattern for creating dashboards

Data analysis very often boils down to looking at a metric, and drilling down to understand its distribution. This is why the tidy data concept data is so powerful: the data is ready to be aggregated. A dashboard is very often just an interface to display metrics grouped by various dimensions. Ideally, dashboards allow choosing which dimensions to drill down on. Sadly, this isn't available in Metabase. Moreover, the desired aggregation has to be performed live. This costs precious seconds as well as compute credits.

The nice thing with `GROUPING SETS` is that all the computation has already been performed. You can just filter the resulting table to look at the set of dimensions you're interested in. One way to do this is by checking on the nullity of the columns:

```sql
WITH groups (
    SELECT
        week,
        industry,
        SUM(claims) / SUM(premiums) AS loss_ratio
    FROM accounts
    WHERE country = '🇫🇷'
    GROUP BY GROUPING SETS (
        (week),
        (industry),
        (week, industry)
    )
)

SELECT *
FROM groups
WHERE week IS NOT NULL
AND industry IS NOT NULL
```

| week | industry | loss_ratio |
| :--- | :--: | :--- |
| 2021-01-01 | 🏥 | 0.80 |
| 2021-01-01 | 🏭 | 1.40 |
| 2021-01-08 | 🏥 | 0.77 |
| 2021-01-08 | 🏭 | 1.50 |

This works just fine. It drastically simplifies the query that would have to be written in dashboard. Indeed, there's no need to write a `GROUP BY` statement.

If there's a lot of dimensions, writing many `WHERE ... IS NOT NULL` can get a bit boring. A colleague at Alan found a nice trick to make this easier. The idea is to build a string that indicates which dimensions participate in a group. It's possible to do this in Snowflake by using [`GROUPING_ID`](https://docs.snowflake.com/en/sql-reference/functions/grouping_id.html).

```sql
groups AS (
    SELECT
        week,
        industry,
        ARRAY_TO_STRING(
            ARRAY_CONSTRUCT_COMPACT(
                IFF(GROUPING_ID(week) = 0, 'week', NULL),
                IFF(GROUPING_ID(industry) = 0, 'industry', NULL)
            ),
            ' x '
        ) AS group_by,
        SUM(claims) / SUM(premiums) AS loss_ratio
    FROM accounts
    WHERE country = '🇫🇷'
    GROUP BY GROUPING SETS (
        (week),
        (industry),
        (week, industry)
    )
)

SELECT *
FROM groups
```

| week | industry | group\_by | loss\_ratio |
| :--- | :--- | :--- | :--- |
| 2021-01-01 | 🏥 | week x industry | 0.80 |
| 2021-01-01 | 🏭 | week x industry | 1.40 |
| 2021-01-08 | 🏥 | week x industry | 0.77 |
| 2021-01-08 | 🏭 | week x industry | 1.50 |
| 2021-01-01 | NULL | week | 1.00 |
| 2021-01-08 | NULL | week | 0.97 |
| NULL | 🏥 | industry | 0.79 |
| NULL | 🏭 | industry | 1.44 |

This is nice, because now we can access a particular group as so:

```sql
-- Before
SELECT *
FROM groups
WHERE week IS NOT NULL
AND industry IS NOT NULL

-- After
SELECT *
FROM groups
WHERE group_by = 'week x industry'
```

| week | industry | loss_ratio |
| :--- | :--: | :--- |
| 2021-01-01 | 🏥 | 0.80 |
| 2021-01-01 | 🏭 | 1.40 |
| 2021-01-08 | 🏥 | 0.77 |
| 2021-01-08 | 🏭 | 1.50 |

That's as simple as a query can get. It's just a very readable `SELECT FROM WHERE`. This is great for us, as it minimizes the amount of SQL we put in Metabase. It also speeds up our dashboards because the heavy-lifting has already been done.
## Shortcuts: `CUBE` and `ROLLUP`

Writing down a `GROUPING SETS` operator can be a bit tedious. It's also slightly error-prone if you're juggling with a lot of dimensions. Thankfully, in Snowflake there are a couple of operators to ease this process.

You can use [`CUBE`](https://docs.snowflake.com/en/sql-reference/constructs/group-by-cube.html) when you want to group on all the combinations of dimensions. It's a good default mode when you're not sure what dimensions are going to be used in the dashboard. By the way, I really think that this notion of having prepared data that does not know how it's going to be used is a powerful idea. It's yet another instance of [data independence](https://www.wikiwand.com/en/Data_independence).

```sql
GROUP BY CUBE (week, country, industry)

-- is short for

GROUP BY GROUPING SETS (
    (week),
    (country),
    (industry),
    (week, country),
    (week, industry),
    (country, industry),
    (week, country, industry)
)
```

You can also the [`ROLLUP`](https://docs.snowflake.com/en/sql-reference/constructs/group-by-rollup.html) operator if you want to do a `GROUPING SETS` which drills down over dimensions. It's useful when your dimensions have a hierarchy.

```sql
GROUP BY ROLLUP (week, country, industry)

-- is short for

GROUP BY GROUPING SETS (
    (week),
    (week, country),
    (week, country, industry)
)
```

## Conclusion

I hope you found this post useful! Taking a step back, it does feel that this is reinventing the wheel somehow. Writing SQL to connect a data warehouse to a dashboard may seem awkward. But sometimes you're limited by your tools, and you don't have access to an expensive no-code interface to do all this for you.

Note that I've been using Snowflake as an example because that's we use at work. But this is also available in [PostgreSQL](https://www.postgresql.org/docs/10/queries-table-expressions.html#QUERIES-GROUPING-SETS), as well as in [MySQL](https://mysqlserverteam.com/mysql-8-0-grouping-function/), but sadly not in SQLite 😢
