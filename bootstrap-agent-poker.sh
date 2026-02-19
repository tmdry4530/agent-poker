#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(pwd)"
PROJECT_NAME="agent-poker"

echo "==> Bootstrapping ${PROJECT_NAME} in: ${ROOT_DIR}"

# ------------------------------------------------------------------------------
# Directories
# ------------------------------------------------------------------------------
mkdir -p .claude/skills
mkdir -p .claude/skills/kickoff
mkdir -p .claude/skills/spec-mvp1
mkdir -p .claude/skills/ws-protocol
mkdir -p .claude/skills/engine-invariants
mkdir -p .claude/skills/event-log-replay
mkdir -p .claude/skills/ledger-virtual
mkdir -p .claude/skills/security-threat-model
mkdir -p .claude/skills/mvp2-web3-plan

mkdir -p docs
mkdir -p docs/adr

# ------------------------------------------------------------------------------
# Root files
# ------------------------------------------------------------------------------
cat > README.md <<'EOF'
# agent-poker

에이전트 전용 포커 플랫폼.

## 단계
- MVP1: Web2 / 가상머니(칩) / 에이전트 전용 / 실시간(WebSocket)
- MVP2: Web3 / (옵션) x402 결제 + (옵션) ERC-8004 에이전트 신원/평판 + 온체인 정산

## 개발 원칙
- 포커 엔진은 순수(state machine) + 결정적(deterministic)
- 게임 서버는 이벤트 소싱(event-sourcing) 기반 로그로 리플레이 가능해야 함
- Web3는 “어댑터”로만 추가 (코어 엔진/프로토콜은 최대한 고정)

## 빠른 시작(스캐폴딩 후)
- pnpm i
- pnpm -r test
EOF

cat > CLAUDE.md <<'EOF'
# agent-poker — Working Agreement (Claude Code/OMC)

## 0) 프로젝트 목적
에이전트(봇)만 참가하는 포커 플랫폼을 만든다.

### MVP1 (1차)
- Web2 기반 (온체인/웹3 기능 없음)
- 가상머니/칩 (현금 가치/환전/토큰화 금지)
- 최소 UI (인간용 UI는 비목표)
- 목표: 2개 에이전트가 로컬에서 핸드 N개를 안정적으로 진행 + 로그/리플레이/정산

### MVP2 (최종)
- Web3 확장 (옵션):
  - x402: join/buy-in(좌석 토큰 발급) 결제 핸드셰이크
  - ERC-8004: agent identity/agentWallet 조회 + 평판/검증 훅
  - 온체인 escrow/정산
- 핵심: MVP1 코어 엔진/WS 프로토콜은 최대한 유지하고 “어댑터”만 교체/추가한다.

---

## 1) 아키텍처 불변조건 (Hard Invariants)
1. **poker-engine은 순수 상태기계**
   - 네트워크/DB/시간/랜덤에 직접 의존 금지
   - 입력: (state, action, rng?) → 출력: (newState, events)
2. **game-server는 이벤트 소싱**
   - 모든 핸드는 event log로부터 100% 리플레이 가능
   - “재현 불가능한 상태” 금지
3. **프로토콜은 명시적 버저닝**
   - WS 메시지에 protocolVersion 포함 (호환성/업그레이드 대비)
4. **Idempotency / Replay protection**
   - join / action 제출은 멱등성 키로 중복 처리 방지
5. **Web3는 포트-어댑터로 격리**
   - IdentityProvider / Ledger / Settlement 인터페이스 뒤에 숨긴다.

---

## 2) MVP1에서 절대 하지 말 것 (Non-goals)
- 현금 가치가 있는 결제/출금/토큰화
- 사람 대상 UI/웹앱(운영용 최소 엔드포인트만)
- 6-max/토너먼트/No-limit 같은 복잡 확장 (후순위)

---

## 3) 기술 스택 기본값 (필요 시 변경 가능)
- Node.js >= 20, TypeScript
- pnpm workspace 모노레포
- lobby-api: Fastify (HTTP)
- game-server: WebSocket (ws)
- storage: Postgres (MVP1 chips ledger)
- tests: Vitest (+ 가능하면 fast-check로 불변조건 강화)

---

## 4) 로컬 커맨드(스캐폴딩 후)
- pnpm i
- pnpm -r test
- pnpm -r lint
- pnpm -r build

---

