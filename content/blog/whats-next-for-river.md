+++
date = "2026-07-20"
title = "What's next for River (and myself)"
toc = true
math = true
tags = ['online-machine-learning']
+++

## The last few years

Although my PhD had nothing to do with online machine learning, that's when I started to take an interest in it. I made a Python package called [creme](https://github.com/MaxHalford/creme) in 2019. We joined forces with [scikit-multiflow](https://scikit-multiflow.github.io/) in 2020 and agreed on the name [River](https://github.com/online-ml/river).

For some reason, I had this romantic vision of people working together in roughly equal proportions. However, I feel I did most of the core maintenance and decision-making, with others contributing in their areas of expertise and interest:

| Contributor | Commits |
  | - | -: |
  | Max Halford | 995 (59.3%) |
  | Saulo Mastelini | 224 (13.3%) |
  | Jacob Montiel | 64 (3.8%) |
  | Geoffrey Bolmier | 39 (2.3%) |
  | Raphael Sourty | 37 (2.2%) |
  | Émile | 34 (2.0%) |
  | Etienne Kintzler | 30 (1.8%) |
  | Hoang-Anh Ngo | 30 (1.8%) |
  | Cedric Kulbach | 22 (1.3%) |
  | Alexey C | 18 (1.1%) |
  | Others | 186 (11.1%) |
  | **Total** | **1,679** |

I am grateful to see people wanting to contribute to River. It's heartwarming and one of the reasons why I still consider River a hobby. But the truth is that, like most open-source projects, River lives and grows as a function of the availability and energy of its main contributor.

In 2022 I joined an early-stage startup, and then I became a dad in the fall of 2023. Both events naturally took priority over tinkering on River. To be honest, the project has been more or less in maintenance mode since my daughter was born. People kept contributing and downloads increased, but I simply didn't put in the time the project deserved.

I want to point out that **this is fine**. Maintaining an open-source project can be a source of guilt. But it shouldn't. An open-source project is like a cactus: it appreciates every drop of water you give it and can survive without you. It's *normal* for you to prioritize the many delicate flowers around you that need (daily) attention.

Coding agents came into our world right when I was getting used to this status quo. For all their flaws and consequences, they have allowed me to find more hours in the day to do the things I want. For one thing, I've been more efficient at work. I had a somewhat operational job, so coding agents had a rather positive impact on my workload.

More time away from the keyboard has meant more headspace for my loved ones -- workdays that actually end on time, yay! -- but also more time to think/ponder/contemplate.

## Newfound time and motivation

I recently left Carbonfact for positive reasons. It had been about 4.5 years, and I felt I'd done what I was meant to do there. Without going into the details of why, what I can say is that I wasn't as motivated as I used to be, and it would have been unfair to everyone if I had stayed merely out of comfort.

I am not certain with whom I'll work in a year's time. Because of where I live, I have to work fully remote, which limits my options. What I do know is that I will be freelancing for the foreseeable future. In fact, <a class="rainbow-link" href="/freelance/"> I'm up for hire</a>!

Open-source is still in the cards for me, I'm sure of that. For me it's always been about building stuff for others, and I see coding agents as an enabler in that sense. Sure, writing most code manually is now less relevant, but that part wasn't key for me. There are still many problems to ponder, systems to be built, and people to be helped.

I have newfound motivation to work on River in particular. I still believe online machine learning is relevant -- and somewhat underappreciated. There are several research directions I want to pursue, and many things to implement. Furthermore, I want to put energy into educating people about where and how online machine learning applies.

## River roadmap 12 months ahead

River is not as widely used as "serious" machine learning packages like scikit-learn and PyTorch, which means we don't have to chastise ourselves for not publishing and following a rigid roadmap. But I believe it's beneficial to give users and contributors a rough idea of our direction without detailing all the stops and turns.

Something I want to insist on is working on stuff that people need. As obvious as that might be, River development has mostly been driven by contributor interest and area of expertise. For instance we've put a lot of effort into regression/classification models, when in fact people seem to use River for other tasks like anomaly detection, clustering, and drift detection. I know this because we have page visit statistics for our documentation website.

