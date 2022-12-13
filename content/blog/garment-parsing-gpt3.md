+++
date = "2022-11-20"
title = "Parsing garment descriptions with GPT-3"
toc = true
tags = ['text-processing']
+++

## The task

You'll have heard of GPT-3 if you haven't been hiding under a rock. I've recently been impressed by Nat Friedman [teaching](https://twitter.com/natfriedman/status/1575631194032549888) GPT-3 to use a browser, and SeekWell [generating](https://blog.seekwell.io/gpt3) SQL queries from free-text. I think the most exciting usecases are yet to come. But GPT-3 has a good chance of changing the way we approach mundane tasks at work.

I wrote an [article](/blog/carbonfact-nlp-open-problem) a couple of months ago about a boring task I have to do at work. I got a few interesting suggestions by email. Raphaël suggested a [question-answering](https://huggingface.co/tasks/question-answering) model [here](https://raphaelsty.github.io/blog/qa/). I've slowly become convinced that GPT-3 might be the perfect tool for the job. It's cold and miserable where I am, so I thought it would be opportune to take GPT-3 for a spin 🧙

This thing I have to do at work is convert human inputs like this:

```
lace: 90% nylon 10% spandex; fabric: 80% nylon 20%spandexndex
```

into structured JSONs like this:

```json
{
  "fabric": [
    {
      "material": "nylon",
      "proportion": 80
    },
    {
      "material": "spandex",
      "proportion": 20
    }
  ],
  "lace": [
    {
      "material": "nylon",
      "proportion": 90
    },
    {
      "material": "spandex",
      "proportion": 10
    }
  ]
}
```

I provided a training set of 600 such input/output pairs [here](/blog/carbonfact-nlp-open-problem/#the-data).

It's possible to solve this task with regex patterns and string preprocessing. But it's a painful process. There are typos, material names have to be recognised and normalized, proportions have to be assigned to the correct material, materials have to grouped into components, etc. It's definitely not trivial.

Even if I were to implement an end-to-end supervised ML pipeline, there would be a lot of work to set it up and maintain it. I'm definitely open to trying an end-to-end black box like GPT-3.

## Choosing a tool

After a bit of googling around I found this [gpt3-sandbox](https://github.com/shreyashankar/gpt3-sandbox) which seemed straightforward. It provides a simple interface to build a prompt from a list of examples, send the prompt to [OpenAI](https://openai.com/), and get an answer back. However, it feels weird to me to build a set of examples for every sample I want to parse. It seems far more natural to train GPT-3 on a training set, and then ask it to parse new samples.

And so I went on the lookout for solutions to fine-tune a GPT-3-like model. One option is to use [Hugging Face](https://huggingface.co/) to load an [EleutherAI](https://www.eleuther.ai/) or [BLOOM](https://huggingface.co/bigscience/bloom) pre-trained network. But that requires installing a whole bunch of packages. I'm not in the mood for that. I just want an API. Sue me.

Next I found great stuff like this [20B parameter EleutherAI playground](https://20b.eleuther.ai/), [DUST](https://dust.tt), [GooseAI](https://goose.ai/) and [TextSynth](https://textsynth.com/index.html). But they're "just" playgrounds where you can input something and get an output. They don't provide ways to fine-tune a model and re-use it. The only solution I found is OpenAI. I really like what they're doing. As someone who just wants to experiment on a Sunday, their API is a great way to get started. And no I'm not getting payed to write this 😄

OpenAI's [fine-tuning documentation](https://beta.openai.com/docs/guides/fine-tuning) are easy on the eyes. They even have an [entity recognition example](https://beta.openai.com/docs/guides/fine-tuning/case-study-entity-extraction), which is more or less what my task is about.

## Preparing the data

To fine-tune a GPT-3 model, you have to build a training set of [inputs](/files/datasets/nlp-carbonfact/inputs.txt) and [outputs](/files/datasets/nlp-carbonfact/outputs.json). OpenAI requires this to be in [JSON Lines text format](https://jsonlines.org/). OpenAI also recommends adding a `\n\n###\n\n` delimiter to each input, a blank space at the start of each output, and an ` END` delimiter at the end of each output. It beats me why they don't do this for you 🤷‍♂️

Anyway, building the training set is straightforward. The dataset I have has is 600 samples, so I decided to use the first 300 for training and the rest for validation later on.

```py
import json
from itertools import islice
from pathlib import Path

inputs = Path('inputs.txt').read_text().splitlines()
outputs = json.loads(Path('outputs.json').read_text())

training_data = [
    {
        "prompt": f"{inp}\n\n###\n\n",
        "completion": f" {out} END"
    }
    for inp, out in islice(zip(inputs, outputs), 300)
]

jsonl = "\n".join(map(json.dumps, training_data))
Path('training_data.jsonl').write_text(jsonl)
```

A good thing to check here is the lengths of the inputs and outputs. Indeed, the OpenAI models have a limit on the number of tokens they can process at a time. A token is an abstract concept, but it's roughly equivalent to 4 characters [according](https://beta.openai.com/tokenizer) to their docs. Let's check.

```py
>>> # Largest number of tokens in the inputs
>>> max(map(len, inputs)) // 4
38

>>> # Largest number of tokens in the outputs
>>> max(len(json.dumps(out)) for out in outputs) // 4
95
```

OpenAI's smallest model, Ada, supports up to 2048 tokens. We make the cut by far.

## Fine-tuning

OpenAI exposes an API. But they also ship a Python [library](https://github.com/openai/openai-python) for ease-of-use.

```sh
pip install openai
```

Installing this also includes a CLI with several commands. For instance, there's a command to vet the training set:

```sh
$ openai tools fine_tunes.prepare_data \
    -f training_data.jsonl
```

```
Analyzing...

- Your file contains 300 prompt-completion pairs
- All prompts end with suffix `\n\n###\n\n`
- All completions end with suffix `}]} END`

No remediations found.

You can use your file for fine-tuning:
> openai api fine_tunes.create -t "training_data.jsonl"

After you’ve fine-tuned a model, remember that your prompt has to end with the indicator string `\n\n###\n\n` for the model to start generating completions, rather than continuing with the prompt. Make sure to include `stop=["}]} END"]` so that the generated texts ends at the expected place.
Once your model starts training, it'll approximately take 6.56 minutes to train a `curie` model, and less for `ada` and `babbage`. Queue will approximately take half an hour per job ahead of you.
```

All good. Now we can do the fine-tuning. But OpenAI has several [model variants](https://beta.openai.com/docs/models/gpt-3) to choose from. I started with [Ada](https://beta.openai.com/docs/models/ada) because it's the cheapest one, and is labeled as being good at parsing text.

```sh
$ export OPENAI_API_KEY=<🤐>
$ openai api fine_tunes.create \
    -t training_data.jsonl \
    -m ada \
    --no_check_if_files_exist \
    --suffix garment-parser
```

```
Upload progress: 100%|██████████████████████████| 74.3k/74.3k [00:00<00:00, 48.4Mit/s]
Uploaded file from training_data.jsonl: file-lKmZrjNDJaRd9mVkTQiq1sV8
Created fine-tune: ft-QbZmdeIBW0XwmQTdhKOBmEMx
Streaming events until fine-tuning is complete...

(Ctrl-C will interrupt the stream, but not cancel the fine-tune)
[2022-11-20 19:45:55] Created fine-tune: ft-QbZmdeIBW0XwmQTdhKOBmEMx
[2022-11-20 19:46:01] Fine-tune costs $0.04
[2022-11-20 19:46:02] Fine-tune enqueued. Queue number: 0
[2022-11-20 19:46:03] Fine-tune started
[2022-11-20 19:46:58] Completed epoch 1/4
[2022-11-20 19:47:39] Completed epoch 2/4
[2022-11-20 19:48:21] Completed epoch 3/4
[2022-11-20 19:49:03] Completed epoch 4/4
[2022-11-20 19:49:26] Uploaded model: ada:ft-personal:garment-parser-2022-11-20-18-49-25
[2022-11-20 19:49:26] Uploaded result file: file-cLrqI4ECTHSdHSnPUeCP665T
[2022-11-20 19:49:26] Fine-tune succeeded

Job complete! Status: succeeded 🎉
Try out your fine-tuned model:

openai api completions.create -m ada:ft-personal:garment-parser-2022-11-20-18-49-25 -p <YOUR_PROMPT>
```

$0.04 is pretty cheap. Also it's quite cool they display this in the CLI. It would probably cost more in electricity if I were to do run on my laptop ⚡️

## Parsing new inputs

I've kept half of the initial data to validate the fine-tuned model. The `openai` Python package provides a method to "complete" a prompt using a pre-trained model. This is nice because there's no need to pass the initial data that was used for fine-tuning, as is the case with regular GPT-3 prompts. The fine-tuned model already has all the context.

Some care needs to be given to the input parameters. The end of input delimiter, `" END"`, needs to be respecified. Else the model will go haywire and keep producing outputs while it has tokens left. Speaking of which, the default number of tokens is 16. A higher value needs to be set, else the outputs are too short. I picked 400, which is very high in my case. Finally, because I'm not looking to be creative and instead know there's only a single valid output, I set the temperature to 0. I got this advice from the OpenAI [completion docs](https://beta.openai.com/docs/api-reference/completions/create).

```py
import openai
from tqdm import tqdm

openai.api_key = '<🤐>'

completions = [
    openai.Completion.create(
        prompt=f'{inp}\n\n###\n\n',
        model='ada:ft-personal:garment-parser-2022-11-20-18-49-25',
        stop=[' END'],
        max_tokens=400,
        temperature=0
    )
    for inp in tqdm(inputs[300:])
]
```

```
100%|██████████| 300/300 [03:13<00:00,  1.55it/s]
```

I find it a tad slow, especially considering I'm using the smallest model variant. My regex logic runs near instantaneously in comparison. But who am I to complain? Anyway, throughput is a secondary concern, what matters most is correctness.

## How good is it?

The output from OpenAI is a piece of text. A tiny bit work is necessary to cast each output to JSON.

```py
test_outputs = []
json_fmt_errors = {}

for i, c in enumerate(completions):
    try:
        test_output = c['choices'][0]['text'].lstrip()
        test_outputs.append(json.loads(test_output.replace("'", '"')))
    except json.JSONDecodeError as e:
        test_outputs.append({})
        json_fmt_errors[i] = test_output
```

First of all, it's nice to find out only three outputs are invalid JSONs. That's **99% recall**. Two outputs have a same key appearing twice. The third one has an extra `]`. Overall I think this is a good result, considering I gave no instructions to produce valid JSON -- which if I recall is more or less possible.

```
INPUT
rib - 95% bci cotton 5% elastane/ lace - 90% recycle polyamide 10% elastane
OUTPUT
{'lace': [{'material': 'recycle polyamide', 'proportion': 90.0}, {'material': 'elastane', 'proportion': 10.0}], 'proportion': 95.0}], 'lace': [{'material': 'recycle polyamide', 'proportion': 90.0}, {'material': 'elastane', 'proportion': 10.0}]}

INPUT
rib - 95% bci cotton 5%elastane/ lace - 90% recycle polyamide 10% elastane
OUTPUT
{'lace': [{'material': 'recycle polyamide', 'proportion': 90.0}, {'material': 'elastane', 'proportion': 10.0}], 'proportion': 95.0}], 'lace': [{'material': 'recycle polyamide', 'proportion': 90.0}, {'material': 'elastane', 'proportion': 10.0}]}

INPUT
rib - 95% cotton 5%elastane/ lace - 90% recycle polyamide 10% elastane
OUTPUT
{'lace': [{'material': 'recycle polyamide', 'proportion': 90.0}, {'material': 'elastane', 'proportion': 10.0}], 'proportion': 95.0}]}
```

As for the 297 valid JSONs, 44 of them were incorrect. That's **85% precision**. Here are all the mistakes:

<details>
  <summary>Inspect the 44 mistakes 👀</summary>

```
INPUT
100% polyester woven (pant) and 95% viscose  5%spandex knitted top
TRUTH
{'pants': [{'material': 'polyester knitted', 'proportion': 100.0}]}
OUTPUT
{'': [{'material': 'polyester', 'proportion': 100.0}]}