## 5) 품질 기준
- 상태전이(액션)는 invalid 케이스 포함 테스트로 잠근다.
- 칩 보존/턴 순서/베팅 라운드 규칙은 “불변조건 테스트”로 강제한다.
- 로그만으로 핸드를 재현할 수 있어야 한다.
EOF

cat > .editorconfig <<'EOF'
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
EOF

cat > .gitignore <<'EOF'
# Node / TS
node_modules/
dist/
build/
coverage/
*.log

# Env / secrets
.env
.env.*
secrets/
*.pem
*.key

# OS
.DS_Store

# Claude Code / MCP local state (project)
.mcp.json
EOF

cat > .nvmrc <<'EOF'
20
EOF

# ------------------------------------------------------------------------------
# Minimal monorepo scaffold (safe defaults; Claude/OMC will extend)
# ------------------------------------------------------------------------------
cat > package.json <<'EOF'
{
  "name": "agent-poker",
  "private": true,
  "version": "0.0.0",
  "description": "Agent-only poker platform (MVP1: Web2 chips, MVP2: Web3 adapters).",
  "scripts": {
    "lint": "pnpm -r lint",
    "test": "pnpm -r test",
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck"
  }
}
EOF

cat > pnpm-workspace.yaml <<'EOF'
packages:
  - "apps/*"
  - "packages/*"
  - "contracts/*"
EOF

cat > tsconfig.base.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  }
}
EOF

# ------------------------------------------------------------------------------
# Claude Code settings (project-scope)
# ------------------------------------------------------------------------------
cat > .claude/settings.json <<'EOF'
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "permissions": {
    "allow": [
      "Bash(pnpm *)",
      "Bash(node *)",
      "Bash(git *)",
      "Bash(ls *)",
      "Bash(cat *)",
      "Bash(find *)",
      "Bash(rg *)",
      "Bash(jq *)",
      "Bash(docker compose *)",
      "Bash(docker-compose *)"
    ],
    "deny": [
      "Bash(curl *)",
      "Bash(wget *)",
      "Bash(ssh *)",
      "Bash(scp *)",
      "Bash(nc *)",
      "Bash(socat *)",
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(./secrets/**)",
      "Read(**/*.pem)",
      "Read(**/*.key)",
      "Write(./.env)",
      "Write(./.env.*)",
      "Write(./secrets/**)",
      "Write(**/*.pem)",
      "Write(**/*.key)"
    ]
  },
  "companyAnnouncements": [
    "MVP1은 Web2(가상칩)만. Web3(x402/ERC-8004/온체인)는 MVP2 어댑터로만 추가.",
    "poker-engine은 순수 상태기계 + 테스트로 잠그기. game-server는 이벤트 소싱 로그 필수."
  ]
}
EOF

# ------------------------------------------------------------------------------
# Claude Code Skills (project-scope)
# ------------------------------------------------------------------------------
cat > .claude/skills/kickoff/SKILL.md <<'EOF'
---
name: kickoff
description: Project kickoff. Ensure docs templates are filled, define module boundaries, and create an MVP1 scaffolding plan.
disable-model-invocation: true
---

You are the project lead for agent-poker.

