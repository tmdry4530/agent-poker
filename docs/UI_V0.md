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
