+++
date = "2022-03-06"
title = "OCR spelling correction is hard"
+++

I recently saw [SymSpell](https://news.ycombinator.com/item?id=30576435) pop up on Hackernews. It claims to be a million times faster than [Peter Norvig's spelling corrector](https://norvig.com/spell-correct.html). I think it's great that there's a fast open source solution for spelling correction. But in my experience, the most challenging aspect of spelling correction is not necessarily speed.

When I [worked at Alan](/blog/one-year-at-alan), I mostly wrote logic to extract structured information from medical documents. After some months working on the topic, I have to admit I hadn't cracked the problem. The goal was to process >80% of documents with no human interaction, but when I left we had only reached 35%. However, I developed a good understanding of what made this task so difficult.

First, it's worth thinking about why spelling correction is necessary in the context of OCRs. OCRs are used to convert images to text. The OCR identifies characters along with their positions in the image. It packs nearby characters into words that make sense. Usually one would write parsers, such as regex rules, to extract structured information. These parsers are sensitive to typos. OCRs make mistakes, that's a given. A good OCR usually has some kind of post-processing mechanism to correct characters, so that the words they belong to make sense. But this is not foolproof. Alas, good OCRs are often commercial, so we don't know how they work in detail. Moreover, we have no control over the post-processing mechanism. We have to implement our own post-processing logic if we want to correct the OCR's outputs.

Spelling correctors are usually based on a lexicon of words. They start by splitting a sentence into words -- sometimes they support $n$-grams. Each word is edited by inserting, deleting, substituting, and sometimes transposing characters. Many variations are generated for a given word. Only the words that are part of the lexicon are kept, while the others are cast aside. At last, they use a probabilistic model to decide which correction is the most likely. This is essentially how every [noisy channel model](https://www.wikiwand.com/en/Noisy_channel_model) functions.

There are a few issues which make vanilla spelling correctors unsuitable for post-processing OCR outputs. First of all, a typical document processing task is to extract specific entities, such as dates, currency amounts, and identifiers. These kind of entities are not part of the lexicons which spelling correctors are usually trained on. For instance, Peter Norvig uses words from comprehensive English sources, such as Project Gutenberg, Wiktionary, and the British National Corpus. The issue is that if I'm looking to extract a currency amount, say "70.58€", then the spelling corrector won't be of any use, because that token is not part of the spelling corrector's lexicon. In my experience, I noticed that OCRs make more errors on such "non-word" entities, thereby confirming that their spelling correction step is limited by their lexicon.

I noticed in practice that Google's and Amazon's OCRs make more mistakes for dates and currency amounts than for regular words. I haven't taken the time to quantify this but I'm quite confident it is the case. It made me realise that I was lucky to be working with the French language. Indeed, if you're working with a rarer language, then it's likely that the OCR's spelling corrector is weaker, due to the lack of comprehensive lexicons. For instance, see [this article](https://arxiv.org/pdf/2011.03502.pdf) which discusses OCR post-correction for Finnish, as well as [this Master's degree](https://skemman.is/bitstream/1946/12085/1/Post-Correction%20of%20Icelandic%20OCR%20Text.pdf) by Jón Friðrik Daðason for Icelandic. The takeaway is that you need a language model which is tailored towards your target language. In my case, my target language was made up of dates and currency amounts. Therefore, I have to build a bespoke language model.

In theory, it's possible to circumvent this lexicon issue by augmenting it with all the entities we might be looking for. Indeed, in the case of dates, there are only so many of them we can expect to see in a document, even if we consider different date formats. For instance, if I were looking for the date a patient went to see a doctor, then I would assume that it's likely going to be a date in the last three months. The downside here is that this isn't a very generic approach, and a specific lexicon has to be specified for every field we're looking to extract.

There's another issue with vanilla spelling correctors. The number of candidates they consider grows exponentially with the number of allowed edits. This limits spelling correctors to consider candidates up to three, sometimes four edits. Anything above that is too computationally prohibitive. The trick is that OCRs make different kind of mistakes than humans do. They can make mistakes with a high number of edits, but these edits are often substitutions or inserted blank spaces. Moreover, substituted characters are usually morphologically similar to the correct character.

Consider the token `IZIo212O21`. It's actually a date: `17/02/2021`. The edit distance is 6 because there are six characters to modify:

```
IZIo212O21
1
1ZIo212O21
 7
17Io212O21
  /
17/o212O21
   0
17/0212O21
     /
17/02/2O21
       0
17/02/2021
```

The edit distance to, say, `PZIo212O21`, is only 1. And yet it's very unlikely that an `I` gets interpreted as a `P` by an OCR, so it's not really worth taking the time to consider that correction. It would be more efficient to only consider likely candidates. That way, we could consider candidates which are further away in terms of number of edits, but are actually likely. Indeed, `IZIo212O21` and `17/02/2021` are not that different morphologically speaking. The characters look the same. The OCR just had a hard time making the different between similar characters, such as `o/0` and `Z/7`. The OCR's postprocessor didn't manage to recognize `IZIo212O21` is a date, because dates are not part of its lexicon, and there are too many edits to consider.

I would go as far as suggesting that the same kind of pruning logic could be applied to user input correction. For instance, on a QWERTY keyboard, there's not much sense in considering if a Q was inverted with an M, because both keys are very distant on the keyboard. It's more worthwhile to consider candidates which contain more characters edits, but which are more closer in terms of keyboard layout distance. I wrote a little [proof of concept](https://github.com/MaxHalford/clavier) in Python to do just that. But anyway, the concern of this blog post are OCR outputs, not user inputs.

I hope this blog post does a solid job of shedding some light on why OCR post-processing is so hard. In particular, I want to emphasize that out-of-the-box spelling correctors don't work well enough on this task. My gut feeling is that a whole other approach is necessary to reach very good results. As of now, I haven't seen anything suitable in the open source world. I have however been inspired by a few papers:

- [A Statistical Approach to Automatic OCR Error Correction in Context](https://aclanthology.org/W96-0108.pdf)
- [Japanese OCR Error Correction using Character Shape Similarity and Statistical Language Model](https://aclanthology.org/P98-2152.pdf)
- [Migrating a Privacy-Safe Information Extraction System to a Software 2.0 Design](http://cidrdb.org/cidr2020/papers/p31-sheng-cidr20.pdf)
- [Alleviating Digitization Errors in Named Entity Recognition for Historical Documents](https://aclanthology.org/2020.conll-1.35.pdf)

I did some research in various directions when I had spare time at Alan. But now I don't work there, so I have less incentive to work on this. However, I am compiling my ideas into a piece of software called [orc](https://github.com/MaxHalford/orc). Admittedly, I'm moving forward at a turtle's pace, but I will eventually get somewhere. Furthermore, I'm keen to bounce ideas off someone, so feel free to get in touch if this topic is of interest to you.
