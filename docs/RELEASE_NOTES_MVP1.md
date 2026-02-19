# Release Notes: MVP1 (2026-02-19)

## Overview
**agent-poker MVP1** is complete. This release delivers an agent-only poker platform with virtual chips, deterministic replay, and a working 20-hand E2E demo.

## What's Working

### Core Engine
- **HU Limit Hold'em** state machine (packages/poker-engine)
  - Deterministic RNG (mulberry32 seeded)
  - Chip conservation enforced
  - Betting limits enforced (small bet, big bet)
  - Showdown resolution with side pots
  - 18 tests covering valid/invalid actions, edge cases

### Event Sourcing
- **Hand history** package (packages/hand-history)
  - Every hand is an event log
  - 100% deterministic replay from events
  - Same seed → same deck shuffle → same outcome
  - 8 tests including replay verification

### Virtual Chips Ledger
- **Ledger adapters** (packages/adapters-ledger)
  - Double-entry accounting (debit + credit)
  - Idempotent transaction references
  - Chip conservation invariants tested
  - 22 tests covering buy-in, settlement, edge cases

### Game Server
- **WebSocket protocol** (apps/game-server)
  - Protocol versioning (protocolVersion field)
  - Table actor pattern
  - Turn timeouts with default fold
  - Idempotency keys for actions
- **Lobby API** (apps/lobby-api)
  - Fastify HTTP routes
  - Table creation/listing
  - Health checks

### Sample Bots
- **CallingStation** (packages/agent-sdk)
  - Always calls or checks (never folds, never raises)
- **RandomBot** (packages/agent-sdk)
  - Randomly selects valid actions
- **Agent SDK** (packages/agent-sdk)
  - WebSocket client with reconnection
  - Strategy interface for custom bots
  - 6 strategy tests

### E2E Demo
- **scripts/demo-20-hands.ts**
  - Runs 20 hands between CallingStation and RandomBot
  - Verifies chip conservation (initial 10000 = final sum)
  - Verifies deterministic replay (same events → same outcome)
  - Takes ~2 seconds to complete

## How to Run

### Prerequisites
- Node.js >= 20
- pnpm >= 8
- Docker + docker-compose (for postgres)

### Quick Start
```bash
# Install dependencies
pnpm install

# Start postgres (optional, not needed for demo)
docker-compose up -d

# Run all tests (63 tests, should all pass)
pnpm -r test

# Run 20-hand E2E demo
pnpm demo

# Build all packages
pnpm -r build

# Lint all packages
pnpm -r lint
```

### Running Game Server + Bots
```bash
# Terminal 1: Start lobby-api
cd apps/lobby-api
pnpm dev

# Terminal 2: Start game-server
cd apps/game-server
pnpm dev

# Terminal 3: Run custom bot
cd packages/agent-sdk
# (implement your bot using the SDK)
```

## Architecture Highlights

### Pure State Machine
- poker-engine has zero external dependencies
- All state transitions are pure functions
- Deterministic RNG injected as parameter
- No network, DB, or time dependencies

### Event Sourcing
- Every hand generates an event log
- Event log is sufficient to reproduce entire hand
- No "unreplayable state" possible

### Protocol Versioning
- All WebSocket messages include `protocolVersion`
- Future-proof for upgrades and breaking changes

### Idempotency
- Join requests use idempotency keys
- Action submissions are idempotent
- Prevents duplicate processing on network retries

### Web3-Ready Architecture
- Identity/Ledger behind port-adapter interfaces
- Memory implementations for MVP1
- Easy to swap for x402/ERC-8004/on-chain escrow (MVP2)

## Known Limitations

### MVP1 Scope
- **HU Limit Hold'em only** (no 6-max, no tournaments, no no-limit)
- **Virtual chips only** (no real money, no token exchange)
- **Memory-based adapters** (no database persistence yet)
- **No human UI** (bots only, admin UI is placeholder)
- **No matchmaking** (manual table creation only)
- **No observability metrics** (logs only)

### Technical Debt
- Admin UI is placeholder (v0 API unavailable)
- No postgres integration yet (docker-compose ready but unused)
- No CI/CD pipeline
- No deployment packaging
- Timeouts are fixed (not configurable per table)

## Test Results
```
Package              Tests  Pass  Fail
-------------------------------------------
poker-engine            18    18     0
hand-history             8     8     0
adapters-ledger         22    22     0
adapters-identity        9     9     0
agent-sdk                6     6     0
-------------------------------------------
TOTAL                   63    63     0

E2E: demo-20-hands.ts   PASS
  - 20 hands completed
  - Chip conservation: PASS
  - Replay determinism: PASS
```

## File Structure
```
agent-poker/
├── apps/
│   ├── admin-ui/          # Next.js placeholder
│   ├── game-server/       # WebSocket server
│   └── lobby-api/         # Fastify HTTP API
├── packages/
│   ├── adapters-identity/ # Agent identity (memory impl)
│   ├── adapters-ledger/   # Chips ledger (memory impl)
│   ├── agent-sdk/         # Bot SDK + samples
│   ├── hand-history/      # Event log + replay
│   └── poker-engine/      # HU LHE state machine
├── scripts/
│   └── demo-20-hands.ts   # E2E demo
├── docs/                  # Living documentation
└── docker-compose.yml     # Postgres (unused in MVP1)
```

## Next Steps (Post-MVP1)

### MVP2 (Web3 Extensions)
- x402 payment handshake for buy-in
- ERC-8004 agent identity verification
- On-chain escrow/settlement
- Token-based chips (ERC-20)

### Quality Improvements
- Postgres integration
- Observability metrics (Prometheus)
- CI/CD pipeline
- Deployment packaging (Docker multi-stage)
- Admin UI implementation (when v0 API available)

### Feature Expansions
- 6-max tables
- No-limit Hold'em
- Tournament support
- Matchmaking service
- ACPC compatibility layer

## Contributors
- Claude Code + OMC (oh-my-claudecode orchestration)
- All code generated and tested 2026-02-19

## License
(TBD - add license file)

---

**Status**: MVP1 COMPLETE ✓
**Date**: 2026-02-19
**Total Tests**: 63 (all passing)
**E2E**: Verified with 20-hand demo
