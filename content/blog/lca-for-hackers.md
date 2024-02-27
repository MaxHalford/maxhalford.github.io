+++
date = "2024-01-07"
title = "Life Cycle Assessment for hackers"
toc = true
tags = ['sustainability']
draft = true
+++

https://ecochain.com/blog/life-cycle-assessment-lca-guide/

## Introduction

## In a nutshell

## It's boxes all the way down

## LCA = LCI + LCIA

LCA is the acronym for Life Cycle Assessment. It is the process of measuring the environmental impact of a product. It is composed of two steps:

- Life Cycle Inventory (LCI) -- the process of breaking down a product into its parts -- so-called _activities_.
- Life Cycle Impact Assessment (LCIA) -- the process of measuring the impact of each activity.

This dichotomoty translates well into software.

### Life Cycle Inventory (LCI)

This is the process of describing the inputs and processes needed to make a product. The goal at this stage isn't to measure the environmental impact of the product or its parts, but to describe it.

For instance, a cup of coffee requires a cup, a lid, a sleeve, a stirrer, a napkin, and a coffee machine. Each of these parts has its own sub-parts. The coffee machine requires electricity, water, and coffee beans. The coffee beans require a bag, which requires a truck, which requires fuel, etc.

<div align="center">
<figure>
    <img src="https://upload.wikimedia.org/wikipedia/commons/e/e2/LCI_Diagram.png">
    <figcaption>An example of a life cycle inventory (LCI) diagram (<a href="https://www.wikiwand.com/en/Life-cycle_assessment#Life_Cycle_Inventory_(LCI)">source</a>)</figcaption>
</figure>
</div>

LCI can be performed at different levels of detail. For instance, the coffee machine can be described as a single activity, or as a detailed list of sub-activities. The more detailed the LCI is, the more actionable it is.

A typical issue is when LCI is done without enough detail. For instance, let's say you're tasked with measuring the impact of a wool t-shirt. You have an emission factor for 1kg of wool, and you know the amount of wool the t-shirt requires, so you are able to (roughly) measure the t-shirt's impact. Someone then asks you to split the impact between the raw materials -- shaving the wool from the sheep -- and the manufacturing -- spinning the wool into yarn, weaving the yarn into fabric, etc. You can't do that because the LCI wasn't done with that level of detail.

The necessary level of detail depends on the kind of analysis you anticipate will be needed. The more detailed the LCI is, the more kinds of analysis it unlocks. Finding the sweet spot is problem-specific. On the one hand, you want an LCI that is deep enough to provide actionable insights and operational levers. On the other hand, you have limited time and budget, so you can't afford to go too deep. Moreover, you are likely limited

## False precision is the vilain

https://moutreach.science/2020/11/12/LCA-this-pseudo-science.html

### Learning material

### Data sources

