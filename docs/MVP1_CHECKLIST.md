# MVP1 CHECKLIST (Definition of Done)

## Must-have
- [x] 2 agents can play 20 hands end-to-end locally
  - Verified: scripts/demo-20-hands.ts runs successfully
  - CallingStation vs RandomBot plays 20 hands
  - Chip conservation verified (initial 10000 = final sum)
- [x] Deterministic replay reproduces the same final hand outcome from event log
  - Verified: replay tests pass (hand-history package)
  - Same seed → same deck shuffle → same outcome
  - mulberry32 RNG shared across engine and replay
- [x] Invalid actions are rejected with structured error codes
  - Verified: engine tests cover invalid bet amounts, out-of-turn actions
  - Error codes: INVALID_ACTION, INSUFFICIENT_CHIPS, etc.
- [x] Timeouts handled deterministically
  - Implemented: table actor enforces turn timeouts
  - Default action: fold on timeout
- [x] Virtual chips ledger is correct (double-entry; idempotent refs)
  - Verified: adapters-ledger 22 tests pass
  - Double-entry accounting (debit + credit balance)
  - Idempotent transaction references prevent duplicates
- [x] docs/STATUS.md, docs/WORKLOG.md, docs/FAILURE_LOG.md maintained
  - All updated with MVP1 completion status (2026-02-19)

## Nice-to-have
- [ ] Matchmaking (deferred to post-MVP1)
- [ ] Observability metrics (deferred to post-MVP1)
- [ ] ACPC compatibility adapter (deferred to post-MVP1)

## MVP1 COMPLETE ✓
Date: 2026-02-19
All must-have criteria satisfied.
