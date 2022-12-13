+++
date = "2015-09-10"
draft = false
title = "The Naïve Bayes classifier"
tags = ['machine-learning']
+++

The objective of a classifier is to decide to which *class* (also called *label*) to assign an observation based on observed data. In *supervised learning*, this is done by taking into account previous classifications. In other words if we *know* that certain observations are classified in a certain way, the goal is to determine the class of a new observation. The first group of observations on which the classifier is built is called the *training set*.

In mathematical terms say $X$ is a list of attributes for each one of a group of $n$ observations. In the training set, each observation $X_i$ has a label $Y_i$ associated to it. The question is which $Y$ to associate to a new $X_i$?

The Naïve Bayes method is a probabilistic approach. It assigns a probability to each label $Y_i$ based on the training set. The best guess is the label with the highest probability.

## The mathematics

The general idea is to know $P\_F(C)$ where $C$ is a discrete class/label and $F$ is a list of *features*. For example if the class was an author and the features were words in a text the conditional probability $P\_F(C)$ could be read as

>"What is the probability that a text is written by author $C$ given that words $F$ are in the text?"

Good question. This is where the "Bayes" in the title comes from [Bayes' theorem](https://www.wikiwand.com/en/Bayes'_theorem) gives

$$P\_F(C\_j) = \frac{P(C\_j) \times P\_{C\_j}(F)}{P(F)}$$

- $P(C\_j)$ is called the *prior*. It is the probability we are looking for *before* the data is being considered. In philosophy the prior is the state of the knowledge on a subject before an experience is performed.
- $P\_{C\_j}(F)$ is the frequency at which $F$ appeared for $C\_j$. This is the observed data in the training set.
- $P(F)$ represents the support $F$ provides for $C$.

In a sense Bayes' theorem is a "magic" formula which gives the probability of having A (for example an author) based on the fact that we already B (for example some words). It does because we already know at what frequency B appears when A does. In other words, if the word "Quiditch" appears in a sentence, you have a good chance that the sentence belongs to a Harry Potter book because *you already know* that it frequently appears in Harry Potter books.

If we calculate $P\_F(C\_j)$ for every $j$ then we can sort them based on their value and choose one of them. This is called a *decision rule*. Not surprisingly the most common decision rule is to take the highest probability, this is called *maximum a posteriori* (MAP).

Now for calculating $P\_F(C\_j)$:

- $P(C\_j)$ is simply the frequency of the $C\_j$ class.
- $P(F)$ doesn't depend on $C$ and so it doesn't have to be calculated. Indeed $P(F)$ is the same for every $C$ and won't affect the order of all the $P\_F(C\_j)$.
- $P\_{C\_j}(F)$ is the only (slighly) tricky probability to compute.

$P\_{C\_j}(F)$ is the probability of having a list of features in a text. For the sake of simplicity we can suppose that the occurrences of features are independent from each other (this is why the classifier is considered "Naïve"). Of course this is false, indeed text often use semantic fields. However it has been shown that the classifier does well even if the assumption seems foolish. Because the events are independent the mathematics become very convenient. Indeed if there are $p$ features in a text the probability that a document belongs to a class can now be written down as

$$P\_{C\_j}(F) = \prod\_{k=1}^p P\_{C\_j}(f\_k) = \prod\_{k=1}^p \frac{P(C\_j \cap f\_k)}{P(C\_j)}$$

It's important to understand that this isn't true if the features occurrences are not considered independent. For example, the events $A$ "It's raining" and $B$ "It's cold" are not independent. In a probabilistic sense, the event $P(A \cap B)$ ("It's cold and rainy") is *not* equal to $P(A) \times P(B)$. This is because most of the time one implies the other. In our case it's mathematically convenient to consider the independence of events, that's all.

## Python implementation

If you want to run the code that will come up yourself, you can simply copy/paste it all into your text editor, it will work out of the box. However you will have to download the pandas module in order to read a CSV dataframe.

