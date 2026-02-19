#!/usr/bin/env bash
set -euo pipefail

echo "==> agent-poker Phase-0 bootstrap (OMC multi-agent + v0 UI + .env + progress logs)"

write_or_recommend() {
  local path="$1"
  if [[ -f "$path" ]]; then
    local rec="${path}.recommended"
    echo " - EXISTS: $path  -> writing: $rec"
    mkdir -p "$(dirname "$rec")"
    cat > "$rec"
  else
    echo " - WRITING: $path"
    mkdir -p "$(dirname "$path")"
    cat > "$path"
  fi
}

write_if_missing() {
  local path="$1"
  if [[ -f "$path" ]]; then
    echo " - SKIP (exists): $path"
  else
    echo " - WRITING: $path"
    mkdir -p "$(dirname "$path")"
    cat > "$path"
  fi
}

# ------------------------------------------------------------------------------
# 0) .env (env var management)
# ------------------------------------------------------------------------------
write_if_missing .env.example <<'EOF'
# =========================
# agent-poker (MVP1) env
# =========================
NODE_ENV=development
LOG_LEVEL=info

# HTTP/WS ports (MVP1)
LOBBY_PORT=4000
GAME_PORT=4001
ADMIN_UI_PORT=3000

# JWT/Token signing (dev only)
SEAT_TOKEN_SECRET=dev_only_change_me
ADMIN_API_KEY=dev_admin_key_change_me

# Postgres (docker-compose)
POSTGRES_USER=agentpoker
POSTGRES_PASSWORD=agentpoker
POSTGRES_DB=agentpoker
POSTGRES_PORT=5432

# App connection string
DATABASE_URL=postgresql://agentpoker:agentpoker@localhost:5432/agentpoker?schema=public

# MCP tuning (Claude Code)
MCP_TIMEOUT=10000
MAX_MCP_OUTPUT_TOKENS=50000

# ===========================================
# Optional (UI): v0 Platform API (자동 생성)
# - 키가 없으면 v0 자동생성 스크립트는 스킵하고,
#   docs/UI_V0.md에 있는 "수동 프롬프트" 방식으로 진행하면 됨.
# ===========================================
V0_API_KEY=

# ===========================================
# Optional (Multi-AI): external tools
# - OMC는 Gemini CLI / Codex CLI를 선택적으로 오케스트레이션 가능
# - CLI 로그인/설정 방식에 따라 아래 키가 필요할 수도 있음 (환경에 따라 다름)
# ===========================================
OPENAI_API_KEY=
GEMINI_API_KEY=
EOF

# If .env doesn't exist, create it by copying .env.example (safe defaults)
if [[ ! -f .env ]]; then
  echo " - Creating .env from .env.example (safe defaults; keys empty)"
  cp .env.example .env
fi

# ------------------------------------------------------------------------------
# 1) docker-compose (MVP1 local infra)
# ------------------------------------------------------------------------------
write_if_missing docker-compose.yml <<'EOF'
services:
  postgres:
    image: postgres:16
    container_name: agent-poker-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-agentpoker}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-agentpoker}
      POSTGRES_DB: ${POSTGRES_DB:-agentpoker}
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - agent_poker_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-agentpoker} -d ${POSTGRES_DB:-agentpoker}"]
      interval: 5s
      timeout: 5s
      retries: 20

volumes:
  agent_poker_pgdata:
EOF

# ------------------------------------------------------------------------------
# 2) Claude Code settings (permissions + teams + external CLIs)
# ------------------------------------------------------------------------------
write_or_recommend .claude/settings.json <<'EOF'
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1",
    "MCP_TIMEOUT": "10000",
    "MAX_MCP_OUTPUT_TOKENS": "50000"
  },
  "permissions": {
    "allow": [
      "Bash(pnpm *)",
      "Bash(npx *)",
      "Bash(node *)",
      "Bash(git *)",
      "Bash(ls *)",
      "Bash(cat *)",
      "Bash(find *)",
      "Bash(rg *)",
      "Bash(jq *)",
      "Bash(docker compose *)",
      "Bash(docker-compose *)",

      "Bash(gemini *)",
      "Bash(codex *)"
    ],
    "deny": [
      "Bash(curl *)",
      "Bash(wget *)",
      "Bash(ssh *)",
      "Bash(scp *)",
      "Bash(nc *)",
      "Bash(socat *)",

      "Read(./secrets/**)",
      "Read(**/*.pem)",
      "Read(**/*.key)",
      "Write(./secrets/**)",
      "Write(**/*.pem)",
      "Write(**/*.key)"
    ]
  },
  "companyAnnouncements": [
    "MVP1은 Web2(가상칩)만. Web3(x402/ERC-8004/온체인)는 MVP2 어댑터로만 추가.",
    "진행상황/실패/결정은 docs/STATUS.md, docs/WORKLOG.md, docs/FAILURE_LOG.md, docs/adr/* 에 기록.",
    "UI는 v0 기반(수동 프롬프트 or v0 Platform API 자동). 키가 없으면 수동 프롬프트로 진행하고 막히지 말 것."
  ]
}
EOF

