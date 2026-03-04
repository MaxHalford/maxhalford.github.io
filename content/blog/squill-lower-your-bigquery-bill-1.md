+++
date = "2026-04-04"
title = "Lower your BigQuery bill • Part 1"
tags = ['data-eng', 'bigquery']
draft = true
+++

BigQuery billing is a difficult topic.

https://biq.blue/

- https://biq.blue/form#step=2
- https://followrabbit.ai/bigquery-savings-calculator?pricing_model=on-demand&on_demand_cost=178383&autoscaler_cost=0&commitment_cost=0&logical_storage_cost=175881&physical_storage_cost=0
- https://biq.blue/
- https://docs.cloud.google.com/bigquery/docs/best-practices-performance-overview

## Billing analytics

First things first, you need to understand your billing. BigQuery provides an [interface](https://console.cloud.google.com/billing), but I don't like it.

```sql
WITH `jobs_cte` AS (
  SELECT
    *,
    ROW_NUMBER() OVER () AS job_id,
    EXTRACT(
      DATE
      FROM
        TIMESTAMP_TRUNC(_PARTITIONTIME, DAY)
    ) AS date
  FROM
    `billing-administration-389720.all_billing_data.gcp_billing_export_v1_01E9A2_2EB742_463579`
  WHERE
    service.description IN (
      'BigQuery',
      'BigQuery Storage API',
      'BigQuery Reservation API'
    )
    AND EXTRACT(
      DATE
      FROM
        TIMESTAMP_TRUNC(_PARTITIONTIME, DAY)
    ) >= DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY)
    AND project.id LIKE '%kaya%'
),
`jobs_with_labels_cte` AS (
  SELECT
    project.id AS project_id,
    service.description AS gcp_service,
    sku.description AS gcp_sku,
    date,
    job_id,
    KEY,
    value,
    cost AS cost_in_euros,
    usage.amount AS usage_in_seconds,
    usage_start_time,
    usage_end_time,
  FROM
    `jobs_cte`,
    UNNEST(labels) AS label
),
`jobs_transposed_cte` AS (
  SELECT
    *
  FROM
    `jobs_with_labels_cte` PIVOT(
      ANY_VALUE(value) FOR key IN (
        'cf_app',
        'cf_bq_dataset',
        'cf_bq_schema',
        'cf_bq_table',
        'cf_customer_account',
        'cf_environment',
        'cf_github_action',
        'cf_github_actor',
        'cf_github_run_id',
        'cf_github_workflow',
        'cf_github_event_name',
        'cf_lea_run_id',
        'cf_service',
        'cf_service_context',
        'cf_username',
        'table',
        'username',
        'year'
      )
    )
),
`bq_reservation_jobs_cte` AS (
  SELECT
    cf_github_workflow,
    cf_github_actor,
    cf_github_run_id,
    cf_github_actor = 'clemencevlp' AS is_daily_refresh,
    cf_github_event_name,
    -- for some reason GH associated this schedule with Clémence's username
    date,
    usage_start_time,
    usage_end_time,
    cf_bq_dataset,
    CONCAT(cf_bq_schema, '.', cf_bq_table) AS full_table,
    usage_in_seconds / 3600 AS usage_in_hours,
    usage_in_seconds / 3600 * 0.044 AS cost_in_euros,
    -- using standard EU pricing (/slots.h)
  FROM
    `jobs_transposed_cte` AS t1
  WHERE
    gcp_service = 'BigQuery'
    AND gcp_sku = 'Analysis Slots Attribution' -- looking at bills for jobs running in a reservation
    AND project_id = 'int-data-kaya-prod'
  ORDER BY
    usage_in_hours DESC
),
`bq_reservation_job_infos_cte` AS (
  SELECT
    cf_github_actor,
    cf_github_run_id,
    cf_github_event_name,
    date,
    is_daily_refresh,
    MAX(
      CASE
        WHEN full_table = 'core.carbonverses_history' THEN TRUE
        ELSE FALSE
      END
    ) AS refreshed_all_views,
    -- only full refreshes have a job running on this table
    COUNT(DISTINCT full_table) AS count_impacted_tables,
    SUM(usage_in_hours) AS usage_in_hours,
    SUM(cost_in_euros) AS cost_in_euros
  FROM
    `bq_reservation_jobs_cte` AS t1
  GROUP BY
    1,
    2,
    3,
    4,
    5
  ORDER BY
    date,
    cost_in_euros DESC
)
SELECT
  date,
  CASE
    WHEN is_daily_refresh THEN 'DAILY_REFRESH'
    WHEN refreshed_all_views THEN 'OTHER_ALL_VIEWS'
    ELSE 'OTHER'
  END AS refresh_type,
  cf_github_event_name,
  COUNT(DISTINCT cf_github_run_id) AS count_runs,
  AVG(count_impacted_tables) AS avg_count_impacted_tables,
  SUM(usage_in_hours) / COUNT(DISTINCT cf_github_run_id) AS avg_usage_in_hours_per_run,
  SUM(cost_in_euros) / COUNT(DISTINCT cf_github_run_id) AS avg_cost_in_euros_per_run,
  SUM(usage_in_hours) AS total_usage_in_hours,
  SUM(cost_in_euros) AS total_cost_in_euros,
FROM
  `bq_reservation_job_infos_cte` AS t1
WHERE
  cf_github_run_id IS NOT NULL
GROUP BY
  ALL
ORDER BY date DESC
```

## On-demand vs slot reservations

https://docs.cloud.google.com/bigquery/docs/slots?authuser=0#use_autoscaling_reservations


```sql
WITH data AS (
  SELECT
    project_id, total_bytes_processed, total_bytes_billed, total_slot_ms,
    (reservation_id IS NOT NULL) AS use_reservation,
    (bi_engine_statistics.acceleration_mode IS NOT NULL) AS use_bi_engine,
    referenced_tables
  FROM `int-data-kaya-dev`.`region-eu`.INFORMATION_SCHEMA.JOBS
  WHERE DATE(creation_time) > '2026-02-01'
    AND DATE(creation_time) < '2026-03-01'
    AND job_type = 'QUERY'
    AND state = 'DONE'
    AND error_result IS NULL
    AND (statement_type != "SCRIPT" OR statement_type IS NULL)
),
data2 AS (
  SELECT
    *,
    use_reservation=FALSE use_on_demand,
    (total_bytes_processed * 6.25 / 1024 / 1024 / 1024 / 1024) AS cost_on_demand,
    (total_bytes_billed * 6.25 / 1024 / 1024 / 1024 / 1024) AS cost_on_demand2,
    (total_slot_ms * 0.06/ 1000/ 60 / 60) AS cost_slot_reservations
  FROM data
),
tables AS (
  SELECT
    t1.project_id,
    t1.project_number,
    t1.table_schema AS dataset_id,
    t1.table_name AS table_id,
    t1.creation_time,
    t1.total_rows,
    t1.total_partitions,
    t1.total_logical_bytes,
    t1.active_logical_bytes,
    t1.long_term_logical_bytes,
    t1.total_physical_bytes,
    t1.active_physical_bytes,
    t1.long_term_physical_bytes,
    t1.time_travel_physical_bytes,
    t1.storage_last_modified_time,
    t1.deleted,
    t1.table_type,
    t3.ddl,
  FROM `int-data-kaya-dev`.`region-eu`.`INFORMATION_SCHEMA.TABLE_STORAGE` t1
  LEFT JOIN (
    SELECT
      table_catalog,
      table_schema,
      table_name,
      ddl,
    FROM `int-data-kaya-dev`.`region-eu`.`INFORMATION_SCHEMA.TABLES`
    GROUP BY 1,2,3,4
  ) t3 USING (table_catalog, table_schema, table_name)
),
dataset_billing AS (
  SELECT
    catalog_name AS project_id,
    schema_name  AS table_schema,
    MAX(IF(option_name = 'storage_billing_model', option_value, NULL)) AS storage_billing_model
  FROM `int-data-kaya-dev`.`region-eu`.INFORMATION_SCHEMA.SCHEMATA_OPTIONS
  GROUP BY 1,2
),
tables2 AS (
  WITH used AS (
    SELECT DISTINCT
      rt.project_id,
      rt.dataset_id,
      rt.table_id
    FROM data d, UNNEST(d.referenced_tables) AS rt
  )
  SELECT
    t.*,
    (
      DATE(t.creation_time) < DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH)
      AND DATE(t.storage_last_modified_time) < DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH)
    ) AS unused,
    (u.project_id IS NULL) AS not_referenced_last_month,
    CASE
      WHEN COALESCE(db.storage_billing_model, 'LOGICAL') = 'PHYSICAL'
        THEN 'physical'
      ELSE 'logical'
    END AS storage_billing_model,
  FROM tables t
  LEFT JOIN dataset_billing db
    ON db.project_id = t.project_id
   AND db.table_schema = t.dataset_id
  LEFT JOIN used u
    ON t.project_id = u.project_id
   AND t.dataset_id = u.dataset_id
   AND t.table_id = u.table_id
  WHERE
    deleted=FALSE
    AND t.dataset_id NOT LIKE "\\_script%"
    AND t.project_id = 'int-data-kaya-dev'
),
tables3 AS (
  SELECT
    *,
    ((active_logical_bytes/1024/1024/1024)*0.02) AS active_logical_cost, -- monthly
    ((long_term_logical_bytes/1024/1024/1024)*0.01) AS long_term_logical_cost, -- monthly
    ((active_physical_bytes/1024/1024/1024)*0.04) AS active_physical_cost, -- monthly
    ((long_term_physical_bytes/1024/1024/1024)*0.02) AS long_term_physical_cost, -- monthly
    ((time_travel_physical_bytes/1024/1024/1024)*0.04) AS time_travel_physical_cost, -- monthly
  FROM tables2
),
tables4 AS (
  SELECT *,
    IF (storage_billing_model="logical",
        active_logical_cost+long_term_logical_cost,
        active_physical_cost+long_term_physical_cost+time_travel_physical_cost) AS cost,
  FROM tables3
),

tables_agg AS (
  SELECT
    project_id,
    COUNTIF(unused = FALSE OR not_referenced_last_month = FALSE) AS nb_tables_used,
    COUNTIF(unused = TRUE AND not_referenced_last_month = TRUE)  AS nb_tables_unused,
    SUM(IF(unused = TRUE, cost, 0)) AS cost_storage_unused
  FROM tables4
  GROUP BY 1
)

SELECT
  d.project_id,
  SUM(d.total_bytes_processed) AS total_bytes_processed,
  SUM(d.total_bytes_billed) AS total_bytes_billed,
  SUM(d.total_slot_ms) AS total_slot_ms,
  COUNT(*) AS nb_jobs,
  SUM(IF(d.use_on_demand=TRUE, 1, 0)) > 0 AS use_on_demand,
  SUM(IF(d.use_reservation=TRUE, 1, 0)) > 0 AS use_slot_reservation,
  SUM(IF(d.use_bi_engine=TRUE, 1, 0)) > 0 AS use_bi_engine,
  SUM(d.cost_on_demand) AS cost_on_demand,
  SUM(d.cost_on_demand2) AS cost_on_demand2,
  SUM(d.cost_slot_reservations) AS cost_slot_reservations,
  SUM(LEAST(d.cost_on_demand, d.cost_slot_reservations)) AS cost_optimal,
  IFNULL(ta.nb_tables_used, 0) AS nb_tables_used,
  IFNULL(ta.nb_tables_unused, 0) AS nb_tables_unused,
  IFNULL(ta.cost_storage_unused, 0) AS cost_storage_unused
FROM data2 d
LEFT JOIN tables_agg ta USING (project_id)
GROUP BY
  d.project_id,
  ta.nb_tables_used,
  ta.nb_tables_unused,
  ta.cost_storage_unused
```

## Unused tables

## BI engine

## Uncompressed (logical) vs compressed (physical) storage
