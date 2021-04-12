+++
date = "2021-04-11"
title = "Reducing the memory footprint of a scikit-learn text classifier"
toc = true
+++

## Context

This week at Alan I've been working on parsing [French medical prescriptions](https://www.wikiwand.com/fr/Ordonnance_(m%C3%A9decine)). There are three types of prescriptions: lenses, glasses, and pharmaceutical prescriptions. Different information needs to be extracted depending on the prescription type. Therefore, the first step is to classify the prescription. The prescriptions we receive are pictures taken by users with their phone. We run each image through an OCR to obtain a text transcription of the image. We can thus use the text transcription to classify the prescription.

I played around with writing some regex rules and reached a macro F1 score of 95%. Not bad, but not perfect. I wanted to reach 100% because it seemed to me like a simple classification task. That is, when I looked at some sample prescriptions, the type of the prescription was really obvious. I weighed the pros and cons of writing more complex regex patterns versus building a machine learning text classifier. I opted for the latter. I wrote a simple [scikit-learn pipeline](https://scikit-learn.org/stable/modules/compose.html) and tested it as so:

```py
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import Normalizer

model = make_pipeline(
    CountVectorizer(),
    Normalizer(),
    LogisticRegression()
)

train = prescriptions[:len(prescriptions) // 2]
test = prescriptions[len(prescriptions) // 2:]

model.fit(train['text'], train['type'])

y_pred = pd.DataFrame(
    model.predict_proba(test['text']),
    columns=model.classes_,
    index=test.index
)
y_pred.head()
```

|   prescription_id |   contact_lenses |   glasses |   pharmacy |
|------------------:|-----------------:|----------:|-----------:|
|            495866 |        0.984725  | 0.0115185 | 0.00375634 |
|            495838 |        0.041953  | 0.187964  | 0.770083   |
|            495838 |        0.041953  | 0.187964  | 0.770083   |
|            495825 |        0.0221103 | 0.966687  | 0.011203   |
|            495812 |        0.964409  | 0.0213663 | 0.0142247  |

Note: the `prescriptions` variable is a `pandas.DataFrame` containing the prescription text transcriptions along with the type (glasses, lenses, or pharmacy).

I decided to trust the classifier if the probability it assigned to a class was above `0.7`. If the classifier is unsure, the prescription type can't be determined, and it will be rejected or sent for manual processing. This rule provided the following classification report:

```py
from sklearn.metrics import classification_report

confident = y_pred.max(axis='columns') > .7
print(classification_report(
    test[confident]['type'],
    y_pred[confident].idxmax(axis='columns'),
    digits=3
))
```

```
                precision    recall  f1-score   support

contact_lenses      0.981     0.964     0.972       950
       glasses      0.991     0.986     0.989      2104
      pharmacy      0.987     0.999     0.993      2319

      accuracy                          0.988      5373
     macro avg      0.986     0.983     0.985      5373
  weighted avg      0.988     0.988     0.987      5373
```

The number of cases where the model is confident enough -- the recall in other words -- can be computed as so:

```py
print(f'Recall is {confident.sum() / len(confident):.2%}')
```

```
Recall is 90.24%
```

Good enough! I checked some false positive cases and all of them were mislabeled. Indeed, the training data I'm using are manual annotations made by our operators. Once in a while they make a mistake, which is totally acceptable and simply something we have to deal with. However, learning with noisy labels is another story that I don't discuss in this blog post. I do however recommend [this research article](https://arxiv.org/pdf/1911.00068.pdf) if you're interested.

I'm confident enough to put this model into production. At Alan we like to keep things simple. Our website is a [Flask](https://flask.palletsprojects.com/en/1.1.x/) app running on [Heroku](https://www.heroku.com/). We want to load this scikit-learn model in memory when the app boots up, and simply call it when a prescription has to be classified. If this pattern works for us, we might use it for other document classification tasks.

The model I trained weighs around 2.7 MB. That's over 8000 times [the amount of RAM](https://www.bbc.com/future/article/20190704-apollo-in-50-numbers-the-technology) in the first Apollo shuttle that went to the Moon. Obviously I'm saying this with my tongue in my cheek. And yet, I believe it's important to be frugal and not waste the memory of our precious [Heroku dynos](https://www.heroku.com/dynos). Especially if I want to convince the engineering team to use more machine learning models.

In a text classifier, the importance of each word follows a long-tail distribution. Most words are not important at all, which is the driving insight for [knowledge distillation](https://www.wikiwand.com/en/Knowledge_distillation). As we will see, this is very true for the above model. I decided to push the envelope and lighten the memory footprint of the model, while preserving its accuracy. Anyway, enough with the (long) introduction, here goes.

## Measuring the model's size

From experience, I have a good idea of the model's memory footprint layout. However, it's always good to confirm this by measuring the memory footprint of each part of the model. I wrote a little utility to do this for any scikit-learn pipeline:

```py
from humanize import naturalsize
from pickle import dumps

def obj_size(obj):
    return naturalsize(sys.getsizeof(dumps(obj)))

def estimator_size(model):
    return {
        attr: obj_size(getattr(model, attr))
        for attr in model.__dict__ if attr.endswith('_')
    }

for name, step in model.steps:
    print(name)
    for attr, size in estimator_size(step).items():
        print(f'\t{attr.ljust(20)} {size}')
    print()

print('Total'.ljust(20), ' ' * 7, obj_size(model))
```

```
countvectorizer
	fixed_vocabulary_    37 Bytes
	stop_words_          38 Bytes
	vocabulary_          980.8 kB

normalizer
	n_features_in_       50 Bytes

logisticregression
	n_features_in_       50 Bytes
	classes_             219 Bytes
	n_iter_              184 Bytes
	coef_                1.8 MB
	intercept_           204 Bytes

Total                        2.7 MB
```

The above table shows the memory footprint of each attribute for each step of the pipeline. I'm only looking at the attributes whose name ends with a `_` because that's the scikit-learn convention for marking attributes that have been created during the `fit` call. In other words, I'm ignoring hyperparameters that are provided during initialization, because their memory footprint is insignificant.

As we can see, most of the memory footprint is taken up by the logistic regression `coef_` attribute. The latter is a matrix which stores the $n \times k$ weights for each of the $n$ words and the $k$ classes. The second culprit is the count vectorizer's `vocabulary_` attribute, which assigns an index to each word. This allows determining the weight vector of each word because `coef_` is integer-indexed instead of being word-indexed. We can now confidently move on and reduce the memory footprint of these two attributes.

## Reducing the model's size

In a logistic regression, the importance of a feature is proportional to the magnitude of its weight vector. Therefore, unimportant features have a weight vector whose magnitude is close to 0. Intuitively, their contribution to the final sum is very small. In our case the features are the words in the text. By determining the unimportant words, we may reduce the model's memory by limiting the considered vocabulary.

First, let's measure the importance of each word. We can compute the feature-wise $L^2$ norm to measure the magnitude of each word's weight vector.

```py
from numpy import np

log_reg = model.steps[2][1]
W = log_reg.coef_
magnitudes = np.linalg.norm(W, ord=2, axis=0)
```

Now let's list the most important words by sorting their associated weight vector magnitudes.

```py
vectorizer = model.steps[0][1]
idx_to_word = {
    idx: word
    for word, idx in vectorizer.vocabulary_.items()
}

top = np.argsort(magnitudes)[::-1]

meaningful_vocab = [
    idx_to_word[k]
    for k in top[:100]
]
```

Here are the 10 most important words:

```
lentilles
monture
verres
lunettes
ophtalmologiste
50
oeil
ophtalmologie
25
gauche
```

Looks good to me! I'm not too sure what the 25 and 50 are doing there, but I guess they're indicative of drug dosage (e.g. "50 mg of paracetamol"), and are thus distinctive indicators of pharmaceutical prescriptions.

We can prune the model now that we know which words matter. I found that the easiest way to proceed is to specify a list of words to the `CountVectorizer`. Indeed, the latter has a `vocabulary` parameter which overrides the lists of words that are used in the model. By default, all the words in the training set are used.

```py
pruned_model = make_pipeline(
    CountVectorizer(
        vocabulary=meaningful_vocab
    ),
    Normalizer(),
    LogisticRegression()
)

pruned_model.fit(train['text'], train['text'])
```

Let's first check the pruned model's performance.

```py
y_pred_pruned = pd.DataFrame(
    pruned_model.predict_proba(test['text']),
    columns=pruned_model.classes_,
    index=test.index
)

confident = y_pred_pruned.max(axis='columns') > .7
print(classification_report(
    test[confident]['type'],
    y_pred_pruned[confident].idxmax(axis='columns'),
    digits=3
))
```

```
                precision    recall  f1-score   support

contact_lenses      0.976     0.963     0.970      1068
       glasses      0.988     0.985     0.986      2170
      pharmacy      0.991     0.999     0.995      2324

      accuracy                          0.987      5562
     macro avg      0.985     0.982     0.984      5562
  weighted avg      0.987     0.987     0.987      5562
```

```py
print(f'Recall is {confident.sum() / len(confident):.2%}')
```

```
Recall is 93.42%
```

The performance is (slightly) better! The intention of this pruning process was not to improve the model, but it did. That's the magic of regularization for you. Indeed, the pruning process we've applied boils down to [sparsity regularisation](https://www.wikiwand.com/en/Regularization_(mathematics)#/Regularizers_for_sparsity).

Let's now see the memory footprint of the pruned model.

```py
for name, step in model.steps:
    print(name)
    for attr, size in estimator_size(step).items():
        print(f'\t{attr.ljust(20)} {size}')
    print()

print('Total'.ljust(20), ' ' * 7, obj_size(model))
```

```
countvectorizer
	fixed_vocabulary_    37 Bytes
	vocabulary_          1.1 kB

normalizer
	n_features_in_       38 Bytes

logisticregression
	n_features_in_       38 Bytes
	classes_             219 Bytes
	n_iter_              184 Bytes
	coef_                2.6 kB
	intercept_           204 Bytes

Total                        5.0 kB
```

We've reduced the model's memory consumption by a whopping factor of ~545. We've done this without impacting the memory's accuracy. It's a free win! Note that you could push the envelope even further by reducing the precision of the coefficient matrix to 32 bits instead of 64 bits, but the savings would be marginal.
