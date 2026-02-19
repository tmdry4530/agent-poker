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
