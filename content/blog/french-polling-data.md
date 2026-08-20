+++
date = "2026-09-02"
title = "A brief guide to French polling data"
tags = ['open-data', 'data-science']
+++

[FiveThirtyEight](https://en.wikipedia.org/wiki/FiveThirtyEight) is one of the reasons I went down the data science rabbit hole at university. What it achieved during the 2012 US presidential election felt like nothing short of predicting the future. And yet, all the data it used was out there in the open, available to anyone. I found that very inspiring at the time.

France is going through a difficult political period. The far right has a serious chance of winning the next presidential election, while the rest of the political landscape looks fragmented. At least, that is what recent polls suggest. Polling data and the models built on top of it play a significant part in day-to-day political debate. As of writing, [this page](https://fr.wikipedia.org/wiki/Liste_de_sondages_sur_l%27%C3%A9lection_pr%C3%A9sidentielle_fran%C3%A7aise_de_2027) provides a useful overview of polling for the upcoming election.

I was between jobs until recently, and had planned to contribute to public efforts around polling data and modelling. It turns out I will not have time to do anything substantial before the 2027 French presidential election, so I thought I should share the small amount of research I'm sitting on, in case someone else wants to pick it up.

The Economist [built](https://github.com/TheEconomist/2022-france-election-model) a statistical model for the 2022 election and published an accompanying [write-up](https://www.economist.com/graphic-detail/how-we-forecast-the-french-election/21807484) -- free access [here](https://archive.is/20230308081118/https://www.economist.com/graphic-detail/how-we-forecast-the-french-election/21807484). Its approach belongs to the tradition of election forecasting popularized by FiveThirtyEight. A useful technical reference is [this paper](https://sites.stat.columbia.edu/gelman/research/published/Harvard_Data_Science_Review.pdf), co-authored by [G. Elliott Morris](https://www.gelliottmorris.com/) and [Andrew Gelman](https://en.wikipedia.org/wiki/Andrew_Gelman). Morris previously led FiveThirtyEight's data operation before the site was shut down in 2025, and Gelman is a core member of the team behind [Stan](https://mc-stan.org/), a popular software for Bayesian statistical modelling.

As often, the secret sauce lies in the data, not in the choice of their statistical model or its parameters. Their method boils down to looking at past polling data, determining the correctness of each poll, and using this to weight polling agencies by how trustworthy they are. Of course, there's more to a good model than just that, but a significant amount of predictive power comes from estimating how trustworthy any unverified poll is. Looking at the polling agency's track record is paramount.

It is useful here to distinguish polls that can eventually be compared with an observed outcome. A voting-intention question such as *"Which candidate would you vote for?"* can be compared with an election result. A question such as *"Which candidate would you go on holiday with?"* cannot. Classifying verifiable polls is a necessary preliminary step.

Historical polling data is useful both for fitting models and for backtesting them. With [temporal cross-validation](https://scikit-learn.org/stable/modules/cross_validation.html#cross-validation-of-time-series-data), you can estimate how a model would have performed on past elections without letting future information leak into its predictions. Before getting into modelling, it is already instructive to examine polling errors, and how these vary between polling agencies and across elections.

The crux of the matter is therefore to collect past polling data and associate each relevant poll with the corresponding election result. Although elections are crucial events in our societies, I could not find a comprehensive global dataset that does this. The Economist's model uses [data](https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/8421DX) from [this paper](https://eprints.soton.ac.uk/413658/1/JenningsWlezienPollingErrors.pdf), but little else appears to exist at a comparable scale. That is understandable: if you are building a model for one country, it makes sense to just collect data from that country's past elections.

In France, polling organizations must submit published political polls to the [*Commission des sondages*](https://www.commission-des-sondages.fr/). This independent public authority monitors compliance with the applicable rules and methodology. Polling agencies usually submit polls as PDFs, which are published [on the Commission's website](https://www.commission-des-sondages.fr/notices/). A project called [NSPPolls](https://codeberg.org/nsppolls/sondages-commission-index) polls (🥁) that page once a day and turns the index into an [XML feed](https://codeberg.org/nsppolls/sondages-commission-index/raw/branch/main/polls.rss.xml). The data is still unstructured at this point, although the project appears to have published [structured data](https://github.com/nsppolls/nsppolls) in the past. But at least there is an extensive list of French political polls going back to 2016.

Several projects work downstream of NSPPolls. I came across [presidentielle2027](https://github.com/MieuxVoter/presidentielle2027), which monitors the XML feed, opens a GitHub issue for each new poll, and relies on people to extract the data from each PDF into a CSV file. I had a [chat](https://github.com/MieuxVoter/presidentielle2027/issues/41) with the project's owner, [Pierre Puchaud](https://github.com/Ipuch), who gave me permission to leverage Claude. For now, I run it manually whenever a new issue appears in my notifications. I have not automated the process because a little friction forces me to review Claude's output. I considered creating a dedicated skill, but the project's existing [instructions](https://github.com/MieuxVoter/presidentielle2027/blob/main/COMMENT_AJOUTER_UN_SONDAGE.md) are enough for Claude to do the job reliably.

The limitation of presidentielle2027 is that it focuses on presidential elections rather than municipal, parliamentary, and European ones. Those elections matter too: estimating polling errors requires as many comparable polls and outcomes as possible. I have not found an active project that collects and cleans all this data in one place, let alone one that links each poll to the corresponding result.

Ideally, such a dataset would contain:

- the Commission notice and original PDF
- the polling agency, sponsor, fieldwork dates, sample size, and methodology
- the election, round, question, and candidate configuration
- the published vote shares
- the corresponding official election result

I'll bet many people would feel enabled by such a project being well maintained, and I encourage any bored enthusiast who's reading this to take it on.
