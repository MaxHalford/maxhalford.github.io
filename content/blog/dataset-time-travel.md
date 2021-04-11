+++
date = "2021-04-07"
title = "An overview of dataset time travel"
toc = true
+++

## TLDR

You're a data scientist. The engineers in your company overwrite data in the production database. You want to access overwritten data to train your models. How?

## I thought time travel only existed in the movies

You're probably right, expect maybe for [this guy](https://www.wikiwand.com/en/Time_travel_claims_and_urban_legends#/Present-day_hipster_at_1941_bridge_opening).

I want to discuss a concept that's been on my mind for a while now. I like to call it "dataset time travel" because it has a nice ring to it. But the association of "time travel" and "data" has already been used elsewhere. It's not something I'm pulling out from thin air. Essentially, what I want to discuss is the ability to view a dataset at any given point in the past. Having this ability is powerful, as it allows answering important business questions. As an example, let's say we have a database table called `users`. We might ask the following question:

> What did the `users` table look like one month ago?

A different and yet equivalent way to formulate this question would be:

> If I were to go back in time one month ago, what would the `users` table look like?

## A motivating business problem

When I was an intern at [HelloFresh](https://www.hellofreshgroup.com/en/), we were obsessed with understanding why our users would churn. I was tasked with building a machine learning model that would predict the risk of a user churning once they had been delivered their first meal box. To do this, I had to record everything I knew about the user right when said user received their box. In other words, I had to collect features relative to a particular point in time. Three weeks after the first box had been received, I would have a label indicating whether the user still had an active subscription. This was the binary target class in my model.

I had identified the user's delivery address as an important feature. The HelloFresh userbase tend(ed) to live in wealthy neighborhoods, so using their delivery address postcode mattered a lot. Another important feature was the type and size of the meal box the user had subscribed to: vegetarian, pescatarian, for 3 servings, 5 servings, etc.

My goal was to build a database that recorded these features for each user at the moment when said user had received their first box. I quickly encountered a problem: users could change their delivery address. If I took a user who had been subscribed with us for, say, 3 months, then the address they were using at a given week was not necessarily the one they were using presently. Unsurprisingly, when a user changed their address, we just replaced the according field in our production database. The same was true for the meal plan they had subscribed to. I was blocked.

My (weak) solution to this problem was to record the features for users that had currently just received their first meal box. I then had to wait 3 weeks to see if the user had churned or not. In other words, I couldn't use our historical data. I could only base myself on the users to which I had real-time access. This greatly limited the amount of training data I was able to prepare for my model.

I did this internship over 3 years ago. Facing this kind of issue was a great opportunity for me to understand the practical challenges of data science. Shortly after the internship, I began my PhD studies and thus didn't give this problem much more thought. I've now finished my PhD and joined a health insurance tech company called [Alan](https://alan.com/). It took me only a couple of months to face this problem again! I'm convinced it is a problem that appears in many businesses, and thus deserves to be addressed in a holistic manner. I decided to write this blog post to review the different solutions that may be considered -- at least those that I'm aware of!

## Storing events

A first way to proceed is to store events instead of state. I'll explain with an example. Let's say we're interested in a user's delivery address. We might have a `user` relation which records, among other things, the address of each user:

| name    | address               |
|---------|-----------------------|
| Anna    | 891 Friedrichstrasse  |
| Beau    | 264 Schönhauser Allee |
| Charles | 113 Karl-Marx-Allee   |

Each address is the current address of each user. It's the current state. But we might be interested in a user's address sometime in the past, which is a past state. Instead of only storing the current address, we could store an event each time a user updates their address. This might translate in the following table:

| name    | moment     | address               |
|---------|------------|-----------------------|
| Anna    | 2019-01-12 | 12 Frankfurter Allee  |
| Anna    | 2021-04-06 | 891 Friedrichstrasse  |
| Beau    | 2020-08-25 | 264 Schönhauser Allee |
| Charles | 2017-10-08 | 224 Prenzlauer Allee  |
| Charles | 2021-03-02 | 113 Karl-Marx-Allee   |

We could also do something like this:

| name    | moment     | field   | value                 |
|---------|------------|---------|-----------------------|
| Anna    | 2019-01-12 | address | 12 Frankfurter Allee  |
| Anna    | 2021-04-06 | address | 891 Friedrichstrasse  |
| Beau    | 2020-08-25 | address | 264 Schönhauser Allee |
| Charles | 2017-10-08 | address | 224 Prenzlauer Allee  |
| Charles | 2021-03-02 | address | 113 Karl-Marx-Allee   |

The exact structure doesn't matter that much. What is important is that you can determine the state of things at any point in time. If you want to get the current state, you can look at the latest value for each user. If you want to determine the state at any point in the past, you have to filter out all the data that occurs after that point in time, and then look at the latest value per user. In SQL, this would look something like:

```sql
SELECT DISTINCT ON name *
FROM users
WHERE moment < '2020-04-23'
ORDER BY moment DESC
```

The advantage of this storage pattern is its flexibility. It is every data scientist's wet dream to have access to historical data in order to be able to determine the state of the data at any point in time. And yet, data is rarely stored in such a manner in the real world. Indeed, production databases are owned by engineers, not data scientists. In that regard, data scientists are victims of the patterns and habits that engineers are used to. Although that is probably a good thing: application data [should be](https://www.wikiwand.com/en/Data_independence) agnostic of the usage that is made of it. Engineers should have freedom as to how they go about managing their application data. Having the data science team be involved in the application database design choices would involve a lot of friction and demolish the separation of concerns principle.

In recent years, there has been a shift towards the use of data instrumentation. This boils down to emitting events each time something of interest happens in application. These events are not stored into the application database. Instead, they're typically directly sent to a data warehouse to be consumed by a data science team. This is commonly referred to as [event driven analytics](https://www.littlemissdata.com/blog/givemedata). There's some neat tools out there to manage this, including [Heap](https://heap.io/), [Snowplow](https://snowplowanalytics.com/), [Iteratively](https://iterative.ly/), and [Segment](https://segment.com/) which we use at Alan. They're basically the equivalent of Google Analytics, but for general purpose data and not just web traffic data. My impression is that this is essentially a bypass mechanism to allow data science teams to not have to rely as much on the application database. Emitting and storing events empowers a data science team because it gives them ownership of the data that is being produced.

Event driven analytics is however not a panacea in my eyes. You still have to declare all the events you want to capture. For the address field, you would have to capture the event of when a user changes their address. This might happen in various places: the mobile app, the website, the backend CRM. Clearly, defining and firing an event for each attribute change seems a tad overkill. It's also not retroactive and has to be setup long before any analytics may be done.

Storing state changes instead of the state itself is actually an old topic in the database world. In fact, there's even a thing called [temporal databases](https://www.wikiwand.com/en/Temporal_database). The Wikipedia article on the topic has good examples of what problem this addresses. Spoiler: it's very similar to the problem I had at HelloFresh. The Wikipedia article also lists [some implementations](https://www.wikiwand.com/en/Temporal_database#/Implementations_in_notable_products) in commercial databases. The [Bigtable paper](https://www.usenix.org/legacy/event/osdi06/tech/chang/chang.pdf) by Google is also very much worth a read. They effectively add a temporal dimension to each cell of their table to record the changes of the cell's value. Their use case is rather interesting: they want to record the state of a webpage each time their crawler analyses its content and track the modifications.

Using events instead of explicitly storing the state is an interesting approach. It solves a lot of problems, and yet it isn't ideal nor is it popular. You still have to write a bunch of logic to reconcile your data and aggregate it properly. You also have to convince your engineering team to switch their mindset, or shift towards using event-driven analytics. Thankfully, using events isn't the only way to time travel over a dataset.

## Versioning

A version control system (VCS) is a piece of software to manage changes in data. [Git](https://www.wikiwand.com/en/Git) is probably the most famous VCS there is. In a nutshell, a VCS keeps a record of the changes that are made to a set of files. This allows you to go in back in time by reverting the changes that were made up to a given point in time. Which is exactly what we're looking for!

In fact, most databases have some mechanism for reverting updates by design. This allows them to handle distributed workloads and recover from crashes. This is often implemented by storing a log of all the changes that are made, which is well explained in [this old but gold article](https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying). The PostgreSQL docs have [a great explanation](https://www.postgresql.org/docs/9.1/continuous-archiving.html) of how this works. Another mention of using logs for database recovery [can be found](https://dev.mysql.com/doc/mysql-backup-excerpt/8.0/en/point-in-time-recovery-positions.html) in the MySQL docs. Likewise, SQLite has an [undo/redo mechanism](https://www.sqlite.org/undoredo.html).

Although databases have the ability to reflect the state of the data at any point in the past, this is not always done in a very user-friendly manner. Databases use this feature for distributed computing and fault recovery, but not as a feature that is exposed to the client. Thankfully, there are some notable exceptions. In particular, Snowflake [enables time travel](https://docs.snowflake.com/en/user-guide/data-time-travel.html) by exposing `AT` and `BEFORE` keywords. Google's BigQuery [also allows this](https://cloud.google.com/bigquery/docs/time-travel). You can write the following kind of query:

```sql
SELECT address
FROM users
WHERE name = 'Anna'
AT '2019-03-20'
```

Note how different this is different to adding a `WHERE date = '2019-03-20'`. The `AT '2019-03-20'` statement will give you Anna's address at the given date, which is mind blowing to me. This is a really powerful feature, especially considering that Snowflake and BigQuery are becoming established in more and more data science teams. It's much more user-friendly than storing events. It provides a high-level mechanism that abstracts away almost all the details incurred from storing events.

Some databases have drank the version control Kool-Aid and actually built their logic on top of a git-like VCS. [Noms](https://github.com/attic-labs/noms) -- on which [Dolt](https://github.com/dolthub/dolt) is built -- is a canonical example. There's also [OrpheusDB](https://orpheus-db.github.io/). I also recommend going through [this Hackernews thread](https://news.ycombinator.com/item?id=26370572) -- git for data is a regular topic on Hackernews. Lastly there's [DVC](https://dvc.org/), which was initially devoted to versioning datasets, and has now degenerated into a fully fledged project to handle machine learning projects (sigh). It's all very much experimental -- that is, in my eyes -- but it seems promising nonetheless. As always people will keep using battle-tested software like PostgreSQL and Snowflake, so I'd be surprised if these projects become mainstream.

Interestingly, it's worth considering Git for small data analysis projects where time travel is necessary. I recently stumbled on a wonderful talk by Simon Willision entitled [*Git scraping, the five minutes lightning talk*](https://simonwillison.net/2021/Mar/5/git-scraping/). He discusses a simple and yet powerful idea -- all powerful ideas are simple in my experience -- which is to commit data changes using Git. This becomes very worthwhile when fetching and recording data from an API, say a weather service. For instance, I wrote a scrapper that fetches data from the BBC weather service and stores the result in a file on a regular basis. Each time I query the service, I store the given results in a JSON file and add a commit to the version history. This then allows me to [revisit the history of changes](https://github.com/MaxHalford/bbc-weather-honolulu/blob/main/build_database.py) and trace the weather forecasts that were made at any given point in time in the past. The beauty of it is that I don't have to explicitly store some fields that indicates at what moment each forecast was made. Instead, all that is handled transparently due to the fact that I'm using Git. I think this is simply amazing. You can see this idea being discussed in further depth in [this article](https://www.kenneth-truyers.net/2016/10/13/git-nosql-database/).

It's worth mentioning that this versioning approach has also been on the radar of the database community for a long time. There's an interesting concept called [slowly changing dimension](https://www.wikiwand.com/en/Slowly_changing_dimension) that crystallizes a lot of the ideas I'm trying to convey in this blog post.

## Snapshotting

I have a personal preference for the versioning approach over the event storage approach. The usage that ensues is at a higher level. It doesn't require writing queries that aggregate the data up to a given point in time. With versioning, you just have to pick a point in time and rollback all the commits that were made after that point in time. The downside is that this can become a costly operation. As you can imagine, rolling back changes isn't necessarily a cheap operation. There are likely many optimizations that can be made, such as squashing commits together, but that's just details.

An alternative approach that is worth keeping in mind is snapshotting. This involves dumping the current state of a table -- or a database in its entirety -- on a regular basis. That way, when you want to access the state of the data at a given point in time in the past, you just have to use the latest snapshot that is older than the given point in time. The upside over versioning is that you don't have to rollback the changes, which will save you a considerable amount of time. The downside is that you lose in flexibility, because the snapshots are discrete. Updates that occur in between consecutive snapshots might get lost because the rhythm at which the snapshots are made is too slow. Then again, this all depends on your specific application. For instance, at HelloFresh, weekly snapshots would have done the trick just fine.

A great tool to mention if you want to go down the snapshotting route is [Amazon Athena](https://aws.amazon.com/fr/athena/). You can use it to manage [Parquet files](https://databricks.com/fr/glossary/what-is-parquet) that will allow you to handle the high volume incurred by snapshotting.

## Objectives for a data science team

I believe that a product-oriented data science team should be asking itself:

> Are we able to determine the state of our data at any point in the past?

If the answer is no, then it might be worth bulking up on these topics. Especially if you're going to be building models on top of this data. An interesting notion to explore of [feature stores](https://www.featurestore.org/). The latter are becoming [popular](https://www.ethanrosenthal.com/2021/02/03/feature-stores-self-service/) and are supposed to abstract many data engineering details away. I'm not an expert on the topic, so I don't have any to recommend in particular. I've taken a look at the feature store landscape and noticed that a lot of them focus on scalability and production serving. None of them seemed to me to have the ability to time travel and allow computing historical features. They might, but I haven't seen it showcased. I'm excited to see how this will develop in the next few years. Especially when data science start realising that good models are a lot about having good data, and less about using powerful models.

As ever, feel free to reach out if you want to discuss further, or drop a comment right below.
