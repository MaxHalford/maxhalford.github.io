+++
date = "2022-09-25"
title = "Dynamic on-screen TV keyboards"
toc = true
+++

## On-screen TV keyboards

I've recently been spending time at my brother's place. We usually eat in front of TV. I've thus found myself typing stuff on the Netflix/Amazon/Plex TV apps. The typing happens through a remote controller, which is slower than typing with ones fingers. However, the TV apps usually suggest the correct show/movie after five or six keystrokes, so it's not that bad.

Typing stuff via an on-screen TV keyboard with a remote controller isn't something one does very often. It's likely pointless to try optimizing this process. And yet, I felt compelled to explore more efficient keyboard layouts.

In particular, I immediatly wondered why these keyboards didn't reorganise their layout dynamically based on the current input. I did some research, and stumbled on [this](https://ediblecode.com/blog/tv-keyboards/) article comparing different TV keyboards back in 2017. The article mentions a Samsung TV that suggests the four most likely next characters:

<div align="center">
<figure >
    <img src="/img/blog/dynamic-on-screen-keyboards/samsung-tv.png" style="box-shadow: none;">
    <figcaption><i><a href="https://www.youtube.com/watch?v=9PPlan7lVzc">Source (Youtube)</a></i></figcaption>
</figure>
</div>

