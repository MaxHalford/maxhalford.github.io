+++
date = "2023-12-01"
draft = false
title = "Efficient ELT refreshes"
tags = ['data-eng']
images = ["/img/blog/efficient-elt-refreshes/after.png"]
+++

A tenant of the modern data stack is the use of ELT (Extract, Load, Transform) over ETL (Extract, Transform, Load). In a nutshell, this means that most of the data transformation is done in the data warehouse. This has become the _de facto_ standard for modern data teams, and is epitomized by [dbt](https://www.getdbt.com/) and its ecosystem. It's a great time to be a data engineer!

We at [Carbonfact](https://www.carbonfact.com/) fully embrace the ELT paradigm. In fact, our whole platform is powered by BigQuery, which acts as our single source of truth. We have a main BigQuery dataset where we materialize several SQL views that power what our customers see.

Our SQL views are stored in a GitHub repository. We open a pull request when we want to add/remove/edit a view. We have some CI/CD in place that creates a bespoke dataset for each pull request, and materializes each SQL view to that dataset. We then run unit tests -- written in SQL -- against the dataset. We also run a diff against the production dataset to see what the impact would be in terms of rows/columns added/removed/changed per view. This is what our setup looks like:

<div align="center" >
<figure style="width: 50%;">
    <img src="/img/blog/efficient-elt-refreshes/before.png" style="box-shadow: none;">
</figure>
</div>

We have identified two problems with this setup:

1. It is not efficient. In a pull request, all the views are materialized, even if only one view is modified. This wastes time, money, and carbon.
2. When we do a diff between the pull request dataset and the production dataset, we are not guaranteed both datasets are using the same source data. This is because the pull request dataset is materialized at the time of the pull request, and the production dataset is periodically refreshed -- every 3 hours in our case.

This second problem is more subtle and merits some context. Let's say we have a view that counts events on our platform. We edit the view to filter out some undesired events. We commit our change and open a pull request. The pull request dataset is materialized, and the unit tests pass. We then compare the pull request dataset with the production dataset. We are surprised because we notice the number of events has actually increased.

This is because the diff is conflating two things: the events filtered out by the new logic, and the new events due to pull request dataset having access to more recent data. Here's a schematic of what's happening:

<div align="center" >
<figure style="width: 90%;">
    <img src="/img/blog/efficient-elt-refreshes/no-freeze.png" style="box-shadow: none;">
</figure>
</div>

At Carbonfact, we use PostHog to track events on our platform -- i.e. pageviews and clicks. PostHog exports its data in near real-time to a BigQuery table we've provided it with. In our analytics repository, we have an `events` view which consumes the data from the PostHog table. Therefore, the `events` table in the pull request can have a different number of rows than its counterpart in the main table. Indeed, because it depends on the PostHog table, its number of rows depends on the moment it was materialized.

When we edit a view, we're interested in understanding whether the new logic is correct or not, and if it breaks anything downstream. To do so, we must perform an apples to apples comparison in terms of source data. The solution we've found is to freeze the `events` table in the pull request dataset, as so:

<div align="center" >
<figure style="width: 90%;">
    <img src="/img/blog/efficient-elt-refreshes/with-freeze.png" style="box-shadow: none;">
</figure>
</div>

Even though the `metrics` view in the pull request is refreshed at a different moment, it can be compared to its equivalent in production dataset. Indeed, both are leveraging the same `events` table. This kills two birds with one stone:

1. We can do a meaningful comparison between the pull request dataset and the production dataset.
2. We are being efficient because we only have to materialize modified views and their dependencies, not the whole DAG.

How do we go about doing this in practice? What needs to happen is for the SQL queries in the pull request to target the correct table references. This necessitates a few pieces of logic:

- Identify the edited files from the git diff.
- For each edited view, target tables from the production dataset.
- For each dependency of the edited views, target the materialized table from the pull request.

I haven't found an easy way to do this with dbt. I found this [tip](https://discourse.getdbt.com/t/tips-and-tricks-about-working-with-dbt/287/2) from the dbt forums about how to feed edited views -- and optionally their dependencies -- to the `dbt run` command. There's also this [gist](https://gist.github.com/jtalmi/c6265c8a17120cfb150c97512cb68aa6) that does something similar. However, I haven't found a way to switch the target dataset dynamically.

I did stumble on dbt's [stateful selection](https://docs.getdbt.com/reference/node-selection/syntax#stateful-selection) and [defer](https://docs.getdbt.com/reference/node-selection/defer) documentation, but I don't find these concepts straightforward. Even the dbt docs [admit](https://docs.getdbt.com/reference/node-selection/methods#the-state-method) state selection is complicated. There's a comprehensive example [here](https://docs.getdbt.com/blog/slim-ci-cd-with-bitbucket-pipelines), and a detailed testimony [here](https://discourse.getdbt.com/t/how-we-sped-up-our-ci-runs-by-10x-using-slim-ci/2603) of so-called [Slim CI](https://docs.getdbt.com/best-practices/best-practice-workflows#run-only-modified-models-to-test-changes-slim-ci). But the dbt approach of storing/loading artifacts from a previous run feels cumbersome to me.

We've implemented a minimalist dbt-like tool at Carbonfact called [lea](https://github.com/carbonfact/lea). Many people have told me that we're crazy and should just stick to dbt. They're probably right. But dbt boils the ocean, and we only need a subset of its features. It's also a great learning experience, and allows us to experiment with new ideas.

Here is what our CI/CD looks like with lea:

<div align="center" >
<figure style="width: 50%;">
    <img src="/img/blog/efficient-elt-refreshes/after.png" style="box-shadow: none;">
</figure>
</div>

The following command is where the magic happens:

```sh
lea run --select git+ --freeze-unselected
```

The `--select git+` part selects all the views that have been edited in the pull request, as well as their descendants. This ensures we will materialize all the parts of the DAG that depend on the changes we made. The `--freeze-unselected` part freezes all the tables which are not selected, meaning that the SQL queries will target the production dataset for the unselected views. This is all done in a stateless manner: we don't have to store/load artifacts from previous runs.

I'm sure that the same efficiency could be achieved with dbt, but that's not the point. The point is that more and more people are doing analytics, and I believe it's important to put simple tools in their hands. Not everyone needs the full power of dbt, and it's important to have a low barrier to entry. I'm not saying that lea is the answer, but I do think we need tools that make it easy to do the right thing -- aka the [pit of success](https://blog.codinghorror.com/falling-into-the-pit-of-success/).

Feel welcome to reach out if you want to riff on this topic and/or tell me I'm doing everything wrong ✌️

<div align="center" >
<figure style="width: 90%;">
    <img src="/img/blog/efficient-elt-refreshes/happy-martin.png" style="box-shadow: none;">
</figure>
</div>
