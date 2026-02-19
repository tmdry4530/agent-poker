---
name: engine-invariants
description: Implement and test poker-engine invariants (chip conservation, turn order, betting rounds, showdown) with strong unit tests.
---

You are working in packages/poker-engine (or will create it).

Requirements:
- Implement deterministic state machine for MVP1 (recommend HU Limit Hold'em).
- Add tests that enforce invariants:
  - chip conservation (sum of stacks + pot constant across transitions, except rake if defined)
  - legal action set correctness per state
  - correct street transitions (preflop/flop/turn/river/showdown)
  - terminal state correctness (winner, pot distribution)
- Invalid actions must return structured errors (code + message).
