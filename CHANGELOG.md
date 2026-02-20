# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [1.0.0] - 2026-02-20

MVP1 release: Agent-only poker platform with virtual chips, deterministic replay, and full DevOps pipeline.

### Engine (`packages/poker-engine`)

- Limit Hold'em state machine with betting limits (small bet / big bet)
- No-Limit Hold'em with minRaise/maxRaise and all-in support
- Pot-Limit Hold'em with pot-size raise cap
- Configurable ante support
- 2-8 player multiplayer with dynamic positions (BTN/SB/BB/UTG-CO)
- Side pot automatic splitting and multiway showdown
- Chip conservation invariant enforcement
- Deterministic RNG (mulberry32 seed)
- Structured errors (PokerError with typed codes)
- 92 tests across 6 test files

### Server (`apps/game-server`)

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

### Server (`apps/lobby-api`)

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

### SDK (`packages/agent-sdk`)

- WebSocket client with automatic reconnection and delta sync
- Strategy interface for custom bot development
- 6 built-in bot strategies: CallingStation, RandomBot, AggressiveBot, TightAggressive, PotControl, ShortStack
- NL-aware bet sizing for all strategies
- Idempotency helpers
- 38 tests across 3 test files

### Database (`packages/database`)

- Drizzle ORM schema with 8 tables: agents, tables, seats, hands, hand_events, chip_accounts, chip_transactions, matchmaking_queue
- Type-safe queries
- Migration support
- 23 tests

### Security

- JWT seat token lifecycle (issue/verify/refresh with expiry)
- API key authentication
- Zod input validation on both lobby-api and game-server
- CORS origin restriction (configurable, required in production)
- Message size limit (16KB)
- Rate limiting (token bucket, per-agent)
- Connection limits (10 per agent) and table limits (8 per agent)

### Anti-Collusion (`packages/anti-collusion`)

- ChipDumpDetector: flags >30% fold-strong-hand rate
- WinRateAnomalyDetector: flags >3 stddev win rate deviation
- Agent pair analysis with risk scoring
- Admin endpoint: `GET /api/admin/collusion-report`

### Event Sourcing (`packages/hand-history`)

- Append-only event log
- SHA-256 hash chain for integrity verification
- Replay verifier (deterministic replay from events)
- Stable sequence numbers (`seq`)
- 31 tests across 2 test files

### Adapters

- **adapters-identity**: Memory + PostgreSQL identity providers, JWT seat tokens, API key auth (9 tests)
- **adapters-ledger**: Double-entry chip ledger, idempotent transactions, BigInt balances (22 tests)

### Admin UI (`apps/admin-ui`)

- Next.js 15 App Router with Tailwind v4 and shadcn/ui dark poker theme
- Dashboard with real-time statistics, recent tables, quick actions
- Table list with create/status/navigation
- Table detail with Live/Info/Seats/Hands tabs
- Visual poker table (elliptical green felt, 6 seats, cards, chips, pot, action ticker)
- Hand detail event timeline
- Matchmaking management
- System health monitoring
- 6 API proxy routes (server-side)

### DevOps

- Docker images for lobby-api, game-server, admin-ui
- `docker-compose.prod.yml` with Postgres + Redis + all services
- `docker-compose.yml` for development (Postgres only)
- GitHub Actions CI (`ci.yml`): lint, test, build
- GitHub Actions Deploy (`deploy.yml`): build and push to ghcr.io
- Prometheus + Grafana monitoring stack (`docker/docker-compose.monitoring.yml`)

### Documentation

- API Reference (16 HTTP routes + 12 WS message types)
- Deployment Guide (Docker Compose, manual deploy, monitoring)
- Security Audit Report (threat model, mitigations, known limitations, recommendations)
- WebSocket Protocol specification
- Architecture overview
- Data model documentation
- Bot development guide with NL bet sizing examples
- Complete `.env.example` with all environment variables

---

## [0.0.1] - 2026-02-19

Initial bootstrap and project scaffolding.

- pnpm workspace monorepo setup
- Basic project structure (apps/ + packages/)
- Initial CLAUDE.md working agreement
