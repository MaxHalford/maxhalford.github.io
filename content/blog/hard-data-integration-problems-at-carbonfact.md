+++
date = "2025-01-02"
title = "Hard data integration problems at Carbonfact"
toc = true
tags = ['data-science']
+++

Carbonfact's customers are clothing brands and factories. Our mission is to measure (and ultimately reduce) the carbon footprint of their products. We need primary data to do this: purchase orders, bills of materials, energy consumption data, etc.

Each customer has a unique IT setup, which makes it challenging to scale to hundreds/thousands of customers. Our success as a business depends on our ability to not reinvent the wheel for each customer.

Data integration is a difficult problem to work on. In fact, in my experience, it's one of the hardest data science tasks. This is because many aspects can't just be addressed with technical solutions. LLMs and machine learning are useful, but they don't change the fact customers have all kinds of messed up edge-cases on their end.

> _Customer data is like a box of chocolates: you never know what you're going to get._

> _Sturgeon's law: 90% of everything is crap._

I'm not yet convinced the kind of data integration we do at Carbonfact can be fully automated. We take a white gloved approach: we look at the customer's data with our eyes, we meet with them, we ask questions, and we write a bespoke connector. Our customers are delighted. But don't get fooled: we're not consultants, and our objective is to automate and scale our methodology. It's just really hard.

The purpose of this blog post is to list some tough data integration topics we are seeing repeatedly at Carbonfact. This list should give proof that the "AI will replace data scientists" narrative is poppycock. I also want to use this post to give my team and our customers some food for thought.

I haven't listed everything: _le secret d'ennuyer est celui de tout dire._ There are mundane topics which we deal on a daily basis: normalizing human inputs, imputing missing data, etc. I gave an example of dealing with manually entered product compositions in a [previous blog post](/blog/carbonfact-nlp-open-problem/). Instead, here I've focused on hard stuff for which I do not see an obvious technical solution.

## Mutable systems lead to misrepresentations

