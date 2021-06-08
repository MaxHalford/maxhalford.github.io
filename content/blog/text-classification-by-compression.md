+++
date = "2021-06-08"
title = "Text classification by data compression"
+++

Last night I felt like reading [*Artificial Intelligence: A Modern Approach*](http://aima.cs.berkeley.edu/). I stumbled on something fun in the natural language processing chapter. The section I was reading dealt with classifying text. The idea of the particular subsection I was reading was to classify documents by using a [compression algorithm](https://www.wikiwand.com/en/Data_compression). This is such a left field idea, and yet it does make sense when you think about it. To quote the book:

> In effect, compression algorithms are creating a language model. The [LZW algorithm](https://www.wikiwand.com/en/Lempel%E2%80%93Ziv%E2%80%93Welch) in particular directly models a maximum-entropy probability distribution.

In other words, a compression algorithm has some knowledge of the distribution of words in a corpus. It can thus be used to classify documents. The learning algorithm is quite straightforward:

1. Take a labeled training set of documents.
2. Build a single document per label by concatenating the texts that belong to that label.
3. Compress each obtained document and measure the size of each result.

To classify a document, proceed as so:

1. Concatenate the document with the concatenated document of each label.
2. Compress each of these concatenations and measure the size.
3. Return the label for which the size increased the least.

The idea is that if a document is similar to the text of a particular label, they will share patterns that will get exploited by the compression algorithm. Ideally, the size increase of compressing the training texts with the new text should be correlated with the similarity between the text and the training texts. The smaller the increase, the more likely the label should be assigned.

I think this is an elegant idea. It's not sophisticated, and I don't expect it to perform better than a plain and simple logistic regression. Moreover, it's expensive because the training texts of each label have to be recompressed for each test document. Still, I find the idea intriguing and decided to implement it in Python.

Here I'll use the [newsgroup20 dataset](http://qwone.com/~jason/20Newsgroups/) from scikit-learn. I'm using the same four categories they use in their [user guide](https://scikit-learn.org/stable/datasets/real_world.html#converting-text-to-vectors) to have something to compare against.

```py
from sklearn.datasets import fetch_20newsgroups

categories = [
    'alt.atheism',
    'talk.religion.misc',
    'comp.graphics',
    'sci.space'
]

train = fetch_20newsgroups(
    subset='train',
    categories=categories
)
```

The first step is to concatenate the texts that belong to each of the four categories. I'm adding a space before each text so that the last word isn't glued with the first word of the next text.

```py
from collections import defaultdict

label_texts = defaultdict(str)

for i, text in enumerate(train['data']):
    label = train['target_names'][train['target'][i]]
    label_texts[label] += ' ' + text.lower()
```

The next step is to compress each of these big texts and measure the size of the compressed result. It's quite easy to do this in Python. Indeed, Python provides high-level functions that compress a sequence of bytes into a smaller sequence of bytes. The `len` method gives us the number of bytes in the sequence. I picked [`gzip`](https://docs.python.org/3/library/gzip.html) at random from the compression methods listed [here](https://docs.python.org/3/library/archiving.html). Each of these provides an easy-to-use [`compress`](https://docs.python.org/3/library/gzip.html#gzip.compress) method.

```py
import gzip

METHOD = gzip

original_sizes = {
    label: len(METHOD.compress(text.encode()))
    for label, text in label_texts.items()
}

print(original_sizes)
```

```py
{
    'comp.graphics': 252268,
    'talk.religion.misc': 224228,
    'sci.space': 310524,
    'alt.atheism': 266440
}
```

That's all there is to the training phase. The training texts have to be kept in memory because they have to be used for the prediction phase. Let's say we're given a list of unlabeled texts. The idea for each text is to concatenate it with each training text, compress the result, and then measure the size of the compressed result.

When that's done, we just need to compare the obtained sizes with the original and return the label for which the size increased the least. Note that there is no notion of probability. There might be some weird way to cook up some probabilities, but they wouldn't be [calibrated](https://scikit-learn.org/stable/modules/calibration.html).

```py
test = fetch_20newsgroups(subset='test', categories=categories)
predictions = []

for text in test['data']:

    sizes = {
        label: len(METHOD.compress(f'{label_text} {text.lower()}'.encode()))
        for label, label_text in label_texts.items()
    }

    predicted_label = min(
        sizes,
        key=lambda label: sizes[label] - original_sizes[label]
    )

    predictions.append(predicted_label)
```

So how well does this fair? Well, it takes over 5 minutes to run on my laptop for only 1,353 test cases. That's 0.2 seconds per document, which is rather slow! Here's the classification report:

```py
from sklearn.metrics import classification_report

test_labels = [
    test['target_names'][label]
    for label in test['target']
]

print(classification_report(
    test_labels,
    predictions,
    digits=3
))
```

```
                    precision    recall  f1-score   support

       alt.atheism      0.678     0.680     0.679       319
     comp.graphics      0.784     0.897     0.837       389
         sci.space      0.878     0.746     0.807       394
talk.religion.misc      0.609     0.614     0.611       251

          accuracy                          0.749      1353
         macro avg      0.737     0.734     0.733      1353
      weighted avg      0.754     0.749     0.749      1353
```

Is that good? No, not really. A multinomial Naive Bayes classifier achieves a macro F1-score of 0.88 with the same categories and train/test split. It's also dramatically faster. Is there anything we can do? We can try other compression algorithms. Here are the results for [`zlib`](https://docs.python.org/3/library/zlib.html), which was a bit faster and took just over 4 minutes to run:

```
                    precision    recall  f1-score   support

       alt.atheism      0.656     0.687     0.671       319
     comp.graphics      0.782     0.902     0.838       389
         sci.space      0.880     0.744     0.806       394
talk.religion.misc      0.612     0.578     0.594       251

          accuracy                          0.745      1353
         macro avg      0.732     0.728     0.727      1353
      weighted avg      0.749     0.745     0.744      1353
```

The performance with `zlib` seems to be worse than with `gzip`. What about [`bz2`](https://docs.python.org/3/library/bz2.html)?

```
                    precision    recall  f1-score   support

       alt.atheism      0.648     0.110     0.188       319
     comp.graphics      0.732     0.584     0.649       389
         sci.space      0.923     0.305     0.458       394
talk.religion.misc      0.271     0.928     0.420       251

          accuracy                          0.455      1353
         macro avg      0.644     0.482     0.429      1353
      weighted avg      0.682     0.455     0.442      1353
```

The performance is awful in comparison. Also, it took more than 7 minutes to run. Now how about [`lzma`](https://docs.python.org/3/library/lzma.html)?


```
                    precision    recall  f1-score   support

       alt.atheism      0.851     0.875     0.862       319
     comp.graphics      0.923     0.959     0.941       389
         sci.space      0.927     0.934     0.930       394
talk.religion.misc      0.866     0.773     0.817       251

          accuracy                          0.897      1353
         macro avg      0.892     0.885     0.888      1353
      weighted avg      0.897     0.897     0.896      1353
```

The performance is surprisingly good! But this comes at a cost: it took 32 minutes to complete, which is ~1.4 seconds per document. Still, it's very interesting to see this kind of result for an algorithm that wasn't at all designed to classify documents. Well, the `lzma` in fact implements the LZW algorithm that is mentioned in the *Artificial Intelligence: A Modern Approach* book, so it's less surprising that it does well!

There's probably some fine-tuning that could be done to improve this kind of approach. However, it would most probably not be worth using such an approach because of the prohibitive computational cost. This should simply be seen as an interesting example of thinking outside the box. It also goes to show that statistical modelling and information theory are very much intertwined.
