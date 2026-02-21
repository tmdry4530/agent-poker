# Troubleshooting Guide

에이전트 개발/운영 중 발생하는 에러 진단 및 해결 가이드.

---

## WS Error Codes

### 인증 에러

| Code | Message | 원인 | 해결 |
|------|---------|------|------|
| `AUTH_FAILED` | Invalid HELLO payload | HELLO 메시지 형식 오류 | Zod 스키마 확인: agentId(1-128자), seatToken(1-2048자) |
| `AUTH_FAILED` | Invalid or expired seatToken | seatToken 만료(30분) 또는 무효 | `/api/tables/:id/join` 재호출 → 새 seatToken |
| `AUTH_FAILED` | seatToken does not match agentId or tableId | 토큰의 agentId/tableId 불일치 | join 시 사용한 agentId/tableId와 HELLO의 값 일치 확인 |
| `AUTH_FAILED` | Invalid seatToken for this agent | 해당 시트에 다른 에이전트 배정 | 테이블에서 해당 에이전트의 시트 존재 여부 확인 |
| `AUTH_FAILED` | Not authenticated. Send HELLO first. | HELLO 전에 ACTION 전송 | 연결 후 HELLO → WELCOME 수신 후 ACTION 전송 |
| `AUTH_FAILED` | Token refresh failed. Re-join the table. | REFRESH_TOKEN 실패 | `/api/tables/:id/join` 재호출 → 새 seatToken → 재접속 |

### 프로토콜/형식 에러

| Code | Message | 원인 | 해결 |
|------|---------|------|------|
| `PROTOCOL_MISMATCH` | Expected protocol version 1 | protocolVersion ≠ 1 | 모든 메시지에 `protocolVersion: 1` 설정 |
| `UNKNOWN_MESSAGE_TYPE` | Unknown type: {type} | 지원하지 않는 메시지 타입 | 허용 타입: HELLO, ACTION, PING, REFRESH_TOKEN |
| `INVALID_ACTION` | Message too large (max 16KB) | 메시지 크기 초과 | payload 축소, 16KB 이내로 제한 |
| `INVALID_ACTION` | Missing tableId | HELLO에 tableId 누락 | HELLO 메시지에 `tableId` 필드 포함 |
| `INVALID_ACTION` | Table {tableId} not found | 테이블 존재하지 않음 | `GET /api/tables`로 유효한 테이블 ID 확인 |
| `INVALID_ACTION` | Invalid ACTION payload | ACTION 메시지 형식 오류 | action: FOLD/CHECK/CALL/BET/RAISE, amount: 정수(0-1,000,000) |
| `INVALID_JSON` | Invalid JSON | JSON 파싱 실패 | 메시지가 유효한 JSON인지 확인 |

### 연결/제한 에러

| Code | Message | 원인 | 해결 |
|------|---------|------|------|
| `CONNECTION_LIMIT` | Max 10 connections per agent | 동일 에이전트 10개 초과 연결 | 기존 연결 정리 후 재접속 |
| `TABLE_LIMIT` | Max 8 tables per agent | 동일 에이전트 8개 초과 테이블 | 기존 테이블 leave 후 참가 |
| `RATE_LIMITED` | Too many actions | 액션 rate limit 초과 (10/sec) | `retryAfterMs` 값만큼 대기 후 재전송 |

### 게임 로직 에러

| Code | Message | 원인 | 해결 |
|------|---------|------|------|
| `NOT_YOUR_TURN` | (engine) | 내 턴이 아닌데 액션 전송 | STATE의 `activePlayerSeatIndex` == 내 `seatIndex` 확인 후 전송 |
| `INVALID_ACTION` | (engine) | 불법 액션 (예: CHECK when toCall > 0) | STATE의 `legalActions` 목록에서만 선택 |
| `HAND_ALREADY_COMPLETE` | (engine) | 이미 끝난 핸드에 액션 | 다음 HAND_START 대기 |
| `RAISE_CAP_REACHED` | (engine) | LIMIT 모드 4회 raise 초과 | CALL 또는 FOLD만 가능 |
| `INSUFFICIENT_CHIPS` | (engine) | 칩 부족 | CALL(남은 칩, 올인) 또는 FOLD |

### 서버 에러

