+++
date = "2024-02-27"
title = "Fast Poetry and pre-commit with GitHub Actions"
tags = ['python']
+++

This is a short post to share a GitHub Actions I use to setup [Poetry](https://python-poetry.org/) and [pre-commit](https://pre-commit.com/). These two tools cover most of my Python development needs. I use Poetry to manage dependencies and pre-commit to run code checks and formatting. The setup is fast because it caches the virtual environment and the `.local` directory.

A pattern I like is to use [custom actions](https://docs.github.com/en/actions/creating-actions/about-custom-actions). These are reusable actions that you can use in multiple workflows. I have a custom action to install the Python environment. Here's the action file:

```yaml
# .github/actions/install-env.yml

name: Install Python env

runs:
  using: "composite"
  steps:
    - name: Check out repository
      uses: actions/checkout@v3

    - name: Set up python
      id: setup-python
      uses: actions/setup-python@v5
      with:
        python-version: "3.11"

    - name: Load cached venv
      id: cached-poetry-dependencies
      uses: actions/cache@v4
      with:
        path: .venv
        key: venv-${{ runner.os }}-${{ hashFiles('poetry.lock') }}-${{ hashFiles('.github/actions/install-env/action.yml') }}-${{ steps.setup-python.outputs.python-version }}

    - name: Load cached .local
      id: cached-dotlocal
      uses: actions/cache@v4
      with:
        path: ~/.local
        key: dotlocal-${{ runner.os }}-${{ hashFiles('.github/actions/install-env/action.yml') }}-${{ steps.setup-python.outputs.python-version }}

    - name: Install Python poetry
      uses: snok/install-poetry@v1
      with:
        virtualenvs-create: true
        virtualenvs-in-project: true
        installer-parallel: true
      if: steps.cached-dotlocal.outputs.cache-hit != 'true'

    - name: Install dependencies
      shell: bash
      if: steps.cached-poetry-dependencies.outputs.cache-hit != 'true'
      run: poetry install --no-interaction

    - name: Activate environment
      shell: bash
      run: source .venv/bin/activate
```

The action file is a [composite action](https://github.com/orgs/community/discussions/36861). It has a few steps to install Python, cache the virtual environment, and install Poetry. The last step activates the virtual environment. The action is used in a workflow file -- e.g. for units tests -- as so:

```yaml
# .github/workflows/unit-tests.yml

name: Unit tests

on:
  pull_request:
    branches:
      - "*"
  push:
    branches:
      - main

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: ./.github/actions/install-env
      - run: poetry run pytest
```

Here's a GitHub Action to run pre-commit checks:

```yaml
# .github/workflows/code-quality.yml

name: Code quality

on:
  pull_request:
    branches:
      - "*"
  push:
    branches:
      - main

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: ./.github/actions/install-env
      - name: Run pre-commit on all files
        run: poetry run pre-commit run --all-files
```

The immediate benefit of this setup is that the virtual environment and the `.local` directory are cached. This means that the environment is ready to use in a few seconds. The first time the action runs, it installs Poetry and the dependencies. The next time, it doesn't need to install Poetry because it's already cached in the `.local` directory. Likewise for the virtual environment.

This can be a huge time saver. At [Carbonfact](https://github.com/carbonfact), this has reduced the setup time from ~45 seconds to ~8 seconds. The remaining installation time is spent downloading the caches, which can be subject to variance due to network conditions.

I didn't write this from scratch. I stumbled on [this GitHub issue](https://github.com/snok/install-poetry/issues/43), which led me to [this blog post](https://www.peterbe.com/plog/install-python-poetry-github-actions-faster). I made a few changes to the original setup, but the credit goes to the original authors. My wish is simply to share the knowledge so that we all benefit from it.

Spread the knowledge!