Before I/we keep building, I want us to write down a set of rules for using coding agents. [Several](https://github.com/melissawm/open-source-ai-contribution-policies) open source projects have put this in place. This is paramount, because having no rules at all is the quickest way to alienate contributors -- and potentially affect the project's quality. There's an [ongoing discussion](https://github.com/online-ml/river/pull/1937), and I'm confident we're reaching a consensus that keeps the project's human touch, while improving our delivery speed/quality.

### Live benchmarks platform

Online machine learning is about running models on streaming data. I therefore find it appropriate to set up an endless benchmark of sorts. The idea is to find public sources of streaming data, turn them into learning environments, and make models compete with each other. There are several reasons why this motivates me.

First of all, online machine learning will only be considered if it holds up its promise to beat batch models. Comparing online against batch models on fixed datasets is one thing, but it's more convincing to make the comparison on a live stream of data. More broadly, I think online machine learning would be more appealing if there were a Kaggle-like live benchmark people could freely take part in. Peter Cotton's [Microprediction](https://microprediction.github.io/microprediction/) project comes to mind here.

Second, real use cases are educational. River is just a collection of online algorithms, and doesn't tell you how to deploy them. I initiated [a](https://github.com/online-ml/chantilly) [couple](https://github.com/online-ml/beaver) MLOps packages specific to online machine learning, but they didn't pick up. People don't have the problem of deploying/managing online models, because they're not inclined to in the first place. My current understanding is that I should provide realistic examples, instead of shipping generic frameworks that people don't need.

Collecting realistic data also enables gauging models with higher confidence. As of now, when we implement a new estimator, we test it against one of the example datasets that comes with the River package. This is not good science, as per [Goodhart's law](https://en.wikipedia.org/wiki/Goodhart%27s_law). Continuously evaluating our roster of models with fresh data is a far more honest approach. Crucially, we don't need to wait a week to evaluate a model. Historical data can be stored and rewound for evaluation using [progressive validation](/blog/online-learning-evaluation/).

More concretely, here's a rough architecture:

- A module to collect samples $x_i$ and associate outcomes $y_i$ when they arrive. I've found a great first use case, which is detecting undesirable Wikipedia edits. There's a [RecentChanges API endpoint](https://www.mediawiki.org/wiki/API:RecentChanges) that surfaces recent activity on Wikipedia pages. They have a machine learning project called [Lift Wing](https://wikitech.wikimedia.org/wiki/Machine_Learning/LiftWing), which amongst other things classifies suspicious edits -- these predictions are also available through an API. Apparently the current model is an XGBoost instance, which I'm motivated to beat with an online model.
- Another module that retrieves model predictions, stores them, compares them to the ground truth as it becomes available, and updates the models. Ideally, the system should support batch models too, by retraining them from scratch periodically.
- An endpoint to run a model against past data to evaluate it. This could be triggered automatically, and a report could be made when an estimator is modified/added in a pull request to River.
- A leaderboard to gamify the project a bit and make it enticing.
- If many models are running together, you want some kind of meta-model that decides which is the current best model. Indeed in production you need to pick one model -- or blend many -- to make your decision. For instance this could be a bandit or a stacking method.
- It makes sense and is simpler to begin with classification/regression, but eventually I would like this system to support drift detection, anomaly detection, clustering, and (contextual) bandits.

### Drift detection

River's `drift` module comes from scikit-multiflow. To be perfectly honest, I never really put my nose into it. I am aware that drift detection is applicable to many use cases, like detecting a significant change in CPU temperature, or a change of rhythm in EEG activity. But for some reason I haven't yet given the topic the treatment it deserves.

Like many other modules, there is a need to guide users when it comes to using the `drift` module. How to select a method? What if different methods detect different drift points? Drift detection methods are unsupervised, so if we also have some manual annotations? I'm sure there are a lot of gray areas we could give some color to.

I can't even tell you which methods we plan to work on, because first I need to give the field a thorough review. Thankfully the people who worked on this topic knew what they were doing, so the existing implementations in River lay a solid foundation.

### Anomaly detection

Anomaly detection is similar to drift detection, in that it makes sense to apply it online on (fast) data streams. Anomalies typically tend to evolve in their definition in time. For instance, I've met with people in cybersecurity who use River to detect malicious traffic in HTTP logs. The behavior patterns apparently evolve so quickly that it is infeasible to retrain batch anomaly detection models in time.

[Half-space trees](https://riverml.xyz/dev/api/anomaly/HalfSpaceTrees/) stand out to me as a strong overall anomaly detector. They work well out of the box, as there aren't too many parameters to tune -- tuning parameters online is a hard topic. I would like to double down on the implementation and add bells and whistles to make it even more practical. For instance, the base algorithm samples features uniformly at random when making random splits, although it could prioritize whose features yielded interesting splits in past trees.

As I present below in the Rust section, I think anomaly detection is one of those topics where you want fast models that can process >100k rows/second, which as of now isn't a speed River is capable of reaching. There is a lot of room for optimization. River's tree methods are all implemented through the intuitive yet slow parent/child pointer approach. It is well known that an array based implementation is much faster. See for instance the AMF implementation in [onelearn](https://github.com/onelearn/onelearn).

### Clustering

Clustering is also a use case where users reach out for River because they have streaming data.

Here I would say our implementations have been rather academic. Many came from scikit-multiflow, and are textbook implementations of popular clustering research papers. Which is not to say they're bad, but they were not necessarily rigorously tested on real-world use cases.

I'm confident there are several public data streams where we could demonstrate, evaluate, and improve River's `cluster` package. A fun use case someone already brought to the table is clustering messages from Twitch chats and Twitter feeds. It is rather cool to see clustering bubbles inflate and deflate in real-time.

Like the other modules I aim to prioritize, our approach should be to observe the models on real data, and iterate on the models accordingly. It's a bit like Kaggle competitions, where the theory only gets you so far, and it's the tricks of the trade you pick up along the way that make all the difference.

### `auto` module

Like many, I've been inspired by Karpathy's [autoresearch](https://github.com/karpathy/autoresearch) project. The idea is simple yet only possible because of coding agents' ability to [hill climb](https://en.wikipedia.org/wiki/Hill_climbing) code. I see ways in which this can be relevant for online learning.

The way I see it, this new `auto` module should provide:

- A way to generate candidate models in the background, while the model is running.
- A mechanism for inserting new candidates in a pool of existing candidates, and running them side-by-side.
- An algorithm for comparing model performance, and replacing the existing leader with a better candidate.
- Potentially, the ability to warm up a model on recent data so it can compete with existing models from the get-go.
- A method for evaluating feature importance, so the agent can add/edit/discard features without completely improvising.

What I like about this new potential module is that it lowers the barrier of entry for applying online machine learning. Although River is straightforward for getting started, maxxing performance isn't obvious because of the many possible modelling approaches. Delegating the exploration to an agent in a controlled setting sounds appealing on paper.

### Rust package

Speaking of Rust, we've [ported](https://github.com/online-ml/river/issues/1797) River's C++ and Cython extensions to Rust. We did this to simplify the development toolchain. We also reaped better performance, due to better implementations -- I have no shame in saying Claude writes faster low-level code than I!

Thanks to coding agents, we can afford to move more Python code to Rust. I'm not a fan of migrating entire codebases from one language to another -- thinking of Bun's recent Zig to Rust [hullabaloo](https://news.ycombinator.com/item?id=48843352). I do however see the benefits of moving the most popular methods to a faster language.

At this point you may wonder why River is written in Python at all. Well, it started that way out of convenience, and also because Python is a common language for implementing systems that require machine learning. This is only true because batch machine learning Python packages are shims on top of faster languages. There is actually less benefit implementing online algorithms in, say, Rust and calling them in Python. For some bottlenecks it's worth it, but usually the overhead of calling one language from the other is not worth it. That's because in online learning each learning step operates on a single sample -- except for mini-batch learning, but that's a special case.

There are however use cases where running Python code isn't an option. Take a project like [Grafana](https://grafana.com/blog/identify-anomalies-outlier-detection-forecasting-how-grafana-cloud-uses-ai-ml-to-make-observability-easier/), which has a backend written in Go. In addition to visualizing time series, it provides ancillary features like time series anomaly detection. It would be impractical for Grafana's backend to make calls to a River service written in Python. It could make sense to call River's Rust implementation with something like [CFFI](https://github.com/mediremi/rust-plus-golang).

Streaming compute systems like Flink, Materialize, RedPanda, are naturally all written in low-level languages. I may be foolish, but I'm supposing that if River's Rust package were exposed as a first-class citizen, there may be opportunities for it to be used in some of these systems. Right now the Rust code is a bit hidden and barely documented.

Last but not least, fast and accessible Rust implementations would also allow River to be compared against Vowpal Wabbit and scikit-learn's `partial_fit` methods. The latter cater to a special case of online learning, which is to train on a fixed dataset. In this setting the model is allowed to do multiple passes over the data. The models learn online in the sense that the samples are processed one at a time, but the goal isn't for the models to learn on-the-fly when deployed in production. Although this isn't what River initially caters to, its estimators can be trained in such a fashion. The problem is simply that running this loop in Python incurs an impractical amount of overhead. Running the loop in Rust -- e.g. through a CLI like VW does it -- would unlock new use cases.

## Get in touch!

I'm excited as ever to maintain and develop River. If you're an aspiring contributor, or working at a company where you'd like to apply online machine learning, or a curious researcher, please do feel welcome to reach out. We have a [Discord server](https://discord.gg/qNmrKEZMAn), or you can open a [GitHub discussion](https://github.com/online-ml/river/discussions/new/choose). Feel free to also reach out to me [directly](mailto:maxhalford25@gmail.com).
