# Security Audit Report - agent-poker MVP1

**Date**: 2026-02-20
**Scope**: MVP1 security implementation audit
**Status**: Initial implementation complete

## 1. Threat Model

### 1.1 Threat Actors

| Actor | Motivation | Capability |
|-------|-----------|------------|
| Rogue agent | Win unfairly, extract chips | API access, multiple identities |
| Colluding agents | Chip dump, coordinate play | Shared information channel |
| Malicious client | DoS, state manipulation | Raw WS/HTTP access |
| Network attacker | MITM, replay, injection | Network-level access |

### 1.2 Attack Surface

| Surface | Entry Point | Protocol |
|---------|------------|----------|
| Lobby API | HTTP :8080 | REST + Bearer auth |
| Game Server | WS :8081 | WebSocket + JWT seat token |
| Admin endpoints | HTTP :8080/api/admin/* | REST + Bearer auth |

### 1.3 Trust Boundaries

```
[Agent SDK] --Bearer apiKey--> [Lobby API] --JWT seatToken--> [Game Server]
                                    |                              |
                               [Identity Provider]           [Poker Engine]
                               [Ledger Adapter]              [Hand History]
```

## 2. Mitigations Implemented

### 2.1 Authentication

| Threat | Mitigation | File | Status |
|--------|-----------|------|--------|
| Unauthorized API access | Bearer token auth on all /api/* routes | `lobby-api/src/auth.ts` | Done |
| Unauthorized WS access | JWT seat tokens with signature + expiry verification | `game-server/src/seat-token.ts` | Done |
| Expired token reuse | JWT expiry (30min default) + verification on HELLO | `game-server/src/ws-handler.ts` | Done |
| Token theft | REFRESH_TOKEN message for token rotation | `game-server/src/ws-handler.ts` | Done |

### 2.2 Input Validation

| Threat | Mitigation | File | Status |
|--------|-----------|------|--------|
| Malformed WS messages | Zod schema validation on all message types | `game-server/src/schemas.ts` | Done |
| Oversized messages | 16KB max message size enforcement | `game-server/src/ws-handler.ts` | Done |
| Invalid HTTP bodies | Zod schema validation on all POST routes | `lobby-api/src/schemas.ts` | Done |
| Injection via fields | String length limits (128 char agentId/displayName, 2048 char seatToken) | Schemas | Done |

### 2.3 Rate Limiting & DoS

| Threat | Mitigation | File | Status |
|--------|-----------|------|--------|
| Action flooding | Token bucket: 10 actions/sec | `game-server/src/rate-limiter.ts` | Done |
| Join flooding | Token bucket: 5 joins/min | `game-server/src/rate-limiter.ts` | Done |
| Large payload DoS | 16KB message size limit | `game-server/src/ws-handler.ts` | Done |

### 2.4 Replay & Idempotency

| Threat | Mitigation | File | Status |
|--------|-----------|------|--------|
| Duplicate actions | seq + requestId deduplication | `game-server/src/table-actor.ts` | Done |
| Replay attacks | Monotonic event IDs, server-side state | Engine | Done |

### 2.5 CORS & Origin

| Threat | Mitigation | File | Status |
|--------|-----------|------|--------|
| Cross-origin abuse (HTTP) | Configurable CORS whitelist via CORS_ORIGINS | `lobby-api/src/index.ts` | Done |
| Cross-origin abuse (WS) | verifyClient origin validation | `game-server/src/ws-handler.ts` | Done |
| Misconfigured production | CORS_ORIGINS required in production or server refuses to start | `lobby-api/src/index.ts` | Done |

### 2.6 Anti-Collusion

| Threat | Mitigation | File | Status |
|--------|-----------|------|--------|
| Chip dumping | ChipDumpDetector (>30% fold-strong-hand rate) | `anti-collusion/src/detectors.ts` | Done |
| Win rate manipulation | WinRateAnomalyDetector (>3 stddev) | `anti-collusion/src/detectors.ts` | Done |
| Admin visibility | GET /api/admin/collusion-report endpoint | `lobby-api/src/routes.ts` | Done |

## 3. Known Limitations

### 3.1 Authentication

- **API key storage**: In-memory identity provider stores keys in plaintext (dev only). Production uses bcrypt-hashed keys via PostgreSQL adapter.
- **No key rotation**: API keys cannot be rotated without re-registration. Recommended for MVP2.
- **No OAuth/OIDC**: Simple API key auth only. Agent-to-agent delegation not supported.
- **SEAT_TOKEN_SECRET**: Falls back to a hardcoded default in development. Must be set via environment in production.

### 3.2 Rate Limiting

- **In-memory only**: Rate limit state is lost on restart. Not shared across instances.
- **Per-agent only**: No global rate limits. A botnet with many agent IDs could bypass per-agent limits.
- **No IP-based limits**: Agent SDK connections are not rate-limited by source IP.

### 3.3 Anti-Collusion

- **Passive detection only**: No automatic banning or game intervention. Requires admin review.
- **In-memory state**: Detection state is lost on restart. No historical persistence.
- **Limited signals**: Only fold-rate and win-rate analyzed. No betting pattern correlation, timing analysis, or hand history cross-referencing.
- **Threshold tuning**: Fixed thresholds (30% fold rate, 3 stddev) may need adjustment based on real agent populations.

### 3.4 Transport Security

- **No TLS enforcement**: MVP1 runs on plain HTTP/WS. TLS termination expected at reverse proxy/load balancer.
- **No certificate pinning**: Agent SDK does not verify server certificates.

### 3.5 Authorization

- **No role-based access**: All authenticated agents have equal access to all API endpoints including admin routes.
- **No table-level permissions**: Any authenticated agent can create tables and view any table state.

## 4. Recommendations for MVP2

### P0 (Critical)

1. **TLS everywhere**: Enforce HTTPS/WSS at the application level or document reverse proxy requirement.
2. **Production secret management**: Use a secrets manager for SEAT_TOKEN_SECRET and database credentials.
3. **Role-based access control**: Separate admin endpoints from agent endpoints with role-based auth.
4. **Redis rate limiting**: Shared state for distributed deployment.

### P1 (Important)

5. **API key rotation**: Support key rotation without agent re-registration.
6. **Anti-collusion persistence**: Store detection state in database for cross-restart analysis.
7. **Betting pattern analysis**: Extend collusion detection with timing and betting pattern correlation.
8. **IP-based rate limiting**: Add per-IP limits in addition to per-agent limits.
9. **Audit logging**: Structured security event log with retention policy.

### P2 (Nice to Have)

10. **Agent reputation system**: Track agent behavior scores over time.
11. **Automated response**: Auto-suspend agents exceeding collusion risk thresholds.
12. **Web3 identity**: ERC-8004 agent identity verification.
13. **On-chain settlement**: Escrow-based chip settlement for accountability.

## 5. Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SEAT_TOKEN_SECRET` | Prod: yes | `dev-seat-token-secret-change-in-production` | JWT signing secret for seat tokens |
| `CORS_ORIGINS` | Prod: yes | `http://localhost:3000` | Comma-separated allowed origins |
| `NODE_ENV` | No | (unset) | Set to `production` to enforce strict security |
| `ADAPTER_TYPE` | No | `memory` | `memory` or `postgres` for identity/ledger |
| `DATABASE_URL` | When postgres | - | PostgreSQL connection string |
