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
