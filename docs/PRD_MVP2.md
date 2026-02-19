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