INPUT
86% nylon, 14% span
TRUTH
{'': [{'material': 'nylon', 'proportion': 86.0}, {'material': 'spandex', 'proportion': 14.0}]}
OUTPUT
{'': [{'material': 'nylon', 'proportion': 86.0}, {'material': 'span', 'proportion': 14.0}]}

INPUT
80% nylon, 20% span
TRUTH
{'': [{'material': 'nylon', 'proportion': 80.0}, {'material': 'spandex', 'proportion': 20.0}]}
OUTPUT
{'': [{'material': 'nylon', 'proportion': 80.0}, {'material': 'span', 'proportion': 20.0}]}

INPUT
80% polyester, 20% span
TRUTH
{'': [{'material': 'polyester', 'proportion': 80.0}, {'material': 'spandex', 'proportion': 20.0}]}
OUTPUT
{'': [{'material': 'polyester', 'proportion': 80.0}, {'material': 'span', 'proportion': 20.0}]}

INPUT
95% polyester, 5% span
TRUTH
{'': [{'material': 'polyester', 'proportion': 95.0}, {'material': 'spandex', 'proportion': 5.0}]}
OUTPUT
{'': [{'material': 'polyester', 'proportion': 95.0}, {'material': 'span', 'proportion': 5.0}]}

INPUT
50% cotton/algodón/coton 50% polyester/poliéster
TRUTH
{'': [{'material': 'cotton', 'proportion': 50.0}, {'material': 'polyester', 'proportion': 50.0}]}
OUTPUT
{'': [{'material': 'cotton', 'proportion': 50.0}, {'material': 'polyester', 'proportion': 50.0}, {'material': 'poliéster', 'proportion': 50.0}]}

