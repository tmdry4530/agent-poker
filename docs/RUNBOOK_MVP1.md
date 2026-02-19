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
