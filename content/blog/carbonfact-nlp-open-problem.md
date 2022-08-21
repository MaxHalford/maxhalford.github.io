+++
date = "2022-08-11"
title = "NLP at Carbonfact: how would you do it?"
toc = true
draft = true
+++

## The task

I work at a company called [Carbonfact](https://www.carbonfact.com/). Our core value proposal is computing the [carbon footprint](https://www.wikiwand.com/en/Carbon_footprint) of clothing items, expressed in [carbon dioxide equivalent](https://www.wikiwand.com/en/Carbon_Dioxide_Equivalent) -- $kgCO^2e$ in short. For instance, we started by measuring the footprint of shoes -- no pun intended. We do these measurements with [life cycle analysis (LCA)](https://www.wikiwand.com/en/Life-cycle_assessment) software we built ourselves. We use these analyses to fuel higher-level tasks for our clients, such as [carbon accounting](https://www.wikiwand.com/en/Carbon_accounting) and [sustainable procurement](https://www.wikiwand.com/en/Sustainable_procurement).

A life cycle analysis is essentially a recipe, the output of which is a carbon footprint assessment. Like any recipe, an LCA necessitates ingredients. In a [cradle-to-gate](https://www.wikiwand.com/en/Life-cycle_assessment#/Cradle-to-gate) scenario, this includes everything that is needed to make the product: the materials, the mass, the manufacturing methods, the transport between factories, etc. In our experience, the biggest impact on a product's footprint come from the materials which it is made of.

Part of my job at Carbonfact involves massaging whatever data our clients can provide us with. My goal is to normalize their data so that it adheres to our internal product data model -- i.e. the ingredients. Alas, this process is difficult to automate, because all of our clients store their data in different ways. Some have a big Google Sheet, some have one Excel file per product, some provide us with a BigQuery table, etc. It gets worse: clients have differing naming conventions for materials, or they might have different expectations as to what components make up a product, etc.

We've come to accept that we have to write bespoke data normalization logic for each one of our clients. This initial resource investment is unavoidable. The upside is that we can perform LCA consistently once a client's data has been normalized.

I'm constantly thinking of ways for scaling this process. Indeed, building a bespoke parser for a new catalog of products is a tedious task. It also takes time: I recently spent three days on a catalog of roughly 5000 products. There's definitely opportunities to improve this process with machine learning, which is why I'm writing this blog post. I'd like to zoom in on a specific task I had to perform, present my existing solution that is not ML based, and do a light retrospective. I'm also going to share some labeled data, which I hope will encourage people to suggest their solution.

In this article, I want to focus on an NLP task I recently performed. I had to take human inputs that follow a rough template, and parse them into a structured schema. Here are a few input samples:

```txt
top body: 100% polyester lace: 88% nylon 12% spandex, string: 88% nylon 12% spandex
92% polyester, 8% spandex
95% rayon 5% spandex
87% nylon 13% spandex
95% rayon 5% spandex
87% nylon 13% spandex
lace 87% nylon 13% spandex; mesh: 95% nylon 5% spandex
92% nylon 8% spandex
body & panty: 85% nylon 15% spandex
86%polyamide,14%elastane
```

And here's the expected output for the following input string:

```txt
lace 87% nylon 13% spandex; mesh: 95% nylon 5% spandex
```

```json
{
    "lace": [
        {
            "material": "nylon",
            "proportion": 87.0
        },
        {
            "material": "spandex",
            "proportion": 13.0
        }
    ],
    "mesh": [
        {
            "material": "nylon",
            "proportion": 95.0
        },
        {
            "material": "spandex",
            "proportion": 5.0
        }
    ]
}
```

Here, `lace` and `mesh` are component names. Indeed, clothing items are made of several components. For the sake of normalization, we usually enforce each product to have a set list of components, but for the purpose of this task we'll ignore that aspect. Note that I made a short list of the material names that can be encountered, which you can find [here](/files/datasets/nlp-carbonfact/materials.txt).

## The data

There are 4662 (input, output) pairs, all of which can be found in these two datasets:

<div><a href="/files/datasets/nlp-carbonfact/inputs.txt"><b>inputs.txt</b></a></div>
<div><a href="/files/datasets/nlp-carbonfact/outputs.json"><b>outputs.json</b></a></div>

## A (tedious) working solution

When faced with this kind of task, it's difficult to decide between:

1. Spending time working on a generic machine learning based solution.
2. Spending less time writing a scrappy rule-based solution.

I opted with the latter for the sake of saving of time in the short-term. The solution I wrote is not generic, as it is only guaranteed to work for the dataset linked above. Also, if our client adds more data to their catalog, it's likely that I'll have to dive back into the code to handle new cases. However, this option is risk-free, and has the merit of being easy to debug. Here is the Python code:

<details>
  <summary>Click to see the code</summary>

```python
import json
import pathlib
import re
import regex

def normalize_composition_format(text):
    """
    >>> normalize_composition_format('(body) 82% nylon 18% spandex (forro)100% polyester')
    'body: 82% nylon 18% spandex forro: 100% polyester'

    >>> normalize_composition_format('fabric - 80% polyamide 20% elastane/lining - 100% polyester')
    'fabric: 80% polyamide 20% elastane lining: 100% polyester'

    """

    if text == "100% polyester woven (pant) and 95% viscose  5%spandex knitted top":
        return "pants: 100% polyester knitted_top 95% viscose 5%spandex"

    text = re.sub(
        r"\((?P<component>\w+)\)", lambda m: f"{m.group('component')}: ", text
    )
    text = re.sub(r"(?P<component>\w+)\ -", lambda m: f"{m.group('component')}: ", text)
    text = text.replace("/", " ")
    text = text.replace(" %", "%")
    text = text.replace("：", ": ")
    text = re.sub(r"fabric \d:", "fabric:", text)
    text = re.sub(r"(\d+\.?\d*)%", r" \1%", text)
    text = text.replace("top body", "top_body")
    text = text.replace("op body", "top_body")
    text = text.replace("body & panty", "body_panty")
    text = text.replace("edge lace", "edge_lace")
    text = text.replace("edg lace", "edge_lace")
    text = text.replace("cup shell", "cup_shell")
    text = text.replace("centre front and wings", "centre_front_and_wings")
    text = text.replace("cup lining", "cup_lining")
    text = text.replace("front panel", "front_panel")
    text = text.replace("back panel", "back_panel")
    text = text.replace("marl fabric", "marl_fabric")
    text = text.replace("knited top", "knitted_top")
    text = text.replace("striped mesh", "striped_mesh")
    text = text.replace("trim lace", "trim_lace")
    text = text.replace("body-", "body:")
    text = text.replace("liner-", "liner:")
    text = text.replace("mesh-", "mesh:")
    text = text.replace("&", " ")
    text = text.replace("lace ", "lace: ")
    text = text.replace("mesh ", "mesh: ")
    text = text.replace("gusset ", "gusset: ")
    text = text.replace("top ", "top: ")
    text = text.replace("body ", "body: ")
    text = text.replace("fabric ", " fabric: ")
    text = text.replace("bottom ", " bottom: ")
    text = text.replace(" :", ":")
    text = text.replace(";", " ")
    text = text.replace(",", " ")
    text = text.replace(". ", " ")
    text = text.replace("，", " ")
    text = text.replace("pa-00462-tho pa-00464-tho", "pa-00464-tho")
    text = text.replace("pa-00462-tho:", "")
    text = text.replace("g string ", "g-string: ")
    text = text.replace("95% 5%", "100%")
    text = text.replace(":", ": ")
    text = text.replace("\t", " ")
    text = text.replace("$", "%")
    text = text.replace(" with ", " ")
    text = text.replace("  ", " ")
    text = text.replace("%s ", "% ")
    text = text.replace("bci cotton", "cotton")
    text = re.sub(r"pa-\d{5}-tho:", "", text)
    text = text.replace("spandexbottom:", "spandex bottom:")

    # typos
    text = text.replace("sapndex", "spandex")
    text = text.replace("spadnex", "spandex")
    text = text.replace("spandexndex", "spandex")
    text = re.sub("span$", "spandex", text)
    text = re.sub("spande$", "spandex", text)
    text = text.replace("polyest ", "polyester ")
    text = re.sub("polyeste$", "polyester", text)
    text = re.sub("poly$", "polyester", text)
    text = text.replace("polyster", "polyester")
    text = text.replace("polyeste ", "polyester ")
    text = text.replace("elastanee", "elastane")
    text = text.replace(" poly ", " polyester ")
    text = text.replace("cotton algodón coton", "cotton")
    text = text.replace("recycle polyamide", "recycled polyamide")
    text = text.replace("polyester poliéster", "polyester")
    text = text.replace("polystester", "polyester")
    text = text.replace("regualar polyamide", "regular polyamide")
    text = text.replace("recycle nylon", "recycled nylon")
    text = text.replace("buttom", "bottom")
    text = text.replace("recycle polyester", "recycled polyester")
    text = text.replace("125", "12%")
    text = text.replace("135", "13%")
    text = text.replace("recycled polyeser", "recycled polyester")
    text = text.replace("polyeter", "polyester")
    text = text.replace("polyeseter", "polyester")
    text = text.replace("viscouse", "viscose")
    text = text.replace("ctton", "cotton")
    text = text.replace("ryaon", "rayon")

    return text.replace("  ", " ").strip()


def named_pattern(name, pattern):
    return f"(?P<{name}>{pattern})"


def multiple(pattern, at_least_one=True):
    return f"({pattern})+" if at_least_one else f"({pattern})*"


def sep(pattern, sep):
    return pattern + multiple(sep + pattern, at_least_one=False)


def split_composition_into_component_materials(text):
    """

    >>> split_composition_into_component_materials('fabric: 80% polyamide 20% elastane lining: 100% polyester')
    {'fabric': [('80', 'polyamide'), ('20', 'elastane')], 'lining': [('100', 'polyester')]}

    """

    component = ""
    materials = []
    component_materials = {}

    for token in re.split(r"\s+", text):
        if token.endswith(":"):
            if materials:
                component_materials[component] = " ".join(materials)
                materials = []
            component = token.rstrip(":")
        else:
            materials.append(token)
    else:
        if materials:
            component_materials[component] = " ".join(materials)

    # Parse the materials
    material_pat = named_pattern("material", r"[a-zA-ZÀ-ÿ\-\s']+[a-zA-ZÀ-ÿ\-']")
    proportion_pat = named_pattern("proportion", r"\d{1,3}([,\.]\d{1,2})?") + "%?"

    for component, materials in component_materials.items():
        pattern = sep(rf"{proportion_pat}\s*{material_pat}", " ")
        match = regex.match(pattern, materials)
        component_materials[component] = [
            {
                "material": m,
                "proportion": float(p)
            }
            for m, p in zip(
                match.capturesdict()["material"],
                match.capturesdict()["proportion"],
            )
        ]

    return component_materials

inputs = pathlib.Path('inputs.txt').read_text().splitlines()
outputs = []

for inp in inputs:
    inp = normalize_composition_format(inp)
    out = split_composition_into_component_materials(inp)
    outputs.append(out)

expected_outputs = json.loads(pathlib.Path('outputs.json').read_text())
outputs == expected_outputs
```
</details>

The core parsing logic happens in `split_composition_into_component_materials`. It begins by splitting the text into tokens. Tokens that end with a `:` are classified as component names. That allows regrouping tokens into groups, each group corresponding to one component. Once that's done, a regex pattern is used to recognize all the `(proportion, material)` pairs within a group. This logic is straightforward and dead easy to unit test. The only problem is that each piece of text doesn't always follow this idealized pattern.

There's a second function called `normalize_composition_format` which cleans each piece of text. For instance, in some texts, the component names end with a `-` rather than a `:`. Sometimes a `;` might be used to separate components. There are also a whole bunch of typos, such as `polyeseter -> polyester` -- in fact, I found 10 different spellings for polyester. There's also some more esoteric corrections to make like `cotton algodón coton -> cotton`.

The details are not very interesting. I guess what's more important is the process it took to build this normalization function. Essentially, I looped through the inputs, tried to parse them, and stopped each time something went wrong. Then I diagnosed the error, edited the code to accommodate the new case, and moved on. Rinse and repeat. It's essentially a boring feedback loop with myself.

## Room for improvement

What I dislike with my current solution is that the parsing system is dumb and isn't learning by itself. I would love to build a feedback loop between the system and myself, which would enable the system to *learn* how to parse each sentence from the examples I provide it with. If the system is unsure, then it asks me to confirm/edit a parsing. For this to work, the feedback loop must be data-driven: I only label parts of the sentence, and I delegate the parsing logic to the system.

Of course, what I'm describing has a name: it's an [active learning](https://www.wikiwand.com/en/Active_learning_(machine_learning)) scenario. I'm also well aware that I could create this feedback loop with a tool like [Prodigy](https://prodi.gy/). For instance, I've spotted [this](https://prodi.gy/docs/dependencies-relations#ner) recipe for combining named entity recognition with relation extraction.

I haven't yet reached the point where I feel overwhelmed and in need of setting up this feedback loop. As of now, I can manage the workload. I don't feel like the initial investment of setting up something more complex will yield significant benefits. On the contrary, I'm still in doubt as to what an all-in-one solution would look like. For instance, I haven't seen good examples of using Prodigy to correct spelling errors and normalize names, which are important aspects to me. But that's likely because I'm just lacking NLP experience. At some point, I will likely spend some time and put a smarter solution in place.

I have written bespoke parsing functions for several catalogs I've had to work on. In each case, the parsing logic is rule-based, just like the piece of code above. The nice thing is that this generates a whole bunch of `input -> output` labeled data from different sources. That way I won't have to start from scratch the day I decide to begin a machine learning based solution. [This](https://www.cidrdb.org/cidr2020/papers/p31-sheng-cidr20.pdf) paper describes a similar situation, wherein a team at Google moved from a rule-based setup to a "Software 2.0" solution for an email information extraction task.

I'm very curious to understand how would others do it. I imagine that this kind of problem is faced by many practitioners. I can't be the only one hesitating between sticking to my rules and moving on to a machine learning system. Feel free to reach out and/or comment below if you want to share your experience!