INPUT
87% polyester, 13% span
TRUTH
{'': [{'material': 'polyester', 'proportion': 87.0}, {'material': 'spandex', 'proportion': 13.0}]}
OUTPUT
{'': [{'material': 'polyester', 'proportion': 87.0}, {'material': 'span', 'proportion': 13.0}]}

INPUT
86% polyester, 14% span
TRUTH
{'': [{'material': 'polyester', 'proportion': 86.0}, {'material': 'spandex', 'proportion': 14.0}]}
OUTPUT
{'': [{'material': 'polyester', 'proportion': 86.0}, {'material': 'span', 'proportion': 14.0}]}

INPUT
88% polyester, 12% span
TRUTH
{'': [{'material': 'polyester', 'proportion': 88.0}, {'material': 'spandex', 'proportion': 12.0}]}
OUTPUT
{'': [{'material': 'polyester', 'proportion': 88.0}, {'material': 'span', 'proportion': 12.0}]}

INPUT
85% nylon, 15% span
TRUTH
{'': [{'material': 'nylon', 'proportion': 85.0}, {'material': 'spandex', 'proportion': 15.0}]}
OUTPUT
{'': [{'material': 'nylon', 'proportion': 85.0}, {'material': 'span', 'proportion': 15.0}]}

INPUT
88%poliamide 12%elastane
TRUTH
{'': [{'material': 'polyamide', 'proportion': 88.0}, {'material': 'elastane', 'proportion': 12.0}]}
OUTPUT
{'': [{'material': 'poliamide', 'proportion': 88.0}, {'material': 'elastane', 'proportion': 12.0}]}

