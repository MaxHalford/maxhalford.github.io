+++
date = "2026-05-11"
title = "Autonomous web scraping with Claude Code"
tags = ['scraping', 'llm']
+++

Andrej Karpathy's [autoresearch](https://github.com/karpathy/autoresearch) project made a lot of ripples. I guess it's exciting because a program that modifies itself feels like actual AI. The concept of autonomous programs is not new -- see [genetic programming](https://en.wikipedia.org/wiki/Genetic_programming) -- but [what](https://github.com/FeSens/auto-arch-tournament/blob/main/docs/auto-arch-tournament-blog-post.md) [we're](https://shopify.engineering/autoresearch) [witnessing](https://github.com/MaxHalford/qthun) [now](https://github.com/WecoAI/awesome-autoresearch) is somewhat more convincing. We just got a bit closer to Neuromancer's world, with a [Turing Police](https://williamgibson.fandom.com/wiki/Turing_Police) that's in charge of stopping AIs from rewriting themselves.

While we wait for AI to become self-conscious, there are mundane problems that can be solved with autoresearch. Web scraping is one of these. Indeed, turning unstructured data into knowledge is an excellent problem for LLMs to solve. But there are nuances to have in mind:

- Calling the LLM on each HTML page will cost a lot of tokens if you have many pages to scrape.
- Letting the LLM spit out a response and calling it a day is lazy. There has to be at least one layer of validation.
- Web scrapers break, because they are static whereas web pages change over time.

I prototyped something I wanted to share. I'm a regular reader of Thomas Eaton's [weekly quiz](https://www.theguardian.com/theguardian/series/the-quiz-thomas-eaton?page=25) he writes for The Guardian. It's the right level of difficulty, and the topics are interesting to me. I want to [scrape](https://github.com/MaxHalford/pub-quiz-flashcards) all past questions/answers, to create myself some Anki/[Space](https://getspace.app/) cards, and also leverage NER techniques to dive into topics.

These quiz pages is that they aren't always in the same format. The HTML slightly changes from time to time, which means that a regular web scraper would regularly break and need to be fixed. Prompting Claude to extract questions/answers is powerful, because I can let it worry about the page structure.

There are 10 years worth of pages to scrape, and there will be more to come, so I don't want the agent to start from scratch each time. I therefore ask it to generate a Python script to do the extraction. I end up with an idempotent script, which I can run once a week when there's a new quiz to scrape:

```sh
python scrape/the_guardian_weekly/scrape.py
```

Again, this script will eventually break. What I want to do is run it once a week, and have it fix itself when there's an issue. This can be done via Claude's [headless mode](https://code.claude.com/docs/en/headless):

```sh
claude -p "Scrape @scrape/$(filter-out $@,$(MAKECMDGOALS))/scrape.py" \
    --bare \
    --append-system-prompt-file CLAUDE.md \
    --model haiku \
    --effort medium \
    --tools "Bash,Read,Edit,Write,Grep,Glob" \
    --no-session-persistence \
    --output-format json \
    --dangerously-skip-permissions \
    --verbose \
    --max-budget-usd 5
```

<details class="modal">
  <summary><code>CLAUDE.md</code> (system prompt)</summary>

# Pub quiz

This is a project for learning pub quiz questions, and associated knowledge. Questions and answers are scraped from the web, such as The Guardian's weekly quiz, University Challenge, etc.

## Scraping

Each source has its own `scrape.py` file. For instance there is `scrape/the_guardian_weekly/scrape.py` for Thomas Eaton's weekly quiz.

Run the scrape script for a given source:

```sh
uv run python scrape/source/scrape.py
```

The script scrapes **one page at a time**. If there is nothing new to scrape, it exits without changes.

### Stopping condition

You can stop if the parsing script prints out that there is nothing new to scrape.

### Q/A the results

After running the script, use `jq '.[-1]'` to extract and review only the last entry from the source's `questions.json`. Do not read the entire file. Verify that questions and answers are properly paired and make sense. If the output looks wrong, delete the bad entry from the JSON file, fix `scrape.py` to handle the page format correctly, and re-run.

### Fixing scripts

These scripts are mutable. They can raise an error because the structure of the pages they parse has changed. Fix them when that happens. Under no circumstances should you change the structure of the output format. You should only change whatever logic is used to extract the target data from the pages.

When updating a script, you should avoid adding try/catch exceptions. Instead, make the necessary changes to make the parsing go through. Further changes can always be made later for future formats. You also do not need to make the code retro-compatible, because the goal is only to keep the scripts up-to-date with the latest format.

## Refactoring

When you done repairing and running a scraping script, please take some time to review it as a whole. You can refactor and simplify it when it makes sense. The goal is to avoid patching it incrementally and ending up with a castle of cards. The script should be lean because what matters is that it works with the latest page, and does not need to support all formats.

### Linting and type checking

After modifying any Python file, run ruff and ty to format, lint, and type check:

```sh
uv run ruff check --fix .
uv run ruff format .
uv run ty check .
```

Fix any reported issue.

</details>

Headless mode is cool because it allows running an agentic session without any human in the loop. It's practical when you have a more or less deterministic task for the agent to perform.

Note I've thrown some quality control into the system prompt:

> After running the script, use jq '.[-1]' to extract and review only the last entry from the source’s questions.json. Do not read the entire file. Verify that questions and answers are properly paired and make sense. If the output looks wrong, delete the bad entry from the JSON file, fix scrape.py to handle the page format correctly, and re-run.

This way, whenever the script breaks or outputs bogus question/answers, the agent takes over and fixes the script.

If the parsing script goes through, the only addition are new rows in the `questions.json` file, which contains all question/answers parsed so far. If it fails, the `scrape.py` script is edited too. In both cases a [pull request](https://github.com/MaxHalford/pub-quiz-flashcards/pull/1/changes) is opened for me to review once a week. This way there's a second review which only takes me a few seconds.

I like this pattern because I have the choice of running the parsing script manually, or wrapping it with a harness -- Claude Code in this case. With the harness, the script can "evolve" autonomously, which is one hell of a step forward.
