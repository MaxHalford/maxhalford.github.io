+++
date = "2020-09-13"
title = "Thoughts on fair recommender systems"
draft = true
+++

## Motivation

Fairness matters:

- Different contexts: TikTok (fun) vs ManoMano (serious)
- [The Social Dilemna](https://www.imdb.com/title/tt11464826/) (maybe not so relevant but got me thinking)
- Fairness can be with respect to:
  - Users: get a representative set of recommendations, with respect to the item distribution
  - Items: be recommended in a fair manner

In TikTok, variety seems to the killer ingredient:

- https://news.ycombinator.com/item?id=24431975
- https://www.eugenewei.com/blog/2020/8/3/tiktok-and-the-sorting-hat

## Sources

- [Michael Ekstrand](https://md.ekstrandom.net/research/fair-recsys)
- [Dimitris Sacharidis](http://www.ec.tuwien.ac.at/~dimitris/research/recsys-fairness.html)

## Methods

- [A Fairness-aware Hybrid Recommender System](https://arxiv.org/pdf/1809.09030.pdf)
- [Fairness in Learning: Classic and Contextual Bandits](https://arxiv.org/abs/1605.07139)

## Requirements for a new recsys library

- Online
- Differential privacy
- Fair
- Always explain "why" a prediction is made
- Benchmarking
