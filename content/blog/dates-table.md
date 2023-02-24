+++
date = "2023-04-19"
title = "You should have a dates table"
tags = ['data-eng', 'sql']
+++

I work at a company measuring the environmental footprint of clothing items. Like many modern startups, my company is quite data driven. We have internal metrics to track our operational performance. We also build dashboards for our customers. A large part of our business boils down to data integration, and so we run anomaly detection jobs. All the heavy lifting is done in SQL, with a internal tool that looks like dbt.

Like many analytics workloads, I often find myself working with dates. I recently found a nice pattern, which is to create a `dates` table:

```sql
SELECT *
FROM core.dates
ORDER BY date DESC
LIMIT 5
```

| date | week | is_this_week | is_last_week |
| :--- | :--- | :--- | :--- |
| 2023-02-21 | 2023-02-26 | true | false |
| 2023-02-20 | 2023-02-26 | true | false |
| 2023-02-19 | 2023-02-26 | true | false |
| 2023-02-18 | 2023-02-19 | false | true |
| 2023-02-17 | 2023-02-19 | false | true |

Right now, this table is really basic. But it allows me to write very readable queries. For instance, here is a query to find products that are not complete, and have at least one purchase order issued last week. It's using BigQuery syntax.

```sql
SELECT
    DISTINCT
    p.product_id,
    p.is_complete
FROM products p
LEFT JOIN purchase_orders po USING (product_id)
LEFT JOIN dates d ON po.issued_at = d.date
WHERE d.is_last_week
```

I find this more readable than inlining the "is it the last week" logic in the `WHERE`. Precomputing this information and putting it into a table feels elegant to me. Also, my thinking is that this `dates` table could hold other information, such as dates of major changes at my company.

By the way, here is the BigQuery SQL I wrote to generate my `dates` table:

```sql
SELECT
    *,
    DENSE_RANK() OVER (ORDER BY week DESC) = 1 AS is_this_week ,
    DENSE_RANK() OVER (ORDER BY week DESC) = 2 AS is_last_week
FROM (
    SELECT
        date,
        DATE_ADD(DATE_TRUNC(date, WEEK(SUNDAY)), INTERVAL 7 DAY) AS week
    FROM UNNEST(GENERATE_DATE_ARRAY(
        DATE(2021, 6, 1),  -- date my company opened for business
        CURRENT_DATE()
    )) AS date
)
```

What's yours?