INPUT
88% poliamide 12% elastane
TRUTH
{'': [{'material': 'polyamide', 'proportion': 88.0}, {'material': 'elastane', 'proportion': 12.0}]}
OUTPUT
{'': [{'material': 'poliamide', 'proportion': 88.0}, {'material': 'elastane', 'proportion': 12.0}]}

INPUT
82% polyester, 18% span
TRUTH
{'': [{'material': 'polyester', 'proportion': 82.0}, {'material': 'spandex', 'proportion': 18.0}]}
OUTPUT
{'': [{'material': 'polyester', 'proportion': 82.0}, {'material': 'span', 'proportion': 18.0}]}

INPUT
shell:92% polyester 8% spandex  lining:78% polyester 22% spandex
TRUTH
{'lining': [{'material': 'polyester', 'proportion': 78.0}, {'material': 'spandex', 'proportion': 22.0}], 'shell': [{'material': 'polyester', 'proportion': 92.0}, {'material': 'spandex', 'proportion': 8.0}]}
OUTPUT
{'lining': [{'material': 'polyester', 'proportion': 78.0}, {'material': 'spandex', 'proportion': 22.0}], 'lace': [{'material': 'polyester', 'proportion': 78.0}, {'material': 'spandex', 'proportion': 22.0}]}

INPUT
fabric - 83% polyamide 17% elastane/ elastic - 83% polyester 9% elastane 8% polyamide
TRUTH
{'elastic': [{'material': 'polyester', 'proportion': 83.0}, {'material': 'elastane', 'proportion': 9.0}, {'material': 'polyamide', 'proportion': 8.0}], 'fabric': [{'material': 'polyamide', 'proportion': 83.0}, {'material': 'elastane', 'proportion': 17.0}]}
OUTPUT
{'elastic': [{'material': 'polyester', 'proportion': 83.0}, {'material': 'elastane', 'proportion': 9.0}, {'material': 'polyamide', 'proportion': 8.0}], 'fabric': [{'material': 'polyamide', 'proportion': 83.0}, {'material': 'elastane', 'proportion': 9.0}]}

INPUT
95% cotton 5% spande
TRUTH
{'': [{'material': 'cotton', 'proportion': 95.0}, {'material': 'spandex', 'proportion': 5.0}]}
OUTPUT
{'': [{'material': 'cotton', 'proportion': 95.0}, {'material': 'spande', 'proportion': 5.0}]}

INPUT
92% polyester, 8% span
TRUTH
{'': [{'material': 'polyester', 'proportion': 92.0}, {'material': 'spandex', 'proportion': 8.0}]}
OUTPUT
{'': [{'material': 'polyester', 'proportion': 92.0}, {'material': 'span', 'proportion': 8.0}]}