Goals:
- Focus on MVP1 (Web2 virtual chips only).
- Produce or update docs/* to be implementation-ready.
- Propose a step-by-step execution plan for OMC (autopilot/team/ultraqa).

Rules:
- Do NOT implement Web3 in MVP1 code.
- Keep Web3 requirements as adapter interfaces and docs only.
- Enforce the invariants in CLAUDE.md.

Deliverables:
1) Update docs/PRD_MVP1.md, docs/ARCHITECTURE.md, docs/PROTOCOL_WS.md, docs/DATA_MODEL.md, docs/SECURITY.md
2) Add an ADR in docs/adr/0001-initial-architecture.md summarizing key decisions.
3) Provide a concrete “next prompts” list for Claude Code / OMC.
EOF

cat > .claude/skills/spec-mvp1/SKILL.md <<'EOF'
---
name: spec-mvp1
description: Update MVP1 spec (PRD + acceptance criteria + open questions) without adding Web3 scope.
---

Read docs/PRD_MVP1.md and improve it:
- Clarify rules (game type, betting structure, timeouts).
- Define explicit acceptance criteria (measurable).
- List open questions and propose default decisions.

Constraints:
- MVP1 is virtual chips only.
- Minimal human UI.
EOF

cat > .claude/skills/ws-protocol/SKILL.md <<'EOF'
---
name: ws-protocol
description: Define/update the WebSocket protocol spec: message types, schemas, idempotency, replay protection, reconnect flow.
---

Update docs/PROTOCOL_WS.md.

Include:
- protocolVersion
- message envelope (type, ts, requestId, tableId, seatToken, payload)
- idempotency keys for action submission
- replay protection strategy (monotonic seq per client or per seat)
- error codes and retry rules
- full example flows:
  1) join -> ws connect -> start hand -> actions -> end hand
  2) disconnect -> reconnect -> state resync
EOF

cat > .claude/skills/engine-invariants/SKILL.md <<'EOF'
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
EOF

cat > .claude/skills/event-log-replay/SKILL.md <<'EOF'
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
EOF

cat > .claude/skills/ledger-virtual/SKILL.md <<'EOF'
---
name: ledger-virtual
description: Design MVP1 virtual chip ledger (double-entry), DB schema, and settlement rules.
---

Update docs/DATA_MODEL.md with a double-entry ledger model:
- chip_accounts: per agent, per currency(only CHIP for MVP1)
- chip_tx: immutable transactions with (debit_account, credit_account, amount, reason, ref)
- constraints: amount > 0, balanced entries, idempotency on ref

Define:
- buy-in rules (reserve chips to seat)
- hand settlement (winner receives pot, losers pay)
- rake policy (default: none in MVP1 unless required)
EOF

cat > .claude/skills/security-threat-model/SKILL.md <<'EOF'
---
name: security-threat-model
description: Create/update threat model for agent-only poker: sybil, collusion, replay, spam, timeouts, state desync.
---

Update docs/SECURITY.md with:
- Assets, trust boundaries, entry points
- Attack list and mitigations
- Detection signals (logging/metrics)
- Tests or enforcement points

MVP1 priorities:
- Idempotency and replay protection
- Rate limits and timeouts
- Collusion signals logging (even if not enforced yet)
EOF

cat > .claude/skills/mvp2-web3-plan/SKILL.md <<'EOF'
---
name: mvp2-web3-plan
description: Plan MVP2 Web3 adapters (x402 join payments, ERC-8004 identity/agentWallet, escrow settlement) without changing core engine/protocol.
disable-model-invocation: true
---

Update docs/PRD_MVP2.md and docs/ONCHAIN.md.

Rules:
- Core poker-engine and WS protocol must remain stable.
- All Web3 integration must be via adapters:
  - IdentityProvider (ERC-8004 lookup)
  - Ledger/Settlement (escrow + payout)
  - Join/buy-in payments (x402 on HTTP join endpoint only)

Deliver:
- Migration plan from MVP1 DB ledger to MVP2 escrow
- Minimal contract interface sketch (functions only, no full implementation needed at this stage)
EOF

# ------------------------------------------------------------------------------
# Docs templates
# ------------------------------------------------------------------------------
cat > docs/PRD_MVP1.md <<'EOF'
# PRD — MVP1 (Web2 / Virtual Chips)

## 1. 배경 / 문제정의
- 에이전트(봇)끼리만 플레이 가능한 포커 플랫폼이 필요
- 실시간 게임/재현 가능한 로그/칩 정산이 핵심

## 2. 목표
- 2개 이상의 에이전트가 로비에서 매치 → 테이블 입장 → 핸드 N개 진행
- 모든 핸드가 이벤트 로그로 저장되고 리플레이로 재현 가능
- 가상칩(현금 가치 없음) 정산 정확성

## 3. 비목표(명시)
- 현금 가치/환전/토큰/온체인 결제
- 사람 대상 UI (운영용 최소 API만)
- 토너먼트/No-limit/6max 등 대규모 확장

## 4. 사용자(에이전트) 시나리오
- Agent registers (API key or token)
- Agent lists tables
- Agent joins table (buy-in with virtual chips)
- Agent plays via WebSocket (action messages)
- Agent disconnects and reconnects, resumes safely

## 5. 게임 스펙(초안, 기본값)
- Variant: Texas Hold'em
- Seats: Heads-up (2 players)
- Betting: Limit (고정 베팅)
- Blinds: TBD
- Action timeout: TBD (예: 2s + timebank 10s)

## 6. 기능 요구사항
### 6.1 Lobby/API
- table create/list/join
- matchmaking (옵션)
- admin endpoints (테스트용)

### 6.2 Game Server (WS)
- seatToken 기반 접속
- state push + action request/response
- timeout 처리
- idempotency/replay protection
- disconnect/reconnect state resync

### 6.3 Storage
- virtual chips ledger (double-entry)
- hand events log (immutable)
- agent registry

## 7. 관측/운영
- structured logs
- match/hand metrics (hands/sec, timeout rate, reconnect rate)

## 8. Acceptance Criteria (측정 가능)
- 로컬에서 2 bots가 20 hands 완주
- 재시도/중복 action으로 칩/상태가 깨지지 않음
- event log replay로 동일 결과 재현(핸드 단위)

## 9. Open Questions
- blinds, bet sizing (limit steps)
- rake (MVP1은 기본 none 권장)
- rating/league는 MVP1에 포함?
EOF

cat > docs/PRD_MVP2.md <<'EOF'
# PRD — MVP2 (Web3 / Final)

## 1. 목표
- MVP1 코어(engine/protocol/log)는 유지
- Web3는 adapters로 추가:
  - (옵션) x402: HTTP join/buy-in 결제
  - (옵션) ERC-8004: agent identity + agentWallet 조회
  - (옵션) 온체인 escrow/정산

## 2. 범위
### 2.1 결제/바이인
- join endpoint에서만 결제 (WS 액션은 결제와 분리)
- 성공 시 seatToken 발급

### 2.2 정산/지급
- escrow에서 payout
- agentWallet을 상금 수령 주소로 사용(가능 시)

### 2.3 평판/검증(선택)
- reputation registry에 결과/행동 기반 피드백
- validation registry는 확장 포인트로만 (강제 아님)

## 3. Migration Plan (초안)
- MVP1 DB ledger -> MVP2 escrow:
  - 신규 테이블은 escrow 기반
  - 기존 virtual chips 모드는 유지 가능(리그 분리)

## 4. Acceptance Criteria
- join 결제 성공/실패/재시도 멱등성
- payout 주소 바꿔치기 방지(ERC-8004 agentWallet 신뢰 모델)
- 코어 엔진 변경 최소화
EOF

cat > docs/ARCHITECTURE.md <<'EOF'
# Architecture

## 1. Components
- apps/lobby-api (HTTP)
- apps/game-server (WebSocket, table actors)
- packages/poker-engine (pure deterministic state machine)
- packages/hand-history (event log format + replay verifier)
- packages/agent-sdk (client library for agents)
- packages/adapters-* (Identity/Ledger/Settlement implementations)
- contracts/ (MVP2 only, optional)

## 2. Ports & Adapters
Interfaces (ports):
- IdentityProvider: authenticate agent, map to agentId/ownerId
- Ledger: reserve chips, transfer chips, settle pots
- Settlement: final payout mechanism (MVP1 internal, MVP2 on-chain)

Adapters:
- MVP1: PostgresIdentityProvider, PostgresLedger, InternalSettlement
- MVP2: ERC8004IdentityProvider, EscrowLedger, OnchainSettlement, x402JoinPayment

## 3. Table as an Actor
- One table = one serialized execution loop
- Inputs: join/leave/action/timeout/reconnect
- Outputs: events + state updates
- Persistence: append-only hand events

## 4. Event Sourcing & Replay
- Every state transition emits events
- Persist events in stable order
- Replay tool reconstructs final state and validates invariants

## 5. Future-proofing
- Optional hash-chain for events (later proofs)
- Protocol versioning
EOF

cat > docs/PROTOCOL_WS.md <<'EOF'
# WebSocket Protocol (MVP1)

## 1. Envelope
All messages are JSON:
```json
{
  "protocolVersion": 1,
  "type": "ACTION",
  "requestId": "uuid",
  "tableId": "tbl_...",
  "seatToken": "st_...",
  "seq": 12,
  "payload": {}
}
2. Replay protection

seq must be strictly increasing per connection (or per seat)

Server rejects duplicates / old seq with ERROR(code="REPLAY_DETECTED")

3. Idempotency

Every ACTION has requestId

Server stores last N requestId per seat and returns the same response for duplicates

4. Message types (initial)

HELLO (client -> server): includes agentId, seatToken, lastSeenHand?, lastSeenEventId?

WELCOME (server -> client): accepted + initial state snapshot

STATE (server -> client): incremental updates or full snapshot

ACTION (client -> server): fold/call/raise/check + amount (if needed)

ACK (server -> client): acknowledges requestId

ERROR (server -> client): structured errors

PING/PONG

5. Reconnect flow

client connects, sends HELLO with lastSeenEventId

server responds with WELCOME + delta events or full snapshot

game resumes

6. Error codes (draft)

AUTH_FAILED

SEAT_TOKEN_EXPIRED

INVALID_ACTION

NOT_YOUR_TURN

REPLAY_DETECTED

RATE_LIMITED

INTERNAL
EOF

cat > docs/DATA_MODEL.md <<'EOF'

Data Model (MVP1 / Postgres)
1. agents

id (pk)

display_name

created_at

status (active/banned)

owner_id (optional, reserved for MVP2 & anti-sybil)

2. tables

id (pk)

variant (HU_LHE)

status (open/running/closed)

created_at

3. seats

table_id, seat_no

agent_id

buy_in_amount

status (seated/left)

4. hands

id (pk)

table_id

hand_no

started_at, ended_at

result_summary (json)

5. hand_events (append-only)

id (pk, monotonic)

hand_id

seq (monotonic per hand)

type

payload (jsonb)

created_at
Indexes:

(hand_id, seq)

6. chips ledger (double-entry)
chip_accounts

id (pk)

agent_id

currency = 'CHIP'

balance (bigint)

updated_at

chip_tx (immutable)

id (pk)

ref (unique) # idempotency key

debit_account_id

credit_account_id

amount (bigint, >0)

reason (enum: BUYIN, POT_TRANSFER, REFUND, ADMIN_ADJUST)

created_at
EOF

cat > docs/SECURITY.md <<'EOF'

Security & Abuse Model (MVP1-first)
1. Assets

Game integrity (no illegal actions, correct turn order)

Chip ledger correctness

Event log integrity & replay determinism

Availability (spam/DoS resistance)

2. Threats (MVP1)
2.1 Replay / duplicate actions

Mitigation: seq + requestId idempotency, server-side cache

Detection: rejected REPLAY_DETECTED count

2.2 Timeout abuse / griefing

Mitigation: strict per-action timeout + penalties (fold)

Detection: timeout rate per agent

2.3 Sybil / multi-agent collusion

MVP1: detect signals only (log)

Signals: chip dumping, correlated folds/raises, suspicious winrate clusters

2.4 State desync / reconnect exploit

Mitigation: snapshot + delta events resync, seatToken expiry, monotonic event ids

3. Logging requirements

per action: agentId, tableId, handId, seq, requestId, decision, result

per settlement: pot size, winners, transfers
EOF

cat > docs/ONCHAIN.md <<'EOF'

Onchain Plan (MVP2)
1. Guiding principle

Do NOT change core poker-engine / WS protocol.

Add Web3 via adapters.

2. x402 (optional)

Apply only to HTTP join/buy-in:

POST /tables/:id/join

If unpaid -> 402 with payment requirements

If paid -> issue seatToken

3. ERC-8004 (optional)

IdentityProvider implementation:

input: agentRegistry + agentId

output: agentURI, agentWallet (payout address)

Reputation/Validation: optional extensions

4. Escrow (optional)

deposit/buy-in -> escrow

settle hand/match -> payout to agentWallet
EOF

cat > docs/WORKFLOW_CLAUDE_CODE.md <<'EOF'

Workflow — Claude Code + Oh My ClaudeCode (OMC)
0) Before you start

Ensure Claude Code is installed

Install OMC plugin (once) using its setup skill

Enable Agent Teams via env in .claude/settings.json (already set)

1) Suggested execution order

/kickoff

OMC autopilot: scaffold monorepo + minimal playable match

/engine-invariants (lock rules via tests)

/ws-protocol (finalize WS protocol)

/event-log-replay (event sourcing + replay)

/ledger-virtual (chip ledger correctness)

/security-threat-model (hardening)

(Later) /mvp2-web3-plan

2) OMC modes to use

autopilot: multi-step implementation loops

team: split engine/protocol/storage tasks

ultraqa: test-fail-fix loops

3) Rules of engagement

Keep MVP1 Web2 only.

Do not introduce Web3 libraries until MVP2.
EOF

cat > docs/adr/0001-initial-architecture.md <<'EOF'

ADR-0001: Initial architecture (MVP1 Web2 -> MVP2 Web3 adapters)
Status

Proposed

Context

We need a deterministic poker core and real-time server, with later Web3 extensions.

Decision

Use ports/adapters: IdentityProvider, Ledger, Settlement

Core engine is pure state machine; server is event-sourced

Consequences

MVP1 can ship fast with Postgres ledger

MVP2 can swap adapters for x402/ERC-8004/escrow without rewriting the engine
EOF

echo "==> Done."
echo "Next: git init && git add . && git commit -m 'bootstrap agent-poker'"