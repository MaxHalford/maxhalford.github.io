+++
date = "2021-12-19"
title = "Abrupt drifts in online learning, and how to handle them gracefully"
toc = true
draft = true
+++

## Concept drift

First of all, it's worth mentioning what is concept drift, and how it applied to online learning. [Chip Huyen](https://huyenchip.com/) summarised it rather well in a Twitter thread of hers:

{{< tweet 1313921889061015557 >}}

As Chip points out, there are two kinds of drifts:

1. **Data drift** — this is when the distribution of your features $X$ are changing.

There are some synthetic datasets in [River's `synth` module](https://riverml.xyz/latest/api/overview/#synth). The [`stream-learn` library](https://w4k2.github.io/stream-learn/) also has some stuff. There's also some non-stationary datasets [here](https://sites.google.com/site/nonstationaryarchive/). The latter are accompanied with some [visualisations](https://sites.google.com/site/nonstationaryarchive/home?authuser=0).

## Abrupt data drifts

> You also show the validation for the first 38,000 steps. In my code, the online model actually diverges after this (because the date shifts from holiday to not holiday ~ Jan 8), and ends up being much worse than the offline model. I wonder if you encountered similar behaviors in your experiment and what I've done wrong.

What Chip has encountered is called an abrupt data drift. What's happening is that one her features takes on a constant value, and all of a sudden switches to a new value. Presumably in this case of a boolean holiday

https://github.com/online-ml/river/issues/332

## Handling abrupt data drifts
