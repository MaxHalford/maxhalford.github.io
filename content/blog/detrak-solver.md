+++
date = "2026-02-02"
title = "Solving Détrak with brute force"
toc = true
tags = ['optimization']
+++

[Détrak](https://cdn.1j1ju.com/medias/6a/e0/d8-detrak-regle.pdf) is a simple board game. There's a 5x5 grid, and players need to place 12 domino-like pieces to cover the grid completely. The domino symbols are determined by rolling two dice. The dice are six-sided, and their rolls are shared by all players. Points are scored based on adjacencies of matching symbols.

<p>
  <img src="https://github.com/MaxHalford/detrak/raw/main/46.jpg" width="60%">
</p>

The goal is to find the optimal placement of the pieces to maximize the score based on the rolled symbols. What makes it competitive is that everyone has to work with the same rolls. This involves logical thinking and spatial reasoning. But you also have to juggle luck and risk, because you can't predict the dice rolls.

I don't think the game is very popular. There is [Alex from Australia](https://zwyx.dev/) who made a [web version](https://detrak.net/2026-02-02) of the game, with approval from the original creator. But I haven't seen much else about it online.

Naturally vanquishing other humans is not enough. What you really want to achieve is reach the optimal score for the given rolls. ~4 years ago I [tried](https://github.com/MaxHalford/detrak/tree/20ada659beea6d06bb57e23f5e894f4eacab7da0) to do it via brute force. I got to a working Python script. But it was too slow to find the solution in a reasonable time. I gave up and went on with my life.

The thing is, I'm not a combinatorial optimization expert. I know what beam search is, I understand the purpose of pruning, I'm aware of branch and bound, I even read a good chunk of [Modern Artificial Intelligence](https://www.goodreads.com/book/show/27543.Artificial_Intelligence) back in the day. But I don't have the experience nor time to determine which techniques are best suited for a given problem. I just tried to optimize my brute-force search as much as I could, but I didn't get very far.

Fast forward to January 2026. I decided to give it another go. This time I obviously have Claude Code to help me. And this changes everything. I got it to produce a solution that churns ~1M boards per second, which is more than enough to suggest a strong candidate solution in a matter of minutes. The solution came with a [decent web interface](https://maxhalford.github.io/detrak/) to interact with the solver.

<p>
  <img src="/img/blog/detrak-solver/solver.png" width="60%">
</p>

I am genuinely impressed by how much of a leap this represents compared to my previous attempt. Claude Code enabled me ship a project I would never have taken the time to finish. In that sense, I feel AI coding assistants can make us more creative via productivity gains. Especially for throw-away projects like this, where code maintainability is not a concern. It is invigorating to think of an idea and see it materialize in a short amount of time.

Mind you, Claude Code did make mistakes. It forgot the diagonal score counted twice, it initially thought both diagonals counted, and it picked the wrong diagonal when I corrected it. But those mistakes are on both sides. I could have been more precise in my prompts.

I feel bittersweet at the end of this project. This initially was a hard enough problem for me to solve on my own. I don't feel like I learned much now that I have a working solution. My initial intent was to come up with smart tricks by myself, and write a short research paper about it. But now that feels unnecessary.