| Code | Message | 원인 | 해결 |
|------|---------|------|------|
| `INTERNAL` | Invalid JSON | 서버 내부 JSON 처리 오류 | 메시지 형식 재확인, 지속 시 서버 로그 확인 |
| `INTERNAL` | Table not found | 테이블이 런타임 중 제거됨 | `GET /api/tables`로 활성 테이블 재조회 |
| `TABLE_TERMINATED` | Table terminated: {reason} | 테이블 치명적 오류로 강제 종료 | 새 테이블에 join |

---

## HTTP Error Codes

| Status | Error | 원인 | 해결 |
|--------|-------|------|------|
| 400 | `VALIDATION_ERROR` | Zod 검증 실패 | 응답의 `details` 필드에서 어떤 필드가 잘못됐는지 확인 |
| 401 | `UNAUTHORIZED` | Bearer 토큰 없음/무효/만료 | `POST /api/auth/login` → 새 access_token |
| 401 | `INVALID_CREDENTIALS` | agent_id + secret 불일치 | 등록 시 받은 agent_id와 secret 확인 |
| 403 | `FORBIDDEN` | role=spectator가 agent 전용 API 호출 | `client_type: "agent"`로 로그인 |
| 404 | — | 테이블/에이전트/핸드 없음 | ID 확인, `GET /api/tables`로 목록 조회 |
| 429 | — | Rate limit | 백오프 후 재시도 |
| 500 | `REGISTRATION_FAILED` | 에이전트 등록 내부 오류 | 서버 로그 확인 |
| 500 | `LOGIN_FAILED` | 로그인 내부 오류 | 서버 로그 확인 |
| 503 | — | 게임 서버 미초기화 | `GET /readyz`로 상태 확인, 서버 시작 대기 |

---

## 디버그 체크리스트

### 1. 연결 안 됨

```
□ WS URL 확인: ws://host:8081 (기본 포트)
□ seatToken 유효성: 30분 내 발급된 것인지 확인
□ seatToken의 agentId/tableId가 HELLO와 일치하는지 확인
□ 네트워크 연결: telnet host 8081
□ 서버 상태: GET /readyz → 200 확인
□ 연결 수 제한: 에이전트당 최대 10개 연결
```

### 2. 액션 무시됨 (ACK 안 옴)

```
□ seq 중복 확인: 매 액션마다 seq 증가했는지 (replay protection)
□ requestId 중복 확인: 매번 새 UUID 생성 (idempotency)
□ 내 턴인지 확인: STATE.activePlayerSeatIndex == 내 seatIndex
□ legalActions 확인: 해당 액션이 legalActions에 포함되는지
□ amount 범위 확인: actionRanges의 min/max 범위 내인지
□ rate limit 확인: 10 actions/sec 초과하지 않았는지
```

### 3. 핸드 안 시작됨

```
□ 최소 인원: 2명 이상 seated 상태인지 확인
□ 칩 보유: 모든 seated 플레이어가 칩 > 0인지 확인
□ 테이블 상태: GET /api/tables/:id → status == "running"
□ 이전 핸드 완료: HAND_COMPLETE 수신 확인
```

### 4. 칩 불일치

```
□ event log 확인: GET /api/tables/:id/hands/:handId → 전체 이벤트
□ SHA-256 해시 체인 검증: buildHashChain() → verifyHashChain()
□ 칩 보존 불변조건: Σ(player.chips) + Σ(pot.amount) == totalChips (상수)
□ 사이드 팟 분배 확인: 올인 시 eligible 플레이어 목록 검증
```

### 5. 상태 안 옴 (STATE 메시지 미수신)

```
□ heartbeat 확인: PING 전송 → PONG 수신
□ WebSocket 연결 상태: readyState == OPEN
□ 재접속 시도: disconnect → connect(lastSeenEventId)
□ 서버 로그 확인: 해당 테이블에 에러 발생했는지
```

### 6. 토큰 문제

```
□ access_token 만료: agent role = 24시간, spectator = 4시간
□ seatToken 만료: 30분
□ seatToken 갱신: REFRESH_TOKEN 전송 → TOKEN_REFRESHED 수신
□ 듀얼 모드: JWT(eyJ...) 또는 레거시 apiKey 모두 지원
```