- [Ecoinvent](https://ecoinvent.org/). Their [glossary](https://ecoinvent.org/glossary-terms/) is worth a look.
- Agribalyse
- Ecobalyse. Formally known as Wikicarbone.
- [Idemat](https://www.ecocostsvalue.com/data/idemat-and-idematlightlca/)
- [U.S. Life Cycle Inventory Database](https://www.nrel.gov/lci/)
- [Ecolizer](https://www.ecolizer.be/), for instance see [this PDF](https://venturewell.org/wp-content/uploads/Ecolizer-2.0-LCA-tables-printable.pdf)

https://parisgoodfashion.fr/en/our-glossary/

### Software

Note that software solutions usually provide adapters to load common data sources. For instance, Brightway2 can import data from Ecoinvent out-of-the-box. Likewise, OpenLCA provides access to many sources by default.

https://moutreach.science/2018/04/10/Teaching-experiment.html

#### Free usage

- [Brightway2](https://2.docs.brightway.dev/) is an opensource framework for LCA. It can be used as an interface to work with [different sources](https://2.docs.brightway.dev/notebooks.html#importing-data-example-notebooks), such as Ecoinvent, Agribalyse, or even a custom one. [This](https://github.com/maximikos/Brightway2_Intro) tutorial is a good start. There's more material [here](https://github.com/massimopizzol/B4B/tree/main), [courtesty of](https://moutreach.science/2018/04/10/Teaching-experiment.html) Massimo Pizzol.

https://chris.mutel.org/how-to-use-ecoinvent.html

https://github.com/massimopizzol/B4B

- [OpenLCA](https://www.openlca.org/). This short [tutorial](https://www.youtube.com/watch?v=r2Xdh5LT934) demonstrates how to measure the impact of a plastic bottle.
- [CMLCA](https://personal.vu.nl/R.Heijungs/CMLCA/home.html), developed at the university of Leiden where Reinout Heijungs worked. Seems a bit antique as of now.
- [EIO-LCA](http://www.eiolca.net/) -- web-based

#### Commercial

- [SimaPro](https://pre-sustainability.com/solutions/tools/simapro/)
- [GaBi](https://gabi.sphera.com/international/index/)
- [Umberto](https://www.ifu.com/umberto/)

## ILCDpornhub

## Concepts

There's at a lot of definitions. Here are the ones I deem most important. See [here](https://consequential-lca.org/glossary/) for more.

**Activity**

**Bill of materials**

[Wikipedia article](https://www.wikiwand.com/en/Bill_of_materials)

**Functional unit**

<div align="center">
<figure >
    <img src="/img/blog/lca-for-dummies/coffee-cup.png">
    <figcaption><a href="https://www.youtube.com/watch?v=uXj3M9Z4B4g&t=2000s">Source</a></figcaption>
</figure>
</div>

**Impact indicators**

**System boundary**

<div align="center">
<figure >
    <img src="/img/blog/lca-for-dummies/skin-moisturiser-system-boundaries.png">
    <figcaption><a href="https://static1.squarespace.com/static/5e66303d2a35d86b999ddf82/t/5ed4fd309aade1279552f980/1591016771984/LCA+Guide">Source</a></figcaption>
</figure>
</div>

_In time_

- Cradle to gate
- Cradle to grave
- Gate to grave
- Gate to gate

_In space_

- Scope 1
- Scope 2
- Scope 3

**Attributional vs. consequential LCA**

Example of corn ethanol. If you grow it, you're not growing other stuff, so other countries grow it, for instance by destroying rain forests.

## The lifecycle

<div align="center">
<figure >
    <img src="/img/blog/lca-for-dummies/Example_Life_Cycle_Assessment_Stages_diagram.png">
    <figcaption><a href="https://www.wikiwand.com/en/Life-cycle_assessment#/Definition,_synonyms,_goals,_and_purpose">Source</a></figcaption>
</figure>
</div>

### Usage

Usage is important for products which consume energy, such as a hand-dryer or a car. Less so for a pair of shoes. Although one could argue that a good pair of shoes encourages to move around more, and therefore spend more energy, and thus consume more food to replenish that energy.

## Steps to conduct an LCA

### Scope definition

- System boundaries
- Functional unit (dry hands, as opposed to paper towels or hand dryer; cup of coffee: paper cup and China cup)
- Cut-off rules (e.g remove steps and/or parts that you think won't have a big impact)

### Inventory analysis

Also called life-cycle inventory (LCI).

Identify:

- Energy inflows
- Material inflows
- Releases

Proxies (material fallbacks because relevant material is not in database), the goal is to find a material that is environmentally similar but not necessarily functionally similar

### Impact analysis

Also called life-cycle impact assessment (LCIA).

### Interpretation

## Uncertainty

- [A Review of Approaches to Treat Uncertainty in LCA](https://scholarsarchive.byu.edu/cgi/viewcontent.cgi?article=3524&context=iemssconference) by Heijungsa and Huijbregts with accompanying [slides](http://formations.cirad.fr/analyse-cycle-de-vie/pdf/Heijungs_2.pdf)

## Example: pizzas

## Case studies

### Coffee

- https://theconversation.com/heres-how-your-cup-of-coffee-contributes-to-climate-change-196648
- https://onlinelibrary.wiley.com/doi/full/10.1111/jiec.12487

## Going further

- [Teaching videos](https://moutreach.science/2022/08/15/teaching-videos.html) by Massimo Pizzol from the university of Aalborg
- The [Wikipedia article](https://www.wikiwand.com/en/Life-cycle_assessment) on LCA is quite comprehensive and lists some of its pitfalls.
- [Life Cycle Analysis lecture from MIT ESD.S43 Green Supply Chain Management, Spring 2014](https://www.youtube.com/watch?v=gpuvUU0Nl4k)
- [LCA lecture](https://www.youtube.com/watch?v=uXj3M9Z4B4g) by Jeremy Faludi, along with a [hands-on workshop](https://www.youtube.com/watch?v=ATkUB9JJWHE) based on [this LCA exercice](https://venturewell.org/tools_for_design/measuring-sustainability/life-cycle-assessment-content/life-cycle-assessment-exercise/) from Venturewell
- If you understand French, I recommend checking out _C'est pas sorcier_ on YouTube. They have comprehensive half-hour videos about how materials are made, such as [cotton](https://www.youtube.com/watch?v=9Aov-vy_mgY), [paper](https://www.youtube.com/watch?v=4ZW4tX4qSHg), and [rubber](https://www.youtube.com/watch?v=kdP30T74oZE). It's definitely not wasted time and anchors LCA in the real-world.
- [Okala course](https://web.stanford.edu/class/me221/readings/Okala_Modules_1-7.pdf)

## Reporting

CSR report](https://www.hec.edu/en/faculty-research/centers/society-organizations-institute/think/so-institute-executive-factsheets/how-report-csr), possibly in order to obtain an [SBTI certification](https://www.wikiwand.com/en/Science_Based_Targets_initiative)

### Scopes

### Standard reports

### Spend-based reports
