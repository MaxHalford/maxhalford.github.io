def period($day):
  if $day >= $period1_start and $day < $period1_end then
    {
      week_start: $period1_start,
      week_end_exclusive: $period1_end,
      period_status: "complete",
      observed_through: "2026-09-06",
      coverage_days: 7
    }
  elif $day >= $period2_start and $day < $period2_cutoff then
    {
      week_start: $period2_start,
      week_end_exclusive: $period2_end,
      period_status: "week_to_date",
      observed_through: "2026-09-08",
      coverage_days: 2
    }
  else
    empty
  end;

def pricing($model; $long_context):
  if $model == "gpt-5.6-sol" then
    if $long_context then
      {input: 0.000010, cached: 0.0000010, output: 0.000045}
    else
      {input: 0.000005, cached: 0.0000005, output: 0.000030}
    end
  elif $model == "gpt-5.6-terra" then
    if $long_context then
      {input: 0.000004, cached: 0.0000004, output: 0.000018}
    else
      {input: 0.000002, cached: 0.0000002, output: 0.000012}
    end
  elif $model == "gpt-6-astra" then
    if $long_context then
      {input: 0.000020, cached: 0.0000020, output: 0.000075}
    else
      {input: 0.000010, cached: 0.0000010, output: 0.000050}
    end
  else
    null
  end;

[
  .files[].codexRows[]?
  | . as $usage
  | period($usage.day) as $period
  | ($usage.input > 272000) as $long_context
  | pricing($usage.model; $long_context) as $prices
  | select($prices != null)
  | ([
      {
        token_type: "input_uncached",
        tokens: ([($usage.input - $usage.cached), 0] | max),
        rate: $prices.input
      },
      {
        token_type: "input_cached",
        tokens: $usage.cached,
        rate: $prices.cached
      },
      {
        token_type: "output",
        tokens: $usage.output,
        rate: $prices.output
      }
    ][]
    | $period + {
        source: "codexbar_local_logs",
        model: $usage.model,
        token_type: .token_type,
        model_request: 1,
        long_context_request: (if $long_context then 1 else 0 end),
        tokens: .tokens,
        cost_usd: (.tokens * .rate)
      })
]
| sort_by(.week_start, .model, .token_type)
| group_by(.week_start, .model, .token_type)
| map(
    . as $rows
    | $rows[0] as $first
    | {
        week_start: $first.week_start,
        week_end_exclusive: $first.week_end_exclusive,
        period_status: $first.period_status,
        observed_through: $first.observed_through,
        coverage_days: $first.coverage_days,
        source: $first.source,
        model: $first.model,
        token_type: $first.token_type,
        model_requests: ([$rows[].model_request] | add),
        long_context_requests: ([$rows[].long_context_request] | add),
        tokens: ([$rows[].tokens] | add),
        cost_usd: ([$rows[].cost_usd] | add)
      }
    | .tokens_per_request = (.tokens / .model_requests)
    | .effective_usd_per_million_tokens =
        (if .tokens == 0 then null else (.cost_usd / .tokens * 1000000) end)
  )