I decided to work on a more general prototype, and to implement my own algorithm. I had [some experience](https://github.com/MaxHalford/clavier) measuring keyboard efficiency, so I was confident it would be straightforward to measure the performance gain of a dynamic keyboard. But first, I wrote a little something in Vue.js to simulate a TV keyboard:

<script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>

</br>
{{< rawhtml >}}

<div id="regular" style="display: flex; flex-direction: column;">

    <div style="display: flex; flex-direction: row;">

        <div class="grid-container">
            <button
                class="grid-item"
                v-for="key in keys"
                @click="click(key.r, key.c, charAtIndex(key.ranking))"
                :disabled="charAtIndex(key.ranking) === undefined"
                :style="key.r == r & key.c == c ? {'border-color': 'red', 'border-width': '2px', 'position': 'relative'} : {}"
            >
                [[ charAtIndex(key.ranking) ]]
            </button>
        </div>

        <div style="display: flex; flex-direction: column; margin-left: 20px; justify-content: center;">

            <h2 style="margin: 5px">✍️ — '[[ input ]]'</h2>
            <h2 style="margin: 5px">📐 — [[ distances.reduce((sum, x) => sum + x, 0) ]]</h2>

            <button
                @click="cancel()"
                :disabled="input.length === 0"
                style="margin: 5px; margin-top: 10px; width: 120px;"
            >
                Delete
            </button>

        </div>

    </div>

    <div style="display: flex; flex-direction: row; margin-top: 20px;">
        <button @click="write('the last dance')">The Last Dance</button>
        <button @click="write('house of cards')" style="margin-left: 12px;">House of Cards</button>
        <button @click="write('peaky blinders')" style="margin-left: 12px;">Peaky Blinders</button>
    </div>
</div>

<script>
  const { createApp } = Vue

  createApp({
    delimiters: ["[[", "]]"],
    data() {
        return {
            cols: 6,
            rows: 7,
            distances: [],
            keysPressed: [],
            characters: 'abcdefghijklmnopqrstuvwxyz1234567890 '
        }
    },
    computed: {
        keys() {
            // Returns a list of coordinates, along with the ranking of the key with respect to the
            // last pressed key. That allows determining what will be the new character for that
            // key in the next iteration.
            let keys = []
            let ranking = 0
            for (r = 0; r < this.rows; r++) {
                for (c = 0; c < this.cols; c++) {
                    keys.push({
                        r,
                        c,
                        ranking
                    })
                    ranking += 1
                }
            }
            return keys
        },
        input() {
            return this.keysPressed.map(x => x.char).join('')
        },
        r() {
            return this.keysPressed[this.keysPressed.length - 1]?.r || 0
        },
        c() {
            return this.keysPressed[this.keysPressed.length - 1]?.c || 0
        }
    },
    methods: {
        click(r, c, char) {
            this.distances.push(Math.abs(r - this.r) + Math.abs(c - this.c))
            this.keysPressed.push({r, c, char})
        },
        charAtIndex(index) {
            return this.characters[index]
        },
        cancel() {
            this.keysPressed.pop()
            this.distances.pop()
        },
        write(sentence) {
            while (this.input.length > 0) {
                this.cancel()
            }
            sentence.split('').forEach(char => {
                let key = this.keys.find(x => this.charAtIndex(x.ranking) === char)
                this.click(key.r, key.c, char)
            })
        }
    }
  }).mount('#regular')
</script>

<style>
.grid-container {
  display: inline-grid;
  grid-template-columns: auto auto auto auto auto auto;
}

.grid-item {
  border: 1px solid;
  width: 36px;
  height: 36px;
  font-size: 21px;
  text-align: center;
  margin-top: -1px;
  margin-left: -1px;
  cursor: pointer;
}
</style>
{{< /rawhtml >}}
</br>

This keyboard lacks realism in that you can point-and-click on it, as opposed to navigating with directional arrows. I'm also only considering the Latin alphabet and numbers. I'd also like to mention I'm going to ignore torus keyboards which wrap-around the edges, because they don't seem common. Anyway, this keyboard has the merit of being interactive, and it can be used to measure the travel distance of an input.

What I call travel distance is the amount of necessary ⬆️⬇️⬅️➡️ movements to input a sentence. Note that the first position is always the top-left corner. My goal in this article is to design a dynamic keyboard which minimizes this distance. I'll be benchmarking it against a static keyboard with a list of Netflix titles, which I found [here](https://raw.githubusercontent.com/andrewhood125/netflix-search-cli/master/movieList.txt).

*Note: the source code for each keyboard is embedded into this page's source code.*

## A dynamic layout algorithm

### Distance between keys

The basic idea is that when you press a key, you want the keyboard to be layed out in such a manner that the next likely characters are close by. A static keyboard organised in alphabetical order is not optimal in that sense. It doesn't take into account the frequency of juxtaposed characters. Other static keyboards take this into account, such as the QWERTY and AZERTY layouts. However, the latter were designed for physical keyboards, where the layout can't change dynamically. We can do whatever we want with a virtual keyboard.

For an on-screen TV keyboard, it makes sense to measure the distance between keys with a [taxicab geometry](https://www.wikiwand.com/en/Taxicab_geometry). Indeed, one can only go ⬆️⬇️⬅️➡️ with a remote controller. The following grid is interactive, and indicates a key's distance with respect to the last key that was pressed:

</br>
{{< rawhtml >}}
<div id="distance" align="center">
    <div class="grid-container">
        <button class="grid-item" v-for="key in keys" @click="click(key[0], key[1])">
            [[ key[2] ]]
        </button>
    </div>
</div>

<script>
  createApp({
    delimiters: ["[[", "]]"],
    data() {
        return {
            cols: 6,
            rows: 6,
            c: 0,
            r: 0
        }
    },
    computed: {
        keys() {
            let keys = []
            for (i = 0; i < this.rows; i++) {
                for (j = 0; j < this.cols; j++) {
                    keys.push([i, j, Math.abs(i - this.r) + Math.abs(j - this.c)])
                }
            }
            return keys
        }
    },
    methods: {
        click(i, j) {
            this.r = i
            this.c = j
        }
    }
  }).mount('#distance')
</script>
{{< /rawhtml >}}
</br>

Now let's assume we have some method to determine the most likely next keys following one keypress. We can use more or less sophisticated probability models to do this. I'll get back to that afterwards. Anyway, assuming we can order keys by some measure of likelihood, in what order should we lay them out on the keyboard?

### Ordering keys around the previous keypress

We know the distance of each key with respect to the last keypress, so we can use said distance to determine the order. The only thing to clarify is the handling of keys that have the same distance. I cooked up a heuristic: keys closest to the keyboard's center should be used in priority. The reasoning is that you want keypresses to occur away from the edges and corners, because those spots have less keys available around them.

The following interactive grid shows what this ordering algorithm looks like. The adjacent keys to the last keypress are prioritized. The distance to the center is used as a tiebreaker. Note that for a keyboard with an uneven number of columns and/or rows, the column and/or row numbers should be used as extra tiebreakers.

</br>
{{< rawhtml >}}
<div id="order" align="center">
    <div class="grid-container">
        <button class="grid-item" v-for="key in keys" @click="click(key.r, key.c)">
            [[ key.ranking + 1 ]]
        </button>
    </div>
</div>

<script>
  createApp({
    delimiters: ["[[", "]]"],
    data() {
        return {
            cols: 6,
            rows: 6,
            c: 0,
            r: 0
        }
    },
    computed: {
        keys() {
            let keys = []
            let id = 0
            for (r = 0; r < this.rows; r++) {
                for (c = 0; c < this.cols; c++) {
                    keys.push({
                        id,
                        r,
                        c,
                        d: Math.abs(r - this.r) + Math.abs(c - this.c),
                        dc: Math.hypot(r - (this.rows - 1) / 2, c - (this.cols - 1) / 2),
                        ranking: null
                    })
                    id += 1
                }
            }
            let sorted = structuredClone(keys).sort((a, b) => (
                a.d - b.d || a.dc - b.dc || a.r - b.r || a.c - b.c
            ))
            keys.forEach((key, i) => {
                key.ranking = sorted.findIndex(x => x.id === key.id)
            })
            return keys
        }
    },
    methods: {
        click(r, c) {
            this.r = r
            this.c = c
        }
    }
  }).mount('#order')
</script>
{{< /rawhtml >}}
</br>

### A basic probability model

We now have an algorithm to lay out a keyboard, with respect to the last key that was pressed. We know what character a keypress would correspond to, so all we need is a lookup table indicating which keys are the most likely to be pressed next. A simple solution is to build a probability model that measures the likelihood of a character appearing after another one:

$$P(c_i \mid c_{i-1}) = \frac{\sum_{w \in W}\sum_{j = 1}^{|w|} \mathbb{1}(w_{j-1} = c_{i-1}, w_j = c_i)}{\sum_{w \in W}\sum_{j = 1}^{|w|} \mathbb{1}(w_{j-1} = c_{i-1})}$$

This is just a fancy way of saying that we have to count how many times a character $c_i$ appears after another character $c_{i-1}$. Then we divide that by the total number of occurrences for $c_{i-1}$. That gives us a probability distribution over characters.

The set $W$ contains sentences over which to count. I've used [this](https://raw.githubusercontent.com/andrewhood125/netflix-search-cli/master/movieList.txt) list of Netflix titles to do that. Here is a Python script to parse said list of titles, do the counting, and create a priority list for each keypress:

<details>
  <summary>Click to see the code</summary>

```python
import collections
import json
import requests
import string

titles = (
    requests
    .get('https://raw.githubusercontent.com/andrewhood125/netflix-search-cli/master/movieList.txt')
    .content
    .decode()
    .splitlines()
)
titles = (movie.split('|')[0].split('(')[0] for movie in movies)
titles = (title.translate(str.maketrans('', '', string.punctuation)) for title in titles)
titles = (title.strip() for title in titles)
titles = (title.lower() for title in titles)
titles = (title.replace('�', '') for title in titles)
titles = list(titles)

counts = collections.Counter(
    (prev_char, char)
    for title in titles
    for prev_char, char in zip(title, title[1:])
)
chars = set(''.join(titles))
P = {
    prev_char: {
        char: p_char
        for char in chars
        if (p_char := (
            sum(c for (a, b), c in counts.items() if a == prev_char and b == char) /
            sum(c for (a, b), c in counts.items() if a == prev_char)
        ))
    }
    for prev_char in chars
}
most_common_after = {
    prev_char: ''.join(sorted(P[prev_char], key=P[prev_char].get, reverse=True))
    for prev_char in chars
}
print(json.dumps(
    most_common_after,
    indent=4,
    sort_keys=True
))
```

</details>

```json
{
    " ": "tsoabmcfwdligphrenk jvuy231qz75x49680",
    "0": " 01s345t7298",
    "1": "9310 26857s4",
    "2": " 01954287hnmok6g",
    "3": "0 15td294rb763",
    "4": " 0t329146758",
    "5": " 0t81475i",
    "6": " 6t07el53",
    "7": " 06t1435",
    "8": " 0248137hmt6",
    "9": " 18790245ta63",
    "a": "nrlts mdciypgkvubfwhazxejoq",
    "b": "eaoluri ybcsjtmhdfqn1zkw3",
    "c": "haoekrt iluyncswbdqgmv",
    "d": " eaiosryduvltgnhwmbfzcjpkx",
    "e": " rsnadltecyvmxogpwfibkuhzqj21",
    "f": " roiaefultysgnkpbmcdx",
    "g": " ehrioauslgnytdmfbvkjcw",
    "h": "eoia turynsmlbwdfchqjvp2g",
    "i": "ncteslogrdvma fpbkizxuqjwhy58",
    "j": "oaeui rhfcdynm",
    "k": "ie sanyoulhrtmbfd91kp2jvwg",
    "l": "eial odsyutkbmfvpcrhwgnzj1",
    "m": "aeoi ypubsmrncwlthdfxj1kg",
    "n": " gdetaisconkybufvhljrmzqwxp",
    "o": "nrfum lowsdvtcpgbykaiehxjzq",
    "p": "earoihl psutydfbmnkc5w",
    "q": "u saowi",
    "r": "ei aosytldnurkcmgvpbfhwzjqx",
    "s": " teishaoupclkwmynqbfdrgv2z",
    "t": "h eioarsutylcmwznbdgpfk2jv",
    "u": "rnstlmeipgcb adfxykovjzuh2q5",
    "v": "eiaos yrupnjkd",
    "w": "aieoh nswrblydukcmtpfjzg",
    "x": " ptiaexyomfucswrbh2",
    "y": " soealnmptibwrcdzfgkuhvjyq",
    "z": "aoe izyluhmtkw"
}
```

We also need to list the most common characters for the first keypress. This is rather straightforward.

<details>
  <summary>Click to see the code</summary>

```python
print(''.join(
    c[0]
    for c in collections.Counter(''.join(title[0] for title in titles))
    .most_common()
    if c[0] != '_'
))
```

</details>

```py
tsbacmdhfprlwngiekjovu31yqz2x456897
```

### Piecing it together

Now we know how to order keys following a keypress. We also have a basic model to determine what keys are likely to be pressed next. We can implement a dynamic keyboard by putting these two building blocks together.

</br>
{{< rawhtml >}}
<div id="keyboard" style="display: flex; flex-direction: column;">

    <div style="display: flex; flex-direction: row;">

        <div class="grid-container">
            <button
                class="grid-item"
                v-for="key in keys"
                @click="click(key.r, key.c, charAtIndex(key.ranking))"
                :disabled="charAtIndex(key.ranking) === undefined"
                :style="key.r == r & key.c == c ? {'border-color': 'red', 'border-width': '2px', 'position': 'relative'} : {}"
            >
                [[ charAtIndex(key.ranking) ]]
            </button>
        </div>

        <div style="display: flex; flex-direction: column; margin-left: 20px; justify-content: center;">

            <h2 style="margin: 5px">✍️ — '[[ input ]]'</h2>
            <h2 style="margin: 5px">📐 — [[ distances.reduce((sum, x) => sum + x, 0) ]]</h2>

            <button
                @click="cancel()"
                :disabled="input.length === 0"
                style="margin: 5px; margin-top: 10px; width: 120px;"
            >
                Delete
            </button>

        </div>

    </div>

    <div style="display: flex; flex-direction: row; margin-top: 20px;">
        <button @click="write('the last dance')">The Last Dance</button>
        <button @click="write('house of cards')" style="margin-left: 12px;">House of Cards</button>
        <button @click="write('peaky blinders')" style="margin-left: 12px;">Peaky Blinders</button>
    </div>
</div>

<script>
  createApp({
    delimiters: ["[[", "]]"],
    data() {
        return {
            cols: 6,
            rows: 6,
            distances: [],
            keysPressed: [],
            mostCommon: 'tsbacmdhfprlwngiekjovu31yqz2x456897',
            mostCommonAfter: {
                "0": " 01s34t52798",
                "1": "9310 26857s4",
                "2": " 0159428ghkmno67",
                "3": "0 1dt5249br367",
                "4": " 0t312469578",
                "5": " 0t814i57",
                "6": " 6t07el35",
                "7": " 06t1345",
                "8": " 024813hmt67",
                "9": "18 790245ta36",
                " ": "tsoabmcfwdligphrenk jvuy231qz75x49680",
                "a": "nrlts mdciypgkvubfwhazxejoq",
                "b": "eaoluri ybcsjtmhdfknqwz13",
                "c": "haoekrt iluyncswbdgqmv",
                "d": " eaiosryduvlgtnhwmbfzcjkpx",
                "e": " rsnadltecyvmxogpwfibkuhzqj12",
                "f": " roiaefultygsknbcdmpx",
                "g": " ehrioauslgnytdmfbkvcjw",
                "h": "eoia turynsmlbwdfchjqvgp2",
                "i": "ncteslogrdvma fpbkizxuqjwhy58",
                "j": "oaeui hrfcdmny",
                "k": "ie sanyoluhrtmbdfk19gjpvw2",
                "l": "eial odsyutkbmfvpcrhwgnzj1",
                "m": "aeoi ypubsmrncwltdhfxgjk1",
                "n": " gdetaisconkybufvhljrmzqwxp",
                "o": "nrfum lowsdvtcpgbykaiehxjzq",
                "p": "earoihl psutydfbmkncw5",
                "q": "u asiow",
                "r": "ei aosytldnurkcmgvpbfhwzjqx",
                "s": " teishaoupclkwmynqbfdrgvz2",
                "t": "h eioarsutylcmwznbdgpfkjv2",
                "u": "rnstlmeipgcb adfxykovjzhuq25",
                "v": "eiaos yrudjknp",
                "w": "aieoh nswrblydkucmtfgjpz",
                "x": " ptiaexyomfucswbhr2",
                "y": " soealnmptibwcrdzfgkuhvjqy",
                "z": "aoe izyluhmktw"
            }
        }
    },
    computed: {
        keys() {
            // Returns a list of coordinates, along with the ranking of the key with respect to the
            // last pressed key. That allows determining what will be the new character for that
            // key in the next iteration.
            let keys = []
            let id = 0
            for (r = 0; r < this.rows; r++) {
                for (c = 0; c < this.cols; c++) {
                    keys.push({
                        id,
                        r,
                        c,
                        d: Math.abs(r - this.r) + Math.abs(c - this.c),
                        dc: Math.hypot(r - (this.rows - 1) / 2, c - (this.cols - 1) / 2),
                        ranking: null
                    })
                    id += 1
                }
            }
            let sorted = structuredClone(keys).sort((a, b) => (
                a.d - b.d || a.dc - b.dc || a.r - b.r || a.c - b.c
            ))
            keys.forEach((key, i) => {
                key.ranking = sorted.findIndex(x => x.id === key.id)
            })
            return keys
        },
        input() {
            return this.keysPressed.map(x => x.char).join('')
        },
        r() {
            return this.keysPressed[this.keysPressed.length - 1]?.r || 0
        },
        c() {
            return this.keysPressed[this.keysPressed.length - 1]?.c || 0
        },
        prevChar() {
            return this.keysPressed[this.keysPressed.length - 1]?.char
        },
    },
    methods: {
        click(r, c, char) {
            this.distances.push(Math.abs(r - this.r) + Math.abs(c - this.c))
            this.keysPressed.push({r, c, char})
        },
        charAtIndex(index) {
            if (this.prevChar === undefined) {
                return this.mostCommon[index]
            }
            return this.mostCommonAfter[this.prevChar][index]
        },
        cancel() {
            this.keysPressed.pop()
            this.distances.pop()
        },
        write(sentence) {
            while (this.input.length > 0) {
                this.cancel()
            }
            sentence.split('').forEach(char => {
                let key = this.keys.find(x => this.charAtIndex(x.ranking) === char)
                this.click(key.r, key.c, char)
            })
        }
    }
  }).mount('#keyboard')
</script>
{{< /rawhtml >}}
</br>

The keys are first layed out according to the likelihood of a character appearing in the first input position. Next, when a key is pressed, the matching position and character are stored. This triggers a refresh of the keyboard, whereby each key is assigned with an integer indicating its number in the order. Then, the lookup table for the last key that was pressed is used to assign a character to each key. It's pretty straightforward, it just requires a bit of bookkeeping.

I suggest trying out the keyboard for yourself. For example, you can see that it reduces the distance for the three predefined titles by a non-negligible amount:

- The Last Dance goes from 64 to 14 (x4.6)
- House of Cards goes from 73 to 17 (x4.3)
- Peaky Blinders goes from 57 to 18 (x3.2)

## Refining the probability model

One of the first things I noticed with this dynamic keyboard is that if I press `e`, the next suggested character is an empty space. I checked, and this is statistically correct. But it doesn't make sense to suggest an empty space as the second character of a movie title -- or any English sentence for that matter.

To alleviate this corner case, I tried out using a more granular probability model. I baked in the position of the next character. This essentially boils down to performing more counting and storing more values.

$$P(c_i \mid c_{i-1}) = \frac{\sum_{w \in W}\sum_{j = 1}^{|w|} \mathbb{1}(i = j, w_{j-1} = c_{i-1}, w_j = c_i)}{\sum_{w \in W}\sum_{j = 1}^{|w|} \mathbb{1}(i = j, w_{j-1} = c_{i-1})}$$

</br>
{{< rawhtml >}}
<div id="memorized" style="display: flex; flex-direction: column;">

    <div style="display: flex; flex-direction: row;">

        <div class="grid-container">
            <button
                class="grid-item"
                v-for="key in keys"
                @click="click(key.r, key.c, charAtIndex(key.ranking))"
                :disabled="charAtIndex(key.ranking) === undefined"
                :style="key.r == r & key.c == c ? {'border-color': 'red', 'border-width': '2px', 'position': 'relative'} : {}"
            >
                [[ charAtIndex(key.ranking) ]]
            </button>
        </div>

        <div style="display: flex; flex-direction: column; margin-left: 20px; justify-content: center;">

            <h2 style="margin: 5px">✍️ — '[[ input ]]'</h2>
            <h2 style="margin: 5px">📐 — [[ distances.reduce((sum, x) => sum + x, 0) ]]</h2>

            <button
                @click="cancel()"
                :disabled="input.length === 0"
                style="margin: 5px; margin-top: 10px; width: 120px;"
            >
                Delete
            </button>

        </div>

    </div>

    <div style="display: flex; flex-direction: row; margin-top: 20px;">
        <button @click="write('the last dance')">The Last Dance</button>
        <button @click="write('house of cards')" style="margin-left: 12px;">House of Cards</button>
        <button @click="write('peaky blinders')" style="margin-left: 12px;">Peaky Blinders</button>
    </div>
</div>

<script>
  createApp({
    delimiters: ["[[", "]]"],
    data() {
        return {
            cols: 6,
            rows: 6,
            distances: [],
            keysPressed: [],
            mostCommon: 'tsbacmdhfprlwngiekjovu31yqz2x456897',
            mostCommonAfter: {"1-1": "30 16982", "1-2": "0 1h4568n", "1-3": "0 d512", "1-4": "2 09348t", "1-5": " 084i", "1-6": "6t03", "1-7": " ", "1-8": "0 42m", "1-9": " 01579t", "1-a": " nlmrfdbstpcguiavkweyjqhz", "1-b": "aoelruihy bkmw", "1-c": "oahrlnieuys q", "1-d": "eaoiruhycndg lmw", "1-e": "lxvdamnystecigrupqk2", "1-f": "raioleuxdy", "1-g": "oraeiuhlyn", "1-h": "oeaiuyrgh2w", "1-i": "n msrtlfpcdvkoqw", "1-j": "oauei dfhry", "1-k": "ieanuoh9l12rty", "1-l": "oiaeuybf", "1-m": "aoyieurcsnx", "1-n": "aoeiuynsb", "1-o": "nuplfvrcmstkhdbyjawx", "1-p": "aroeuilhds y", "1-q": "ua", "1-r": "eoaiuhp ", "1-s": "taheopuicwlknmygq2srv", "1-t": "hreoaiwuyn", "1-u": "nlpfgrsdh", "1-v": "iaeor", "1-w": "hiaeowrycmu", "1-x": "xamseo", "1-y": "oea ", "1-z": "oeauz", "10- ": "taocsbmwdlhigpfryeknujv 2q13x7z45", "10-0": "0 t7", "10-1": "3", "10-2": " ", "10-3": " ", "10-4": "1", "10-5": "0", "10-6": " ", "10-7": "0 ", "10-8": "7", "10-9": "1", "10-a": "nr ltcsdmgvyipukbhfawxjzq", "10-b": "aeloruiby1", "10-c": "ehaiotkr ulycs", "10-d": " eaoisrdyuvwnh", "10-e": " rsnadxtlvceyipmofgbwkqhu", "10-f": " oraeiftulk", "10-g": "e aihorulsgcy", "10-h": "eoai utrmybn", "10-i": "ntslacergdvomf bixkpu", "10-j": "ueoiar", "10-k": " eisnlyuhkao", "10-l": "ealio bdysutmvnfghkz", "10-m": "eaoyi bspumr", "10-n": " gdtiesaconukyhfjz", "10-o": "nf rumlowsvtpgdciyzhkaexb", "10-p": "aeroihlp suy", "10-q": "u", "10-r": "i eoaslvytdurknmgbpcwf", "10-s": " tehisaoucplmwqnbky", "10-t": "h eoisrauytwlcmz", "10-u": "inrstlp mgceafdbxy", "10-v": "eiaos ", "10-w": "aioneh kl", "10-x": " iatp", "10-y": " seaopdlztwnm", "10-z": "yeo mi", "11- ": "tsoamwihfcbgdlprk2vejn 3y1u4q985", "11-0": "0 ", "11-1": "32491", "11-2": " ", "11-3": " 0", "11-4": " ", "11-5": "7", "11-7": "0 ", "11-a": "nrlm tdsiyckvbgupfwxzaeh", "11-b": "ueolarisyb", "11-c": "oeahktirluys ", "11-d": " eaisroydglmnuthv", "11-e": " ronsaltdecfymxvgpwbi", "11-f": " oiefaltru", "11-g": " ehioursaglfnt", "11-h": "eoai trunjywm", "11-i": "enlsgtrcdomav bfkizhujp", "11-j": "aou", "11-k": "eis alhrnot", "11-l": "ieloa sduythpw", "11-m": "a eiouympbsn", "11-n": " aegdtscionkvybuwhlrm", "11-o": "fnr umovltwdpsybgieckzhja", "11-p": "aeol isprhyuwt", "11-q": "u", "11-r": " esoiatdyuknlrcmvgbpfh", "11-s": " tsiehaouplmcwdqrvkb", "11-t": "he oiarstyunlwmcz", "11-u": "rnsemtlpgb idcakoxy", "11-v": "eiao", "11-w": "iaohesn bdyl", "11-x": "piat x2o", "11-y": " soecpmagitnb", "11-z": "a eoi", "12- ": "tmsadobclwfphigrnekvy2u jz1x3q5", "12-0": " ", "12-1": "1956", "12-2": " 098", "12-3": " 45", "12-4": "35 ", "12-5": " ", "12-8": "4", "12-9": "18", "12-a": "nlrt mscdiyvpgbufkzwhaox", "12-b": "leaoirubyc ", "12-c": "ethaorilku ysc", "12-d": " eaioryslgvtjnuf", "12-e": " nrslaetdvmycoxfphwkbugi", "12-f": " oareiuflgyt", "12-g": "h aeoisrulgmdyn", "12-h": "eoa itryuwdmnslcv", "12-i": "nlstercgodav fmikbuzpq", "12-j": "oeuai", "12-k": "ei snouht", "12-l": "delaios myupfckvztw", "12-m": "eaipo ubsyfr", "12-n": " dgetcsioankqjyvlmzbhf", "12-o": "gnrfu mlowdsvptycaxkieb", "12-p": "eroaily pthus", "12-q": "u", "12-r": "es oialdtyrcgmuvnfkbwx", "12-s": " teisohuapclkmqfybrw", "12-t": "h eiorsayultcmndz", "12-u": "nmrseltigdpab hfcy", "12-v": "eias o", "12-w": "aioen brlh", "12-x": "pit aeu", "12-y": " seorladbg", "12-z": "ioa", "13- ": "tsamobcdflpwighrknveyju127z6q3 589", "13-0": "15", "13-1": "12", "13-2": " 0", "13-3": "1", "13-4": "t", "13-5": "10", "13-6": " ", "13-8": "0", "13-9": "3a", "13-a": "nrltsc midygvukfpwahbq", "13-b": "elaoiruycb", "13-c": "ehoklatriu ywc", "13-d": "e aiosrduynzhmglb", "13-e": " rsnaldetycvxwmkgopfiuzhjb", "13-f": " eroiafultg", "13-g": "re hoislaundy", "13-h": "etoia rumld", "13-i": "ntlsdecgrmvoaip fbzx", "13-j": "ao", "13-k": "ie ynslouafg", "13-l": "eslioa dyfutvbwckr", "13-m": "easoi yupbmc", "13-n": "d egtcisnoakyfuljbrzqv", "13-o": "nrf uwmlsvkotpdaygcbeix", "13-p": "oealrpiyht bs", "13-q": "u", "13-r": "ei saoltdnyrmcugkfbpvh", "13-s": " teioshapucykmwldb", "13-t": "hei orasultycnwmz", "13-u": "rsntlge pmcdaibkfo", "13-v": "eiaos uy", "13-w": "aioeh nrsbmlc", "13-x": " tmeyfp", "13-y": " saomijlrebfd", "13-z": "ayezo", "14- ": "tscomalbdpwfirhgneujykv 2zq1796", "14-0": " ", "14-1": "9251 s", "14-2": " m", "14-3": "16 ", "14-5": "0", "14-6": "05", "14-7": "3t", "14-9": "1", "14-a": "nr dsmtlyigckvbhwfeouzpx", "14-b": "eoalriuy s", "14-c": "ehoakrti clwsu", "14-d": "s eaiourygfvlndhp", "14-e": " rsantdeclyvmgwxopbkihfu", "14-f": " oeiruafl", "14-g": "ei hoasrulngdtk", "14-h": "eioa trsufy", "14-i": "netcolsgrmdvaf pbixwz", "14-j": "oaue", "14-k": "ie snaydkho", "14-l": "ealoi ydsutnkbprc", "14-m": "aeoi brupysm", "14-n": "g edtisoacnyfkhzp", "14-o": "nrfuo tvmwlsdpcyjegkibazh", "14-p": "elriao sutyhp", "14-q": "u", "14-r": "aie osdlyuntrmgcbkvf", "14-s": " tiesahupolkwqcmnby", "14-t": "h eiasroyutlncmw", "14-u": "rstnlepbmagc idjk", "14-v": "eiaosp", "14-w": "eoaih snrl", "14-x": "ei o", "14-y": " soencludparw", "14-z": "eozk a", "15- ": "tomasldcbphrgfiwnej ukvy1zq2347", "15-1": "691", "15-2": " 10", "15-5": " 0", "15-6": "7", "15-9": "0 5", "15-a": "pnrtscdml ivgyuwkbehaqzfj", "15-b": "eauiolryb s", "15-c": "oeahkriul tsy", "15-d": "e oaisyruvcwbnlk", "15-e": " rsnaldxeycmtwfopvgbikh", "15-f": " rieoautlgf", "15-g": "ehai slrounmg", "15-h": "eiao rtunyqf", "15-i": "nescolrdtvag mpfbixu", "15-j": "eoaufhi", "15-k": "ei soanblr", "15-l": "iaelo dytuskvpfw", "15-m": "eaoiy psmurnb", "15-n": "g detiancsoymkjblfwqruvhx", "15-o": "nrfumvo wpdtslckhiybegxj", "15-p": "aerilhos uy", "15-q": "u", "15-r": " iesotadklnryubvfpg", "15-s": " teihsaocpulwnykb", "15-t": "h eiroasyutlmwdcbpn", "15-u": "nsrtlpec bdmgkifa", "15-v": "eiao", "15-w": "a oishenby", "15-x": "apot ", "15-y": " oseamwktc", "15-z": "oyale", "16- ": "tsabcmopwhfdlrgiuknevjy21 34z78569q", "16-0": "0", "16-1": "71 30", "16-2": " ", "16-3": " ", "16-4": " ", "16-5": "5", "16-6": "t", "16-7": "0 ", "16-9": "4", "16-a": "rnl mstcidygufzkbpaoxw", "16-b": "oairelusyct bj", "16-c": "aheotkirul nyc", "16-d": "e aiosruyvgndc", "16-e": " rsnladtcvexmwgiofykpqju", "16-f": " roaielfuk", "16-g": "eh orailtdus", "16-h": "eoa tiurmsncylw", "16-i": "neslcrovmgtdafb ixypkz", "16-j": "eouar", "16-k": "e isnoyt", "16-l": "eila odsuythkzcb", "16-m": "eaoip uybsmr", "16-n": " gedtsacionkyfbmwvuqhr", "16-o": "nfrulm wovspgbdycaetikj", "16-p": "heaoilrspm bud", "16-q": "u", "16-r": "eoi saldtyukrcmgnhb", "16-s": " tesaiuopmhcnbwklfg", "16-t": "heo iasryultmwcgn", "16-u": "nrtslgipmcba2 eu", "16-v": "eias ", "16-w": "eao inhsb", "16-x": "patiou ", "16-y": " soeiwalzbtpm", "16-z": "oe", "17- ": "tasobchdwflmirgpneyjku2 3v4q6", "17-0": "s10", "17-1": "08 1", "17-2": " 4", "17-3": " t", "17-4": "4 3", "17-5": " ", "17-6": " ", "17-7": "t 6", "17-8": " 8", "17-9": " ", "17-a": "nrt lsmyidcugpkwfhvoz", "17-b": "oeuialrbys", "17-c": "aeothkilruysd c", "17-d": " eiaosndrmvbhugl", "17-e": " rsnaedtlcmvgypfobxiuwzk", "17-f": " iuaorelftc", "17-g": "e houiraymglnf", "17-h": "ieaot rus", "17-i": "nvecstlgrdoampfbiuk8 ", "17-j": "aeuo", "17-k": "i eonasumy", "17-l": "el aoiydsutpfhwvk", "17-m": "eaopuiby mshnr", "17-n": "cega dstoinykrzhlbjfw", "17-o": "nrfmuv wosltcdkyjbpegxiha", "17-p": "eraio puthlyd", "17-q": "u", "17-r": "esa ioytdnlrcubgkfmvp", "17-s": " tiesahupckolywmbnqg", "17-t": "hi eoratsyculmbp", "17-u": "nrsetlgbpmdac ifk", "17-v": "eioas", "17-w": "oiaehn rdbs", "17-x": "tpci", "17-y": " oesait", "17-z": "oytei", "18- ": "tsmaobpdiwfcrlhenuvgkyj21 3qzx", "18-0": " t", "18-1": " ", "18-2": " ", "18-3": " ", "18-4": " 7", "18-6": "t", "18-8": " h", "18-a": "n rltdcimskywgvuphxfqb", "18-b": "ieaorlu cybt", "18-c": "ehaotirkyl u", "18-d": "e aiosrduvwygzp", "18-e": " rsnatdlecxygvwmikpfhou", "18-f": " reoiafutyl", "18-g": " eorihaugsl", "18-h": "eioa turysmnb", "18-i": "cneosmrtgldf avxbzu", "18-j": "oeai", "18-k": " eisnyoamf", "18-l": "ileo asdyutkzp", "18-m": "eao ipbyumn", "18-n": "gd etsiacokyrbuljnz", "18-o": "nfrulovmd wbcptsyaeghj", "18-p": "eil roahupmyst", "18-q": "u", "18-r": "eios yatnudrcklmvgbf", "18-s": " tesihuoacpmqyrlkb", "18-t": "h eioasrytulmcz", "18-u": "nrsitlge ypcmbxfad", "18-v": "eioa ", "18-w": "anioes hr", "18-x": "baep ", "18-y": " osepidcwtfr", "18-z": "ziae", "19- ": "tafobrhwcsgmdplienk2v uyjqz435", "19-1": "0 ", "19-2": " ", "19-3": " ", "19-7": " ", "19-a": "nrtlms idcyvfgkuaxwhpbe", "19-b": "euailrsob y", "19-c": " ehoakrtusilyc", "19-d": " eairodvsylnm", "19-e": " rasndlcetyxvmwfzuibop", "19-f": " reoiatufsl", "19-g": "e hiolsragd", "19-h": "ea oiturdml", "19-i": "ntlvcseogmdrbaf ipzjkx", "19-j": "aoiue", "19-k": "e isuaon", "19-l": " eliaodsyupfmhktr", "19-m": "eao yubipc", "19-n": " dgteascoiylknzv", "19-o": "nrmfulsvo wdtgcapbxkeiy", "19-p": "aeriloput hys", "19-q": "u", "19-r": "eio astyrndcumkblgjfpv", "19-s": "t esohpaicuwlmyqn", "19-t": "h eiosarutyclzwmk", "19-u": "nsrtcmpfxibglaedy", "19-v": "eaoi", "19-w": " iaoenhsr", "19-x": "tpime", "19-y": " ospnildmew", "19-z": "azoi", "2- ": "mstwldcgbpahnfrk1vyj6e", "2-0": " 01352", "2-1": " 1459", "2-2": " 10o", "2-3": "1 bt23", "2-4": " 6", "2-5": " 0", "2-6": " 6l", "2-7": "6", "2-8": " 08", "2-9": " 180", "2-a": "rtnlsmdcikpybvguw afhxjzqeo", "2-b": "seobdjnrqt", "2-c": "hacreot wilm", "2-d": " davgioreswu", "2-e": "arndltsevcgm oxyfiwbphqkuj", "2-f": "t frogcke", "2-g": "ayetnl ", "2-h": "eoairuy f", "2-i": "nslgrtdcvmafpekoxzu b5hj", "2-j": "a ", "2-k": "ieaylo u", "2-l": "aioelut mdybpvfwsc", "2-m": "eapo imbrxtgd", "2-n": " tdbcgeiosnavuflhkymjz", "2-o": "nrumlbwocds vtapyhgeixkfz", "2-p": "eiaorl yphn5ts", "2-q": "u", "2-r": "aoei utmcsyrjgdbnk", "2-s": "s clytanhipreo", "2-t": "raeo tsihulmy", "2-u": "nrstmlpcebidgafyjov kzh", "2-v": "eiao", "2-w": "eoialj", "2-x": "tipxaoyc ", "2-y": " selpnbcmiturado", "2-z": "o ", "20- ": "tsamoicwlbgpdhefr2nk1uj yv3z745qx", "20-0": " ", "20-2": " 59", "20-3": " ", "20-4": " ", "20-5": " ", "20-a": "ntrsldmci ypgkzfvabuh", "20-b": "leaoubiyrt", "20-c": "haoketrly ius", "20-d": " eoaisrulvymng", "20-e": " rsnadeltcyvmibxpgwfzu", "20-f": " oauireftn", "20-g": " ehuariolsyfn", "20-h": "eoi aturslb", "20-i": "nsocemgltrdpafvib z", "20-j": "uo a", "20-k": " islaen", "20-l": "elia dyotuskpw", "20-m": "aeo mspuyinwk", "20-n": " gdteaiokcsyxunjhrbz", "20-o": "nrfulomtvs pwidagcbxykej", "20-p": "eioalr hstp", "20-q": "u", "20-r": "eioas ytdulkrnvmcfphb", "20-s": " teishompaucwkn", "20-t": "h oeirsayutzwmcgdlp", "20-u": "rsnltecmx ajdipb", "20-v": "eioay k", "20-w": "iheoan spw", "20-x": " iptsa", "20-y": " seowlgnai", "20-z": "yozm", "21- ": "toamsdipfbclwrhevngujyx 25673k", "21-1": "936 ", "21-2": " 1", "21-3": " 0", "21-4": " ", "21-5": "t ", "21-9": "2", "21-a": "nstrmlcgp diykuvhjbaxwzf", "21-b": "eiaorlbsy", "21-c": "hoaktierl uys", "21-d": " eoisadblry", "21-e": " rnslatdceygpxwkvih", "21-f": " oiufradlte", "21-g": " eiorhuafdtyl", "21-h": "eai ortuyvd", "21-i": "ntercoalsgm fkpdvibx", "21-j": "aoieu", "21-k": "i easnyu", "21-l": "eoai ldysbuht", "21-m": "eaoi pyubnm", "21-n": " detgsckoiayvbfn", "21-o": "rnfmwl svubocdpktzay", "21-p": "eraiosl hput", "21-q": "u", "21-r": "esia ytounklgvmbwdfc", "21-s": " tesihucaoplmbnky", "21-t": "he oirmsaluwtycnb", "21-u": "nretlascmipxb ", "21-v": "eiao", "21-w": "oeains hu", "21-x": " iat", "21-y": " stoeam", "21-z": "eazuo", "22- ": "taosmcidfwblprghn2juek 5vyz134q", "22-0": " ", "22-1": "1 ", "22-2": " 90", "22-3": " ", "22-5": " ", "22-6": "6 ", "22-7": " ", "22-9": "9", "22-a": "rntlscdmyib fpugvawoh", "22-b": "oaeiul jbrsy", "22-c": "ektiaoh ruly", "22-d": " eaiosyruwlgfnx", "22-e": " rnsadectlyifowvxmpg", "22-f": " eoairful", "22-g": "e hoaluysir", "22-h": "eoa ritydufml", "22-i": "ntocgevrlsd fxaipmkub", "22-j": "oam", "22-k": "e silyan", "22-l": "ilea dysotufk", "22-m": "eaoi pybrucm", "22-n": "gt descioanybhfv", "22-o": "nrfwu olmsvebykdtgaphx", "22-p": "ea ohrpslibu", "22-r": "e iasoytlcgunrdhkpm", "22-s": " tehsaucoilpwkmb", "22-t": "h eioarutsymcfz", "22-u": "nrseptlmf aic", "22-v": "eia ", "22-w": "eoia rlhc", "22-x": " tpia", "22-y": " oesmtn", "22-z": "eila ", "23- ": "tswalbcfmopdgnir khey2u1jvq3", "23-0": "0", "23-1": "2", "23-2": "0 9", "23-5": "t", "23-6": "6", "23-9": "4", "23-a": "nrstlmcigyxd zvukfwhqpb", "23-b": "eaourilcb", "23-c": "oehrtiu klasw", "23-d": " esaoiuvlyr", "23-e": " rsndaclytemboixwhzupkgf", "23-f": " iuraoeflt", "23-g": " euaoirshdn", "23-h": "eaio tursym", "23-i": "noetsclgdarmfv ipkh", "23-j": "oare", "23-k": " isaeyol", "23-l": "iea lodsprcvy", "23-m": "aeopmyuis ", "23-n": " gtdesoanciuzflb", "23-o": "nrfmud wtkvlogspcyhabi", "23-p": "elapo rih", "23-q": "u", "23-r": " eioaldsytknprvgumfch", "23-s": "t ieshacpoyurq", "23-t": "he iosaruylt", "23-u": "nrtspi dmaxbce", "23-v": "eiao ", "23-w": "iaon ersbfc", "23-x": "op ", "23-y": " otawedlp", "23-z": "o ", "24- ": "tsbacolfmwpd3gihnr12jekyv u4", "24-0": "03", "24-1": "9", "24-2": " ", "24-6": " ", "24-9": "t", "24-a": "nrtlsm yivgbcwpudj", "24-b": "eaolui r", "24-c": "aretlh oikysucw", "24-d": " eiaosydvwu", "24-e": " rsnadtlmfhegcvyupxw", "24-f": " aeoirful", "24-g": " earihoyltus", "24-h": "eoi ruamnyt", "24-i": "ndtseolmarcvg fipq", "24-j": "o", "24-k": "ien ays", "24-l": "aeloid ysutgbk", "24-m": "eaoi ybum", "24-n": " gdetsaiocynuv", "24-o": "nr vuflosmtwpcdjeiakxyhb", "24-p": "aheliro tsyu", "24-q": "us", "24-r": "ei oyatnsdlkcrumfg", "24-s": " tihsealokrcypn", "24-t": "h eaoirsutmnyl", "24-u": "rslntekcgidmpy", "24-v": "eiao", "24-w": "oehai sr", "24-x": " ty", "24-y": " osafen", "24-z": "ia ", "25- ": "tasobmwfcildperhuvngk 27yj6", "25-0": "4", "25-1": "9 ", "25-2": " 0", "25-3": "0 ", "25-4": "0", "25-9": "7", "25-a": "nrtlis dcvgympfujkbw", "25-b": "euarobil", "25-c": "aheritko uly", "25-d": "e siarydow", "25-e": " rsantmdcveyhglfoxuw", "25-f": " oeiruatb", "25-g": "e aorhiuntf", "25-h": "eioa tyusrwmn", "25-i": "nceovtdlmafrgb sxhzpu", "25-j": "oae", "25-k": "e yansrid", "25-l": "al eiodutnsyr", "25-m": "aeoi bsymu", "25-n": " gedtaicnsofkyu", "25-o": "nrfoumv lwtdgpbcysia", "25-p": "alerh os", "25-q": "u", "25-r": "ei aostldgvckrmyunbp", "25-s": "t eisacpkuohl", "25-t": "h oiersauytcdml", "25-u": "rtnegcmsax dipy", "25-v": "eiao", "25-w": "oe ihnas", "25-x": "a", "25-y": " osn", "26- ": "toscawdmfbhgerulpyn 1vikj", "26-0": "01", "26-2": "k", "26-6": " ", "26-7": "16", "26-9": "7896", "26-a": "nlrtms cduyigkbepwvf", "26-b": "eaoiulbyr", "26-c": "aehtuokislnr ", "26-d": " eosaymuitg", "26-e": " srnadleuvxwyctgofipmk", "26-f": " uiarlefoty", "26-g": " eahirosglytu", "26-h": "eoai uty", "26-i": "nsroetcgaldvfb kmx", "26-j": "oa", "26-k": "iyens ", "26-l": " eliaodsvmy", "26-m": "aeo bywumis", "26-n": " dgtesikaoclyn", "26-o": "nrfum sldkwvcaoipgt", "26-p": "leoris h", "26-r": "ei oasntykrdlmvg", "26-s": " tiehpacsuwoyzkl", "26-t": "h oeaisutymrcbldw", "26-u": "srnlptimfxc bgde", "26-v": "eaois", "26-w": "aiho e", "26-x": " p", "26-y": " sobe", "26-z": "a", "27- ": "tsocbamwlferhdigkpnyu1j ", "27-0": "0", "27-1": "90", "27-6": "7", "27-7": "0", "27-8": "0", "27-9": "0", "27-a": "nrtsl gympdivcwzjbuhf", "27-b": "lira ueo", "27-c": "ahroiuektlc", "27-d": " eiosardnuyg", "27-e": " rnsadetclmvuxowyfip", "27-f": " euloiarft", "27-g": " houialesntr", "27-h": "eoi atsnyru", "27-i": "ncoltgevsrdap", "27-j": "e", "27-k": "e y1sahi", "27-l": "e lidasoupm", "27-m": "aeoyipsu bmc", "27-n": "d tgeiasocfkr", "27-o": "rfnl womyvsbauitkjpex", "27-p": "eipahro", "27-r": "esltny aiokdrbgcvhm", "27-s": "t pisuoehakcl", "27-t": "hoe irlstaycuvwm", "27-u": "rstnxelpbgma ", "27-v": "eai", "27-w": "ieoa y", "27-x": " yipt", "27-y": " soalewi", "27-z": "l", "28- ": "tosfcmladwgrbhie2pnk1jyu v", "28-0": " s", "28-1": "91", "28-7": "1", "28-9": "87", "28-a": "nmtsldricy zoufqax", "28-b": "ileu aroys", "28-c": "aho retksigyu", "28-d": " eiosavrydg", "28-e": " rsdtaecnyfxlpwghmvuq", "28-f": " oiarlte", "28-g": "hia oeulr", "28-h": "eotai ynr", "28-i": "ntcseloagmv dzfpi", "28-j": "eai", "28-k": "neis y1", "28-l": "eoad isluy", "28-m": "aopeu ybmsi", "28-n": "d egsitcobhynua", "28-o": "nrfu womvlsckgtpby", "28-p": "eah uliosry", "28-r": "ei ysoalndrmctv", "28-s": " tehicopsukd", "28-t": "h oeirlaumsyzt", "28-u": "nlpetmxrsfad", "28-v": "eai", "28-w": "aohnier ", "28-x": " up", "28-y": " sotlen", "28-z": "a", "29- ": "toamscfpblwhrdige2 nuky1vj", "29-1": "92", "29-2": "05", "29-7": "4", "29-8": "03", "29-9": "89", "29-a": "nrcmtd slpgbkyij", "29-b": "lroiaseu", "29-c": "aterkhios ul", "29-d": " ieorsuangvd", "29-e": " rsncdayltvegxpqmukf", "29-f": " roayife", "29-g": "e roahi", "29-h": "e atiory", "29-i": "ntocsrelgam vdfpbq", "29-j": "oe", "29-k": "it r", "29-l": "elaoidyk pmtusf", "29-m": "aeioypu smb", "29-n": " egdsaiotuck", "29-o": "fnr mulosgwcpthbjzdvx", "29-p": "eloai sy", "29-q": "su", "29-r": "ie yolsuartkndb", "29-s": " tesicaoupnhfm", "29-t": "h eiosyarulzct", "29-u": "rsatnpemgjlybxz", "29-v": "ieo", "29-w": "ineaswoh", "29-x": " ept", "29-y": " soepml", "29-z": "ia", "3- ": "tfsamdplwbijchgrnoyeukqv92 z", "3-0": " 01", "3-1": "321 0", "3-2": "1", "3-3": "0 ", "3-4": "0", "3-5": " ", "3-6": " e", "3-8": "14 ", "3-9": " ", "3-a": "rtdsncmglyivpukfz bhwqoajxe", "3-b": " coebraiuylmshz", "3-c": "kthreiao cluybsg", "3-d": "e tidyanoszurwmglkhbf", "3-e": " raenstcpldvmyxgkfbowhi", "3-f": "efoiat lur", "3-g": "heg iarousflmbndt", "3-h": "noaie rtum", "3-i": "nltmdscvegaprz fuok", "3-j": "aie uohd", "3-k": "eiahnyo u", "3-l": "lied aokvtyfcupmshgbwrzn", "3-m": "epaoibm usynrcljhd", "3-n": "g ndteasicokfyvrubjqlmhwzxp", "3-o": "mnsortd kwlpucgbeizjvyah", "3-p": "ep atilrhsoynk", "3-q": "u ow", "3-r": "enaitdrlko scvmgbfypuwhz", "3-s": "tse ihacpouknmqyfwlrbg", "3-t": "i tehuarosclynwfzmb", "3-u": "nsertlgcb idmyfapvuo", "3-v": "eiao yd", "3-w": " eanbolidshkrtw", "3-x": " aietywcfxuh", "3-y": " oslbmcapidrzwefnhtk", "3-z": "aiez", "30- ": "tolbasfdmiphwcge r2junyq1", "30-0": "0", "30-1": "9", "30-2": "095", "30-5": "t", "30-8": "6", "30-9": "871", "30-a": "ntrs lmdcigvupey", "30-b": "aelorusb ", "30-c": "hteoaiksry lcu", "30-d": " eioyvbrlsd", "30-e": " rasncdytmileuxvboqwzgf", "30-f": " iauolyef", "30-g": " ryoheiasgm", "30-h": "eiaos tmur", "30-i": "netoalsvrcdwqgpmf", "30-j": "ahe", "30-k": "i esl", "30-l": "ieola dymfut", "30-m": "aeo pybuis", "30-n": " tgdseciaofzv", "30-o": "fnrdumowl vbpsycxa", "30-p": "earpoh itd", "30-q": "u ", "30-r": "ei ostarlynduwcpkhg", "30-s": " tesahpucinolwb", "30-t": "heo iasrlutcy", "30-u": "nsreldcaptxikm", "30-v": "eoi", "30-w": "aei os", "30-x": " p", "30-y": " soper", "30-z": "a z", "31- ": "taombefsprdwchvijl2ungy k", "31-0": "03", "31-1": "9 ", "31-2": "0", "31-5": " ", "31-7": "5", "31-8": "2", "31-9": "7", "31-a": "nrltcmds pviufgyxk", "31-b": "e ualyro", "31-c": "eakrhliou", "31-d": " easigouhry", "31-e": " rnastdmlcevxuwyk", "31-f": " raief", "31-g": "eo ahi", "31-h": "eiaotubr ", "31-i": "noectflrsmgvabk", "31-j": "ea", "31-k": "ei", "31-l": "eiad yosgml", "31-m": "eoai scybp", "31-n": "d gsitceoa", "31-o": "fnrmvulw oykitgb", "31-p": "eourslihap", "31-q": "u", "31-r": "ea sioytlnrkhmb", "31-s": " tseacuhliop", "31-t": "ho eirayutsnwm", "31-u": "nrstmxed", "31-v": "eia", "31-w": "eaonis", "31-x": "tp", "31-y": " sowa", "31-z": "ae ", "32- ": "tbacdomswjfplhrin gkey", "32-0": "05371", "32-2": "01", "32-7": "3", "32-9": "8", "32-a": "nrmtdsl icgubykopw", "32-b": "aeoruli", "32-c": "erutokaihdl", "32-d": " eroysvauw", "32-e": " rnsaevydxipgtzwlukmch", "32-f": " eiortg", "32-g": " eshidayt", "32-h": "e oiat", "32-i": "nelvcosatpmr", "32-j": "eao", "32-k": "es mi", "32-l": " aieldsuom", "32-m": "aeoi ups", "32-n": " tsnedgcfkawhijyo", "32-o": "fnruc wldamvejo", "32-p": "erliostap", "32-r": "eiyas orltgvnmbupd", "32-s": "t eihaocdpks", "32-t": "h eirsoyutcma", "32-u": "rslnep xmty", "32-v": "eiao", "32-w": "hao eni", "32-x": " pt", "32-y": " aseo", "33- ": "tsacmobpwehrildgfk1njv0u", "33-0": "50", "33-1": "1s", "33-8": "2", "33-a": "nrdltism bwycxgz", "33-b": "oaeruil", "33-c": "ohkaeliuy", "33-d": "ao eyrivsb", "33-e": " rsdantglehcvoxwmb", "33-f": " aioe", "33-g": "ies ohla", "33-h": "eioa utr", "33-i": "nelcvartmfgsdopux k", "33-j": "oei", "33-k": "eidn a", "33-l": " deialomth", "33-m": "aoeisnmp", "33-n": "e dtscgiyoavnu", "33-o": "rnvfumlbtwdh cgo", "33-p": "elrp hayu", "33-r": "ei anolytuskhcdp", "33-s": " ethsuopaiw", "33-t": "haeo irtsymlu", "33-u": "trs lcpn", "33-v": "eio", "33-w": "ioansh", "33-x": "p a", "33-y": " e", "34- ": "osltwabgcjdhemrv1kiypz fn", "34-0": "93", "34-1": "9", "34-a": "nltrscy imgdkv", "34-b": "aireulsbo", "34-c": "eoah ltkr", "34-d": " sevliyora", "34-e": "r sndacytlfe", "34-f": " riet", "34-g": "iho sgr", "34-h": "eoriaun", "34-i": "entlsorcdvmp fb", "34-j": "a", "34-k": "sie o", "34-l": "eia sdlotm", "34-m": "aoe iysb", "34-n": " tdgekcasio", "34-o": "nurfmlwvto yhageds", "34-p": "iealhy o", "34-r": "esi otdrluyamk", "34-s": "ti sehaouk", "34-t": "h eiosualrzb", "34-u": "ntsriem z", "34-v": "eiao", "34-w": "aheok yi", "34-x": "ap", "34-y": " em", "34-z": "y", "35- ": "staobrfdhwijemnpuckyl 1", "35-1": "89", "35-9": "289", "35-a": "rmnclsdyzw gxkie", "35-b": "eouair", "35-c": "akthoeiy", "35-d": " iegsav", "35-e": " snramxbcgdyfowtupl", "35-f": " esrf", "35-g": "eil oru", "35-h": "eioatbdwnr", "35-i": "neoclagsdtvjrp", "35-j": "ua", "35-k": " ise", "35-l": "lyeioau dmsg", "35-m": "eom rybs", "35-n": "d tesgcoan", "35-o": "fmnurdlop cvgews", "35-p": "ste", "35-r": "i eosyaultvdrgk", "35-s": " tehwiysoukanm", "35-t": " hoiayutercs", "35-u": "rlgtcsm", "35-v": "eiao", "35-w": "eiao", "35-y": " eanos", "35-z": "hz", "36- ": "castohplifdbgu2erwx k", "36-2": "9", "36-8": "18", "36-9": "92", "36-a": "rnls tcmivhgdwk", "36-b": "eialo", "36-c": "eaohtrkql ", "36-d": "e aiuojs", "36-e": " rsnadltmhiwgc", "36-f": " ro", "36-g": "eh iarsjy", "36-h": "ei ou", "36-i": "netlascvoidzfk", "36-j": "uao", "36-k": " es", "36-l": "ld uoieyfksa", "36-m": "eaosmpi yb", "36-n": " geotidasncy", "36-o": "nrfmouwdklbit psvy", "36-p": "e yotsa", "36-r": "e tisnoydrkpa", "36-s": "t eikocsuaphyq", "36-t": "hro aisleuy", "36-u": "tngirlbfaxds", "36-v": "eia", "36-w": "aoen i", "36-x": "e ", "36-y": " ngtol", "36-z": "zo", "37- ": "tsoalfcidhgbmpnreuwvyj1", "37-1": "2", "37-9": "9", "37-a": "nlt sdygmruifco", "37-b": "abule", "37-c": "oehar kuitl", "37-d": " ieyarso", "37-e": " rnaldsmbtewc", "37-f": " amofe", "37-g": "lr egobuhn", "37-h": "eao rtu", "37-i": "dnrsmtlcpogevufi", "37-j": "a", "37-k": "esuylif ", "37-l": "l eosadib1vt", "37-m": "e a", "37-n": "gt edloasvc", "37-o": "nrfwmugitasvdoyc", "37-p": "olauesit", "37-q": "u", "37-r": "eis yuontlbf", "37-s": " tpesach", "37-t": "ih ourenafs", "37-u": "trsneam", "37-v": "ea", "37-w": "a ", "37-x": " r", "37-y": " nr", "37-z": "e ", "38- ": "ctmfsbriloghap2dw19v", "38-1": "0", "38-2": " ", "38-a": "rtlndsibc uwypmk", "38-b": "ierlu", "38-c": "okuay h", "38-d": " eyswod", "38-e": " nsrdtlcuyembgf", "38-f": " iaoeur", "38-g": "e islrhna", "38-h": "eoa isr", "38-i": "onemczltpdu", "38-j": "e", "38-k": "s", "38-l": "e oldasiuy", "38-m": "eao y", "38-n": " edcatsgyinfbo", "38-o": "frnlwu pshvg", "38-p": "ehia", "38-r": "eo aidynscupkt", "38-s": " tesuhoak", "38-t": "hiou ealbytr", "38-u": "restlnicgmavp", "38-v": "aes", "38-w": " ao", "38-y": " sokf", "39- ": "tcaowsljedbhrqgpifk2v", "39-0": "3", "39-1": "9", "39-2": " 0", "39-9": "1", "39-a": "nlrmstic ", "39-b": "eroaui", "39-c": "oaheikrn ", "39-d": " saoyev", "39-e": "rs nyclatwodimv", "39-f": " rieau", "39-g": "eohuy", "39-h": "eaio", "39-i": "ongcsmrevltdbaif", "39-k": " ri", "39-l": "leioa yp", "39-m": "a eocp", "39-n": "dti asge", "39-o": "nurpfwsoylvg", "39-p": "es up", "39-r": "eiysaocdp v", "39-s": " tseipa", "39-t": "hs oairuteylm", "39-u": "rxnmeslt", "39-v": "ei", "39-w": "ean", "39-y": " n", "39-z": "ez", "4- ": "tbscmgladfwhporinekyvju qz72x1359", "4-0": " 08", "4-1": "1 0", "4-2": " ", "4-3": " ", "4-9": "0", "4-a": "nr lstmkcdihgypuawvbjxzef", "4-b": "aioelur ybsc3", "4-c": "kh eouaityrlwc", "4-d": " eioaylsbrhfwgtdmcnupv", "4-e": " rnlstemadpwcbviogykfzhx", "4-f": "ofa ieurltybsmp", "4-g": " ioeharsulmdngykt", "4-h": "te aoilsubynmrwhqf", "4-i": "noecsldtrmfga pbvzkuqhxw", "4-j": "aeouin", "4-k": " eiasynuomlbtfdjk", "4-l": " eioaldysrubtfhmvpgwjk", "4-m": "ae iopymsub1wtl", "4-n": "e tigdacyskonbhlrfmuj", "4-o": "rnd lsmtcouvpwiykegbhfa", "4-p": "e iahylpstufordk", "4-q": "u ", "4-r": "iey alogtcnsmdrkupvhfz", "4-s": " etsihoaupcylmdknw", "4-t": " ehaoilyzrtsucnbgw", "4-u": "rtsmplin ebgcadfz", "4-v": "eiaoy", "4-w": "ae oihnlbuzdg", "4-x": "a ite", "4-y": " oaiesbrfctmlghju", "4-z": "iyoa ezw", "40- ": "tasiwohp juv1kgf2rxm", "40-0": "0", "40-1": "1", "40-3": "7", "40-9": "7", "40-a": "nrtkymil dcbxpgsu", "40-b": "eal", "40-c": "ohiareclk", "40-d": "imshr e", "40-e": " srnetdxahmcg", "40-f": " rti", "40-g": " oih", "40-h": "eao tri", "40-i": "nstcelaofdugrb", "40-j": "eao", "40-k": "i e", "40-l": "eli osdyub", "40-m": "meaisp", "40-n": " dtseicbaog", "40-o": "numf tclreiv", "40-p": "hearyo ", "40-q": "u", "40-r": "e syoarivldtpn", "40-s": "t ehyicdbls", "40-t": "heiroalzc u", "40-u": "srndizael", "40-v": "ies", "40-w": " aie", "40-x": " ", "40-y": " den", "40-z": "l", "41- ": "obamsvlwcfthgeinrjpk2", "41-0": "8", "41-1": "9 ", "41-2": "0", "41-7": "4", "41-a": "nmstld rvfic", "41-b": "clye ", "41-c": "ealrhk", "41-d": "eis ovylag", "41-e": " rstclyahdgnm", "41-f": " ea", "41-g": "serh", "41-h": "eio yrta", "41-i": "snlacotrf d", "41-j": "eo", "41-k": "ei ", "41-l": "eiald ", "41-m": "einpa", "41-n": " dgetonisay", "41-o": "rnfumgswytl", "41-p": "iealh", "41-r": "eail nvsotrg", "41-s": " tepicbuma", "41-t": "h oeai", "41-u": "srtlbae", "41-v": "iae", "41-w": "oa", "41-x": "ta", "41-y": " m", "41-z": "ez", "42- ": "twsihmabgfcdnjl", "42-0": "1", "42-2": "0", "42-4": "1", "42-9": "5", "42-a": "nrtlymgikus d", "42-b": "eruol", "42-c": "toae ", "42-d": " stea", "42-e": " rdnsleyatx", "42-f": " far", "42-g": "er oi", "42-h": "eoi l", "42-i": "sncotvae", "42-j": "a", "42-k": "i", "42-l": "eolid ua", "42-m": "ye pa", "42-n": "eogdt iks", "42-o": "rfn tmgcuh", "42-p": "heai", "42-r": "siote yadn", "42-s": " htlpfmeou", "42-t": " ehsiotmlr", "42-u": "r", "42-v": "oea", "42-w": "ioa", "42-y": " sd", "42-z": "l", "43- ": "istcbhalpmwgonkuf27 vd", "43-0": "0", "43-1": "09", "43-5": "8", "43-a": "tsrcim nl", "43-b": "lor", "43-c": "soteh", "43-d": "e rvy", "43-e": " rnaedsowiymt", "43-f": " olr", "43-g": "ea i", "43-h": "oie maun", "43-i": "nvlrdspebzo", "43-j": "o", "43-k": "e", "43-l": "ealdi", "43-m": "ap oie", "43-n": "dt cgoiab", "43-o": "rnlsmauwcid", "43-p": "hea", "43-r": " yiaeltdskng", "43-s": "t esucro", "43-t": "iho ersctau", "43-u": "srbt", "43-v": "ei", "43-w": "rheao", "43-x": "p", "43-y": "s ", "44- ": "twcoamdnibpjek slrf", "44-0": "4", "44-2": "0", "44-7": "0", "44-8": "2", "44-9": "8", "44-a": "tndcsmlprxw", "44-b": "eaul", "44-c": "ehoki", "44-d": " oeiy", "44-e": "r scaenyl", "44-f": "a", "44-g": " uoar", "44-h": "eiaor", "44-i": "oncsglvdrpetu", "44-k": "i", "44-l": " odilcu", "44-m": " aeoim", "44-n": " docteigs", "44-o": "rl nufogt", "44-p": "asheui", "44-r": "eid aosglyvun", "44-s": "t aispeh", "44-t": "i hrosu", "44-u": "snprl", "44-v": "ea", "44-w": "ah o", "44-y": " ", "44-z": "a", "45- ": "vcofltsewp1d3rm8h2", "45-0": "t0", "45-2": "0", "45-8": "4", "45-a": "rnlctudegm", "45-b": "lr", "45-c": "hitekuao", "45-d": " oeswi", "45-e": "n rdsakcypt", "45-f": " o", "45-g": "r h", "45-h": "eo", "45-i": "nagocditvr", "45-j": "a", "45-k": "ei", "45-l": "eodliuam", "45-m": "eoa", "45-n": "dtg evi", "45-o": "nvlromgif tdw", "45-p": "eh t", "45-r": " iselypua", "45-s": "ot hne", "45-t": "eihtamorus", "45-u": "ratgkm", "45-v": "ie", "45-w": "oiea", "45-x": "i", "45-y": "i", "46- ": "otafbmswghp1n", "46-0": "30", "46-8": "t", "46-a": "nrugol ic", "46-c": "artlhoy", "46-d": "ei yus", "46-e": "rsn lwdcae", "46-f": "el i", "46-g": "hye ", "46-h": "eyta", "46-i": "nopsctlvemg", "46-k": " e", "46-l": "iol ud", "46-m": "aeo p", "46-n": " egdiycost", "46-o": "nflrcv pkdsw", "46-p": "os", "46-r": "ealioshyd nbg", "46-s": " iht", "46-t": "h ireao", "46-u": "rlt", "46-v": "oei", "46-w": "ihon", "47- ": "tviesrdb1ylgoh", "47-0": "9", "47-1": "3", "47-a": "tsipcm ln", "47-b": "uia", "47-c": "aeik", "47-d": " s", "47-e": "s rnevat", "47-f": " faol", "47-g": " ueih", "47-h": "e iotry", "47-i": "vedsncrog", "47-k": "i", "47-l": "laeidok", "47-m": "oau", "47-n": "s gatueyo", "47-o": "lnotfpewrhdm", "47-p": " eh", "47-r": "iesl mrho", "47-s": "ta oc", "47-t": "hoyisreu", "47-u": "ts", "47-v": "i", "47-w": " i", "47-y": " ", "48- ": "oarybfwsgmveidthlj", "48-1": "0", "48-3": "t", "48-a": "mpsurltn", "48-b": "o", "48-c": "eok", "48-d": "eai", "48-e": " ntlugxsrpyvd", "48-f": " s", "48-g": "sih", "48-h": "aes t", "48-i": "nemtalsc", "48-k": "e ", "48-l": " daiyloe", "48-m": "ea ", "48-n": "gaoc", "48-o": "nrlmdiyau", "48-p": "eh", "48-r": "oifsle", "48-s": "t hsocp", "48-t": "h iyaoe", "48-u": "star", "48-v": "eo", "48-y": "e s", "49- ": "tiwr12fas34nodgj", "49-0": "9", "49-a": "rlnpm h", "49-b": "ie", "49-c": "ea", "49-d": " r", "49-e": " srnxtec", "49-f": "re", "49-g": " er", "49-h": "ei ot", "49-i": "nvmcseo", "49-j": "e", "49-l": " ido", "49-m": "eos", "49-n": "td gcie", "49-o": "rlfnavw", "49-p": "ehoy", "49-r": "eyovc", "49-s": " seiyma", "49-t": "eisraho uc", "49-u": "sxt", "49-v": "oe", "49-w": "ia", "49-x": "p", "49-y": "o e", "5- ": "otmsaiwbdclgfrhnepk ujy2vz345qx697", "5-0": " 2", "5-1": "120", "5-2": "124", "5-3": "r9", "5-5": "t", "5-7": " t", "5-9": "1", "5-a": "snltr mdgbpcyiewvhkaufzox", "5-b": "aeouirlyb s", "5-c": "oaher ltiukysc", "5-d": "e aoirsyulhnwdbmt", "5-e": "r nystdlamcvxeifgkuphzbowq", "5-f": "aiorle utfysp", "5-g": "ear iouhlsgnyb", "5-h": "e oaiutsbwflyrhqpcmd", "5-i": "ncegstadlo vrfmbpixku", "5-j": "oaeui", "5-k": " ieasolytmrfpbwdn", "5-l": "eia oysludktmvnrbchw", "5-m": "aieoyup bswnrclm", "5-n": " gdtieaosycnkujfbzh", "5-o": "nrf uwlmtosycvpdgeikxabh", "5-p": "eairloh psuty", "5-q": "u", "5-r": " eaiodntsyclmurwgfbhkpvz", "5-s": " teihaouscklpwmfyqnbrd", "5-t": "h eoliraysutmwbnd2jgc", "5-u": "lnrsmpeigdt cafbok", "5-v": "eiaos", "5-w": "aoieh bnrly", "5-x": " yf", "5-y": " oeswbtmvdanzlfqpc", "5-z": " ealzyoi", "50- ": "fostwm rckd1b", "50-a": "drlu", "50-c": "ealt", "50-d": " ei", "50-e": "r sanivt", "50-f": " ro", "50-g": " o", "50-h": "es", "50-i": "ngrczlp", "50-j": "o", "50-l": " ue", "50-m": "nea", "50-n": " doae", "50-o": "vnlrubfs", "50-p": "al", "50-r": "oayditsc", "50-s": " tico", "50-t": "heas", "50-u": "r", "50-v": "ei", "50-w": "eo", "50-x": " p", "50-y": " m", "51- ": "pgmftsj12vdhbawn", "51-1": "9", "51-a": "sgckfr", "51-b": "ea", "51-c": "rhe ", "51-d": " vsei", "51-e": "r smpd", "51-f": "ra ", "51-g": "ah", "51-h": "er", "51-i": "cntmds", "51-k": "i", "51-l": " aiklu", "51-m": "uoa", "51-n": " tygde", "51-o": "rfnlbmvsh", "51-p": "e ", "51-r": " estkoi", "51-s": " tcio", "51-t": "i ohsa", "51-u": "tr", "51-v": "ei", "51-w": "ae", "51-z": "a", "52- ": "miwug2tsoka", "52-9": "7", "52-a": "ticrsy", "52-b": "se", "52-c": "shua", "52-d": "ue i", "52-e": "rsal n", "52-f": " afo", "52-g": "rol", "52-h": "eotn", "52-i": "aesntco", "52-j": "a", "52-k": " e", "52-l": "lu", "52-m": "ob ie", "52-n": "t igs", "52-o": "umi", "52-p": "rae", "52-r": " eloiydcus", "52-s": "tqp", "52-t": "h uias", "52-u": "sb", "52-v": "eia", "52-w": "e", "53- ": "grkidewfs", "53-7": "6", "53-a": "rlnztym", "53-b": "l", "53-c": "tkh", "53-d": "s", "53-e": "n abslv", "53-f": "i", "53-g": "oe", "53-h": "ed", "53-i": "ndomsgi", "53-k": "i", "53-l": "adey", "53-m": "yo ", "53-n": "egs", "53-o": "numrs", "53-p": "e", "53-q": "u", "53-r": "etoais", "53-s": "tespi ", "53-t": "ieh l", "53-u": "nsmfre", "53-w": "ar", "53-y": "l", "54- ": "al1th", "54-a": "tfs", "54-b": "t", "54-d": "ae", "54-e": "s reqaol", "54-f": "fo", "54-g": "aodh", "54-h": "eo", "54-i": "oltecn", "54-k": "n", "54-l": "e ali", "54-m": " eoib", "54-n": " tdscegm", "54-o": "usnb", "54-p": "e", "54-r": "im ke", "54-s": "t seop", "54-t": "o re", "54-u": "asn", "54-v": "e", "54-w": "i", "54-y": "sm ", "54-z": "z", "55- ": "taswmbd", "55-1": "9", "55-a": "nymr t", "55-b": "ir", "55-c": "e", "55-d": "eo ", "55-e": "s roylnc", "55-f": "f", "55-g": " ", "55-h": "ta", "55-i": "nks", "55-l": "lis", "55-m": "es", "55-n": "igt", "55-o": "nro", "55-p": "a", "55-q": "u", "55-r": " i", "55-s": "tesi", "55-t": " risuha", "55-u": "s", "55-z": " ", "56- ": "cgft hbop", "56-9": "7", "56-a": "iruc", "56-b": "u", "56-c": "i", "56-d": "a", "56-e": "n", "56-f": "i", "56-g": " ", "56-h": "e", "56-i": "c ofn", "56-k": "i", "56-l": "e", "56-m": "ae", "56-n": "dgcta", "56-o": "d m", "56-r": "yeagt ", "56-s": "ocei ts", "56-t": "heioma", "56-u": "ra", "56-w": "o", "56-y": " e", "57- ": "gpacfdjw", "57-7": "0", "57-a": "tpli", "57-b": "o", "57-c": "hekral", "57-d": "s ", "57-e": "l rsg", "57-f": "e", "57-g": "sie", "57-h": "ie", "57-i": "tolanr", "57-m": "a", "57-n": "tsg", "57-o": "nr ut", "57-p": "o", "57-r": "ae", "57-t": "oa l", "57-u": "sd", "58- ": "otgl", "58-a": "rlb", "58-c": "o", "58-d": "ei", "58-e": "s ", "58-f": "r", "58-g": "a ", "58-h": "o", "58-i": "nrp", "58-j": "r", "58-k": "s", "58-l": "laeui", "58-n": "s", "58-o": "rnxp", "58-p": "pu", "58-r": "ylib", "58-s": " oh", "58-t": "i uah", "58-u": "t", "58-w": "i", "59- ": "stjih", "59-a": "nlmt", "59-b": " r", "59-e": "as", "59-g": "a", "59-h": " e", "59-i": "s oeln", "59-l": "ad se", "59-n": "gs", "59-o": "orunt", "59-p": "lu", "59-r": "lptoe ", "59-s": " t", "59-t": "h", "59-u": "tnb", "59-x": "e", "59-y": " ", "6- ": "toasbcfdrwmiglphe kjnvuyz28q937451", "6-0": "t", "6-1": " 71", "6-2": " g175", "6-3": "9 0", "6-4": " 06", "6-5": " 0", "6-6": "0", "6-7": "0", "6-9": "1 ", "6-a": "nrtlsm dycvipkgbuwfazh", "6-b": "eoauirlytsjb", "6-c": "aohet iklrcuyv", "6-d": " aeiovusrdygjh", "6-e": " rsndaltevcymfgiwpbxouk", "6-f": " oiefaulrnt", "6-g": "e haiorunlwt", "6-h": "eioa rtuynlmcb", "6-i": "ntclsgredomavf bxipkzjy", "6-j": "auoic", "6-k": " eiualyotnrh", "6-l": "iaek lyoudstfbmpcwng", "6-m": "eaoi ypubmclrts", "6-n": " gadteiscounyklvfbhmxqrj", "6-o": "nrfum losctdwypvgxkaibhqze", "6-p": "eoaitphlru symc", "6-q": "ua", "6-r": " eoiaysuptdnmklrfcgvhbwq", "6-s": " tsheioacpulmwkvnqy", "6-t": "h ioerasulytmpbcnw", "6-u": "rsntmlpeicag dbkfyzv", "6-v": "eiaos", "6-w": "ioae hsnrbml", "6-x": "pety if", "6-y": " seolambnkdctr", "6-z": "oaeliu", "60- ": "lahiv", "60-a": "rks", "60-e": "r on", "60-h": "ea ", "60-i": "n", "60-j": "o", "60-l": "es l", "60-m": "e", "60-n": "dicg", "60-o": "lnm", "60-p": "e", "60-r": "eu", "60-s": "ipae", "60-t": "ih ", "60-u": "rl", "61- ": "goib", "61-a": "rkm", "61-c": "e", "61-e": "d tsr", "61-h": "eo", "61-i": "osnv", "61-k": "s", "61-l": "aeoi", "61-m": " ", "61-n": "s c", "61-o": "sn", "61-p": "i", "61-r": " d", "61-u": "s", "61-v": "e", "62- ": "sgbmo", "62-a": "nr", "62-b": "e", "62-c": "e", "62-d": "oe", "62-e": "r d", "62-g": "a", "62-i": "rna", "62-k": "e", "62-m": "e", "62-n": "ca", "62-o": "nu", "62-r": "tr", "62-s": "h e", "62-t": "h", "62-v": "a", "63- ": "ofr", "63-a": "mlr", "63-b": "l", "63-c": "r", "63-d": " ", "63-e": "n pra", "63-g": "r", "63-h": "om", "63-m": "y", "63-n": "d ", "63-o": "eu", "63-r": "i st", "63-s": "h", "63-u": "s", "64- ": "swoij", "64-a": "c", "64-d": "so", "64-e": "s", "64-f": "e", "64-h": "a", "64-i": "ts", "64-l": "o", "64-m": "be ", "64-o": "rf", "64-p": "h", "64-r": "eadi", "64-s": "ei", "64-u": "t", "64-y": " ", "65- ": "sc", "65-a": "n", "65-b": "l", "65-c": "h", "65-d": " ", "65-e": " dnlt", "65-f": " ", "65-i": "onc", "65-j": "a", "65-o": "fon", "65-r": "p", "65-s": "iou", "65-t": " ", "65-w": "a", "66- ": " aswo", "66-a": "lm", "66-c": "ao", "66-d": "i", "66-f": " ", "66-i": "d", "66-l": "il", "66-n": "ntd ", "66-o": "nd", "66-p": "e", "66-s": "e", "66-t": "u", "66-u": "p", "67- ": "sem", "67-a": "wn", "67-d": "ce", "67-e": "c", "67-i": "bn", "67-l": "lo", "67-m": "e", "67-n": "o", "67-o": "lf", "67-p": "e", "67-s": "p", "67-u": "r", "67-w": "o", "68-b": "l", "68-c": "hr", "68-e": "lsr", "68-f": " ", "68-l": "sb", "68-m": "u", "68-n": "g ", "68-o": "nwo", "68-p": "o", "68-r": "n", "68-s": "c", "68-w": "a", "69- ": "ec", "69-a": "r", "69-b": "y", "69-c": "o", "69-h": "i", "69-l": "e", "69-n": " ", "69-o": "kd", "69-r": "es", "69-s": " t", "69-u": "r", "69-w": "s", "7- ": "tosa bcmfwlipdhrg3nejkvyzu2179q50", "7-0": "704s ", "7-1": "031 ", "7-2": "0", "7-3": "1 ", "7-4": " ", "7-5": "4t", "7-7": " ", "7-8": "3", "7-9": "1", "7-a": "nlrtys dcmpigukvbwazhfoe", "7-b": "oaeyluirbf s", "7-c": "hkr aoeiltucybs", "7-d": " eaoisydrugfmtlhn", "7-e": " rasndeltcpyvgkmxwhifuo1qb", "7-f": " ioerufalt", "7-g": " ehoairlsgtdufmn", "7-h": "eo atiuysrl", "7-i": "ntlscrodvmge afzpbkiu", "7-j": "oeuai c", "7-k": "sei anlruyho", "7-l": "le aioydfstkuvcbm", "7-m": "ae oibpmysurctdn", "7-n": " gdteasiconkyfuxvqhjbpw", "7-o": "frnuo wdpmtlsvcgkiabehyj", "7-p": "eaoirp hltyuk", "7-q": "u", "7-r": "eia solndtrkcgfuympvhwb", "7-s": " tseihauopmlkywnqcf", "7-t": "h ieoartysucmlw", "7-u": "rnstm lebcpgiafydq5uk", "7-v": "eioasjrny", "7-w": "a ieohnlsyu", "7-x": " iept", "7-y": " sponarlzeimtbcgh", "7-z": "eauzi", "70- ": " o", "70-c": "o", "70-d": " ", "70-e": " ntx", "70-i": "l", "70-k": "e", "70-o": "t", "70-r": "d", "70-s": "ht", "70-t": "o", "71- ": "jcm", "71-d": "se", "71-e": "n", "71-h": "i", "71-l": "d", "71-n": "a", "71-o": "fwn", "71-t": "t a", "71-x": "p", "72- ": "p", "72-a": "r", "72-c": "a", "72-d": "r", "72-e": "r", "72-f": " ", "72-i": "p", "72-j": "o", "72-m": "i", "72-n": " t", "72-p": "e", "72-t": "y", "72-w": "n", "73- ": "wt", "73-a": "n", "73-e": "r", "73-i": "s", "73-o": "u", "73-p": "u ", "73-r": "e ", "73-t": "r", "73-y": "s", "74- ": "o", "74-e": "n", "74-n": "v", "74-r": "io", "74-s": " s", "74-t": "h", "74-u": "rb", "74-w": "o", "75- ": "c", "75-b": "l", "75-h": "e", "75-i": "e", "75-o": "frl", "75-r": "n", "75-s": "o", "75-v": "a", "76-a": "s", "76-c": "a", "76-e": " n", "76-f": " ", "76-l": "i ", "76-n": "e", "76-o": "u", "76-r": "d", "77- ": "tkma", "77-a": "s", "77-e": "y", "77-i": "c", "77-n": "c", "77-u": "r", "78-a": "l", "78-c": " e", "78-k": "i", "78-m": "a", "78-r": "i", "78-s": "t", "78-t": "h", "79- ": "j", "79-a": "t", "79-h": "e", "79-i": "n", "79-l": "l", "79-t": "l", "8- ": "tfbaosmwicdlhpgrjken uvy32zq9157x46", "8-0": "24", "8-1": "1 3809", "8-2": "0", "8-3": "0 ", "8-5": " 1", "8-7": " ", "8-9": " ", "8-a": "nl trdscmykbigpvujhwfaezx", "8-b": "learoiybusdj", "8-c": "ahkeotilr ysucd", "8-d": " eioyasdruglvnhm", "8-e": " rnasdltekxcmyvpgfoiwzub", "8-f": " oeriafultny", "8-g": " eihaorsuvfktgl", "8-h": "eaoit urynswm", "8-i": "ngotslecmdr avfkpbiwx", "8-j": "oaeu", "8-k": " einaslyodfv", "8-l": " eiloadsyukfmtvpbcz", "8-m": "aeoi pmuybsfcr", "8-n": " edgtsiaocnkhuyvjlb", "8-o": "fnrudow ltmvgycspkbxieha", "8-p": "eali prhosuytbdf", "8-q": "ui", "8-r": "e aiosyltdrmngukcpfbhzvw", "8-s": " teishocpuakwlmnqdy", "8-t": "h eoiasrtluycmzwkb", "8-u": "trsnlmp cageikbdxof", "8-v": "eaiso", "8-w": "hinaoe tur", "8-x": "ptim", "8-y": " oseanlrgkzmptdc", "8-z": "zioeyhu ", "80-e": " ", "80-j": "o", "80-l": "e ", "80-n": "g", "80-t": "c", "81- ": "rt", "81-c": "h", "81-o": "u", "82-h": "e", "82-r": "i", "82-t": "i", "82-u": "r", "83-e": "s", "83-i": "nm", "83-r": "n", "84-m": "e", "84-n": "ag", "85-a": "l", "9- ": "tgoabsmcfhdwiplrenvjk u2yqz137569", "9-0": " 10", "9-1": "085", "9-2": " 052", "9-3": " ", "9-4": " ", "9-5": "0", "9-7": "0", "9-9": "904", "9-a": "nrlt mcdsiygufkwpvzxbaohje", "9-b": "ueolairysbh ", "9-c": "hoeak irlutys", "9-d": " eaoisyrvugdlhnzjfm", "9-e": " rsnatdlceymvofxipkwugh", "9-f": " roeaifults", "9-g": " ieahrouslgndy", "9-h": "eo aitrnyulmb", "9-i": "ntsclergavod fmuibkp", "9-j": "aeuoif", "9-k": " iesaoynlubh", "9-l": "ei laosyduvmktrzfpb", "9-m": "aeoyi upsmrb", "9-n": " dgteiocsykanufhljq", "9-o": "nfr uomlwsdvytpkecgbizajh", "9-p": "ealripo hstyucd", "9-q": "u", "9-r": " iaeostydnrukmlcghvpfb", "9-s": " tehiocaspulwkyqn", "9-t": "h eoairytluscwdm", "9-u": "nsrteclmdpaviyogb ", "9-v": "eiaou", "9-w": "ihen aosbkr", "9-x": "xtpyae ", "9-y": " soanwetiydlvz", "9-z": "a oie"}
        }
    },
    computed: {
        keys() {
            // Returns a list of coordinates, along with the ranking of the key with respect to the
            // last pressed key. That allows determining what will be the new character for that
            // key in the next iteration.
            let keys = []
            let id = 0
            for (r = 0; r < this.rows; r++) {
                for (c = 0; c < this.cols; c++) {
                    keys.push({
                        id,
                        r,
                        c,
                        d: Math.abs(r - this.r) + Math.abs(c - this.c),
                        dc: Math.hypot(r - (this.rows - 1) / 2, c - (this.cols - 1) / 2),
                        ranking: null
                    })
                    id += 1
                }
            }
            let sorted = structuredClone(keys).sort((a, b) => (
                a.d - b.d || a.dc - b.dc || a.r - b.r || a.c - b.c
            ))
            keys.forEach((key, i) => {
                key.ranking = sorted.findIndex(x => x.id === key.id)
            })
            return keys
        },
        input() {
            return this.keysPressed.map(x => x.char).join('')
        },
        r() {
            return this.keysPressed[this.keysPressed.length - 1]?.r || 0
        },
        c() {
            return this.keysPressed[this.keysPressed.length - 1]?.c || 0
        },
        pos() {
            return this.keysPressed.length
        },
        prevChar() {
            return this.keysPressed[this.keysPressed.length - 1]?.char
        },
    },
    methods: {
        click(r, c, char) {
            this.distances.push(Math.abs(r - this.r) + Math.abs(c - this.c))
            this.keysPressed.push({r, c, char})
        },
        charAtIndex(index) {
            if (this.prevChar === undefined) {
                return this.mostCommon[index]
            }
            return this.mostCommonAfter[`${this.pos}-${this.prevChar}`][index]
        },
        cancel() {
            this.keysPressed.pop()
            this.distances.pop()
        },
        write(sentence) {
            while (this.input.length > 0) {
                this.cancel()
            }
            sentence.split('').forEach(char => {
                let key = this.keys.find(x => this.charAtIndex(x.ranking) === char)
                this.click(key.r, key.c, char)
            })
        }
    }
  }).mount('#memorized')
</script>
{{< /rawhtml >}}
</br>

You'll notice that this keyboard suggests less characters than the previous one. That's because characters which don't appear after the previous one are discarded. And because we're also encoding the character's position, more cases are discarded. This somewhat reminds me inputting addresses in a GPS, where only plausible next characters are available when you type.

## Benchmarking

A little while ago I wrote a small Python library called [clavier](https://github.com/MaxHalford/clavier). I used it to measure edit distances between OCR inputs and a database of correct inputs. Using the context keyboard's physical helped making better spelling corrections.

Anyway, I did a few little changes to accomodate for a dynamic keyboard. This allowed to benchmark the three keyboards in this blog post. For each keyboard, I simply measured the amount of necessary ⬆️⬇️⬅️➡️ movements. I then plotted the distribution for each method and calculated some summary statistics. The code for running this benchmark is available [here](https://gist.github.com/MaxHalford/83e48c23a1086e463858aba4dc9990fe).

<div align="center">
<figure >
    <img src="/img/blog/dynamic-on-screen-keyboards/benchmarks.svg" style="box-shadow: none;">
    <figcaption>Typing distance distribution by method</figcaption>
</figure>
</div>

```
method     mean    std  min   25%   50%   75%    max
regular      75     48    2    42    64    97    393
dynamic      25     14    2    16    22    31    127
memorized    23     12    2    15    21    29     85
```

The dynamic keyboard is faster than the regular keyboard in 99% of cases. The more sophisticated dynamic keyboard -- which is named `memorized` above -- is faster than the dynamic one in 70% of cases. I actually expected the more granular probability model to be consistently better, but it wasn't. And yet, my gut feeling is that there is still room for improvement. After all, the goal here is not to build a probability model that generalizes, but one that memorizes the list of titles.

However, one thing to take into account is the probability model's memory usage. The first version I implemented is simple, and yet is elegant in that it only requires building a list of next characters for every character. The second model requires one entry for each character and each position. Any more sophisticated model would take up more space, which may be burdensome.

I was pleasantly surprised when I found out I wasn't the first person to conduct a comparison between on-screen TV keyboards out in the open. Indeed, I found [this](https://blogs.sas.com/content/iml/2018/09/12/interfaces-remote-control-text.html) technical blog post by Rick Wicklin comparing a Netflix keyboard to an Amazon keyboard on a list of popular movies from IMDB. I tried running my benchmark with his list of movies, but I wasn't able to reconcile the figures he found for the Netflix keyboard. Rick's experiment in SAS, and my university years are too far behind for me to dig into his implementation.

## Conclusion

Is this really any faster? It is if you assume the distance between keystrokes is a good proxy for typing speed. However, I think that assumption is a bit weak in practice. I showed this dynamic keyboard to some friends. All of them mentioned being confused, and didn't seem to be faster than with the regular keyboard. I did some tests myself, and I have to admit I didn't notice a significant difference. However, you could argue that this simply takes some getting used to. But then again, it's difficult to get used to something you don't often use.

All in all I'm still convinced dynamic keyboards are worthwhile. Maybe they provide even more value for languages with longer alphabets than the Latin one. Personally, I'd love to see such a dynamic keyboard implemented in popular TV apps. Imagine the amount of *seconds* the human race would save in total -- I'm just being sarcastic of course 😅.