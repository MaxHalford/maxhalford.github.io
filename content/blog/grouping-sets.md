+++
date = "2021-09-09"
title = "Dashboards and GROUPING SETS"
toc = true
draft = true
+++

## Motivation

At [Alan](https://alan.com/), we do almost all our data analysis in SQL. Our data warehouse used to be PostgreSQL, and have since switched to Snowflake for performance reasons. We load data into our warehouse with Airflow. This includes dumps of our production database, third-party data, and health data from other actors in the health ecosystem. This is raw data. We transform this into prepared data via an in-house tool that ressembles [dbt](https://www.getdbt.com/). You can read more about it [here](https://medium.com/alan/how-we-solve-the-problem-of-sharing-actionable-data-with-the-team-7e4afeff3cac).

Our data analysis is done on top of our prepared data. We use Metabase as our dashboarding tool. Recently, we've been having a lot of discussion around our setup. Metabase allows querying the data warehouse with SQL. This gives us the liberty to do whatever we want between the data warehouse and the visualisation. This sounds great... but it's not. Indeed, it's too permissive.

One of the issues we're facing is that we have a lot of business logic that is stored in Metabase, rather than being versioned in our analytics codebase. There is also business logic that is duplicated in many places across Metabase. Moreover, when we make a change to our prepared data, it's burdensome to propagate the changes into our dashboards.

Generally speaking, we wish to change our relationship with Metabase. We've agreed that the less SQL code is in Metabase, the better off we are. We're addressing this via various initiatives. One of them is to prepare data in such a way that it can be consumed in a dashboard with minimal effort. We recently discovered that Snowflake has a [`GROUPING SETS` operator](https://docs.snowflake.com/en/sql-reference/constructs/group-by-grouping-sets.html). This has unlocked quite a powerful pattern for us. Before delving into said pattern, let us start by dwelling on what this operator does.

## What `GROUPING SETS` does

Let's use a toy example to illustrate.

As a health insurance company, it is key for us is to keep track of our margin. We do this by comparing premiums, which is the money we receive from the people we cover, with claims, which are the healthcare expenses we reimburse. Assuming we've collected these figures at a company level, this might result in such a [tidy](https://cran.r-project.org/web/packages/tidyr/vignettes/tidy-data.html) dataset:

| week       | country | segment       | premiums | claims |
|------------|:-------:|---------------|---------:|-------:|
| 2021-01-01 |    🇫🇷   | Hospitality   | 10,000   | 8,000  |
| 2021-01-01 |    🇫🇷   | Manufacturing | 5,000    | 7,000  |
| 2021-01-08 |    🇫🇷   | Hospitality   | 11,000   | 8,500  |
| 2021-01-08 |    🇫🇷   | Manufacturing | 4,000    | 6,000  |
| 2021-01-01 |    🇪🇸   | Hospitality   | 2,000    | 1,800  |
| 2021-01-01 |    🇪🇸   | Manufacturing | 3,000    | 3,500  |

<details>
  <summary>Table definition in SQL</summary>

```sql
WITH accounts AS (
    SELECT week, country, industry, premiums, claims
    FROM VALUES
        ('2021-01-01', '🇫🇷', 'Hospitality', 10000, 8000),
        ('2021-01-01', '🇫🇷', 'Manufacturing', 5000, 7000),
        ('2021-01-08', '🇫🇷', 'Hospitality', 11000, 8500),
        ('2021-01-08', '🇫🇷', 'Manufacturing', 4000, 6000),
        ('2021-01-01', '🇪🇸', 'Hospitality', 2000, 1800),
        ('2021-01-01', '🇪🇸', 'Manufacturing', 3000, 3500)
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

We like to break this metric down across a few dimensions to get a better understanding. We might want to look at the evolution through time, the country the company is based in, as well as the type of industry it belongs to. But we're greedy, so we also want to look at combinations of these dimensions.

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
| :--- | :--- | :--- |
| 2021-01-01 | Hospitality | 0.800000 |
| 2021-01-01 | Manufacturing | 1.400000 |
| 2021-01-08 | Hospitality | 0.772727 |
| 2021-01-08 | Manufacturing | 1.500000 |
| 2021-01-01 | NULL | 1.000000 |
| 2021-01-08 | NULL | 0.966667 |
| NULL | Hospitality | 0.785714 |
| NULL | Manufacturing | 1.444444 |

This is in fact the concatenation of three smaller tables:

**(`week`, `industry`)**

| week | industry | loss_ratio |
| :--- | :--- | :--- |
| 2021-01-01 | Hospitality | 0.800000 |
| 2021-01-01 | Manufacturing | 1.400000 |
| 2021-01-08 | Hospitality | 0.772727 |
| 2021-01-08 | Manufacturing | 1.500000 |

**(`week`)**

| week | industry | loss_ratio |
| :--- | :--- | :--- |
| 2021-01-01 | NULL | 1.000000 |
| 2021-01-08 | NULL | 0.966667 |

**(`industry`)**

| week | industry | loss_ratio |
| :--- | :--- | :--- |
| NULL | Hospitality | 0.785714 |
| NULL | Manufacturing | 1.444444 |

In fact, you could very implement a `GROUPING SET` yourself by collating many `GROUP BY` query results together via some `UNION` operators. This is well illustrated [here](https://docs.microsoft.com/en-us/previous-versions/sql/sql-server-2008-r2/bb510427(v=sql.105)).

## A pattern for creating dashboards

## Shortcuts: `CUBE` and `ROLLUP`

Writing down a `GROUPING SETS` operator can be a bit tedious. It's also slightly error-prone if you're juggling with a lot of dimensions.

```sql
GROUP BY CUBE (week, country, segment)

-- is short for

GROUP BY GROUPING SETS (
    (week),
    (country),
    (segment),
    (week, country),
    (week, segment),
    (country, segment),
    (week, country, segment)
)
```

```sql
GROUP BY ROLLUP (week, country, segment)

-- is short for

GROUP BY GROUPING SETS (
    (week),
    (week, country),
    (week, country, segment)
)
```