I like using classes, you really can make most of [object-oriented programming](https://www.wikiwand.com/en/Object-oriented_programming) for creating tidy packages. In this case there are two classes.

- A ``Counter`` class for parsing the texts and estimating the probabilities.
- A ``NaiveBayes`` class for predicting the class of new texts which inherits from ``Counter``.

The main advantage of having a ``Counter`` class is that it can be reused for different classifiers. In machine learning in general it's a good idea to split feature extraction and prediction. This is the first thing to code.


```python
class Counter:

    def __init__(self, dataframe, features, textCol, classCol):
        '''
        Extract the features of a dataframe's column and classify
        them according to another dataframe's column.
        '''
        # Keep the same feature extraction function
        self.featureFunction = features
        # Counts of features in a particular class
        self.features = {}
        # Counts of class occurences
        self.classifications = {}
        # Classify the dataframe
        dataframe.apply(self.classify, axis=1,
                        args=(textCol, classCol,))
```

The ``Counter`` class takes 4 arguments. The first is a dataframe which should contain a column for the texts (3rd argument) and a column for the classes (4th argument). The ``features`` argument is a function that extracts the desired features from a text; it can be anything as long as it returns an iterable (list, set, array). For example one could extract [stemmed](https://www.wikiwand.com/en/Word_stem) and/or lower cased words. We will get to that later on. In order to compute the probabilities described above we have to count the features and class occurences, the best way to do this is to use dictionaries. The last line parses all the dataframe with the following procedure.


```python
    def classify(self, row, textCol, classCol):
        '''
        Classify a dataframe row based on a text column and a class
        column and a feature function.
        '''
        # Extract the category of the row
        classification = row[classCol]
        # Initialize the category count if it doesn't exist yet
        self.classifications.setdefault(classification, 0)
        # Increment the count for the category
        self.classifications[classification] += 1
        # Transform the text column into an iterable of features
        for feature in self.featureFunction(row[textCol]):
            # Initialize the feature count if doesn't exist yet
            self.features.setdefault(feature, {})
            # Initialize the feature's category count
            self.features[feature].setdefault(classification, 0)
            # Increment the feature's category count
            self.features[feature][classification] += 1
```

The procedure takes a row as argument and analyses the text and class column. If the class has already appeared then it's count is incremented, else it begins at 1. The same goes for every feature extracted from the text. The ``features`` dictionary has two levels of depth, one for the feature and one for the class. With this implementation it's very easy to get the occurences of a feature in a text of a specific category: ``features[f][c]``.

Now that the texts have been parsed the features we need a function that returns $P\_{C\_j}(f\_k)$ in order to compute $P\_{C\_j}(F)$.


```python
    def probability(self, classification, feature):
        '''
        Calculate the probability that a feature belongs to a
        certain class, ie. P(classification | feature).
        '''
        # Count of classification occurence of a feature
        if feature not in self.features:
            return 1
        else:
            if classification in self.features[feature]:
                count = self.features[feature][classification]
            else:
                count = 1
        # Total count of classification occurences
        total = self.classifications[classification]
        # Compute ratio (will be lower then 1 and higher then 0)
        return count / total
```

A problem that I haven't mentioned is how to deal with features that haven't been encountered/classified in previous texts when doing a prediction. Intuitively an unencountered feature should bias our the decision rule towards a specific class. Because $P\_{C\_j}(F)$ is the result of a product, multiplying it by $1$ won't affect it ($1$ is the *identity element* for the multiplication of real numbers).

The same kind of problem arises as to what probability to assign if a feature has been encountered but not for a certain class. In some sense this should be something *low*. But it shouldn't be 0, because then $P\_{C\_j}(F)$ would be equal to 0 and that is too harsh. However it's also reasonable to return $1$ after the ``else``, which is equivalent to ignoring the feature (but not ignoring the fact that it was never associated with that class!).

Either the feature has already been associated with a class and we can calculate the ``count / total`` ratio, which is the number of times a feature has been associated with a class over the number of occurences of a class. In other words this is the frequency of the association between a feature and a class ($\frac{P(C\_j \cap f\_k)}{P(C\_j)})$. In the other case the ratio is ``1 / total``, which is very pessimistic.

Now we can code the ``NaiveBayes`` class, the one that will be used for prediction.


```python
class NaiveBayes(Counter):

    def predictSentence(self, sentence):
        ''' Classify one sentence based on it's features. '''
        likelihoods = {}
        # For each possible classification
        for classification in self.classifications.keys():
            # Compute P(classification)
            likelihoods[classification] = self.classifications + \
            [classification] / + sum(self.classifications.values())
            # Multiply iy by the product of each P(F_i)
            for feature in self.featureFunction(sentence):
                likelihoods[classification] *= self.probability + \
                (classification, feature)
        return max(likelihoods, key=likelihoods.get)

    def predict(self, df, textCol):
        ''' Classify a test dataframe and return a series object. '''
        classifications = df[textCol].apply(self.predictSentence)
        return classifications
```


```python
import re

def words(sentence, threshold=2):
    '''
    Obtain an iterable of words from a sentence. Lowercase the words.
    '''
    splitter = re.compile('\\W+')
    # Concatenate the lines into a big string
    words = (word for word in splitter.split(sentence))
    # Lower case
    words = (word.lower() for word in words)
    # Done!
    return words
```

The first function classifies a sentence. The outer ``for`` loops over all the possible classes. Lines ``9`` and ``10`` compute $P\_{C\_j}$. The inner ``for`` loops iterates over all the features in order to compute $P\_{C\_j}(F)$. Finally the class that has the highest probability is returned. The second function applies the first function to a dataframe.

The only piece of the puzzle missing is a feature function. Basically, if we have a sentence, we want to be able to transform it into a vector of features (which can be words, prefixes, stems, ...) in order to compute individual probabilities for each feature. A very simple approach is to split a sentence on it's white spaces and to put the words to lowercase.

Choosing a good feature function is crucial for the performance of a classifier, some people argue that it is even more important than the choice of the classifier.

The following piece of code puts all the pieces together.


```python
import pandas as pd
df = pd.read_csv('www.maxhalford.com/data/datasets/authors.csv',
                 delimiter='\t')
bayes = NaiveBayes(dataframe=df, features=words,
                   textCol='Sentence', classCol='Author')
print(bayes.predict(df, 'Sentence'))
```