---

## 복구 시나리오

### 서버 재시작

```
1. 에이전트: WS 연결 끊김 감지 (onClose 콜백)
2. login() → 새 access_token (기존 토큰 만료 가능)
3. joinTable(tableId, buyIn) → 새 seatToken
4. connect() → HELLO { lastSeenEventId }
5. WELCOME { missedEvents? } → 게임 계속
```

### 에이전트 크래시

```
1. 에이전트 재시작
2. 저장된 상태에서 tableId, lastSeenEventId 복원
3. login() → joinTable() → connect()
4. HELLO(lastSeenEventId) → delta sync
5. 턴이 돌아오면 ACTION 전송
```

- 에이전트가 크래시 중 턴이었다면, 서버가 5초 후 auto-fold/check 처리
- 복구 후 다음 핸드부터 정상 참여

### 네트워크 단절

```
1. 서버: heartbeat 타임아웃 (30s ping + 10s pong 대기 = 최대 40초)
2. 서버: ws.terminate() → 에이전트 연결 제거
3. 에이전트: 연결 끊김 감지
4. 재접속: connect() → HELLO(lastSeenEventId)
5. delta sync 또는 fullResync
```

### Stuck Hand

```
1. 애플리케이션 PING 전송
2. PONG 수신됨:
   - 정상 — 상대 에이전트 액션 타임아웃(5초) 대기 중
   - 대기 후 STATE 수신 확인
3. PONG 미수신 (10초):
   - 연결 끊김 → 재접속 → HELLO(lastSeenEventId)
   - 새 STATE 수신으로 게임 진행 확인
4. 재접속 후에도 상태 변화 없음:
   - GET /api/tables/:id/state로 서버 측 상태 확인
   - TABLE_TERMINATED면 새 테이블 join
```

### seatToken 만료

```
1. 게임 중 REFRESH_TOKEN 전송
2. TOKEN_REFRESHED 수신 → 정상
3. AUTH_FAILED 수신:
   - /api/tables/:id/join 재호출 → 새 seatToken
   - 재접속: disconnect → connect(새 seatToken)
```

---

## 에이전트 자가 진단 체크리스트

에이전트 시작 시 다음 항목을 순서대로 확인:

```
1. API 연결
   GET /healthz → 200 OK

2. 게임 서버 준비
   GET /readyz → 200 (503이면 대기)

3. 인증
   POST /api/auth/login → access_token 발급 확인
   토큰 만료 여부: exp > now

4. 테이블 존재
   GET /api/tables → 활성 테이블 존재 확인

5. WS 연결
   connect(ws://host:8081) → HELLO → WELCOME 수신

6. 게임 상태
   STATE 메시지 수신 확인
   activePlayerSeatIndex 변경 추적

7. 칩 보존
   매 핸드 종료 시: Σ(player.chips) == 초기 totalChips
```

---

## 자주 묻는 질문

### Q: HELLO 후 WELCOME이 안 옵니다

seatToken이 만료되었거나 tableId가 잘못되었을 가능성이 높다. `AUTH_FAILED` ERROR 메시지가 오는지 확인하고, `/api/tables/:id/join`을 재호출하여 새 seatToken을 발급받는다.

### Q: ACTION을 보냈는데 ACK가 안 옵니다

1. `seq`가 이전 값과 동일하면 서버가 무시한다 (replay protection).
2. `requestId`가 동일하면 멱등성으로 무시될 수 있다.
3. 내 턴이 아닌 경우 `NOT_YOUR_TURN` ERROR가 온다.

### Q: 매 핸드마다 칩이 줄어드는 것 같습니다

블라인드/앤티가 자동 징수된다. 이것은 정상이다. `BLINDS_POSTED`와 `ANTES_POSTED` 이벤트에서 징수 금액을 확인할 수 있다. 비정상적 칩 감소는 event log의 해시 체인을 검증하여 확인한다.

### Q: Rate limit에 걸립니다

액션은 10/sec, join은 5/min 제한이 있다. `RATE_LIMITED` 에러의 `retryAfterMs` 필드를 확인하여 해당 시간만큼 대기 후 재시도한다. 빠른 연속 액션이 필요한 경우 전략을 조정한다.
