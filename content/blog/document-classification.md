+++
date = "2020-10-03"
draft = false
title = "Classifying documents without any training data"
+++

<div align="center" >
  <img height="300px" src="/img/blog/document-classification/morpheus.jpg" alt="morpheus">
  <br>
</div>

I recently watched a [lecture](https://www.youtube.com/watch?v=IDNXZitcQng) by [Adam Tauman Kalai](https://twitter.com/adamfungi) on stereotype bias in text data. The lecture is very good, but something that had nothing to do with the lecture's main topic caught my intention. At [19:20](http://www.youtube.com/watch?v=IDNXZitcQng&t=19m20s), Adam explains that [word embeddings](https://www.wikiwand.com/en/Word_embedding) can be used to classify documents when no labeled training data is available. Note that word embeddings and word vectors are synonyms. The idea is to exploit the fact that document labels are often textual. For instance, the labels from the [Toxic Comment Classification Challenge](https://www.kaggle.com/c/jigsaw-toxic-comment-classification-challenge) are *toxic*, *severe toxic*, *obscene*, *threat*, *insult*, and *identity hate*. Because the labels are textual, they can be projected into an embedded vector space, just like the words from a document. Therefore, a document can be classified by looking at the distance from a document's centroid to each label. By centroid, I mean the column-wise average of the word embeddings that are extracted from the document. I think that an example will speak for itself.

Consider the following sentence:

> I brought some muffins to church, I baked them myself.

Assuming that we have some function that extracts important words from a sentence, these would be: *muffins*, *church*, and *baked*. Let's say that we want to assign one of three possible labels to the sentence: *cooking*, *religion*, and *architecture*. The first step is to embed the labels. This can be done by using pre-trained word vectors, such as those trained on Wikipedia using [fastText](https://fasttext.cc/), which you can find [here](https://fasttext.cc/docs/en/pretrained-vectors.html). Next, embed each word in the document. Then, compute the [centroid](https://www.wikiwand.com/en/Centroid) of the word embeddings. Finally, compute the distances from the centroid to each label vector and return the closest one. This particular sentence is assigned the "cooking" label because its centroid is mostly influenced by "baked" and "muffins", which are close to "cooking" in the embedded vector space.

<div align="center" >
  <figure style="width: 80%;">
    <img style="padding: 1em;" src="/img/blog/document-classification/viz.png" alt="viz">
    <figcaption>Made with <a href="https://excalidraw.com/">Excalidraw</a></figcaption>
  </figure>
</div>

I this that this is really cool and intuitive! I'm not very experienced in NLP, and so I'm not aware if this is common knowledge/practice. As far as I can tell, word embeddings are more often used as the first layer of a neural network architecture. In any case, as Adam says in his lecture, this is really useful for startups that don't have access to large corpuses of labeled training data. In fact, it turns out that I have a friend who is exactly in this kind of situation. She's working on a newsfeed project for her company. She doesn't have a lot of labeled training data and is thus looking into [active learning](https://www.wikiwand.com/en/Active_learning_(machine_learning)) and [semi-supervised learning](https://www.wikiwand.com/en/Semi-supervised_learning). These are both worthwhile directions to pursue, but I'm pretty sure that this word embedding method is a low-hanging fruit that should be checked out first. Because I'm a nice guy, I decided to code a prototype to help her out. I thought it would be cool to also share this on my blog in order to potentially get some feedback, so here goes.

As a case study, I'm going the BBC news dataset from the [*Practical Solutions to the Problem of Diagonal Dominance in Kernel Document Clustering*](http://mlg.ucd.ie/files/publications/greene06icml.pdf) paper by Derek Greene and Pádraig Cunningham. The raw text files can be downloaded from [this](http://mlg.ucd.ie/datasets/bbc.html) webpage. The documents are organized in directories, with each directory corresponding to one label. Once the data has been unzipped, it can be loaded in memory as so:

```py
import pathlib

docs = []
labels = []

directory = pathlib.Path('bbc')
label_names = ['business', 'entertainment', 'politics', 'sport', 'tech']

for label in label_names:
    for file in directory.joinpath(label).iterdir():
        labels.append(label)
        docs.append(file.read_text(encoding='unicode_escape'))
```

The first document is labeled as "business" and contains the following content:

```
>>> doc = docs[0]
>>> doc
UK economy facing 'major risks'

The UK manufacturing sector will continue to face "serious challenges" over the next two years, the British Chamber of Commerce (BCC) has said.

The group's quarterly survey of companies found exports had picked up in the last three months of 2004 to their best levels in eight years. The rise came despite exchange rates being cited as a major concern. However, the BCC found the whole UK economy still faced "major risks" and warned that growth is set to slow. It recently forecast economic growth will slow from more than 3% in 2004 to a little below 2.5% in both 2005 and 2006.

Manufacturers' domestic sales growth fell back slightly in the quarter, the survey of 5,196 firms found. Employment in manufacturing also fell and job expectations were at their lowest level for a year.

"Despite some positive news for the export sector, there are worrying signs for manufacturing," the BCC said. "These results reinforce our concern over the sector's persistent inability to sustain recovery." The outlook for the service sector was "uncertain" despite an increase in exports and orders over the quarter, the BCC noted.

The BCC found confidence increased in the quarter across both the manufacturing and service sectors although overall it failed to reach the levels at the start of 2004. The reduced threat of interest rate increases had contributed to improved confidence, it said. The Bank of England raised interest rates five times between November 2003 and August last year. But rates have been kept on hold since then amid signs of falling consumer confidence and a slowdown in output. "The pressure on costs and margins, the relentless increase in regulations, and the threat of higher taxes remain serious problems," BCC director general David Frost said. "While consumer spending is set to decelerate significantly over the next 12-18 months, it is unlikely that investment and exports will rise sufficiently strongly to pick up the slack."
```

The first step take is to clean the text. I wrote a simple function that does just that.

```py
import string

def clean_text(text):
    text = text.lower()
    text = text.translate(str.maketrans('', '', string.punctuation))
    text = text.replace('\n', ' ')
    text = ' '.join(text.split())  # remove multiple whitespaces
    return text
```

```py
>>> doc = clean_text(doc)
>>> print(doc)
uk economy facing major risks the uk manufacturing sector will continue to face serious challenges over the next two years the british chamber of commerce bcc has said the groups quarterly survey of companies found exports had picked up in the last three months of 2004 to their best levels in eight years the rise came despite exchange rates being cited as a major concern however the bcc found the whole uk economy still faced major risks and warned that growth is set to slow it recently forecast economic growth will slow from more than 3 in 2004 to a little below 25 in both 2005 and 2006 manufacturers domestic sales growth fell back slightly in the quarter the survey of 5196 firms found employment in manufacturing also fell and job expectations were at their lowest level for a year despite some positive news for the export sector there are worrying signs for manufacturing the bcc said these results reinforce our concern over the sectors persistent inability to sustain recovery the outlook for the service sector was uncertain despite an increase in exports and orders over the quarter the bcc noted the bcc found confidence increased in the quarter across both the manufacturing and service sectors although overall it failed to reach the levels at the start of 2004 the reduced threat of interest rate increases had contributed to improved confidence it said the bank of england raised interest rates five times between november 2003 and august last year but rates have been kept on hold since then amid signs of falling consumer confidence and a slowdown in output the pressure on costs and margins the relentless increase in regulations and the threat of higher taxes remain serious problems bcc director general david frost said while consumer spending is set to decelerate significantly over the next 1218 months it is unlikely that investment and exports will rise sufficiently strongly to pick up the slack
```

As you can, I've removed punctuation marks, removed unnecessary whitespace, got rid of carriage returns, and lowercased all the text. The one thing I haven't taken of are spelling mistakes. Indeed, if a word is misspelt, then we won't be able to match with a word vector. This dataset has supposedly been scrapped from the [BBC website](https://www.bbc.com/), and thus shouldn't contain too many typos. A quick win would be to apply [Peter Norvig's spelling corrector](https://norvig.com/spell-correct.html), but goes beyond the scope of this article.

I'm going to be using [spaCy](https://spacy.io/) for manipulating word embeddings. I've decided to use the `en_core_web_lg` embeddings, which can be downloaded as so:

```py
>>> python -m spacy download en_core_web_lg
```

Note that you could use any pre-trained word embeddings, including `en_core_web_sm` and `en_core_web_md`. Naturally, the performance of this method is going to be highly dependent on the quality of the word embeddings, as well as their adequacy with the dataset at hand. I'll get back to this point later on.

The word vectors can be opened with a one-liner:

```py
import spacy

nlp = spacy.load('en_core_web_lg')
```

I'm now going to define an `embed` function, which takes as input some tokens -- or words, if you prefer -- and outputs the centroid of their respective embeddings. I'm going to filter out tokens that are unknown, as well as [stop words](https://www.wikiwand.com/en/Stop_word) and those that only contain one character.

```py
import numpy as np

def embed(tokens, nlp):
    """Return the centroid of the embeddings for the given tokens.

    Out-of-vocabulary tokens are cast aside. Stop words are also
    discarded. An array of 0s is returned if none of the tokens
    are valid.

    """

    lexemes = (nlp.vocab[token] for token in tokens)

    vectors = np.asarray([
        lexeme.vector
        for lexeme in lexemes
        if lexeme.has_vector
        and not lexeme.is_stop
        and len(lexeme.text) > 1
    ])

    if len(vectors) > 0:
        centroid = vectors.mean(axis=0)
    else:
        width = nlp.meta['vectors']['width']  # typically 300
        centroid = np.zeros(width)

    return centroid
```

```py
>>> tokens = doc.split(' ')
>>> centroid = embed(tokens, nlp)

>>> centroid.shape
(300,)

>>> centroid[:10]
array([-0.25490612,  0.3020584 ,  0.06464471, -0.02984463, -0.00753056,
       -0.15310128,  0.00843642,  0.04468439,  0.02751189,  2.1646047 ],
      dtype=float32)
```

We're nearly done! The last piece of the puzzle is a mechanism to find the closest label for a given centroid. For this I decided to use the [`NearestNeighbors`](https://scikit-learn.org/stable/modules/generated/sklearn.neighbors.NearestNeighbors.html) class from scikit-learn. First, I extract the embeddings for each label, which can be done by reusing the `embed` function.

```py
from sklearn import neighbors

label_vectors = np.asarray([
    embed(label.split(' '), nlp)
    for label in label_names
])

neigh = neighbors.NearestNeighbors(n_neighbors=1)
neigh.fit(label_vectors)
```

Note that in our case each label is made up of one single word, thus `label.split(' ')` is equivalent to `[label]`. If you're in a situation where a label is made up of multiple words, then you'll want to split appropriately instead of treating it as a single word.

We can now classify our document like so:

```py
>>> closest_label = neigh.kneighbors([centroid], return_distance=False)[0, 0]
>>> label_names[closest_label]
'business'
```

Hurray! I think this is quite cool, considering that we didn't train any supervised model. But I've already said that. The question is now, how well does this perform? Well we can easily process each document with a list comprehension:

```py
def predict(doc, nlp, neigh):
    doc = clean_text(doc)
    tokens = doc.split(' ')[:50]
    centroid = embed(tokens, nlp)
    closest_label = neigh.kneighbors([centroid], return_distance=False)[0][0]
    return label_names[closest_label]

preds = [predict(doc, nlp, neigh) for doc in docs]
```

This runs in ~2 seconds on my laptop. We can now use scikit-learn's [`classification_report`](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.classification_report.html) to assess the performance of our method (I'm reluctant to call it a model):

```py
>>> from sklearn import metrics

>>> report = metrics.classification_report(
...     y_true=labels,
...     y_pred=preds,
...     labels=label_names
... )
>>> print(report)
               precision    recall  f1-score   support

     business       0.39      0.99      0.56       510
entertainment       0.82      0.52      0.63       386
     politics       0.90      0.41      0.56       417
        sport       0.94      0.77      0.84       511
         tech       0.52      0.10      0.16       401

     accuracy                           0.59      2225
    macro avg       0.71      0.56      0.55      2225
 weighted avg       0.71      0.59      0.57      2225
```

The performance is not excellent, but it is better than random. One thing I thought about is to use a different distance metric when looking for the closest label for each centroid. By default, the `NearestNeighbors` class uses the Euclidean distance, but nothing is stopping us from using something more exotic, such as cosine similarity:

```py
>>> from scipy import spatial

>>> neigh = neighbors.NearestNeighbors(
...     n_neighbors=1,
...     metric=spatial.distance.cosine
... )
>>> neigh.fit(label_vectors)

>>> preds = [predict(doc, nlp, neigh) for doc in docs]
>>> report = metrics.classification_report(
...     y_true=labels,
...     y_pred=preds,
...     labels=label_names
... )
>>> print(report)
               precision    recall  f1-score   support

     business       0.50      0.91      0.64       510
entertainment       0.76      0.69      0.72       386
     politics       0.70      0.74      0.72       417
        sport       0.93      0.85      0.89       511
         tech       0.85      0.05      0.10       401

     accuracy                           0.67      2225
    macro avg       0.75      0.65      0.62      2225
 weighted avg       0.74      0.67      0.63      2225
```

The overall performance went up a significant margin, even though we only changed the distance metric. There's obviously a lot of other things that could be improved. For instance, an interesting observation is that the performance for the "tech" label is very weak. This is pure speculation, but I assume that it's because the word embeddings that we're using were not trained on a lot of articles about technology.

If you think about it, we're attempting to classify news articles from the BBC website with word embeddings that were fitted on Wikipedia articles. It seems quite obvious that a big boost would come from using word embeddings that are trained on similar documents to those that we have. This could be done in a couple of ways, either by training a word embedding model from scratch on our documents, or by fine-tuning an existing set of embeddings.

I'm not an NLP expert, nor am I fond of it to be truthful, so I'm going to leave it at that. The point of this article was mostly to spark an idea and to nicely present it to my friend. If you have some input or have experience working with word embeddings in such a manner, then please leave a comment. If not, keep lurking.
