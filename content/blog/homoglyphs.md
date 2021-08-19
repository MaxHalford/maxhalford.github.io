+++
date = "2021-08-19"
title = "Homoglyphs: different characters that look identical"
toc = true
+++

## A wild homoglyph appears

For instance, can you tell if there's a difference between `H` and `Η`? How about `N` and `Ν`? These characters may seem identical, but they are actually different. You can try this out for yourself in Python:

```py
>>> 'H' == 'Η'
False

>>> 'N' == 'Ν'
False
```

Indeed, these all represent different Unicode characters:

```py
>>> ord('H'), ord('Η')
(72, 919)

>>> ord('N'), ord('Ν')
(78, 925)
```

`Η` in fact represents the capital [Eta](https://www.wikiwand.com/en/Eta) letter, while `Ν` is a capital [Nu](https://www.wikiwand.com/en/Nu_(letter)). In fact, entering `H` or `Η` in Google will produce different results. The same goes for `N` and `Ν`.

These pairs of seemingly identical characters are called [homoglyphs](https://www.wikiwand.com/en/Homoglyph). I encountered them when working with [PDFMiner](https://github.com/pdfminer/pdfminer.six). I didn't understand at first why one of my regex patterns was not matching a given piece of text. Before losing my sanity, I compared each character in the regex to each character in the text one by one. I then realized that two visually identical characters didn't necessarily represent the same thing.

I believe homoglyphs are quite a niche topic. In my experience, OCR tools like [Amazon Textract](https://aws.amazon.com/fr/textract/) behave well and produce sane outputs. And yet, it's important to know homoglyphs exist if you're looking to correct OCR outputs. The main purpose of this blog post is simply to spread the word on homoglyphs. As a data scientist, I had never heard of them before getting bitten by them in my day job. I had to Google "letters that look the same but are not the same" to learn that this was a thing. Homoglyphs are probably common knowledge if you have a decent background in software engineering. But not everyone is that lucky!

I thought it would be interesting to write a script that searches for all possible homoglyphs for a given typeface. But before we get into that, let me try to summarise some typography terminology.

## Some typography terminology

- **Typeface** — that's what most people usually mean when they say font. It's the name of a style, such as Helvetica, Times New Roman, or Comic Sans. I've also seen these being called "font families".

<div align="center" >
<figure style="width: 50%;">
    <img src="/img/blog/character-similarity-ocr-correction/miller-specimen.png">
    <figcaption>The Miller typeface — specimens such as above are commonly used to display typefaces.</figcaption>
</figure>
</div>

- **Font** — it's the materialization of a typeface. A font is essentially a (typeface, weight, size) triplet. For instance, one could say "I'm using Helvetica (font) bold (weight) 12pt (size) as my font".

<div align="center" >
<figure style="width: 70%;">
    <img style="padding: 5%" src="/img/blog/character-similarity-ocr-correction/miller-fonts.png">
    <figcaption>Each variation of the Miller typeface is a distinct font.</figcaption>
</figure>
</div>

- **Character** — it's the smallest building block of a piece of numeric text. `$`, `!`, `a`, `A`, `à` `1` are all characters. **Letters** are specific characters that belong to an alphabet.

- **Glyph** — I'm going to quote [Python's Unicode documentation](https://docs.python.org/3/howto/unicode.html) here:

    > A character is represented on a screen or on paper by a set of graphical elements that’s called a glyph. The glyph for an uppercase A, for example, is two diagonal strokes and a horizontal stroke, though the exact details will depend on the font being used.

Broadly speaking, a character is materialized in a font by a glyph. To be precise, I would say that each character is represented with a glyph for a given typeface, not a font. I would be surprised if fonts from the same typeface represented the same character with different glyphs. Anyway, I'm nitpicking.

Importantly, the same glyph can be used to represent different characters. For instance, the same glyph is used to represent the characters "H" and "Η". But that's true because of the typeface I'm using in my text editor, which is Microsoft's [Cascadia Code](https://github.com/microsoft/cascadia-code).

## Bitmap font comparison

I would like some way to tell if two characters are represented with the same glyph in a given font. There are essentially two different kinds of [computer fonts](https://www.wikiwand.com/en/Computer_font). There are vectorized fonts, where the glyphs are described geometrically using [Bézier curves](https://www.wikiwand.com/en/B%C3%A9zier_curve) or stroke information. The great advantage is that they can scale to any size. However, I don't see a straightforward way to compare glyphs that are described mathematically. There are also [bitmap fonts](https://www.wikiwand.com/en/Computer_font#/Bitmap_fonts), which represent each glyph as a matrix of pixels, usually stored as a [bitmap](https://www.wikiwand.com/en/Bitmap) -- hence the name. The pixels might be [binary](https://www.wikiwand.com/en/Binary_image) or take on [grayscale](https://www.wikiwand.com/en/Grayscale) values.

Manipulating the pixel representations of glyphs is quite straightforward. For instance, check out [this](https://observablehq.com/@bmschmidt/umap-clustering-of-unicode-characters-from-pixel-values) amazing [UMAP clustering](https://github.com/PAIR-code/umap-js) of Unicode characters from their pixel values. Nowadays, most fonts are expressed in vectorised formats, such as [TrueType](https://www.wikiwand.com/en/TrueType) -- i.e. `.ttf` files. But a vectorized font can be converted to a bitmap font through a process called [rasterisation](https://www.wikiwand.com/en/Font_rasterization).

I decided to use [Pillow](https://pillow.readthedocs.io/en/stable/) to do the rasterisation. Here is a function that does the job:

```py
from PIL import Image
from PIL import ImageFont
from PIL import ImageDraw

def draw_char(char: str, typeface: str, size: int) -> Image:
    font = ImageFont.truetype(f'{typeface}.ttf', size)
    img = Image.new('L', (size, size))
    draw = ImageDraw.Draw(img)
    draw.text((0, 0), char, 255, font=font)
    return img
```

The function returns a `PIL.Image`. This is a [grayscale](https://www.wikiwand.com/en/Grayscale) image. To determine if two characters are identical, we can render both characters and compare them. We first need to convert them to `numpy.ndarray`s to make them comparable. Let's write a little function for this:

```py
import numpy as np

def render(char: str, typeface='Helvetica', size=10) -> np.ndarray:
    img = draw_char(char, typeface=typeface, size=size)
    return np.asarray(img)
```

Now let's compare `H` with `Η`:

```py
>>> (render('H') == render('Η')).all()
False
```

Oups, I would have expected both arrays to be equal. Let's take a look at them:

```py
>>> render('H')
array([[ 56, 196,   0,   0,   0, 128, 124,   0,   0,   0],
       [ 56, 196,   0,   0,   0, 128, 124,   0,   0,   0],
       [ 56, 196,   0,   0,   0, 128, 124,   0,   0,   0],
       [ 56, 246, 216, 216, 216, 236, 124,   0,   0,   0],
       [ 56, 196,   0,   0,   0, 128, 124,   0,   0,   0],
       [ 56, 196,   0,   0,   0, 128, 124,   0,   0,   0],
       [ 56, 196,   0,   0,   0, 128, 124,   0,   0,   0],
       [ 56, 196,   0,   0,   0, 128, 124,   0,   0,   0],
       [  0,   0,   0,   0,   0,   0,   0,   0,   0,   0],
       [  0,   0,   0,   0,   0,   0,   0,   0,   0,   0]], dtype=uint8)

>>> render('Η')
array([[ 36, 212,   0,   0,   0, 152,  92,   0,   0,   0],
       [ 36, 212,   0,   0,   0, 152,  92,   0,   0,   0],
       [ 36, 212,   0,   0,   0, 152,  92,   0,   0,   0],
       [ 36, 249, 216, 216, 216, 239,  92,   0,   0,   0],
       [ 36, 212,   0,   0,   0, 152,  92,   0,   0,   0],
       [ 36, 212,   0,   0,   0, 152,  92,   0,   0,   0],
       [ 36, 212,   0,   0,   0, 152,  92,   0,   0,   0],
       [ 36, 212,   0,   0,   0, 152,  92,   0,   0,   0],
       [  0,   0,   0,   0,   0,   0,   0,   0,   0,   0],
       [  0,   0,   0,   0,   0,   0,   0,   0,   0,   0]], dtype=uint8)
```

The starting point of each drawing is at the top-left. We could put some effort in and make it so that the drawings are centered. But that shouldn't impact the comparison, so there's no point doing it. We can see that the same pixels are "activated", but that they contain the same grayscale values. We can solve this by converting each grayscale representation to a bitmap of 0s and 1s. To each the comparison across many characters, I think it also makes sense to concatenate the bitmap into a string.

```py
def encode_char(char, typeface='Helvetica', size=10):
    img = draw_char(char, typeface=typeface, size=size)
    grayscale = np.asarray(img)
    bitmap = (grayscale > 0).astype('uint8')
    return ''.join(map(str, (bit for row in bitmap for bit in row)))
```

```py
>>> encode_char('H')
'1100011000110001100011000110001111111000110001100011000110001100011000110001100000000000000000000000'

>>> encode_char('Η')
'1100011000110001100011000110001111111000110001100011000110001100011000110001100000000000000000000000'

>>> 'H' == 'Η'
False

>>> encode_char('H') == encode_char('Η')
True
```

## Searching for homoglyphs

We now have an `encode_char` function that allows us to tell if two characters are represented with the same glyph for a given font. Now we just have to compare all characters with each other and compare their encodings. Ok, but what do we mean by "all characters"? Depending on your use case, you might already have a list of characters for which you want to find homoglyphs. Meanwhile, you might not be aware of what homoglyphs you're prone to encounter, so considering a wide range of characters seems appropriate.

Let's talk a bit about [Unicode](https://www.wikiwand.com/en/Unicode). The short story is that it's a standard that lists and organises many characters. The latest stable version of Unicode, which is version 13, defines 143,859 characters. There are different ways to segment these characters into groups. For instance, there are [Unicode blocks](https://www.wikiwand.com/en/Unicode_block), such as [Basic Latin](https://www.wikiwand.com/en/Basic_Latin_(Unicode_block)) and [Latin-1 Supplement](https://www.wikiwand.com/en/Latin-1_Supplement_(Unicode_block)). There are also [scripts](https://www.wikiwand.com/en/Script_(Unicode)), which regroup characters that belong to a same [writing system](https://www.wikiwand.com/en/Writing_system). For example, the documents I'm looking at come from western countries that use the [Latin writing system](https://www.wikiwand.com/en/Latin_script), to which corresponds the [Latin Unicode script](https://www.wikiwand.com/en/Latin_script_in_Unicode). I find that the Unicode nomenclature is a tad complex. But then again, it's powerful because it organises all the different languages and symbols that exist.

Python has a `chr` function which returns the ith Unicode character:

```py
>>> ?chr
Signature: chr(i, /)
Docstring: Return a Unicode string of one character with ordinal i; 0 <= i <= 0x10ffff.
Type:      builtin_function_or_method
```

I encoded all the characters and stored them in a `pandas.DataFrame`. I decided to render each character on a 20 by 20 grid purely heuristically.

```py
import pandas as pd
from tqdm import tqdm

# Meta: I like walrus operators 🤟
char_codes = pd.DataFrame(
    {
        'char': (char := chr(i)),
        'code': (code := encode_char(char, size=20)),
        'n_bits': sum(bit == '1' for bit in code)
    }
    for i in tqdm(range(0x10ffff))
)
```

```
100%|██████████| 1114111/1114111 [09:37<00:00, 1929.22it/s]
```

That's a lot of characters. It's more than the 143,859 characters in the latest Unicode standard. The [Unicode FAQ](https://unicode.org/faq/basic_q.html) gives some pointers as to why this is the case. The answer is a bit complicated.

Anyway, now that each character has been encoded, I can group the characters with the same encodings together. I'm going to ignore the characters that render all black.

```py
groups = (
    char_codes
    .query('n_bits > 0')
    .groupby('code')['char']
    .apply(list)
)
```

After the `groupby`, I need to filter out the groups that contain a single element, because those are the characters without any homoglyphs. I'm also removing very large homoglyph groups because they're probably bogus.

```py
homoglyph_groups = groups[1 < groups.apply(len) < 10_000]
```

Let's see how many groups of homoglyphs there are.

```py
>>> len(homoglyph_groups)
136
```

We can take a look at some groups at random:

```py
>>> for group in homoglyph_groups.sample(10):
...     print(' '.join(group))
Ὦ ᾮ
Ɂ ʔ
Ń Ǹ
Ḷ Ḹ
W Ŵ Ẁ Ẃ Ẅ Ẇ
ώ ώ
t ẗ
Ⅵ Ⅶ Ⅷ
Ơ Ớ Ờ Ỡ
ḷ ḹ Ị
```

So what if we want to determine the homoglyphs for a given character? We can do that by creating a `dict` that maps each character to its homoglyphs.

```py
from collections import defaultdict
from itertools import permutations

homoglyphs = defaultdict(set)
for group in homoglyph_groups:
    for a, b in permutations(group, 2):
        homoglyphs[a].add(b)
```

```py
>>> homoglyphs('D')
Ⅾ Ḋ Ď

>>> homoglyphs('H')
Ḣ Н Ḧ

>>> homoglyphs('N')
Ñ Ṅ

>>> homoglyphs('O')
Ô Ó Ǒ Ò Ṍ Ṑ Ő Ȫ Ȍ Ȯ Ŏ Ö Ȱ Ố Ồ Õ Ō Ṓ Ổ
```

What's interesting is that these characters actually look different, at least on my laptop. That's probably because some details have been smoothed out during the rasterisation phase due to the grid being too small. Increasing the grid size would remove some of these false positives, at the cost of a higher compute time. Then again, omitting these details might be desirable. It all depends on your definition of homoglyphs and your use case.

## Seeing further: confusable characters

I think it's pretty cool to:

1. Be aware that homoglyphs are a thing.
2. Have a way to determine the homoglyphs of a given character.

I became interested in homoglyphs because of my initial interest in what I call "approximate homoglyphs". When I work with OCR outputs, it's often the case that a `0` gets interpreted as an `O`. These are different characters that look similar but are not rendered identically. I've even seen an `O` get interpreted as a `.`, presumably because the human being who wrote the document had a small handwriting. Having a list of approximate homoglyphs for a given character would be useful for [spelling correction](https://norvig.com/spell-correct.html). Of course, I can build this list by hand, and that's what I've been doing at my day job. But it would be nice to have an automated procedure to do so.

I've stumbled on [this paper](https://eprints.whiterose.ac.uk/112665/1/paper_247v2.pdf) which discusses how homoglyph detection can be used to uncover plagiarism. The paper mentions a [dataset](https://util.unicode.org/UnicodeJsps/confusables.jsp) of confusable characters that the Unicode consortium has compiled. There's even some libraries out there that expose this dataset in a friendly manner, such as [this one for Ruby](https://github.com/janlelis/unicode-confusable) and [this one for Python](https://github.com/woodgern/confusables). I've also found some superb documentation [here](https://websec.github.io/unicode-security-guide/visual-spoofing/) and [here](http://www.unicode.org/reports/tr39/#Confusable_Detection). I'll look into all this and report back at some point.

*Meta: I don't think I would have written this blog post if I had first found out about the term "confusable characters". This is not the first time this thing has happened to me: I get very curious about a topic, and I dig by myself into the topic because I can't find anything online. Then, I learn about the correct terminology, and realize that someone has already worked on the topic. The only moat keeping me from accessing this knowledge in the first place is the knowledge of the correct terminology. It never ceases to amaze me how knowing how things are called gives you a lot of power. I first became aware of this principle thanks to Patrick Winston: he calls this [The Rumpelstiltskin Principle](https://alum.mit.edu/slice/rumpelstiltskin-principle).*
