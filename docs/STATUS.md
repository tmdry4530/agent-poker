# STATUS (Living)

> 이 파일은 매 작업 세션 후 업데이트. "지금 MVP1이 어디까지 되었는지" 한 눈에 보이게.

## Current Milestone
- **MVP1: COMPLETE** ✓ Agent-only poker (Web2, virtual chips)

## Today Snapshot
- Date: 2026-02-20
- Owner (AI Orchestration Lead): Claude Code + OMC
- Active Branch: master
- Status: MVP1 delivered + Admin UI fully rebuilt

## Done (since last update)
- [x] Stage 0-8 complete (preflight → stabilization)
- [x] All packages implemented and tested (63 tests passing)
- [x] E2E demo verified: 20 hands with chip conservation + deterministic replay
- [x] CallingStation + AggressiveBot sample agents working
- [x] HU Limit Hold'em engine with invariants tests
- [x] Event sourcing + replay verification
- [x] Virtual chips ledger (double-entry, idempotent)
- [x] WS protocol + table actor
- [x] Admin UI fully rebuilt (Tailwind v4 + shadcn/ui dark poker theme)
  - Dashboard with live stats, recent tables, quick actions
  - Table list with create/status/navigation
  - Table detail with Live/Info/Seats/Hands tabs
  - Visual poker table (oval green felt, 6 seats, cards, chips, pot, action ticker)
  - Hand detail with event timeline
  - API proxy routes (6 endpoints)
  - Hand history storage + API endpoints on lobby-api
- [x] Live demo script (scripts/demo-live.ts) with real-time admin-ui viewing
- [x] CORS support added to lobby-api

## In Progress
- None

## Next
- Optional: Web3 extensions (MVP2)
- Optional: Additional bot strategies
- Optional: More poker variants

## Blockers
- None

## Risks
- Memory-based adapters only (no persistence yet)

## Quality Gates
- Tests: **PASS** (63 tests, 0 failures)
- Lint: **PASS** (all packages)
- Local run: **YES** (scripts/demo-live.ts + scripts/demo-20-hands.ts)
- Replay determinism: **YES** (verified in E2E)

## Package Status
- poker-engine: 18 tests ✓
- hand-history: 8 tests ✓
- adapters-ledger: 22 tests ✓
- adapters-identity: 9 tests ✓
- agent-sdk: 6 tests ✓
- game-server: builds ✓
- lobby-api: builds ✓
- admin-ui: builds ✓
