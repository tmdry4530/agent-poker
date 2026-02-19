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
