+++
date = "2022-04-04"
title = "Fuzzy regex matching in Python"
toc = true
tags = ['text-processing']
+++

## Fuzzy string matching in a nutshell

Say we're looking for a pattern in a blob of text. If you know the text has no typos, then determining whether it contains a pattern is trivial. In Python you can use the `in` function. You can also write a regex pattern with the `re` module from the standard library. But what about if the text contains typos? For instance, this might be the case with user inputs on a website, or with OCR outputs. This is a much harder problem.

[Fuzzy string matching](https://www.wikiwand.com/en/Approximate_string_matching) is a cool technique to find patterns in noisy text. In Python there used to be a ubiquitous library called [`fuzzywuzzy`](https://github.com/seatgeek/fuzzywuzzy). It got renamed to [`thefuzz`](https://github.com/seatgeek/thefuzz/blob/master/thefuzz). Then [`RapidFuzz`](https://github.com/maxbachmann/RapidFuzz) became the latest kid on the block. Here's an example using the latter:

```py
from rapidfuzz import fuzz
fuzz.ratio("I had a sandwich", "I had a sand witch")
```

```py
96.2962962962963
```

These libraries are often used to determine string similarity. This can be very useful for higher level tasks, such as record linkage, which I wrote about in [a previous post](/blog/transitive-duplicates/). For instance, fuzzy string matching is the cornerstone of the [Splink](https://github.com/moj-analytical-services/splink) project from the British Ministry of Justice. Also, I fondly remember doing fuzzy string matching at HelloFresh to find duplicate accounts by comparing postal addresses, names, email addresses, etc.

But fuzzy string matching isn't just about measuring similarities between strings. It also allows locating a pattern in a blob of noisy text. Sadly, popular fuzzy matching libraries don't seem to focus on this aspect. They only allow to measure string similarities.

I've [been doing](/blog/ocr-spelling-correction-is-hard/) a bunch of OCR postprocessing in the past year. For this task, it's very useful to be able to do fuzzy string matching. Indeed, I have this idea of a supervised system for extracting entities -- such as dates and currency amounts -- from noisy OCR outputs. But for that I have to actually locate search patterns in noisy text, and not just calculate their similarity scores against a bunch of text.

## The `regex` Python library

I got lucky and stumbled over [an excellent Python library daringly called `regex`](https://github.com/mrabarnett/mrab-regex). It has a lot of quality of life features that haven't made it into Python standard library. It truly is a goldmine. Personally, I often find myself using [`capturesdict`](https://github.com/mrabarnett/mrab-regex#added-capturesdict-hg-issue-86).

In particular, the `regex` library [offers support](https://github.com/mrabarnett/mrab-regex#approximate-fuzzy-matching-hg-issue-12-hg-issue-41-hg-issue-109) for fuzzy regex matching. For instance, if you write a date pattern, then fuzzy regex matching allows you to look for matches that allow for mistakes. In other words, the pattern doesn't have to exactly match with the text.

Let's do an example. Say we have a named regex pattern that looks for dates:

```py
pattern = r'(?P<YYYY>20\d{2})-(?P<MM>\d{1,2})-(?P<DD>\d{1,2})'
```

Here's a search example with an exact match using Python's `re` module:

```py
import re

text = 'I went to the doctor on 2022-03-16.'
match = re.search(pattern, text)
match.groupdict()
```

```py
{'YYYY': '2022', 'MM': '03', 'DD': '16'}
```

This won't work if the date contains a typo. Meanwhile, the `regex` library allows augmenting the search pattern by allowing for a maximum number of mistakes. For instance, let's allow for three mistakes.

```py
import regex

fuzzy_pattern = f'({pattern}){{e<=3}}'
text = 'I went to the doctor on 7022-O3-I6.'

match = regex.search(fuzzy_pattern, text, regex.BESTMATCH)
match.groupdict()
```

```py
{'YYYY': '7022', 'MM': 'O3', 'DD': 'I6'}
```

It works! I found that not using the `regex.BESTMATCH` flag produces unintuitive results, so I always have it on.

The `regex` library also tells you how many mistakes there were:

```py
match.fuzzy_counts
```

```py
(3, 0, 0)
```

The format of `fuzzy_counts` is `(n_substitutions, n_insertions, n_deletes)`. Note that transpositions are not supported, which is too bad.

The `fuzzy_changes` attributes tell you where the mistakes occurred:

```py
match.fuzzy_changes
```

```py
([24, 29, 32], [], [])
```

These locations are relative to the text that was searched.

## Human friendly interface

That's all and well, but I find this interface too raw to work with. I would like some kind of representation which tells me which characters got deleted, inserted, and substituted. I know I can deduce this from the `fuzzy_changes` attribute, but there's still some lifting to do. In particular, it gets a bit tricky when you have to handle deletions and insertions, which mess with the indexing. I'll spare you the details.

As I mentioned at the end of [my last post](/blog/ocr-spelling-correction-is-hard/), I'm working on a piece of software for doing OCR post-processing. It's called [orc](https://github.com/MaxHalford/orc). As of now, I have only scratched the surface of what I want to do. However, I did implement a friendlier interface to fuzzy regex matching. Here's an example:

<details>
  <summary>🐍 <code>orc.py</code> 👹</summary>

```py
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

import regex


class Edit(ABC):
    @abstractmethod
    def do(self, s: str) -> str:
        ...


@dataclass
class Substitution(Edit):
    at: int
    old: str
    new: str

    def do(self, s: str) -> str:
        return s[: self.at] + self.new + s[self.at + 1 :]


@dataclass
class Insertion(Edit):
    at: int
    new: str

    def do(self, s: str) -> str:
        return s[: self.at] + self.new + s[self.at :]


@dataclass
class Deletion(Edit):
    old: str
    at: int

    def do(self, s: str) -> str:
        return s[: self.at] + s[self.at + 1 :]


@dataclass
class Edits(Edit):
    substitutions: list[Substitution] = field(default_factory=list)
    insertions: list[Insertion] = field(default_factory=list)
    deletions: list[Deletion] = field(default_factory=list)

    def __post_init__(self):
        self.insertions = sorted(self.insertions, key=lambda x: x.at)
        self.deletions = sorted(self.deletions, key=lambda x: x.at, reverse=True)

    @property
    def __len__(self):
        return len(self.substitutions) + len(self.insertions) + len(self.deletions)

    def __iter__(self):
        yield from self.substitutions
        yield from self.insertions
        yield from self.deletions

    def do(self, s: str):
        for edit in self:
            s = edit.do(s)
        return s

    def __neg__(self):
        return Edits(
            substitutions=[
                Substitution(
                    at=s.at
                    + sum(1 for i in self.insertions if i.at < s.at)
                    - sum(1 for d in self.deletions if d.at < s.at),
                    old=s.new,
                    new=s.old,
                )
                for s in self.substitutions
            ],
            insertions=[Insertion(at=d.at, new=d.old) for d in self.deletions],
            deletions=[Deletion(at=i.at, old=i.new) for i in self.insertions],
        )

    @classmethod
    def from_regex(cls, match: regex.Match, specimen: str):
        return cls(
            substitutions=[
                Substitution(
                    at=at - match.start(),
                    old=match.group()[at - match.start()],
                    new=specimen[
                        at
                        - match.start()
                        - sum(1 for x in match.fuzzy_changes[1] if x < at)
                        + sum(1 for x in match.fuzzy_changes[2] if x < at)
                    ],
                )
                for at in match.fuzzy_changes[0]
            ],
            insertions=[
                Insertion(
                    at=at - match.start(),
                    new=specimen[
                        at
                        - match.start()
                        - sum(1 for x in match.fuzzy_changes[1] if x < at)
                    ],
                )
                for at in match.fuzzy_changes[2]
            ],
            deletions=[
                Deletion(
                    at=at
                    - match.start()
                    + sum(1 for x in match.fuzzy_changes[2] if x < at),
                    old=match.group()[at - match.start()],
                )
                for at in match.fuzzy_changes[1]
            ],
        )


@dataclass
class NearMatch:
    specimen: str
    candidate: str
    edits: Edits

    @classmethod
    def from_regex(cls, match: regex.Match, specimen: str):
        return cls(
            specimen=specimen,
            candidate=match.group(),
            edits=Edits.from_regex(match, specimen),
        )

    def __repr__(self):
        candidate = self.candidate
        s = f"{candidate}\n"
        for edit in self.edits:
            s += " " * edit.at + edit.__class__.__name__[0] + "\n"
            candidate = edit.do(candidate)
            s += f"{candidate}\n"
        return s.rstrip()
```

</details>

```py
import orc
import regex

text = 'I went to see Dr. House. The date was 2021-2-04. It cost 60 euros.'
specimen = '2020-02-05'
pattern = specimen.replace('-', r'\-')
fuzzy_pattern = f'({pattern})' + '{s<=3,i<=3,d<=3}'

match = regex.search(fuzzy_pattern, text, regex.BESTMATCH)
near_match = orc.NearMatch.from_regex(match, specimen)

print(near_match)
```

```
2021-2-04
   S
2020-2-04
        S
2020-2-05
     I
2020-02-05
```

The `near_match` object is built from the fuzzy regex match. It has a pretty `__repr__` method, which is the output you see above. It stores a straightforward list of edits:

```py
for edit in near_match.edits:
    print(edit)
```

```py
Substitution(at=3, new='0')
Substitution(at=8, new='5')
Insertion(at=5, new='0')
```

There's also a `.do` method which applies the edits to a string:

```py
near_match.edits.do(match.group())
```

```
2020-02-05
```

I also wrote the logic to invert a bunch of edits. Meaning that you can build edits that go from `B` to `A` if you have the edits that allow going from `A` to `B`. I did this by overloading Python's `__neg__` method, which allows doing the following:

```py
(-near_match.edits).do('2020-02-05')
```

```
2021-2-04
```

I think this API is much more fun to work with. It's going to allow me to do a bunch of things. For instance, once I've compiled a list of edits for many search patterns, I'll be able to build a confusion matrix which tells me how likely it is for two characters to be confused with each other.

The orc project is likely to change. But you can always check out the code I used for this blog post in [this commit](https://github.com/MaxHalford/orc/commit/5d8ea845ca4825e581c457accdf66d59edfbb1f1). In particular, you can check out [this notebook](https://github.com/MaxHalford/orc/blob/5d8ea845ca4825e581c457accdf66d59edfbb1f1/wikipedia.ipynb) which unit tests the fuzzy matching logic against the [Wikipedia common misspellings dataset](https://en.wikipedia.org/wiki/Wikipedia:Lists_of_common_misspellings).
