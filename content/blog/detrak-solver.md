+++
date = "2026-02-02"
title = "Solving Détrak with brute force"
toc = true
tags = ['optimization', 'llm']
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

<details>
  <summary>For the record, here is a summary by Claude Code of the solver it built</summary>

```
Overview

  The solver uses branch-and-bound with backtracking to find optimal domino placements on a 5×5 grid. The problem is combinatorially
  explosive (~10^18 nodes without pruning), so heavy optimization is required.

  ---
  Core Algorithm (Pseudo-code)

  function solve(startSymbol, dominoes):
      grid = new Grid(startSymbol at [0,0])
      bestSolution = null
      bestScore = -∞

      # Phase 1: Quick greedy to get initial bound
      greedySolution = greedySearch(grid, dominoes, beamWidth=3)
      if greedySolution:
          bestScore = score(greedySolution)

      # Phase 2: Full search with pruning
      stack = [{depth: 0, placements: generatePlacements(grid, dominoes[0])}]

      while stack not empty:
          frame = stack.top()

          if frame.depth == 12:  # All dominoes placed
              if grid.score > bestScore:
                  bestScore = grid.score
                  bestSolution = grid.copy()
              backtrack()
              continue

          # Pruning checks
          if upperBound(grid, remainingDominoes) <= bestScore:
              backtrack()
              continue

          if transpositionTable.has(grid.hash) with better result:
              backtrack()
              continue

          if not hasValidTiling(grid):  # Constraint propagation
              backtrack()
              continue

          # Try next placement
          placement = frame.nextPlacement()
          if placement:
              grid.place(placement)
              stack.push({depth+1, generatePlacements(...)})
          else:
              backtrack()

  ---
  Zobrist Hashing

  A technique for incrementally computing a unique hash of the grid state:

  # Initialization (once)
  ZOBRIST[25][7] = random 64-bit values  # position × symbol

  # Grid hash update (O(1) per cell change)
  function setCell(idx, newValue):
      if oldValue != null:
          hash ^= ZOBRIST[idx][oldValue]   # Remove old
      hash ^= ZOBRIST[idx][newValue]       # Add new

  # Lookup
  transpositionTable[hash] = {bestScore, depth, flag}

  Why it works: XOR is its own inverse, so placing/removing a symbol toggles the same bits. Two identical grid states always produce the
   same hash.

  ---
  Optimization Techniques
  ┌────────────────────────┬──────────────────────────────────────────────────────────────────────┐
  │       Technique        │                             Description                              │
  ├────────────────────────┼──────────────────────────────────────────────────────────────────────┤
  │ Transposition Table    │ Cache explored states by Zobrist hash; skip re-exploration           │
  ├────────────────────────┼──────────────────────────────────────────────────────────────────────┤
  │ Upper Bound Pruning    │ Estimate max possible score for remaining cells; prune if ≤ best     │
  ├────────────────────────┼──────────────────────────────────────────────────────────────────────┤
  │ Constraint Propagation │ Reject states with isolated empty cells or odd empty count           │
  ├────────────────────────┼──────────────────────────────────────────────────────────────────────┤
  │ Beam Search            │ Limit to top 20 moves per depth by heuristic score                   │
  ├────────────────────────┼──────────────────────────────────────────────────────────────────────┤
  │ Move Ordering          │ Prioritize: killer moves (500×), history heuristic, greedy potential │
  ├────────────────────────┼──────────────────────────────────────────────────────────────────────┤
  │ Incremental Scoring    │ Track per-line scores; O(1) total score lookup                       │
  ├────────────────────────┼──────────────────────────────────────────────────────────────────────┤
  │ Domino Ordering        │ Try doubles first, then by symbol frequency                          │
  └────────────────────────┴──────────────────────────────────────────────────────────────────────┘
  ---
  Move Ordering Heuristics (Pseudo-code)

  function scorePlacement(placement):
      score = 0

      # Greedy: matching neighbors
      score += countMatchingNeighbors(pos1, sym1) * 2
      score += countMatchingNeighbors(pos2, sym2) * 2

      # Doubles bonus (guaranteed 2-run)
      if sym1 == sym2: score += 3

      # Killer move (caused cutoff at this depth before)
      if placement in killerMoves[depth]: score *= 500

      # History heuristic (led to good solutions globally)
      score += historyTable[placementKey]

      return score

  ---
  Upper Bound Calculation

  function upperBound(grid, remainingDominoes):
      total = 0
      for each line (5 rows + 5 cols + 1 anti-diag):
          if line complete:
              total += actualScore(line)
          else:
              # Best possible: fill remaining with optimal symbols
              total += maxPossibleScore(line, remainingDominoes)

      total += antiDiagonalScore  # Counted twice (×2 rule)
      return total

  ---
  Constraint Propagation

  function hasValidTiling(grid):
      emptyCells = grid.countEmpty()

      # Must be even (dominoes cover 2 cells)
      if emptyCells % 2 != 0: return false

      # No isolated cells (would be impossible to fill)
      for each empty cell:
          if all 4 neighbors are filled:
              return false

      return true

  ---
  Performance Tricks

  - Flat arrays: 25-cell Int8Array instead of 2D array (cache locality)
  - Typed arrays: Int32Array for scores in worker (no GC)
  - Packed move keys: idx1*1000000 + idx2*10000 + sym1*100 + sym2 for fast hashing
  - Batch processing: Process 3000 nodes, then yield to UI with setTimeout(..., 0)
  - Web Worker: Full search runs off main thread

  ---
  Scoring Table
  ┌────────────┬───────┐
  │ Run Length │ Score │
  ├────────────┼───────┤
  │ 0-1        │ -5    │
  ├────────────┼───────┤
  │ 2          │ +2    │
  ├────────────┼───────┤
  │ 3          │ +3    │
  ├────────────┼───────┤
  │ 4          │ +8    │
  ├────────────┼───────┤
  │ 5          │ +10   │
  └────────────┴───────┘
  Anti-diagonal scores count double.

```
</details>