# ------------------------------------------------------------------------------
# 3) “실제 개발팀처럼” 진행/실패/보드 문서 템플릿
# ------------------------------------------------------------------------------
write_if_missing docs/STATUS.md <<'EOF'
# STATUS (Living)

> 이 파일은 매 작업 세션 후 업데이트. “지금 MVP1이 어디까지 되었는지” 한 눈에 보이게.

## Current Milestone
- MVP1: Agent-only poker (Web2, virtual chips)

## Today Snapshot
- Date:
- Owner (AI Orchestration Lead):
- Active Branch:

## Done (since last update)
- [ ]

## In Progress
- [ ]

## Next
- [ ]

## Blockers
- [ ]

## Risks
- [ ]

## Quality Gates
- Tests: (pass/fail)
- Lint: (pass/fail)
- Local run: (yes/no)
- Replay determinism: (yes/no)
EOF

write_if_missing docs/WORKLOG.md <<'EOF'
# WORKLOG (Chronological)

> “무엇을 언제 왜 했는지” 타임라인 기록. 실패/우회/결정도 같이 남긴다.

## YYYY-MM-DD
- HH:MM - (who) - (what) - (result) - (links/files)
EOF

write_if_missing docs/FAILURE_LOG.md <<'EOF'
# FAILURE LOG

> 실패 자체보다 “재발 방지”가 목적. 각 항목은 재현/원인/해결/방지 테스트까지.

## F-0001
- Date:
- Summary:
- Symptom:
- Repro steps:
- Root cause:
- Fix:
- Prevention (test/guardrail):
- Files changed:
EOF

write_if_missing docs/PROJECT_BOARD.md <<'EOF'
# PROJECT BOARD (MVP1)