INPUT
76% nylon, 24% span
TRUTH
{'': [{'material': 'nylon', 'proportion': 76.0}, {'material': 'spandex', 'proportion': 24.0}]}
OUTPUT
{'': [{'material': 'nylon', 'proportion': 76.0}, {'material': 'span', 'proportion': 24.0}]}

INPUT
body 85%polyamide,15%elastane g string 53%polyamide,36%cotton,11%elastane
TRUTH
{'body': [{'material': 'polyamide', 'proportion': 85.0}, {'material': 'elastane', 'proportion': 15.0}], 'g-string': [{'material': 'polyamide', 'proportion': 53.0}, {'material': 'cotton', 'proportion': 36.0}, {'material': 'elastane', 'proportion': 11.0}]}
OUTPUT
{'body': [{'material': 'polyamide', 'proportion': 85.0}, {'material': 'elastane', 'proportion': 15.0}], 'g': [{'material': 'polyamide', 'proportion': 53.0}, {'material': 'cotton', 'proportion': 36.0}, {'material': 'elastane', 'proportion': 11.0}]}

INPUT
body 85%polyamide,15%elastane g string 51%polyamide,39%cotton,10%elastane
TRUTH
{'body': [{'material': 'polyamide', 'proportion': 85.0}, {'material': 'elastane', 'proportion': 15.0}], 'g-string': [{'material': 'polyamide', 'proportion': 51.0}, {'material': 'cotton', 'proportion': 39.0}, {'material': 'elastane', 'proportion': 10.0}]}
OUTPUT
{'body': [{'material': 'polyamide', 'proportion': 85.0}, {'material': 'elastane', 'proportion': 15.0}], 'g': [{'material': 'polyamide', 'proportion': 51.0}, {'material': 'cotton', 'proportion': 39.0}, {'material': 'elastane', 'proportion': 10.0}]}

INPUT
47% bci cotton, 47% ecovero viscose, 6% spandex
TRUTH
{'': [{'material': 'cotton', 'proportion': 47.0}, {'material': 'ecovero viscose', 'proportion': 47.0}, {'material': 'spandex', 'proportion': 6.0}]}
OUTPUT
{'': [{'material': 'cotton', 'proportion': 47.0}, {'material': 'ecovero', 'proportion': 47.0}, {'material': 'spandex', 'proportion': 6.0}]}

INPUT
top body: 87% polyester 13% spandex, top lining: 94% polyester 6% spandex. bottom: 87% polyester, 13% spandex
TRUTH
{'bottom': [{'material': 'polyester', 'proportion': 87.0}, {'material': 'spandex', 'proportion': 13.0}], 'lining': [{'material': 'polyester', 'proportion': 94.0}, {'material': 'spandex', 'proportion': 6.0}], 'top_body': [{'material': 'polyester', 'proportion': 87.0}, {'material': 'spandex', 'proportion': 13.0}]}
OUTPUT
{'bottom': [{'material': 'polyester', 'proportion': 87.0}, {'material': 'spandex', 'proportion': 13.0}], 'top_lining': [{'material': 'polyester', 'proportion': 94.0}, {'material': 'spandex', 'proportion': 6.0}]}

INPUT
lace - 84% recycle polyamide 16% elastane/ mesh - 89% polyamide 11% elastane
TRUTH
{'lace': [{'material': 'recycled polyamide', 'proportion': 84.0}, {'material': 'elastane', 'proportion': 16.0}], 'mesh': [{'material': 'polyamide', 'proportion': 89.0}, {'material': 'elastane', 'proportion': 11.0}]}
OUTPUT
{'lace': [{'material': 'recycle polyamide', 'proportion': 84.0}, {'material': 'elastane', 'proportion': 16.0}], 'mesh': [{'material': 'polyamide', 'proportion': 89.0}, {'material': 'elastane', 'proportion': 11.0}]}

INPUT
lace - 88% polyamide 12% elastane/ mesh - 94% recycle polyamide 6% elastane
TRUTH
{'lace': [{'material': 'polyamide', 'proportion': 88.0}, {'material': 'elastane', 'proportion': 12.0}], 'mesh': [{'material': 'recycled polyamide', 'proportion': 94.0}, {'material': 'elastane', 'proportion': 6.0}]}
OUTPUT
{'lace': [{'material': 'polyamide', 'proportion': 88.0}, {'material': 'elastane', 'proportion': 12.0}], 'mesh': [{'material': 'recycle polyamide', 'proportion': 94.0}, {'material': 'elastane', 'proportion': 6.0}]}

