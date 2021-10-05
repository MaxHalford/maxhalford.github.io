+++
date = "2021-10-26"
title = "One year at Alan"
toc = true
draft = true
+++

## What I did

### Document processing

#### Information extraction

A candidate generator + field labeler system, uncannilly like what you can find [here](http://cidrdb.org/cidr2020/papers/p31-sheng-cidr20.pdf) -- Uncannily similar to what I had thought up.

#### Line segmentation

Deskewing, like what is done [here](https://muthu.co/deskewing-scanned-documents-using-horizontal-projections/)

- https://core.ac.uk/download/pdf/236053908.pdf

## Lessons I learned

### SQL is (usually) enough

We migrated to Snowflake in early 2021. It's so powerful, to the point where I don't really understand why we need tools like Spark, Ray, Dask, and Vaex.

### Simple machine learning goes a long way

We never did any deep learning. Our bread and butter was scikit-learn's LogisticRegression. We were able to replace several rule-based systems with a scikit-learn pipeline.

### Stakeholders should consume datasets, not dashboards

This is my own personal opinion.

### Full-stack data roles

Each member of Alan's data team is expected to handle the three major aspects. Therefore, we were all able to deliver a project from A to Z.
