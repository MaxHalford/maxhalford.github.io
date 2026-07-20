+++
date = "2026-08-03"
title = "What's next for River (and myself)"
toc = true
tags = ['online-machine-learning']
+++

## The last few years

Although my PhD had nothing to do with online machine learning, that's when I started to take an interest in it. I made a Python package called creme in 2019. We joined forces with the scikit-multiflow team in 2020 and agreed on the name [River](https://github.com/online-ml/river).

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

I am not certain with whom I'll work in a year's time. Because of where I live, I have to work fully remote, which limits my options. What I do know is that I will be freelancing for the foreseeable future. In fact, you can <a class="rainbow-link" href="/freelance/"> hire me</a>!

Open-source is still in the cards for me, I'm sure of that. For me it's always been about building stuff for others, and I see coding agents as an enabler in that sense. Sure, writing most code manually is now less relevant, but that part wasn't key for me. There are still many problems to ponder, systems to be built, and people to be helped.

I have newfound motivation to work on River in particular. I still believe online machine learning is relevant -- and somewhat underappreciated. There are several research directions I want to pursue, and many things to implement. Furthermore, I want to put energy into educating people about where and how online machine learning applies.

## River roadmap 12 months ahead

River is not as widely used as "serious" machine learning packages like scikit-learn and PyTorch, which means we don't have to chastise ourselves for not publishing and following a rigid roadmap. But I believe it's beneficial to give users and contributors a rough idea of our direction without detailing all the stops and turns.

Something I want to insist on is working on stuff that people need. As obvious as that might, River development has mostly been driven by contributor interest and area of expertise. For instance we've put a lot of effort in regression/classification models, when in fact people seem to use River for other tasks like anomaly detection, clustering, and drift detection. I know this because we have page visit statistics for our documentation website.

Before I/we keep building, I want us to write down a set rules for using coding agents. [Several](https://github.com/melissawm/open-source-ai-contribution-policies) open source projects are doing this. This is paramount, because having no rules at all is the quickest way to alienate contributors -- and potentially deteriorate the project's quality. There's an [ongoing discussion](https://github.com/online-ml/river/pull/1937), and I'm confident we're reaching a concensus that keeps the project's human touch, while improving our delivery speed/quality.

### Live benchmarks

### Drift detection

River's `drift` module comes from scikit-multiflow. To be perfectly honest,

- Better docs
- Benchmarks
- More methods


### Anomaly detection

- Fast implementation of half space trees
        - tree
            - dealing with dynamical trees; one pass clean up could be a solution
            - categorical splits: how do that in an array-based implementation?
            - ensure missing data is handled in a standardized fashion
    - Go to use case for observability?

### Clustering

- Better docs, real use case
- https://github.com/Rocketgraph/rocketgraph
- Twitch for clustering?


### `auto` module

- Start with binary classification

### Mini-batching

- Hot loop in Rust
- Get on-par with sklearn’s SGDClassifier and vowpal wabbit
- Narwhals
  - https://github.com/lightgbm-org/LightGBM/releases#release-v4.7.0
- Train in rust, infer in python
- Modules
    - linear_model
    - facto
    - optim
    - reco?

### Rust package

- Make it a first class citizen
- Speed

### Documentation

    - Review introductory docs
        - When to use what, TLDR section
        - Docs for agents?
    - AI guidelines
    - CLAUDE.md