INPUT
ank: 95% rayon 5% spandex , pant: 95% polyester 5% spandex
TRUTH
{'ank': [{'material': 'rayon', 'proportion': 95.0}, {'material': 'spandex', 'proportion': 5.0}], 'pant': [{'material': 'polyester', 'proportion': 95.0}, {'material': 'spandex', 'proportion': 5.0}]}
OUTPUT
{'pant': [{'material': 'polyester', 'proportion': 95.0}, {'material': 'spandex', 'proportion': 5.0}], 'knee': [{'material': 'polyester', 'proportion': 95.0}, {'material': 'spandex', 'proportion': 5.0}]}

INPUT
95% bci cotton,5% spandex
TRUTH
{'': [{'material': 'cotton', 'proportion': 95.0}, {'material': 'spandex', 'proportion': 5.0}]}
OUTPUT
{'': [{'material': 'bci cotton', 'proportion': 95.0}, {'material': 'spandex', 'proportion': 5.0}]}

INPUT
95%bci cotton,5%spandex
TRUTH
{'': [{'material': 'cotton', 'proportion': 95.0}, {'material': 'spandex', 'proportion': 5.0}]}
OUTPUT
{'': [{'material': 'bci', 'proportion': 95.0}, {'material': 'spandex', 'proportion': 5.0}]}

INPUT
body 72%polyamide,18%polyester,10%elastane g string 56%polyamide,38%cotton,6%elastane
TRUTH
{'body': [{'material': 'polyamide', 'proportion': 72.0}, {'material': 'polyester', 'proportion': 18.0}, {'material': 'elastane', 'proportion': 10.0}], 'g-string': [{'material': 'polyamide', 'proportion': 56.0}, {'material': 'cotton', 'proportion': 38.0}, {'material': 'elastane', 'proportion': 6.0}]}
OUTPUT
{'body': [{'material': 'polyamide', 'proportion': 72.0}, {'material': 'polyester', 'proportion': 18.0}, {'material': 'elastane', 'proportion': 10.0}], 'g': [{'material': 'polyamide', 'proportion': 56.0}, {'material': 'cotton', 'proportion': 38.0}, {'material': 'elastane', 'proportion': 6.0}]}

INPUT
body 68%polyamide,22%polyester,10%elastane g string 56%polyamide,38%cotton,6%elastane
TRUTH
{'body': [{'material': 'polyamide', 'proportion': 68.0}, {'material': 'polyester', 'proportion': 22.0}, {'material': 'elastane', 'proportion': 10.0}], 'g-string': [{'material': 'polyamide', 'proportion': 56.0}, {'material': 'cotton', 'proportion': 38.0}, {'material': 'elastane', 'proportion': 6.0}]}
OUTPUT
{'body': [{'material': 'polyamide', 'proportion': 68.0}, {'material': 'polyester', 'proportion': 22.0}, {'material': 'elastane', 'proportion': 10.0}], 'g': [{'material': 'polyamide', 'proportion': 56.0}, {'material': 'cotton', 'proportion': 38.0}, {'material': 'elastane', 'proportion': 6.0}]}

INPUT
48% rayon, 32% recycle polyester,  20% polyamide
TRUTH
{'': [{'material': 'rayon', 'proportion': 48.0}, {'material': 'recycled polyester', 'proportion': 32.0}, {'material': 'polyamide', 'proportion': 20.0}]}
OUTPUT
{'': [{'material': 'rayon', 'proportion': 48.0}, {'material': 'recycle polyester', 'proportion': 32.0}, {'material': 'polyamide', 'proportion': 20.0}]}

INPUT
87% polyester, 13%span
TRUTH
{'': [{'material': 'polyester', 'proportion': 87.0}, {'material': 'spandex', 'proportion': 13.0}]}
OUTPUT
{'': [{'material': 'polyester', 'proportion': 87.0}, {'material': 'span', 'proportion': 13.0}]}

INPUT
lace - 88% polyamide 125 elastane/ mesh - 84% polyamide 16% lycra
TRUTH
{'lace': [{'material': 'polyamide', 'proportion': 88.0}, {'material': 'elastane', 'proportion': 12.0}], 'mesh': [{'material': 'polyamide', 'proportion': 84.0}, {'material': 'lycra', 'proportion': 16.0}]}
OUTPUT
{'lace': [{'material': 'polyamide', 'proportion': 88.0}, {'material': 'elastane', 'proportion': 125.0}], 'mesh': [{'material': 'polyamide', 'proportion': 84.0}, {'material': 'lycra', 'proportion': 16.0}]}

