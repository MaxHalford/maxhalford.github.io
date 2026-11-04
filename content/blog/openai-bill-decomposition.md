+++
date = "2026-11-02"
title = "The good way to report OpenAI API costs"
tags = ['data-science', 'decomposition']
draft = true
+++

Are coding agent providers heavily subsidizing tokens? Will open-source models be the norm? Are today's usage patterns completely unrealistic? Time will tell. What is certain is that controlling and optimizing AI usage costs is going to be a [big deal](https://www.youtube.com/watch?v=0zw-Uk9KJiA). It will likely become a dedicated FinOps function, and there will be consultants payed to keep a lid on things. Every company is going to need observability on their AI spending.

I think API bills are the perfect usecase for the [metric decomposition](/blog/metric-tree-total-derivative) method I wrote about last year. The idea being that measuring your monthly spending is not enough: ideally you want to understand why it went up or down. Tools such as [ccusage](https://ccusage.com/) already provide breakdowns, but in my opinion they can do better at explaining change. Other projects like [whoburnedmore](https://whoburnedmore.com/) seem to focus on vanity metrics, which can allow catching anomalies, but aren't FinOps tools per se.

When you're reporting on a metric, a useful thing to do is explain why it changed with respect to each of its drivers.

First things first: we need data.

OpenAI provides two complementary organization-level reporting surfaces, both accessed with an Admin API key. The [`/v1/organization/costs`](https://developers.openai.com/api/reference/python/resources/admin/subresources/organization/subresources/usage/methods/costs) endpoint is the accounting view: daily spend grouped by project, API key, and billing line item. The [`/v1/organization/usage/*`](https://developers.openai.com/api/reference/python/resources/admin/subresources/organization/subresources/usage) endpoints are the operational view: requests, tokens, images, audio seconds, storage, and tool calls, depending on the workload. For model inference, the completions endpoint includes request counts and input, cached-input, and output tokens, with dimensions such as model and project.

The two views are complementary rather than interchangeable: costs are the financial source of truth, while usage supplies the drivers needed to explain them. They only cover API organization activity—not ChatGPT or Codex subscription usage—and non-token charges such as images, storage, and hosted tools need their own units rather than the `requests × tokens/request × cost/token` identity.

It's worth mentioning tools like Tailscale's [Aperture](https://aperture.tailscale.com/), that act as a proxy in front of AI providers, and can therefore collect details which OpenAI's API won't provide you with, for your whole organization. I would probably set up such a tool if I were to deliver a somewhat serious cost breakdown dashboard.
