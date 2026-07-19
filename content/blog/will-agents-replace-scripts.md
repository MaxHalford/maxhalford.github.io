+++
date = "2026-07-02"
title = "Will agents replace scripts?"
tags = ['llm']
+++

I am in favor of coding agents. They're here to stay, so we might as well figure out enjoyable ways to work with them. I'm aligned with Charity Majors' [Make AI Boring Again](https://charitydotwtf.substack.com/p/make-ai-boring-again) piece. I'm also increasingly convinced they won't replace techies, because the non-techies still need us.

I stumbled on this Slack thread at work:

<div align="center" >
<figure style="width: 90%; margin: 0;">
    <img src="/img/blog/will-agents-replace-scripts/slack.png">
</figure>
</div>

At work, we log the hours we spend on each customer, and we report them weekly. It's tedious and error-prone. But it's useful: we want to know where time is going, what to improve, and how to price our services.

One of our non-engineers wants to streamline the process. We all use Claude at work, and the team has a good sense of what it can do. But when you've just discovered a hammer, everything looks nail-shaped.

Consider the task: pull events from someone's Google Calendar, sum up the hours for a given week, and post the tally to a Notion database. This is deterministic. There's no mystery to it; in fact it's quite mundane. We can write a Python script to do it, like I did for [counting meeting hours](/blog/google-calendar-scraping/).

If you ask a coding agent, there's a good chance it'll get the job done. But why would you do that? Why rely on a stochastic process for a repetitive, deterministic task? Could you live with the idea that it might be silently wrong? Several internal alarm bells went off when I read that Slack thread.

I think the answer is friction — or rather, the lack of it. Claude and OpenAI have pulled off a *tour de force*, which is to put programming in the hands of everyone. They've given more power to non-tech people. Indeed, setting up a new internal app at any company usually requires heavy lifting. Many people have ideas which never see the light of day, because the tech team is not staffed for it. But an environment where anyone can solve their own problems is empowering.

When you prompt an agent to run on a schedule, it feels like you're programming something deterministic in natural language. The beauty is that your admin has set up MCPs, so the agent can figure out how to connect to Google Calendar and Notion on its own. And you never have to fix a broken script, because you're not writing code. Again, it's very empowering on paper.

But this isn't the right pattern. Any decent software engineer will tell you so. The better approach is to vibecode a script, run it on a few weeks of real data, check the outputs make sense, and then schedule the script — not the agent — to run periodically. When the script breaks, the agent can fix it, and someone else should review the fix.

Moreover, having scripts running on a schedule outside of version control is a recipe for disaster. There is no accountability, no governance, no sharing, no observability. It reminds of BI tools like Metabase where everyone can write their own dashboards, but the Data team has no control over what's going on. But most people put up with it because they don't know any better.

Hopefully the better pattern wins out. But that only happens if the tools non-technical people use lead them to the [pit of success](https://blog.codinghorror.com/falling-into-the-pit-of-success/). In this case I hope Claude Cowork will let you schedule scripts, and not just agents. The pessimist in me tells me they won't, because their priority is to get us to burn tokens.

Anyhoo, I allowed myself to make a comment:

<div align="center" >
<figure style="width: 90%; margin: 0;">
    <img src="/img/blog/will-agents-replace-scripts/slack-2.png">
</figure>
</div>