INPUT
op body: 87% polyester 13% spandex, top lining: 94% polyester 6% spandex. bottom: 87% polyester, 13% spandex
TRUTH
{'bottom': [{'material': 'polyester', 'proportion': 87.0}, {'material': 'spandex', 'proportion': 13.0}], 'lining': [{'material': 'polyester', 'proportion': 94.0}, {'material': 'spandex', 'proportion': 6.0}], 'top_body': [{'material': 'polyester', 'proportion': 87.0}, {'material': 'spandex', 'proportion': 13.0}]}
OUTPUT
{'bottom': [{'material': 'polyester', 'proportion': 87.0}, {'material': 'spandex', 'proportion': 13.0}], 'top_lining': [{'material': 'polyester', 'proportion': 94.0}, {'material': 'spandex', 'proportion': 6.0}]}

INPUT
body 96%polyamide,4%elastane g string 67%polyamide,26%cotton,7%elastane
TRUTH
{'body': [{'material': 'polyamide', 'proportion': 96.0}, {'material': 'elastane', 'proportion': 4.0}], 'g-string': [{'material': 'polyamide', 'proportion': 67.0}, {'material': 'cotton', 'proportion': 26.0}, {'material': 'elastane', 'proportion': 7.0}]}
OUTPUT
{'body': [{'material': 'polyamide', 'proportion': 96.0}, {'material': 'elastane', 'proportion': 4.0}], 'g': [{'material': 'polyamide', 'proportion': 67.0}, {'material': 'cotton', 'proportion': 26.0}, {'material': 'elastane', 'proportion': 7.0}]}

INPUT
body 96% polyamide 4% elastane g string 65%polyamide,28%cotton,7%elastane
TRUTH
{'body': [{'material': 'polyamide', 'proportion': 96.0}, {'material': 'elastane', 'proportion': 4.0}], 'g-string': [{'material': 'polyamide', 'proportion': 65.0}, {'material': 'cotton', 'proportion': 28.0}, {'material': 'elastane', 'proportion': 7.0}]}
OUTPUT
{'body': [{'material': 'polyamide', 'proportion': 96.0}, {'material': 'elastane', 'proportion': 4.0}], 'g': [{'material': 'polyamide', 'proportion': 65.0}, {'material': 'cotton', 'proportion': 28.0}, {'material': 'elastane', 'proportion': 7.0}]}

INPUT
60% cotton 40% modal  knited top with 100% cotton  woven top
TRUTH
{'': [{'material': 'cotton', 'proportion': 60.0}, {'material': 'modal', 'proportion': 40.0}], 'knitted_top': [{'material': 'cotton woven top', 'proportion': 100.0}]}
OUTPUT
{'': [{'material': 'cotton', 'proportion': 60.0}, {'material': 'modal', 'proportion': 40.0}, {'material': 'polyester', 'proportion': 20.0}]}

INPUT
96%eco vero rayon,4%elastane
TRUTH
{'': [{'material': 'eco vero rayon', 'proportion': 96.0}, {'material': 'elastane', 'proportion': 4.0}]}
OUTPUT
{'': [{'material': 'eco', 'proportion': 96.0}, {'material': 'elastane', 'proportion': 4.0}]}

INPUT
lace - 30% recycled polyamide 56% polyamide 14% elastane/trim lace - 84% polyamide 16% elastane
TRUTH
{'lace': [{'material': 'recycled polyamide', 'proportion': 30.0}, {'material': 'polyamide', 'proportion': 56.0}, {'material': 'elastane', 'proportion': 14.0}], 'trim_lace': [{'material': 'polyamide', 'proportion': 84.0}, {'material': 'elastane', 'proportion': 16.0}]}
OUTPUT
{'lace': [{'material': 'polyamide', 'proportion': 30.0}, {'material': 'polyamide', 'proportion': 56.0}, {'material': 'elastane', 'proportion': 14.0}], 'trim': [{'material': 'polyamide', 'proportion': 84.0}, {'material': 'elastane', 'proportion': 16.0}]}

INPUT
striped mesh - 90% polyamide 10% elastane/lace - 48% recycled polyamide 40% polyamide 12% elastane/mesh - 88% recycled polyamide 12% elastane
TRUTH
{'lace': [{'material': 'recycled polyamide', 'proportion': 48.0}, {'material': 'polyamide', 'proportion': 40.0}, {'material': 'elastane', 'proportion': 12.0}], 'mesh': [{'material': 'recycled polyamide', 'proportion': 88.0}, {'material': 'elastane', 'proportion': 12.0}], 'striped_mesh': [{'material': 'polyamide', 'proportion': 90.0}, {'material': 'elastane', 'proportion': 10.0}]}
OUTPUT
{'lace': [{'material': 'recycled polyamide', 'proportion': 48.0}, {'material': 'polyamide', 'proportion': 40.0}, {'material': 'elastane', 'proportion': 12.0}], 'mesh': [{'material': 'recycled polyamide', 'proportion': 88.0}, {'material': 'elastane', 'proportion': 12.0}]}

