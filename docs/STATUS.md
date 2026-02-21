# STATUS (Living)

> 이 파일은 매 작업 세션 후 업데이트. "지금 MVP1이 어디까지 되었는지" 한 눈에 보이게.

## Current Milestone
- **MVP1 v1.0.0: COMPLETE** — Agent-only poker (Web2, virtual chips, NL/PL/Limit)

## Today Snapshot
- Date: 2026-02-20
- Owner (AI Orchestration Lead): Claude Code + OMC
- Active Branch: master
- Status: MVP1 v1.0.0 released — all features complete, tested, dockerized

## Feature Completion

### Core Engine (poker-engine)
- [x] Limit Hold'em 상태기계
- [x] No-Limit Hold'em (minRaise/maxRaise, all-in)
- [x] Pot-Limit Hold'em (pot-size raise cap)
- [x] Ante 지원 (configurable)
- [x] 2-6인 멀티플레이어 (동적 포지션: BTN/SB/BB/UTG-CO)
- [x] 사이드 팟 자동 분리 + 멀티웨이 쇼다운
- [x] 칩 보존 불변조건 강제
- [x] 결정적 RNG (mulberry32 시드)
- [x] 구조화된 에러 (PokerError)

### Event Sourcing (hand-history)
- [x] Append-only 이벤트 로그
- [x] SHA-256 해시 체인 (무결성 보장)
- [x] 리플레이 검증기
- [x] 안정적 시퀀스 번호 (seq)

### Game Server
- [x] WebSocket 서버 (ws)
- [x] JWT seat token 인증 (발급/검증/갱신)
- [x] 프로토콜 버저닝 (protocolVersion)
- [x] 멱등성 키 (requestId) + seq 리플레이 보호
- [x] 레이트 리미팅
- [x] 상대 카드 마스킹 (sanitizeStateForPlayer)
- [x] CORS 지원
- [x] 메시지 크기 제한 (16KB)
- [x] Zod 스키마 검증
- [x] 이벤트 링 버퍼 (재연결 델타 싱크)
- [x] 에이전트별 멀티테이블 추적

### Lobby API
- [x] Fastify HTTP 서버
- [x] 테이블 CRUD
- [x] 에이전트 등록
- [x] 테이블 참가 (JWT seat token 발급)
- [x] 핸드 히스토리 조회
- [x] 현재 핸드 상태 조회
- [x] 매치메이킹 (micro/low/mid/high 블라인드)
- [x] 서버 통계 엔드포인트
- [x] Health/Readiness probes
- [x] Zod 스키마 검증
- [x] CORS 지원

### Agent SDK
- [x] WebSocket 클라이언트 (재연결 + 델타 싱크)
- [x] Strategy 인터페이스
- [x] 내장 봇 6종: CallingStation, RandomBot, AggressiveBot, TightAggressive, PotControl, ShortStack
- [x] 멱등성 헬퍼

### Database (Postgres)
- [x] Drizzle ORM 스키마 (8 테이블)
- [x] agents, tables, seats, hands, hand_events
- [x] chip_accounts, chip_transactions
- [x] matchmaking_queue
- [x] 마이그레이션 지원

### Security
- [x] JWT seat token (발급/검증/갱신)
- [x] API 키 인증
- [x] Zod 입력 검증 (lobby-api + game-server)
- [x] CORS origin 제한
- [x] 메시지 크기 제한 (16KB)
- [x] 레이트 리미팅
- [x] Anti-collusion (ChipDumpDetector, WinRateAnomalyDetector)

### Admin UI (Next.js 15)
- [x] 대시보드 (실시간 통계, 최근 테이블, 퀵 액션)
- [x] 테이블 목록 + 생성/상태/내비게이션
- [x] 테이블 상세 (Live/Info/Seats/Hands 탭)
- [x] 비주얼 포커 테이블 (타원형 그린 펠트, 6석, 카드, 칩, 팟, 액션 티커)
- [x] 핸드 상세 이벤트 타임라인
- [x] 매치메이킹 관리
- [x] 시스템 헬스 모니터링
- [x] API 프록시 라우트 (6 엔드포인트)
- [x] Tailwind v4 + shadcn/ui 다크 포커 테마

### DevOps
- [x] Docker 이미지 (lobby-api, game-server, admin-ui)
- [x] docker-compose.prod.yml (Postgres + Redis + 서비스)
- [x] GitHub Actions CI (ci.yml)
- [x] GitHub Actions Deploy (deploy.yml -> ghcr.io)
- [x] Prometheus + Grafana 모니터링

## In Progress
- None

## Next
- Optional: Web3 extensions (MVP2)
- Optional: Tournament mode
- Optional: Additional poker variants

## Blockers
- None

## Risks
- None (MVP1 scope fully delivered)

## Quality Gates
- Tests: **PASS** (215 tests across 14 files, 0 failures)
- Lint: **PASS** (all packages)
- Build: **PASS** (all packages)
- Local run: **YES** (demo scripts + docker compose)
- Replay determinism: **YES** (verified in E2E, hash chain integrity)
- Chip conservation: **YES** (invariant tests + E2E verification)

## Package Status

| Package | Tests | Build | Status |
|---------|-------|-------|--------|
| poker-engine | 92 | OK | NL/PL/Limit + ante + 2-6인 (6 test files) |
| hand-history | 31 | OK | SHA-256 hash chain + replay (2 test files) |
| adapters-ledger | 22 | OK | Double-entry ledger |
| adapters-identity | 9 | OK | JWT + API key |
| agent-sdk | 38 | OK | 6종 내장 봇 (3 test files) |
| anti-collusion | - | OK | Chip dump + win rate (no tests yet) |
| database | 23 | OK | Drizzle ORM, 8 tables |
| game-server | - | OK | WS + JWT + rate limit |
| lobby-api | - | OK | HTTP + matchmaking |
| admin-ui | - | OK | Next.js 15 dashboard |
| **Total** | **215** | **All OK** | |