Clothing brands use [PLMs](https://en.wikipedia.org/wiki/Product_lifecycle) and [PIMs](https://en.wikipedia.org/wiki/Product_information_management) to keep track of their products. For instance, these systems are the source of truth for the [bill of materials](https://en.wikipedia.org/wiki/Bill_of_materials).

Staple products that are sold year-on-year are called carry-over products. The bill of materials for these products may change over time. For instance, the company might decide to switch from 100% cotton to 100% organic cotton.

In a good setup, each bill of materials is versioned. Typically, a single SKU is associated with one version for each season where it is sold:

| sku | season      | composition         |
| --- | ----------- | ------------------- |
| 123 | Summer 2023 | 100% cotton         |
| 123 | Summer 2024 | 100% cotton         |
| 123 | Summer 2025 | 100% organic cotton |

This allows indicating which particular variant of each SKU was ordered in the [ERP](https://en.wikipedia.org/wiki/Enterprise_resource_planning):

| sku | season      | date       | units |
| --- | ----------- | ---------- | ----- |
| 123 | Summer 2023 | 2022-03-01 | 1200  |
| 123 | Summer 2023 | 2022-04-01 | 800   |
| 123 | Summer 2024 | 2023-03-01 | 1800  |
| 123 | Summer 2024 | 2023-04-01 | 1400  |
| 123 | Summer 2025 | 2024-05-01 | 4000  |

The problem is that not all systems are well-behaved and version their data. Take the PLM: if it isn't versioned, then changing 100% cotton to 100% organic cotton will change the composition for future purchase orders, but also old ones! And even if the PLM is versioned, the ERP might not be. This happens a lot in practice, because different teams/vendors/consultants are responsible for each system.

One solution is that we could version customers files ourselves. But that would only apply starting from the moment we get access to the customer's data, and it would not be retroactive. Furthermore, it would imply us having to deal with evolving file formats, which is a nightmare.

## Multisourced supply chains don't surface to the top

Most of our customers are clothing brands. They don't usually make the clothes themselves, and instead order them from so-called tier 1 suppliers. Several tier 1 suppliers might supply the same SKU. For instance, a brand might order 400 units of a t-shirt from supplier A and 600 units from supplier B. Likewise, tier 1 suppliers might get their materials from several tier 2 suppliers.

<p>
  <img src="/img/blog/hard-data-integration-problems-at-carbonfact/multisourcing.svg" width="95%" style="box-shadow: none;">
</p>

This is called a [multisourced](https://en.wikipedia.org/wiki/Multisourcing) supply chain. Distinguishing each supply chain variation is important to us, because each one leads to a different carbon footprint. For instance, tier 1 supplier A might use a factory in Bangladesh and source its materials from India, while tier 1 supplier B might use a factory in China and source its materials from Vietnam.

We have access to our customers ERP, so we have a good view of the purchase orders they issue to their tier 1 suppliers. We can therefore create one copy of an SKU for each of its T1 suppliers, and allocate the associated purchase order quantities to it. But we don't have access to the tier 1 suppliers' ERP. This means we don't usually know from which tier 2 suppliers the tier 1 suppliers get their materials from. And even when we do, we don't necessarily know what are the quantities involved.

Sometimes, the bill of materials has one record for each tier 2 supplier of each material. This is a small victory. The problem is that there aren't volumes associated: we don't know how much of each material gets supplied from each tier 2 supplier. Therefore, we can't tell which of the products sent by each tier 1 supplier come from a particular supply chain.

The workaround is what you would expect: we assume each tier 1 supplier gets its materials from a single tier 2 supplier -- typically the most important one. This is a simplification, but it's the best we can do. The problem is that this assumption is not always true. For instance, a tier 1 supplier might source 80% of its materials from tier 2 supplier A and 20% from tier 2 supplier B.

What I dislike most with these (necessary) workarounds is that nobody questions them once they are in place. They become the truth. Somebody at some point might point out the simplification, but it's too late: the data has been integrated, the reports have been generated, and the customer has made decisions based on them. Nobody asks questions, especially if the figures make you look good.

## IT migrations aren't retroactive

Our customers' IT systems were set up at a time when environmental impacts weren't top of mind. Their systems and the data that is kept track in them are not sufficient to get actionable environmental measurements. Many of our customers are thus migrating parts of their IT landscape to support these new needs. For instance, they might be implementing a new PLM that has a field for the dyeing process of each material.

The problem with IT migrations is that they are not retroactive. Existing data is not migrated to these shiny new systems. Instead, customers draw a line in the sand and start using the new system from a certain date. This means that we have to deal with data from two systems: the old one and the new one. The customer now counts as two customers in terms of complexity, but they're only paying for one subscription!

This happens regularly when we meet with customers for the first time. Let's say we're doing their carbon accounting for 2024. They also want us to their carbon accounting for 2023, in order to compare the two years. We agree, but then we learn that they kicked off their new PLM in 2024. This means that we have to deal with two different PLMs, and we have to make sure that the data from the old PLM is comparable to the new PLM. This isn't usually the case, because the new PLM has more fields and is more detailed.

<p>
  <img src="/img/blog/hard-data-integration-problems-at-carbonfact/retroactive.svg" width="95%" style="box-shadow: none;">
</p>

I find this problem particularly hard to deal with from a human perspective. The people who sign the contract on our side and that of the customer are not the people who actually do the work. The people signing the contract don't have in mind that integrating multiple systems is a necessity, and that each integration essentially involves a separate data pipeline. This can cause friction when the people doing the work realize they have double (or triple!) the work they initially thought.

## Information isn't correct, and nobody has ownership

Our points of contact at our customers are usually part of the company's sustainability team. They don't necessarily master the nuances of their IT system. And they don't necessarily someone from their IT team to provide guidance. It's often the case that our point of contact assumes information is available in the system, when in fact it isn't.

We recently worked with a customer who told us 70% of their fabrics were recycled, which is quite high. However, when we integrated their data and delivered them with a dashboard, they complained that the "% recycled" KPI was at 0%. After some digging, we (and they) realized that the drop-down in their PLM didn't have recycled as an option. The people entering the data in the PLM (who are not part of the sustainability team) could only specify what kind of material it was (cotton, polyester, etc.), but not whether it was recycled or not. The craziest part of this story is that the sustainability team had been in place for 3 years, and nobody had noticed this!

I often notice a disconnect between the goals the sustainability team wants to achieve, and what their IT system is capable of. Recently, a customer told us they wanted to highlight that some of their jackets used an innovative water-repellent coating process. The problem of course is that their PLM doesn't have a field for this. The sustainability team was quite disappointed when we told them we couldn't do anything about it. They then asked us if they could compile a manual list of the jackets where this process was used. The problem is that this list would be out of sync with the PLM, would have to be maintained manually, and would require some more adhoc code.

<p>
  <img src="/img/blog/hard-data-integration-problems-at-carbonfact/misalignment.svg" width="95%" style="box-shadow: none;">
</p>

A lot of this comes down to a misalignment of interests and a lack of ownership. Many of our customers are large companies with many departments. The sustainability team is often a small team with a big mission. They don't have the power to change the IT system, and they don't have the power to force other departments to use the system correctly. They're in a tough spot. On top of this, a lot of their IT systems are deployed and managed by expensive consultants. It's [data hell](https://news.ycombinator.com/item?id=42010249).