## Backlog
- [ ] Define MVP1 acceptance criteria (hands, replay, ledger invariants)
- [ ] Monorepo scaffold (apps/*, packages/*)
- [ ] Poker engine (HU LHE) + invariants tests
- [ ] Game server (WS) + table actor + timeouts + idempotency
- [ ] Virtual chips ledger (double-entry) + settlement
- [ ] Hand event log + replay verifier
- [ ] Admin UI (v0) to observe tables/hands (minimal)
- [ ] Packaging: scripts, dev commands, docs

## In Progress
- [ ]

## Blocked
- [ ]

## Done
- [ ]
EOF

write_if_missing docs/MVP1_CHECKLIST.md <<'EOF'
# MVP1 CHECKLIST (Definition of Done)

## Must-have
- [ ] 2 agents can play 20 hands end-to-end locally
- [ ] Deterministic replay reproduces the same final hand outcome from event log
- [ ] Invalid actions are rejected with structured error codes
- [ ] Timeouts handled deterministically
- [ ] Virtual chips ledger is correct (double-entry; idempotent refs)
- [ ] docs/STATUS.md, docs/WORKLOG.md, docs/FAILURE_LOG.md maintained

## Nice-to-have
- [ ] Matchmaking
- [ ] Observability metrics
- [ ] ACPC compatibility adapter
EOF

# ------------------------------------------------------------------------------
# 4) Multi-AI (Gemini/Codex) + MCP usage docs
# ------------------------------------------------------------------------------
write_if_missing docs/MULTI_AI_SETUP.md <<'EOF'
# Multi-AI Orchestration (OMC + Gemini/Codex)

## 목적
- Claude Code/OMC가 메인 실행(코드 작성/수정/테스트)
- 필요 시 외부 AI를 “교차 검증/리뷰”로 사용 (ask_codex / ask_gemini)

## OMC에서 제공되는 External AI 도구
- `ask_codex`: 아키텍처 검증/코드리뷰/플래닝 검증
- `ask_gemini`: UI/UX 일관성/문서/비주얼 분석
(OMC 문서에 역할/권장 사용처가 정리되어 있음)

## 설치(선택)
OMC README 기준(선택 기능):
- Gemini CLI 설치: `npm install -g @google/gemini-cli`
- Codex CLI 설치: `npm install -g @openai/codex`

## 설정
- OMC 설치 후 `/omc:omc-setup`
- MCP 설정은 `/oh-my-claudecode:mcp-setup` (또는 omc-setup에서 함께)

## 병렬 컨설팅 패턴(권장)
- 외부 AI 컨설팅은 백그라운드로 띄우고,
  필요한 시점에 결과를 await 하여 의사결정에 반영한다.

## 운영 원칙
- 외부 AI가 불가/실패하면, OMC는 Claude 에이전트로 graceful fallback 해야 한다.
- 외부 AI output은 반드시 docs/WORKLOG.md에 “요약+결론+적용 여부” 기록.
EOF

# ------------------------------------------------------------------------------
# 5) v0 UI docs + v0 Platform API helper script
# ------------------------------------------------------------------------------
mkdir -p tools/v0

write_if_missing docs/UI_V0.md <<'EOF'
# UI with v0 (Admin UI for MVP1)

## 목표
MVP1에서 사람용 UI는 최소이지만, 개발/운영/디버깅을 위해 Admin UI를 둔다:
- active tables list
- table detail (players, stacks, current street)
- last N hands + replay link
- health (ws connections, timeouts)

## 워크플로 2가지

### A) v0.app 수동 워크플로 (키 필요 없음)
1) v0에서 UI 생성 프롬프트 실행
2) 생성된 React/Next.js(shadcn/ui + Tailwind) 코드를 복사
3) Next.js(apps/admin-ui)에 붙여넣고 의존성 설치 후 통합

### B) v0 Platform API 자동 워크플로 (V0_API_KEY 필요)
- `.env`의 `V0_API_KEY`를 설정하면 tools/v0 스크립트로 자동 생성 가능
- 생성물은 우선 `tools/v0/output/`에 떨어뜨리고, 에이전트가 apps/admin-ui로 통합한다.

## v0 프롬프트(권장)
아래 프롬프트를 v0에 입력하거나, Platform API message로 사용:

"Build a minimal Admin dashboard UI for an agent-only poker platform (MVP1). Tech: Next.js App Router + TypeScript + Tailwind + shadcn/ui.
Pages:
1) /tables: list tables (id, status, players, handsPlayed, createdAt)
2) /tables/[id]: table detail with stacks, pot, current street, last 20 events, and buttons to fetch snapshot/replay.
Use shadcn/ui components (Card, Table, Badge, Tabs, Button).
No auth UI needed; assume an X-ADMIN-API-KEY header exists."

## 실패/차선책
- V0_API_KEY가 없거나 API 호출이 실패하면, 에이전트는 수동 프롬프트 방식으로 진행하되 MVP1 개발은 멈추지 않는다.
EOF

write_if_missing tools/v0/README.md <<'EOF'
# tools/v0

v0 Platform API(v0-sdk)를 사용해 UI 코드를 생성/저장하는 유틸리티.

## 사용
1) 루트 .env에 V0_API_KEY 설정
2) 실행:
   - pnpm -C tools/v0 i
   - pnpm -C tools/v0 gen

## 출력
- tools/v0/output/* (생성된 파일들)
EOF

write_if_missing tools/v0/package.json <<'EOF'
{
  "name": "agent-poker-v0-tools",
  "private": true,
  "type": "module",
  "scripts": {
    "gen": "node --loader ts-node/esm generate-admin-ui.ts"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "v0-sdk": "^0.1.0"
  },
  "devDependencies": {
    "ts-node": "^10.9.2",
    "typescript": "^5.6.3"
  }
}
EOF

write_if_missing tools/v0/tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true
  }
}
EOF

write_if_missing tools/v0/generate-admin-ui.ts <<'EOF'
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { v0 } from 'v0-sdk';

const OUT_DIR = path.resolve(process.cwd(), 'output');

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name} (set it in root .env then re-run)`);
  return v;
}

async function main() {
  // v0-sdk reads V0_API_KEY automatically, but we validate early for clearer failure.
  mustEnv('V0_API_KEY');

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const system = [
    'You are an expert frontend engineer.',
    'Output production-ready Next.js App Router + TypeScript + Tailwind + shadcn/ui code.',
    'Prefer small, composable components.',
    'Do not include secrets.',
    'Generate files with paths relative to a Next.js app root (e.g., app/tables/page.tsx, components/*).'
  ].join('\n');

  const message = `
Build a minimal Admin dashboard UI for an agent-only poker platform (MVP1).
Tech: Next.js App Router + TypeScript + Tailwind + shadcn/ui.

Pages:
1) /tables: list tables (id, status, players, handsPlayed, createdAt)
2) /tables/[id]: table detail with stacks, pot, current street, last 20 events, and buttons to fetch snapshot/replay.

Use shadcn/ui components (Card, Table, Badge, Tabs, Button).
No auth UI needed; assume an X-ADMIN-API-KEY header exists.
Use fetch() calls to:
- GET http://localhost:4000/admin/tables
- GET http://localhost:4000/admin/tables/:id
- GET http://localhost:4000/admin/tables/:id/hands?limit=20
- GET http://localhost:4000/admin/hands/:handId/replay
  `.trim();

  const chat = await v0.chats.create({ system, message });

  // Save a link for traceability.
  fs.writeFileSync(path.join(OUT_DIR, 'CHAT_URL.txt'), `${chat.url ?? chat.demo ?? ''}\n`);

  if (!chat.files || chat.files.length === 0) {
    fs.writeFileSync(path.join(OUT_DIR, 'NO_FILES.txt'), 'v0 returned no files.\n');
    console.log('No files returned. See output/CHAT_URL.txt');
    return;
  }

  for (const f of chat.files) {
    const filePath = path.join(OUT_DIR, f.name);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, f.content ?? '');
  }

  console.log(`Saved ${chat.files.length} files to ${OUT_DIR}`);
  console.log('Next: copy/integrate these files into apps/admin-ui (or regenerate with refined prompt).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
EOF

# ------------------------------------------------------------------------------
# 6) OMC execution runbook + prompts (A→Z MVP1 완주용)
# ------------------------------------------------------------------------------
write_if_missing docs/RUNBOOK_MVP1.md <<'EOF'
# RUNBOOK — MVP1 (A→Z, do not stop)

## 원칙
- MVP1 완료(체크리스트 충족)까지 멈추지 않는다.
- 막히면: (1) FAILURE_LOG 기록 → (2) 우회/차선책 적용 → (3) 계속 진행.
- 매 스테이지 종료 시 docs/STATUS.md, docs/WORKLOG.md 업데이트.

## Stage 0: Tooling 준비
1) OMC 설치 및 설정
2) (선택) Gemini/Codex CLI 설치
3) /mcp 상태 확인

## Stage 1: Repo scaffold
- pnpm workspace 모노레포
- apps/lobby-api, apps/game-server, apps/admin-ui
- packages/poker-engine, packages/hand-history, packages/agent-sdk
- CI scripts (lint/test/build)

## Stage 2: Core engine + invariants
- HU Limit Hold'em 상태기계
- 불변조건 테스트(칩보존/턴/베팅라운드/쇼다운)

## Stage 3: Game server (WS)
- table actor
- timeout
- idempotency/replay protection
- event sourcing log append

## Stage 4: Virtual chips ledger (DB)
- double-entry ledger
- buy-in reserve
- pot settlement

## Stage 5: Replay verifier
- log -> replay -> final state match
- deterministic RNG injection

## Stage 6: Admin UI (v0)
- 키 있으면 tools/v0로 생성하고 통합
- 없으면 v0 수동 프롬프트로 생성한 코드를 통합
- 최소 기능: tables list, table detail, hands list/replay

## Stage 7: Stabilize
- pnpm -r test 통과
- 로컬 2 bots 20 hands 완주
- replay 재현성 확인
- 문서/로그 업데이트 후 태깅
EOF

write_if_missing docs/PROMPTS_MVP1.md <<'EOF'
# Prompts — MVP1 (OMC/Claude Code)

## 1) Kickoff (문서/보드 정리)
`/kickoff` (이미 있는 스킬이면 실행)

## 2) 메인 실행 프롬프트 (A→Z 완주)
아래를 그대로 붙여넣기:

autopilot:
Project: agent-poker (MVP1 Web2 virtual chips only)
Hard constraints:
- No Web3 libs or on-chain logic in MVP1.
- MUST keep progress logs like a real dev team:
  - Update docs/STATUS.md after each stage
  - Append to docs/WORKLOG.md every meaningful action
  - Record failures in docs/FAILURE_LOG.md (with repro + prevention)
- Use Team mode to run tasks in parallel (engine/server/ledger/ui/tests).
- Use OMC external AI consultation when useful:
  - ask_codex for architecture & code review
  - ask_gemini for UI/UX & docs
  Run consultations in background when possible and await before final decisions.
- If V0_API_KEY is missing or v0 API fails: DO NOT STOP.
  Continue with placeholder admin UI + leave v0 prompts and integration notes.

Acceptance criteria:
- 2 agents can play 20 hands end-to-end locally
- Deterministic replay reproduces outcomes from event logs
- Virtual chips ledger (double-entry) remains consistent and idempotent
- pnpm -r test passes

Deliverables:
- Monorepo scaffold (apps/* packages/*)
- Working lobby-api + game-server + poker-engine + ledger + replay
- Minimal admin-ui (v0-based or placeholder with v0 prompts)
- Updated docs and logs

## 3) 병렬 팀 프롬프트(필요 시)
예:
`/omc:team 3:executor,2:test-engineer "Implement poker-engine HU LHE + invariants tests; keep docs updated"`
EOF

# ------------------------------------------------------------------------------
# 7) New Claude skills for logging / council / UI v0 / ship MVP1
# ------------------------------------------------------------------------------
mkdir -p .claude/skills/worklog .claude/skills/council .claude/skills/ui-v0 .claude/skills/ship-mvp1

write_if_missing .claude/skills/worklog/SKILL.md <<'EOF'
---
name: worklog
description: Update docs/STATUS.md + docs/WORKLOG.md + docs/FAILURE_LOG.md like a real dev team after changes.
---

Rules:
- Always update docs/STATUS.md to reflect current state.
- Append entries to docs/WORKLOG.md (timestamped).
- If anything failed, add an item to docs/FAILURE_LOG.md with repro + prevention test.
- Keep entries concise but actionable.
EOF

write_if_missing .claude/skills/council/SKILL.md <<'EOF'
---
name: council
description: Run multi-AI cross-validation using OMC MCP tools (ask_codex / ask_gemini), summarize, and record results.
---

Goal:
- Use `ask_codex` for architecture validation / code review (roles: architect, code-reviewer, security-reviewer, tdd-guide).
- Use `ask_gemini` for UI/UX and documentation consistency (roles: designer, writer).

Process:
1) Start both consultations in parallel (background if supported).
2) Await results before finalizing decisions that depend on them.
3) Summarize and record:
   - docs/WORKLOG.md: what was asked, conclusion, what we applied
   - docs/STATUS.md: impact on current milestone
EOF

write_if_missing .claude/skills/ui-v0/SKILL.md <<'EOF'
---
name: ui-v0
description: Build MVP1 Admin UI using v0 (manual prompts or v0 Platform API), then integrate into apps/admin-ui.
---

Rules:
- MVP1 UI is minimal, dev/admin oriented only.
- Prefer v0 output (shadcn/ui + Tailwind + Next.js App Router).
- If V0_API_KEY exists, use tools/v0 generator to create files into tools/v0/output then integrate.
- If V0_API_KEY missing, generate v0 prompts and proceed with a placeholder admin UI so MVP1 doesn't block.
- Always document the chosen path in docs/WORKLOG.md and update docs/STATUS.md.
EOF

write_if_missing .claude/skills/ship-mvp1/SKILL.md <<'EOF'
---
name: ship-mvp1
description: End-to-end delivery driver: keep going until MVP1 DoD is met, with progress/failure logs maintained.
---

Non-negotiable:
- Do not stop before MVP1_CHECKLIST.md must-have is satisfied.
- Keep docs/STATUS.md, docs/WORKLOG.md, docs/FAILURE_LOG.md updated continuously.
- Use Team mode to parallelize.
- Use council (ask_codex/ask_gemini) when uncertain; otherwise keep moving.

Deliver:
- runnable local stack (docker compose up + pnpm dev)
- tests passing
- 2 sample bots playing 20 hands deterministically with replay verification
EOF

echo "==> Phase-0 bootstrap done."
echo "Next suggested steps:"
echo "  1) git init && git add . && git commit -m 'phase0 setup (omc + v0 + logs + env)'"
echo "  2) docker compose up -d"
echo "  3) Install OMC plugin, run /omc:omc-setup, then run autopilot prompt from docs/PROMPTS_MVP1.md"
