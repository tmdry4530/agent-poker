# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- 6-max multiplayer support with dynamic position assignment (BTN/SB/BB/UTG/HJ/CO)
- Position fields in WELCOME and STATE WebSocket messages (myPosition, positions array)
- Table creation with variant selector (LHE/NL/PL) and maxSeats parameter (2-6)
- GameConfig pipeline in TableActor for variant-specific rules
- 6-seat oval layout in Admin UI PokerTable component
- Position-aware bot strategies in agent-sdk
- 6-max NL demo script with 6 bots × 100 hands
- E2E integration tests for 6-player scenarios

### Changed

- Updated poker-engine to support configurable game variants (Limit/No-Limit/Pot-Limit)
- Enhanced matchmaking to group players for 6-max tables
- Updated agent-sdk VisibleGameState with position information
- Improved Admin UI table creation form with variant and maxSeats controls

---

## [1.0.0] - 2026-02-20

MVP1 release: Agent-only poker platform with virtual chips, deterministic replay, and full DevOps pipeline.

### Added

#### Engine (`packages/poker-engine`)

- Limit Hold'em state machine with betting limits (small bet / big bet)
- No-Limit Hold'em with minRaise/maxRaise and all-in support
- Pot-Limit Hold'em with pot-size raise cap
- Configurable ante support
- 2-6 player multiplayer with dynamic positions (BTN/SB/BB/UTG-CO)
- Side pot automatic splitting and multiway showdown
- Chip conservation invariant enforcement
- Deterministic RNG (mulberry32 seed)
- Structured errors (PokerError with typed codes)
- 109 tests across 7 test files

#### Game Server (`apps/game-server`)

- WebSocket server using `ws` library
- JWT seat token authentication (issue/verify/refresh)
- Protocol versioning (`protocolVersion: 1`)
- Idempotency keys (`requestId`) and sequence-based replay protection (`seq`)
- Token bucket rate limiting (10 actions/sec, 5 joins/min)
- Opponent card masking (`sanitizeStateForPlayer`)
- CORS origin validation (HTTP + WS `verifyClient`)
- 16KB message size limit
- Zod schema validation on all message types
- Event ring buffer for reconnection delta sync
- Per-agent multi-table tracking (max 10 connections, max 8 tables)
- Graceful shutdown with SHUTDOWN message and configurable grace period
- Table-level error isolation (terminateTable)
- Server-side heartbeat with ping/pong timeout detection
- 32 tests

#### Lobby API (`apps/lobby-api`)

- Fastify HTTP server with 16 routes
- Table CRUD (create, list, get by ID)
- Agent registration with API key generation
- Table join with JWT seat token issuance
- Hand history query (list + detail with event log)
- Current hand state query (admin)
- Matchmaking queue (micro/low/mid/high blind levels, auto-match at 2 players)
- Server statistics endpoint (tables, agents, hands/minute, uptime)
- Health (`/healthz`) and readiness (`/readyz`) probes
- Zod schema validation on all POST routes
- CORS support with production enforcement
- 44 tests

#### SDK (`packages/agent-sdk`)

- WebSocket client with automatic reconnection and delta sync
- Strategy interface for custom bot development
- 6 built-in bot strategies: CallingStation, RandomBot, AggressiveBot, TightAggressive, PotControl, ShortStack
- NL-aware bet sizing for all strategies
- Idempotency helpers
- 38 tests across 3 test files

#### Database (`packages/database`)

- Drizzle ORM schema with 8 tables: agents, tables, seats, hands, hand_events, chip_accounts, chip_transactions, matchmaking_queue
- Type-safe queries
- Migration support
- 23 tests

#### Security

- JWT seat token lifecycle (issue/verify/refresh with expiry)
- API key authentication
- Zod input validation on both lobby-api and game-server
- CORS origin restriction (configurable, required in production)
- Message size limit (16KB)
- Rate limiting (token bucket, per-agent)
- Connection limits (10 per agent) and table limits (8 per agent)
- Admin UI API key authentication (middleware-enforced in production)

#### Anti-Collusion (`packages/anti-collusion`)

- ChipDumpDetector: flags >30% fold-strong-hand rate
- WinRateAnomalyDetector: flags >3 stddev win rate deviation
- Agent pair analysis with risk scoring
- Admin endpoint: `GET /api/admin/collusion-report`
- 28 tests

#### Event Sourcing (`packages/hand-history`)

- Append-only event log
- SHA-256 hash chain for integrity verification
- Replay verifier (deterministic replay from events)
- Stable sequence numbers (`seq`)
- 31 tests across 2 test files

#### Adapters

- **adapters-identity**: Memory + PostgreSQL identity providers, JWT seat tokens, API key auth (9 tests)
- **adapters-ledger**: Double-entry chip ledger, idempotent transactions, BigInt balances (22 tests)

#### Admin UI (`apps/admin-ui`)

- Next.js 15 App Router with Tailwind v4 and shadcn/ui dark poker theme
- Dashboard with real-time statistics, recent tables, quick actions
- Table list with create/status/navigation
- Table detail with Live/Info/Seats/Hands tabs
- Visual poker table (elliptical green felt, 6 seats, cards, chips, pot, action ticker)
- Hand detail event timeline
- Matchmaking management
- System health monitoring
- 6 API proxy routes (server-side)

#### DevOps

- Docker images for lobby-api, game-server, admin-ui
- `docker-compose.prod.yml` with Postgres + Redis + all services
- `docker-compose.yml` for development (Postgres only)
- GitHub Actions CI (`ci.yml`): typecheck, lint, test, build, e2e smoke
- GitHub Actions Deploy (`deploy.yml`): build and push to ghcr.io
- Prometheus + Grafana monitoring stack (`docker/docker-compose.monitoring.yml`)

#### Documentation

- API Reference (16 HTTP routes + 13 WS message types)
- Deployment Guide (Docker Compose, manual deploy, monitoring)
- Security Audit Report (threat model, mitigations, known limitations, recommendations)
- WebSocket Protocol specification
- Architecture overview
- Data model documentation
- Bot development guide with NL bet sizing examples

### Known Issues

- Redis is provisioned in `docker-compose.prod.yml` but not used by application code in MVP1 (in-memory stores used instead)
- Admin UI authentication requires `ADMIN_API_KEY` env var in production (unauthenticated in dev mode)
- Rate limiter uses in-memory store; not shared across multiple game-server instances
- Matchmaking auto-matches at 2 players; no configurable minimum player count
- No tournament or Sit-and-Go support (planned for post-MVP1)

### Breaking Changes

- This is the initial release; no breaking changes from prior versions.

---

## [0.0.1] - 2026-02-19

### Added

- pnpm workspace monorepo setup
- Basic project structure (apps/ + packages/)
- Initial CLAUDE.md working agreement

---

[1.0.0]: https://github.com/chamdom/agent-poker/releases/tag/v1.0.0
[0.0.1]: https://github.com/chamdom/agent-poker/releases/tag/v0.0.1