INPUT
82%polyeste18%spandex
TRUTH
{'': [{'material': 'polyester', 'proportion': 82.0}, {'material': 'spandex', 'proportion': 18.0}]}
OUTPUT
{'': [{'material': 'polyeste', 'proportion': 82.0}, {'material': 'spandex', 'proportion': 18.0}]}

INPUT
micro - 83% polyamide 17% elastane/ elastic - 83% polyester 8% polyamide 9% elastane
TRUTH
{'elastic': [{'material': 'polyester', 'proportion': 83.0}, {'material': 'polyamide', 'proportion': 8.0}, {'material': 'elastane', 'proportion': 9.0}], 'micro': [{'material': 'polyamide', 'proportion': 83.0}, {'material': 'elastane', 'proportion': 17.0}]}
OUTPUT
{'elastic': [{'material': 'polyester', 'proportion': 83.0}, {'material': 'polyamide', 'proportion': 17.0}], 'mesh': [{'material': 'polyamide', 'proportion': 83.0}, {'material': 'elastane', 'proportion': 8.0}]}

INPUT
96%eco vero rayon,4%spandex
TRUTH
{'': [{'material': 'eco vero rayon', 'proportion': 96.0}, {'material': 'spandex', 'proportion': 4.0}]}
OUTPUT
{'': [{'material': 'eco', 'proportion': 96.0}, {'material': 'spandex', 'proportion': 4.0}]}

INPUT
lace - 87% polyamide 135 elastane/mesh - 84% polyamide 16% lycra
TRUTH
{'lace': [{'material': 'polyamide', 'proportion': 87.0}, {'material': 'elastane', 'proportion': 13.0}], 'mesh': [{'material': 'polyamide', 'proportion': 84.0}, {'material': 'lycra', 'proportion': 16.0}]}
OUTPUT
{'lace': [{'material': 'polyamide', 'proportion': 87.0}, {'material': 'elastane', 'proportion': 135.0}], 'mesh': [{'material': 'polyamide', 'proportion': 84.0}, {'material': 'lycra', 'proportion': 16.0}]}

INPUT
body: 100% recycle polyester , lace: 100% nylon, cup lining: 100% polyester
TRUTH
{'body': [{'material': 'recycled polyester', 'proportion': 100.0}], 'cup_lining': [{'material': 'polyester', 'proportion': 100.0}], 'lace': [{'material': 'nylon', 'proportion': 100.0}]}
OUTPUT
{'body': [{'material': 'recycle polyester', 'proportion': 100.0}], 'lace': [{'material': 'nylon', 'proportion': 100.0}], 'cup lining': [{'material': 'polyester', 'proportion': 100.0}]}
```
</details>

Here is a summary of the errors I can spot:

- `span` doesn't get normalized to `spandex`: I checked, and there are no inputs which contain `span` and not `spandex`, so this mistake is completely understandable.
- `polyester/poliéster` gets interpreted as two different materials: again, this pattern doesn't occur in the training set.
- `poliamide` doesn't get normalized to `polyamide`: same issue.
- Quite a few errors where the wrong component is output -- such as `lace` instead of `shell`
- More cases of materials not appearing in the training set -- such as `eco vero rayon`
- Some more normalization errors -- such as `recycle polyester` not being normalized to `recycled polyester`
- `135` gets interpreted as 135% instead of 13%. This one clearly shows the model has no semantic sense of what a proportion is.

Overall, this is quite reassuring. I'm rather confident the model would do better if I showed it more varied examples. However, I had to write a lot of regex logic to generate these examples in the first place. This took me some time, especially for the edge-cases. I don't mind having to do this for one dataset, but I wonder to what extent this model would generalize to another dataset. It probably wouldn't without much more training data.

## Conclusion

I'm not exactly sure what steps to take next. The thing about parsing data is that it's not a creative task: you either parse the input correctly or you don't. I need a model that has >95% recall and 100% precision. I don't mind having to produce some outputs manually and thereafter retrain the model to improve it. But I really don't want it to produce erroneous outputs.

Ideally, the model should output a confidence score which I could use to ignore some outputs, thereby lowering the recall but increasing the precision. Alas, I haven't yet found out how to do that with OpenAI.

For this task in particular, I will likely wait until I have more datasets to train on. Also, I want to try generating new training data by taking the samples I've already parsed, and formatting them to different text formats while adding noise. A bit like a self-supervised system. However, my conclusion for now is that it's too early to tell if GPT-3 is the answer to my problem. I will keep writing regex patterns in the meantime 🤓
