+++
date = "2023-03-15"
title = "Metric correctness doesn't matter, consistency does"
tags = ['data-science']
+++

[According to](https://www.un.org/en/dayof8billion) the United Nations, the 15th of November [was the day](https://www.bbc.co.uk/newsround/63632981) we crossed 8 billion humans on the planet. How can they be so sure of that? Surely there has to be some margin of error, meaning it could have happened on the 14th or 16th. Then again, does it matter?

I would argue almost all metrics we look at are incorrect. For instance, I work at a company who's goal is to measure the carbon footprint of clothing items. I can tell you first hand our measurements are stock full of assumptions. In the sustainability world, it's not surprising to get reports like this one:

<div align="center">{{< tweet noahqk 1620150260877389824 >}}</div>
</br>

Depending on what assumptions you make, you will get different results if you do a [life cycle assessment](https://www.wikiwand.com/en/Life-cycle_assessment), which is the *de facto* method for assessing environmental impacts. Some people can go all day about how to measure the impact of packaging, even though it only represents a small portion of the footprint for most manufactured products.

When I worked in a health insurance startup, we had a dashboard telling us how many members we covered. There were a ton of rules needed to determine whether a member was "active" or not. We often nit-picked over obscure definitions. We edited the SQL from time to time, which changed the figures in the dashboard. This was usually followed by a Slack message from a manager asking for explanations.

Here's my opinion: **it doesn't really matter if your metric is correct. Most of the time, what you really care about is the evolution of your metric**. Naturally, a metric should be roughly correct, if not nobody would trust it. But [false precision](https://www.wikiwand.com/en/False_precision) doesn't matter.

Even if your carbon footprint methodology has gaps, knowing Shoe A emits 8kgCO2e while Shoe B emits 22kgCO2e is informative. The fact we grew from 1B to 8B humans in roughly 220 years is informative. It doesn't matter knowing exactly how many active subscriptions you have, what matters is how that number is evolving.

When looking at trends, it's crucial to make sure you're comparing apples to apples. For instance, if you're comparing the Earth population in 2022 to that of 1950, you should make sure both figures were produced using the same methodology. In the EU, there are discussions going on about using [PEFCR](https://ec.europa.eu/environment/eussd/smgp/PEFCR_OEFSR_en.htm) for measuring environment footprints. The less time we spend on the details of this standard, the more we can make sure everyone is using it. This will allow comparing goods with each other, using the same scale.

The famous aphorism [*All models are wrong, but some are useful*](https://www.wikiwand.com/en/All_models_are_wrong) applies here. Indeed, metrics are nothing more than simple models. We use them to describe the past, while also to forecast ahead. All metrics are wrong to some degree, but they're useful nonetheless, in particular when we look at their evolution.
