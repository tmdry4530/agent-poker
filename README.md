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
