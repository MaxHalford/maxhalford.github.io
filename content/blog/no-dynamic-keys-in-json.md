+++
date = "2023-05-11"
title = "For analytics, don't use dynamic JSON keys"
tags = ['data-eng', 'sql']
+++

I love the JSON format. It's the kind of love that grows on you with time. Like others, I've been using JSON everywhere for so many years, to the point where I just take it for granted.

I suppose the main thing I like about JSON is its flexibility. You can structure your JSONs without too much care. There will always be a way to consume and manipulate it. But I have discovered a bit of anti-pattern, which I believe is worth raising awareness about. Especially when you're doing analytics.

<div align="center" >
<figure style="width: 90%; margin: 0;">
    <img style="box-shadow: none;" src="/img/blog/no-dynamic-keys-in-json/good-bad.png">
</figure>
</div>
</br>

We process a lot of JSONs where I work. To be specific, we load them in Google BigQuery, and manipulate them thanks to BigQuery's decent [JSON support](https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions). It's blazing fast, and allows us to process millions of JSONs every day.

An annoying thing is that BigQuery doesn't support specifying JSON access paths dynamically. For instance, take the following code:

```sql
WITH example AS (
    SELECT
        'foo' AS key,
        JSON '{"foo": "bar"}' AS payload
)

SELECT
    JSON_VALUE(payload, CONCAT('$.', key))
FROM example
```

```
Message: JSONPath must be a string literal or query parameter
```

I suspect this is for performance reasons. The least annoying solution I found was to replace the key with a dummy `__KEY__` token:

```sql
WITH example AS (
    SELECT
        'foo' AS key,
        JSON '{"foo": "bar"}' AS payload
)

SELECT
    JSON_VALUE(
        REGEXP_REPLACE(
            TO_JSON_STRING(payload),
            CONCAT('"', key, '"'),
            '"__KEY__"'
        ),
        '$.__KEY__'
    )
FROM example
```

In my experience, this isn't too detrimental in terms of performance. But it's hella hacky. Compare this to the cleaner code that ensues from not using dynamic keys:

```sql
WITH example AS (
    SELECT
        'foo' AS key,
        JSON '[{"key": "foo", "value": "bar"}]' AS payload
)

SELECT JSON_VALUE(part, '$.value') AS value
FROM example, UNNEST(JSON_EXTRACT_ARRAY(payload, '$')) AS part
WHERE JSON_VALUE(part, '$.key') = key
```

An interesting aspect is that if you're using typed languages such as [Go](https://go.dev/), you won't usually fall into this anti-pattern. That's because Go forces you to type your JSON keys and name them. That's not the case with dynamic languages like Python.

Anyway, I got bitten by this at work, and thought I should share.
