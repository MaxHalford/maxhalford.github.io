+++
date = "2022-12-06"
title = "The future of River"
toc = true
draft = true
+++

<div align="center">{{< tweet 1585280138924564481 >}}</div>
<br>

When I see tweets like this one, I'm both happy because people are aware of River, but also irked because it's really difficult to make production-grade open source software.

We just had a developper meeting yesterday. We planned what we work on during the first half of 2023. I thought it would be worthwhile to give a high-level view of how we envision River's future. If not to be comprehensive, at least to reassure potential users that River is alive and kicking 🤺

## Mostly business as usual

I started working on River during my PhD. At the time, the goal was to implement online machine learning algorithms that only existed in papers and blog posts. I also wanted to provide a coherent interface, similar to what scikit-learn did for batch machine learning.

My belief is that River, Vowpal Wabbit, and scikit-learn's `partial_fit` methods are at the front of the pack. Anyone wanting to do online machine learning is better off nowadays than they were a few years ago. I'm proud of what we've built, and more importantly the nice little community we've [gathered](/content/blog/first-river-meetup.md). Definitely a lot of positive vibes 💫

And yet, I have to admit, sometimes I question whether what we're doing with River is useful. Although I'm quite involved in machine learning, my personal belief is that it doesn't necessarily have a significant positive impact on society. I'd like to be convinced otherwise, but until now I haven't. Which doesn't mean I work on River half-heartidly: I enjoy the technical challenge, and it makes me feel good that people find it user-friendly. But anyway, I've solved this conundrum in my life by working four days a week for a company cutting carbon emissions, while spending the rest of my time working on side-projects like River. I've found my balance 🧘🏼‍♂️

Putting aside this "is ML useful?" question, I also sometimes have doubts as to whether River is useful as a machine learning toolbox. In the roughly four years River has existed, I've seen dozens of companies use it, and even more individuals/students. But it's mostly been proof-of-concepts. Apart from a few exceptions, I haven't heard of a company using River at a significant scale. Quoting a recent [blog post](https://fennel.ai/blog/challenges-of-building-realtime-ml-pipelines/) from Fennel:

> For most companies, the costs of maintaining this type of system outweigh the benefits it provides; if you even need to question whether you need online model training, you probably don’t.

I'm a pragmatic person. When I have to build a model at my day-job, I usually pick scikit-learn because batch learning is no-fuss. That's the thing about online ML: it only makes sense for a small subset of problems. Therefore, as an online ML library developer, it's easy to wonder whether what I'm doing is a good use of my time.

I was pretty moved recently after watching [Jiro Dreams of Sushi](https://www.imdb.com/title/tt1772925/). It's a story about a guy who spends all his life making sushi. He's a *shokunin*: he hones his craft and seeks perfection, without worrying about what others are doing. He's passionate, has a strong ethos, and believes in what he's doing. The result is that he makes people happy and good things happen to him. He doesn't feed thousands of people a day, but he does his part. I can't compare myself to Jiro, but I like to think what online ML is to batch ML what refined sushi is to fast food.

Anyway, all this to say I'm well aware that online ML is not as high-impact as regular ML. But who knows what the future is made of? Streaming analytics is definitely picking up, so there's a good chance online ML will too. In the meantime, we'll keep working on River and writing good code that people enjoy using. I also want to do everything I can to help people get acquainted with online ML. Contrary to batch ML, there's a lack of tools and resources to get started.

TLDR: business as usual. We're simply going to explore ways to make online machine learning more user-friendly.

## Streaming MLOps

## Exotic tasks

## Performance

Separate library for performance (speed + accuracy). A bit like LightGBM vs. scikit-learn

<div align="center">{{< tweet 1593227472392200193 >}}</div>
