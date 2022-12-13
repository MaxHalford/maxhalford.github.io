+++
date = "2023-01-01"
title = "Life Cycle Analysis for dummies"
toc = true
draft = true
tags = ['sustainability']
+++

## Introduction

There are different reasons for doing LCA. You might be preparing a [CSR report](https://www.hec.edu/en/faculty-research/centers/society-organizations-institute/think/so-institute-executive-factsheets/how-report-csr), possibly in order to obtain an [SBTI certification](https://www.wikiwand.com/en/Science_Based_Targets_initiative). You may also be working on labelling a product with an environmental impact score. Or maybe you're looking to make environmental claims about your product(s) on social media.

LCA is complex and requires expertise. Companies that showcase software that can be used by anyone are usually selling snake oil. Proper LCA is usually done by a specialized third-party, such as a certified consultancy company. You the reader might thus be such a "hired gun" getting into the world of LCA.

The truth is that LCA boils down to software and data. The difficult part is to obtain and organize accurate data, and then assemble it into meaningful, comparable, trustworthy figures thanks to software. LCA is therefore a software engineering job.

This article is aimed for dummies with software engineering skills: people who want to understand just enough what LCA is about, and get the job done with the right tools. I myself am one of these dummies. I've been working at [Carbonfact](https://www.carbonfact.com/) for roughly 6 months now. There I calculate the environmental footprint of [clothing items](https://www.wikiwand.com/en/Clothing_industry).

## LCA vs. LCI vs. LCIA

## Resources

### Learning material

- The [Wikipedia article](https://www.wikiwand.com/en/Life-cycle_assessment) on LCA is quite comprehensive and lists some of its pitfalls.
- [Life Cycle Analysis lecture from MIT ESD.S43 Green Supply Chain Management, Spring 2014](https://www.youtube.com/watch?v=gpuvUU0Nl4k)
- [LCA lecture](https://www.youtube.com/watch?v=uXj3M9Z4B4g) by Jeremy Faludi, along with a [hands-on workshop](https://www.youtube.com/watch?v=ATkUB9JJWHE) based on [this LCA exercice](https://venturewell.org/tools_for_design/measuring-sustainability/life-cycle-assessment-content/life-cycle-assessment-exercise/) from Venturewell
- If you understand French, I recommend checking out *C'est pas sorcier* on YouTube. They have comprehensive half-hour videos about how materials are made, such as [cotton](https://www.youtube.com/watch?v=9Aov-vy_mgY), [paper](https://www.youtube.com/watch?v=4ZW4tX4qSHg), and [rubber](https://www.youtube.com/watch?v=kdP30T74oZE). It's definitely not wasted time and anchors LCA in the real-world.
- [Okala course](https://web.stanford.edu/class/me221/readings/Okala_Modules_1-7.pdf)

### Data sources

- [Ecoinvent](https://ecoinvent.org/). Their [glossary](https://ecoinvent.org/glossary-terms/) is worth a look.
- Agribalyse
- Ecobalyse. Formally known as Wikicarbone.
- [Idemat](https://www.ecocostsvalue.com/data/idemat-and-idematlightlca/)
- [U.S. Life Cycle Inventory Database](https://www.nrel.gov/lci/)
- [Ecolizer](https://www.ecolizer.be/), for instance see [this PDF](https://venturewell.org/wp-content/uploads/Ecolizer-2.0-LCA-tables-printable.pdf)

### Software

Note that software solutions usually provide adapters to load common data sources. For instance, Brightway2 can import data from Ecoinvent out-of-the-box. Likewise, OpenLCA provides access to many sources by default.

#### Free usage

- [Brightway2](https://2.docs.brightway.dev/) is an opensource framework for LCA. It can be used as an interface to work with [different sources](https://2.docs.brightway.dev/notebooks.html#importing-data-example-notebooks), such as Ecoinvent, Agribalyse, or even a custom one. [This](https://github.com/maximikos/Brightway2_Intro) tutorial is a good start.
- [OpenLCA](https://www.openlca.org/). This short [tutorial](https://www.youtube.com/watch?v=r2Xdh5LT934) demonstrates how to measure the impact of a plastic bottle.
- [CMLCA](https://personal.vu.nl/R.Heijungs/CMLCA/home.html), developed at the university of Leiden where Reinout Heijungs worked. Seems a bit antique as of now.
- [EIO-LCA](http://www.eiolca.net/) -- web-based

#### Commercial

- [SimaPro](https://pre-sustainability.com/solutions/tools/simapro/)
- [GaBi](https://gabi.sphera.com/international/index/)
- [Umberto](https://www.ifu.com/umberto/)

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

*In time*

- Cradle to gate
- Cradle to grave
- Gate to grave
- Gate to gate

*In space*

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

## Example: a vegetarian pizza
