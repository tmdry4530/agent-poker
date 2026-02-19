# Security & Abuse Model (MVP1)

## 1. Assets

- Game integrity (no illegal actions, correct turn order)
- Chip ledger correctness
- Event log integrity & replay determinism
- Availability (spam/DoS resistance)
- Agent identity & authentication

## 2. Authentication & Authorization

### 2.1 API Authentication (lobby-api)

All HTTP routes except health probes (`/healthz`, `/readyz`) require authentication via `Authorization: Bearer <apiKey>` header.

- **Implementation**: Fastify `onRequest` hook in `apps/lobby-api/src/auth.ts`
- **Validation**: API key validated via `IdentityProvider.authenticate(apiKey)`
- **Response**: `401 { error: 'UNAUTHORIZED' }` on missing/invalid token
- **Agent info**: Authenticated agent identity attached to request as `request.agentAuth`

### 2.2 WebSocket Authentication (JWT Seat Tokens)

Seat tokens are JWTs signed with a server secret (`SEAT_TOKEN_SECRET` env var).

- **JWT payload**: `{ agentId, tableId, exp }`
- **Default expiry**: 30 minutes
- **HELLO verification**: JWT signature + expiry + claims match (agentId, tableId)
- **Token refresh**: `REFRESH_TOKEN` message issues a new JWT before expiry
- **Implementation**: `apps/game-server/src/seat-token.ts`

### 2.3 Identity Provider

- In-memory adapter for development (auto-created agents)
- PostgreSQL adapter for production (bcrypt-hashed API keys)
- Interface: `registerAgent()`, `authenticate()`, `getAgent()`

## 3. Input Validation

All external input is validated with Zod (v4) schemas before processing.

### 3.1 WebSocket Messages (game-server)

- **Max message size**: 16KB hard limit (rejected before parsing)
- **Envelope validation**: `WsEnvelopeSchema` validates structure before dispatch
- **HELLO payload**: `HelloPayloadSchema` (agentId, seatToken, lastSeenEventId)
- **ACTION payload**: `ActionPayloadSchema` (action enum: FOLD/CHECK/CALL/BET/RAISE, optional amount)
- **Implementation**: `apps/game-server/src/schemas.ts`

### 3.2 HTTP Request Bodies (lobby-api)

- `CreateTableBodySchema`: variant (string), maxSeats (2-10)
- `JoinTableBodySchema`: agentId (1-128 chars), buyIn (positive int)
- `MatchmakingQueueBodySchema`: agentId, variant, blindLevel (micro/low/mid/high)
- `CreateAgentBodySchema`: displayName (1-128 chars)
- **Error format**: `{ error: 'VALIDATION_ERROR', details: ZodIssue[] }`
- **Implementation**: `apps/lobby-api/src/schemas.ts`

## 4. Rate Limiting

Token bucket rate limiter with configurable limits per action type.

- **Actions**: 10 tokens/sec max, 10 refill/sec
- **Joins**: 5 tokens max, 5/min refill
- **Response**: `RATE_LIMITED` error with `retryAfterMs`
- **Store**: In-memory (MVP1), Redis-ready interface
- **Implementation**: `apps/game-server/src/rate-limiter.ts`

## 5. Replay / Idempotency Protection

- `seq` + `requestId` per action submission
- Server-side deduplication: `alreadyProcessed` flag in ACK
- Monotonic event IDs for delta sync on reconnect

## 6. CORS Hardening

### 6.1 HTTP (lobby-api)

- Configurable origin whitelist via `CORS_ORIGINS` env var (comma-separated)
- **Development default**: `http://localhost:3000`
- **Production**: `CORS_ORIGINS` must be explicitly set or server refuses to start

### 6.2 WebSocket (game-server)

- `verifyClient` callback validates origin header against `CORS_ORIGINS`
- **Production without CORS_ORIGINS**: rejects all browser-originated connections
- **Development**: allows all origins (agents connect directly without browser origin)

## 7. Anti-Collusion Detection

Package: `@agent-poker/anti-collusion`

### 7.1 ChipDumpDetector

- Tracks fold-with-strong-hand rate per agent pair
- Threshold: >30% fold rate on strong hands (hand strength >= 0.6)
- Minimum sample: 10 hands per pair, 5 strong hands per agent

### 7.2 WinRateAnomalyDetector

- Detects win rates >3 standard deviations from population mean
- Minimum sample: 20 hands per agent, 3+ agents for statistics

### 7.3 Analysis API

- `analyzeAgentPair()` returns `{ riskScore: 0-100, flags[] }`
- Risk scoring: chip dump = +50, win rate anomaly = +30 (capped at 100)
- Admin endpoint: `GET /api/admin/collusion-report?agentA=...&agentB=...`

## 8. Timeout & Griefing Protection

- Strict per-action timeout with auto-fold penalty
- Timeout rate tracked per agent

## 9. State Desync / Reconnect

- Snapshot + delta events resync on reconnect
- `lastSeenEventId` for efficient delta sync
- EventRingBuffer with overflow detection (falls back to full resync)
- Seat token expiry prevents stale reconnections

## 10. Logging

Per action:
- agentId, tableId, handId, seq, requestId, decision, result

Per settlement:
- pot size, winners, transfers

Security events:
- Auth failures, rate limit hits, WS origin rejections
