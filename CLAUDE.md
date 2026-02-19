# agent-poker — Working Agreement (Claude Code/OMC)

## 0) 프로젝트 목적
에이전트(봇)만 참가하는 포커 플랫폼을 만든다.

### MVP1 (1차)
- Web2 기반 (온체인/웹3 기능 없음)
- 가상머니/칩 (현금 가치/환전/토큰화 금지)
- 최소 UI (인간용 UI는 비목표)
- 목표: 2-8 에이전트가 로컬에서 핸드 N개를 안정적으로 진행 + 로그/리플레이/정산
- 베팅 모드: Limit, No-Limit, Pot-Limit Hold'em + ante 지원

### MVP2 (최종)
- Web3 확장 (옵션):
  - x402: join/buy-in(좌석 토큰 발급) 결제 핸드셰이크
  - ERC-8004: agent identity/agentWallet 조회 + 평판/검증 훅
  - 온체인 escrow/정산
- 핵심: MVP1 코어 엔진/WS 프로토콜은 최대한 유지하고 "어댑터"만 교체/추가한다.

---

## 1) 아키텍처 불변조건 (Hard Invariants)
1. **poker-engine은 순수 상태기계**
   - 네트워크/DB/시간/랜덤에 직접 의존 금지
   - 입력: (state, action, rng?) → 출력: (newState, events)
2. **game-server는 이벤트 소싱**
   - 모든 핸드는 event log로부터 100% 리플레이 가능
   - SHA-256 해시 체인으로 이벤트 무결성 보장
   - "재현 불가능한 상태" 금지
3. **프로토콜은 명시적 버저닝**
   - WS 메시지에 protocolVersion 포함 (호환성/업그레이드 대비)
4. **Idempotency / Replay protection**
   - join / action 제출은 멱등성 키로 중복 처리 방지
5. **Web3는 포트-어댑터로 격리**
   - IdentityProvider / Ledger / Settlement 인터페이스 뒤에 숨긴다.
6. **베팅 모드 불변조건 (NL/PL/Limit)**
   - **Limit**: bet/raise는 고정 금액 (preflop/flop: smallBet, turn/river: bigBet)
   - **No-Limit**: minRaise = 직전 raise increment, maxRaise = 올인 (남은 칩 전부)
   - **Pot-Limit**: maxRaise = call + current pot (pot-size raise)
   - 모든 모드에서 칩 보존 불변조건 강제 (totalChips before == totalChips after)
   - Ante는 config.ante로 설정, 딜 시점에 자동 징수
7. **멀티플레이어 불변조건 (2-8인)**
   - 포지션: BTN, SB, BB, UTG, UTG+1, MP, HJ, CO (인원에 따라 동적)
   - 사이드 팟: 올인 시 자동 분리, 각 팟별 독립 정산
   - 쇼다운: 멀티웨이 핸드 평가, 동률 시 균등 분배

---

## 2) MVP1에서 절대 하지 말 것 (Non-goals)
- 현금 가치가 있는 결제/출금/토큰화
- 사람 대상 UI/웹앱(운영용 최소 엔드포인트만)
- 토너먼트 모드 (후순위)

---

## 3) 기술 스택
- Node.js >= 20, TypeScript (ES2022, strict)
- pnpm workspace 모노레포
- lobby-api: Fastify (HTTP)
- game-server: WebSocket (ws) + JWT seat token
- storage: PostgreSQL 16 (Drizzle ORM, 8 테이블)
- cache: Redis 7
- tests: Vitest (198+ tests)
- UI: Next.js 15 App Router (Tailwind v4, shadcn/ui)
- CI/CD: GitHub Actions -> ghcr.io
- monitoring: Prometheus + Grafana

---

## 4) 로컬 커맨드

### 기본
```bash
pnpm i                          # 의존성 설치
pnpm -r build                   # 전체 빌드
pnpm -r test                    # 전체 테스트 (198+)
pnpm -r lint                    # 전체 린트
pnpm dev                        # 개발 서버 일괄 실행
```

### Docker
```bash
# 프로덕션 스택 (Postgres + Redis + 서비스)
docker compose -f docker-compose.prod.yml up
docker compose -f docker-compose.prod.yml down

# 개발 DB만
docker compose up -d

# 모니터링 (Prometheus + Grafana)
docker compose -f docker/docker-compose.monitoring.yml up -d
```

### DB 마이그레이션
```bash
cd packages/database
pnpm drizzle-kit generate        # 마이그레이션 생성
pnpm drizzle-kit migrate         # 마이그레이션 실행
pnpm drizzle-kit push            # 스키마 직접 푸시 (dev)
```

### 데모 / 테스트 스크립트
```bash
pnpm demo                                   # 20핸드 HU Limit E2E
npx tsx scripts/demo-nolimit-6max.ts         # 100핸드 6-max NL
npx tsx scripts/integration-test.ts          # 통합 테스트
npx tsx scripts/benchmark.ts                 # 벤치마크
```

---

## 5) 품질 기준
- 상태전이(액션)는 invalid 케이스 포함 테스트로 잠근다.
- 칩 보존/턴 순서/베팅 라운드 규칙은 "불변조건 테스트"로 강제한다.
- NL/PL 베팅 범위 (minBet, maxBet, minRaise, maxRaise)는 별도 테스트로 검증한다.
- 사이드 팟 분배는 3인 이상 시나리오로 테스트한다.
- 로그만으로 핸드를 재현할 수 있어야 한다 (SHA-256 해시 체인 검증).
- 현재 테스트: **198+ tests, 0 failures**

## Browser Automation
Use `agent-browser` for web automation. Run `agent-browser --help` for all commands.
Core workflow:
1. `agent-browser open <url>` - Navigate to page
2. `agent-browser snapshot -i` - Get interactive elements with refs (@e1, @e2)
3. `agent-browser click @e1` / `fill @e2 "text"` - Interact using refs
4. Re-snapshot after page changes
