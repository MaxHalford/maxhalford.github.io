+++
date = "2021-11-11"
title = "Web scraping, upside down"
tags = ['web-scraping']
+++

## Motivation

Web scraping is the art of extracting information from web pages. A web page is essentially an amalgamation of HTML tags. Usually, we're looking for a particular piece of information on a given web page. This may be done by fetching the HTML content of the page in question, and then running some HTML parsing logic. It's quite straightforward.

There are many tools in the wild to perform web scraping. For instance, in Python, you may use [requests](https://docs.python-requests.org/en/latest/) in combination with [Beautiful Soup](https://www.crummy.com/software/BeautifulSoup/bs4/doc/). You can also automate some of the more mundane aspects of scraping by using [Scrapy](https://scrapy.org/).

There's one thing with the way scraping is usually performed that makes me uncomfortable: it's **procedural**. Once you have the HTML tags at your disposal, rather than specifying *what* you want, you typically specify *how* to obtain what you want. The parsing logic you write will usually break if the structure and/or the style of the web page has changed the next time you scrape the page. In other words, procedural web scraping is quite brittle, at least in my eyes. In my experience, it's usually possible to write a better web scraper by taking a **declarative** approach.

## Procedural scraping

Let me illustrate with an example. When I was younger, I played a fair bit of World of Warcraft. But I still follow it from a distance. Recently, I stumbled on [Classic Hardcore](https://classichc.net/). It's a difficult variant of the game, whereby if your character dies, you have to start all over again. It's quite funny to look at [people's reactions](https://classichc.net/wow-classic-hardcore-death-clips-8/) when they die by mistake, after having poured hours into the game. Anyway, they have a [Hall of Legends](https://classichc.net/hall-of-legends/), which is a leaderboard of the players that have completed the challenge. I wanted to know what were the least and most popular classes used by players who had completed the challenged. But I couldn't find any statistics derived from the leaderboard.

If you [inspect the source](view-source:https://classichc.net/hall-of-legends/) of that page, you'll see that the leaderboard is an [HTML table](https://www.w3schools.com/html/html_tables.asp), the contents of which are located in a series of `<td>` tags. The classes used by each player are indicated by `<img>` icons. The name of the class can be determined from the image's source. For instance, the following URL corresponds to the Rogue class:

```
https://classichc.net/wp-content/uploads/2020/08/Rogue-64x64.png
```

It's quite straightforward to count the number of times a class was used by procedurally scraping the page. First, we have to obtain the HTML content of the page, and then parse it with Beautiful Soup.

```py
from bs4 import BeautifulSoup
import requests

url = 'https://classichc.net/hall-of-legends/'

content = requests.get(url).content.decode()
soup = BeautifulSoup(content)
```

Beautiful Soup makes the actual extraction logic a piece of cake. By looking at the contents of the table, I can see that the class icons are stored in a `<td>` tag. This tag has a `'column-3'` CSS class. We just have to loop over all the tags and filter them accordingly with the `find_all` method. For each `<img>`, we extract the `src` and determine the class name from it.

```py
from collections import Counter

classes = Counter()

for td in soup.find_all(name='td', attrs={'class': 'column-3'}):
    for img in td.find_all(name='img'):
        # e.g. https://classichc.net/wp-content/uploads/2020/08/Rogue-64x64.png
        src = img.get('src')
        # e.g. Rogue-64x64.png
        path = src.split('/')[-1]
        # e.g. Rogue
        class_name = path.split('-')[0].title()
        classes.update({class_name})

for class_name, count in classes.most_common():
    print(f'{class_name:>7} {count}')
```

```
 Hunter 24
   Mage 18
Warrior 15
  Rogue 14
  Druid 10
 Priest 10
Warlock 9
Paladin 7
 Shaman 6
```

The fact that hunters are the most common class doesn't surprise me. It's probably easier to achieve with them because they're a ranged class and have a pet that can hold aggro. But isn't that also the case for warlocks? Anyway, that discussion isn't the topic of this blog post 😅

The above parsing logic is procedural because we indicate how to access the class names. They're part of a URL, which is in a `src` attribute, the latter which belongs to an `<img>` tag, who's parent is a `<td>` that has a `'column-3'` CSS class. All that sounds very specific. The issue is that the parsing logic would break if the web page would come to evolve, be it in terms of layout or in terms of style. For instance, maybe the CSS class name will change.

Of course, it's completely overkill to have the evolution of a webpage in mind when writing some parsing logic. Especially for such a toy use case. It works as intended, and sometimes that's all that matters. However, for some situations, being robust to page changes is a must-have. For instance, in the world of e-commerce, it's quite usual for a company to scrape data from a competitor to inform their pricing strategy. Therefore, some e-commerce companies voluntarily change their page layouts and styles on a regular basis to throw off web scrapers. One might call this adversarial frontend engineering!

## Declarative scraping

As I said above, another way to do web scraping is to write the parsing logic in a declarative fashion. Instead of indicating where the information is, we can use an example, and attempt to generalize from it. Let's take another look at the URL I provided above:

```
https://classichc.net/wp-content/uploads/2020/08/Rogue-64x64.png
```

What matters in this URL is that it contains the word `Rogue`. That's what makes it important to us. It's very easy to find an `<img>` which contains the word `Rogue` with Beautiful Soup:

```py
import re

img = soup.find('img', attrs={'src': re.compile(r'Rogue')})
print(img)
```

```html
<img alt="" class="alignnone size-us_64_64_crop wp-image-980" height="32" src="https://classichc.net/wp-content/uploads/2020/08/Rogue-64x64.png" width="32"/>
```

We could assume that class icons are located in the same places in the HTML tree. Indeed, the parent of the above `<img>` is a `<td>`:

```py
print(img.parent)
```

```html
<td class="column-3">...</td>
```

There is an opportunity here to generalize. First, we find the HTML tag which corresponds to our example. In this case, it's an `<img>` where the `src` matches with the `r'Rogue'` regex pattern. Then, we inspect the parent, and take a look at its attributes. We then look for all the tags which look like this parent tag. Each child tag of the thus obtained parents should correspond to a class icon image. Here is a possible implementation:

```py
def generalize(soup, tag_name, **attrs):
    tag = soup.find(tag_name, attrs=attrs)
    for parent in soup.find_all(tag.parent.name, attrs=tag.parent.attrs):
        yield from parent.find_all(tag_name)

classes = Counter()

for img in generalize(soup, 'img', src=re.compile('Rogue')):
    src = img.get('src')
    path = src.split('/')[-1]
    class_name = path.split('-')[0].title()
    classes.update({class_name})

for class_name, count in classes.most_common():
    print(f'{class_name:>7} {count}')
```

```
 Hunter 24
   Mage 18
Warrior 15
  Rogue 14
  Druid 10
 Priest 10
Warlock 9
Paladin 7
 Shaman 6
```

The results are strictly the same. However, this logic makes no assumption on the location of the `src` attributes we're interested in. We just provide an example, and generalize from it. This logic should still hold if the layout of the table were to change. Naturally, the logic is not invulnerable. We're still making an assumption on the structure of the `src` which contains the class name. But you get the idea.

I -- [and others](https://bxroberts.org/files/autoscrape.pdf) -- think this is a powerful way to do web scraping. It makes the scraper more robust to page changes. In fact, the idea of using a declarative approach rather than a procedural one goes beyond the world of web scraping. It's the main reason why the SQL language has been going on strong for decades: it allows users to indicate *what* they want, and not *how* to get there. The nitty-gritty details are handled by the system. A declarative language thus creates a layer of abstraction that allows the client to ignore the physical details of the data they're working with.

Of course, the declarative vs. procedural debate is a well-known one. I just haven't seen the declarative approach being used much for scraping/parsing. Here are a few projects I did find:

- [autoscraper](https://github.com/alirezamika/autoscraper), which is very similar to what I've discussed in this article.
- [grex](https://github.com/pemistahl/grex), which infers a regex pattern from examples. It's based on the theory of [deterministic finite automata](https://www.wikiwand.com/en/Deterministic_finite_automaton) learning (DFAL).
- [dateinfer](https://github.com/jeffreystarr/dateinfer), which infers a date pattern from examples.

Thanks for reading the article, I hope you enjoyed it ツ
