+++
date = "2021-07-14"
draft = true
title = "Spelling correction for OCR outputs"
toc = true
+++

## Motivation

I work at [Alan](https://alan.com/) on processing medical insurance documents automatically. Processing said documents is necessary in order to reimburse our users. Doing so manually is slow and expensive, hence the desire to automate the process. I [wrote](https://medium.com/alan/automated-document-processing-at-alan-918308234390) a Medium article about this.

If we're lucky, our users send us PDF files. We can use [PDFMiner](https://github.com/pdfminer/pdfminer.six) to extract their contents. Alas, users send us images taken from their phones in many cases. Therefore, we rely on commercial OCR tools such as [Google Cloud Vision](https://cloud.google.com/vision/docs/ocr) and [Amazon Textract](https://aws.amazon.com/fr/textract/). These tools are cheap, but are far from perfect. I would be ready to more money to get better results, but that isn't an option that is on offer.

I have already looked into [preprocessing](https://muthu.co/pre-processing-for-detecting-text-in-images/) the images I send to the OCRs. But it didn't yield any noticeable improvement. I think it makes sense to preprocess images when you're rolling your own OCR with a tool such as [Tesseract](https://github.com/tesseract-ocr/tesseract). But my impression is that Google and Amazon do these kinds of processing out of the box.

I came to the conclusion that I could improve our document processing pipeline by postprocessing the results from the commercial OCRs we use. I knew about Peter Norvig's [article](https://norvig.com/spell-correct.html) on spelling correction. The spelling corrector described in that article is intended to correct mistakes made by humans. I started to think about how I could adapt that logic to correct mistakes made by an OCR. Indeed, an OCR doesn't make the same kind of mistakes as a human.

## Spelling correction

I'm going to repeat Peter Norvig's mini-course on probability theory and discuss how it applies to OCR correction. Let's assume we want to correct a word $w$. That's already a big assumption, because splitting a bunch of text into words is not straightforward. I'll get back to that later. We do this by building a model $P(c \mid w)$ which tells us how likely it is for a candidate $c$ to be the correction of $w$ we're looking for. We pick the most likely candidate:

$$\underset{c\ \in\ candidates}{\operatorname{argmax}} P(c \mid w)$$

In theory the list of candidates is infinite. Of course, for practical reasons, computing $P(c \mid w)$ for every possible candidate is too expensive. We thus only want to consider a subset of likely candidates. In other words, there's no point testing the word `dinosaur` when attempting to correct the word `caokie`, but it is worth testing the word `cookie`. Therefore, you need a function that generates candidates $c$ for a given word $w$. Peter Norvig calls this a candidate model.

The design of the candidate model depends on what kind of correction you expect to see. Humans make human mistakes: they pick the wrong character because it's close on the keyboard, they intervert characters, they forget characters, they type characters twice, etc. The `candidates` function that Peter Norvig wrote is designed with these kind of mistakes in mind. However, OCRs make different kinds of mistakes. They typically don't intervet or forget characters. Usually, they pick the wrong character because some characters *look* the same -- for instance `0` looks like `O`, `S` looks like `5`, `nn` looks like `m`. OCR are also prone to adding unnecessary whitespace between characters because they don't recognise that the characters are part of the same word.

Peter Norvig breaks down $P(c \mid w)$ via [Bayes' theorem](https://www.wikiwand.com/en/Bayes%27_theorem):

$$\underset{c\ \in\ candidates}{\operatorname{argmax}} \frac{P(c) \times P(w \mid c)}{P(w)}$$

But $P(w)$ can omitted because it's the same for each candidate $c$, so this boils down to:

$$\underset{c\ \in\ candidates}{\operatorname{argmax}} P(c) \times P(w \mid c)$$

$P(c)$ is a language model. It tells you likely it is to encounter a word $c$. For example, it's very unlikely to encounter `caokie`, so a sane language model would say $P(caokie) = 0$. The language model learns the likelihood of a word by being shown sentences from a corpus. Each language model therefore has a [lexicon](https://www.wikiwand.com/en/Lexicon), which can be thought of as the list of unique words in the corpus. The consequence is that a language model assigns a nil probability to words it has never seen before. This isn't always desirable. One may use [Laplace smoothing](https://www.wikiwand.com/en/Additive_smoothing) to make this probability non-nil, but it would be still be pretty low.

Usually, the language model $P(c)$ works quite well. But it really depends on what kind of "words" you're trying to correct. I'm using quotes because we're not always looking to correct words. In fact, at Alan, I'm mostly interested into extracting pieces of text that are not words, such as dates, currency amounts, identifiers, etc. I prefer to call these pieces of text [tokens](https://www.wikiwand.com/en/Lexical_analysis#/Token) rather than words. I'll keep using $w$ to denote these tokens mathematically just to be coherent with Peter Norvig.

I've noticed that Google's and Amazon's OCRs make more mistakes for dates and currency amounts than for regular words. I haven't taken the time to quantify this but I'm quite confident it is the case. My suspicion is that their language model lexicon is too limited. In fact, it made me realise that I'm lucky to be working with the French language. Indeed, if you're working with a rarer language, then it's likely that the related language model is weaker. For instance, see [this article](https://arxiv.org/pdf/2011.03502.pdf) which discusses OCR post-correction for Finnish, as well as [this Master's degree](https://skemman.is/bitstream/1946/12085/1/Post-Correction%20of%20Icelandic%20OCR%20Text.pdf) by Jón Friðrik Daðason for Icelandic. The takeaway is that you need a language model is that tailored towards your language. In my case, the language is made up of "special" tokens such as dates and currency amounts, and therefore I have to build a bespoke language model.

$P(w \mid c)$ is an error model: it tells you likely it is to observe $w$ given that the correct token is $c$. Again, a good error model should take into account the context surrounding how the text was produced. For instance, for human input, a sophisticated error model would account for the user's keyboard layout -- people with AZERTY keyboards make different mistakes than people with QWERTY keyboards. Of course, that's a bit advanced, and a simpler error model might just measure an [edit distance](https://www.wikiwand.com/en/Edit_distance) between $w$ and $c$, which is what Peter Norvig did in his article.

A different kind of error model needs to be used for OCRs. Indeed, consider the token `IZI0212021`. It's actually a date: `17/02/2021`. The edit distance is 4 because there are four characters to modify. The edit distance to, say, `PZI0212021`, is only 1. And yet it's very unlikely that an `I` gets interpreted as a `P` by an OCR. The edit distance is not a good measure of the types of mistakes an OCR makes. Instead, we would like to build an error model that tells us that `17/02/2021` is more likely than `PZI0212021` when the token that is being corrected is `IZI0212021`.

Applying Bayes' rule is interesting because it melts $P(c \mid w)$ into two models that convey meaning. But that doesn't mean that we can't just build a model $P(c \mid w)$ that does the job. In fact, building such a discriminative model might be powerful and may be easier to manage. I'll discuss this later on.

## Tokenizing the OCR transcript

## Generating candidate corrections

Knowing what kind of mistakes to expect from an OCR is very useful. The naive approach is to assume that all kinds of mistakes are possible, and generate a huge list of candidate corrections. As you can imagine, this can quickly get expensive, and it might generate false positives. Another approach would be to compare OCR outputs to ground truth texts. We could compare the outputs to the ground truth and build a character confusion matrix. This approach seems to be fairly common, as you can see [here](https://arxiv.org/ftp/arxiv/papers/1604/1604.06225.pdf) and [here](https://aclanthology.org/W96-0108.pdf). I think this makes a lot of sense, but alas I haven't found a clean dataset that I can trust to do this. Another approach is to use heuristics that are OCR-agnostic. For instance, we could make the hypothesis that "nn" might get mistaken for "m", "K" for "R", "S" for "5", etc. This is quite well discussed in [this](https://www.zora.uzh.ch/id/eprint/54277/1/Volk_Furrer_Sennrich_2011.pdf) paper.

```py
[
    {'O', '0', 'o'},
    {'l', '1', '/'},
    {'/', '(', ')'},
    {'S', 's', '5'},
    {'7', 'Z'},
]
```

## Picking a correction

## Going unsupervised

So how exactly do we go about establishing this list? The pragmatic answer is that there's not so many characters in the latin alphabet, and there's only 10 digits, so we should be able to establish this list manually with a bit of brainpower. But that answer is boring, and it leaves room for omissions. In particular, we might succeed in building a thorough list for the English language -- or French in my case -- but what about more complex languages that may have more characters and which we might not be familiar with? For instance, check out [this](https://skemman.is/bitstream/1946/12085/1/Post-Correction%20of%20Icelandic%20OCR%20Text.pdf) Master's degree by Jón Friðrik Daðason which discusses OCR correction for Icelandic content.
