# PROJECT BOARD (MVP1)

## Backlog
(Empty - MVP1 complete)

## In Progress
(Empty - MVP1 complete)

## Blocked
(Empty - MVP1 complete)

## Done
- [x] Stage 0: Preflight (docker-compose postgres, pnpm workspace)
- [x] Stage 1: Monorepo scaffold (apps/*, packages/*)
- [x] Stage 2: Poker engine (HU LHE) + invariants tests (18 tests)
- [x] Stage 3: Hand event log + replay verifier (8 tests)
- [x] Stage 4: Virtual chips ledger (double-entry) + settlement (22 tests)
- [x] Stage 5: Game server (WS) + table actor + Fastify lobby-api
- [x] Stage 6: Sample bots (CallingStation, AggressiveBot) + 20-hand E2E demo
- [x] Stage 7: Admin UI fully rebuilt (Tailwind v4 + shadcn/ui)
  - Dark poker theme (emerald/green, oklch colors)
  - Dashboard, table list, table detail (tabs), hand detail
  - Visual poker table (oval green felt, 6 seats, cards, chips, pot, action ticker)
  - Live hand view with 2s polling
  - API proxy route handlers (6 endpoints)
  - Hand history storage + API on lobby-api
  - CORS support
- [x] Stage 8: Stabilize (63 tests passing, E2E verified)
- [x] Live demo script (scripts/demo-live.ts)
- [x] Define MVP1 acceptance criteria (hands, replay, ledger invariants)
- [x] Packaging: scripts, dev commands, docs

## MVP1 Completion Summary
- **Total tests**: 63 (0 failures)
- **Packages**: 5 core + 3 apps
- **E2E verified**: 20 hands with chip conservation + deterministic replay
- **Admin UI**: Full rebuild with visual poker table, live hand view, hand history
- **Architecture invariants**: All maintained (pure engine, event sourcing, protocol versioning, idempotency)
- **Date completed**: 2026-02-19 (Admin UI rebuilt: 2026-02-20)
