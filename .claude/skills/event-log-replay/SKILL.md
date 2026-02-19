---
name: event-log-replay
description: Define and implement event-sourcing log + deterministic replay verification.
---

Update docs/ARCHITECTURE.md and/or docs/DATA_MODEL.md with an event log design.

Implementation guidance:
- game-server emits events for every transition.
- Persist events with stable ordering per hand.
- Provide a replay function that reconstructs the final state from events.
- Include a hash chain option (future-proof for MVP2 proofs) but do NOT require Web3.
