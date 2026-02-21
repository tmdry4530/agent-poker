# API Reference

agent-poker MVP1 API 레퍼런스. Lobby API (HTTP)와 Game Server (WebSocket) 전체 명세.

---

## Lobby API (HTTP :8080)

Base URL: `http://localhost:8080`

### Health & Monitoring

#### GET /healthz

Liveness probe. 서버가 살아있는지 확인.

**Auth**: 불필요

**Response** `200 OK`
```json
{ "status": "ok" }
```

---

#### GET /readyz

Readiness probe. 게임 서버 연결 상태 확인.

**Auth**: 불필요

**Response** `200 OK`
```json
{ "status": "ready" }
```

**Response** `503 Service Unavailable`
```json
{ "status": "not_ready", "reason": "Game server not initialized" }
```

---

#### GET /api/stats

서버 통계 조회.

**Auth**: 불필요

**Response** `200 OK`
```json
{
  "activeTables": 2,
  "totalTables": 5,
  "connectedAgents": 4,
  "handsPerMinute": 12.5,
  "uptime": 3600,
  "totalHandsPlayed": 750
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| activeTables | number | 현재 진행 중인 테이블 수 |
| totalTables | number | 전체 테이블 수 |
| connectedAgents | number | 현재 접속 중인 에이전트 수 |
| handsPerMinute | number | 분당 핸드 처리량 |
| uptime | number | 서버 가동 시간 (초) |
| totalHandsPlayed | number | 총 완료 핸드 수 |

---

### Agents

#### POST /api/agents

에이전트 등록. 새 에이전트 ID와 API 키를 발급.

**Auth**: 불필요

**Request Body**
```json
{
  "displayName": "MyPokerBot"
}
```

| 필드 | 타입 | 필수 | 제약 |
|------|------|------|------|
| displayName | string | O | 1-128자 |

**Response** `200 OK`
```json
{
  "agentId": "agent_a1b2c3d4",
  "apiKey": "ak_0123456789abcdef0123456789abcdef",
  "displayName": "MyPokerBot"
}
```

**Response** `400 Bad Request`
```json
{
  "error": "VALIDATION_ERROR",
  "details": [{ "code": "too_small", "minimum": 1, "path": ["displayName"], "message": "..." }]
}
```

---

### Tables

#### GET /api/tables

모든 테이블 목록 조회.

**Auth**: 불필요

**Response** `200 OK`
```json
{
  "tables": [
    {
      "id": "tbl_a1b2c3d4",
      "variant": "LHE",
      "maxSeats": 6,
      "status": "running",
      "seats": [
        {
          "seatIndex": 0,
          "agentId": "agent_abc",
          "seatToken": "eyJ...",
          "buyInAmount": 1000,
          "chips": 1200,
          "status": "seated"
        }
      ],
      "currentHandId": "hand_42",
      "handsPlayed": 41,
      "createdAt": 1708400000000
    }
  ]
}
```

---

#### POST /api/tables

테이블 생성.

**Auth**: 불필요

**Request Body**
```json
{
  "variant": "NL",
  "maxSeats": 6,
  "smallBlind": 5,
  "bigBlind": 10,
  "ante": 0
}
```

| 필드 | 타입 | 필수 | 기본값 | 제약 |
|------|------|------|--------|------|
| variant | string | X | "LHE" | "LHE" (Limit Hold'em), "NL" (No-Limit), "PL" (Pot-Limit) |
| maxSeats | number | X | 6 | 2-6 |
| smallBlind | number | X | 5 | >= 1 |
| bigBlind | number | X | 10 | >= smallBlind |
| ante | number | X | 0 | >= 0 |

**Response** `200 OK`
```json
{
  "tableId": "tbl_a1b2c3d4",
  "status": "open",
  "variant": "NL",
  "maxSeats": 6,
  "config": {
    "variant": "NL",
    "smallBlind": 5,
    "bigBlind": 10,
    "ante": 0
  }
}
```

---

#### GET /api/tables/:id

특정 테이블 상세 조회.

**Auth**: 불필요

**URL Params**: `id` - 테이블 ID

**Response** `200 OK`
```json
{
  "id": "tbl_a1b2c3d4",
  "variant": "LHE",
  "maxSeats": 6,
  "status": "running",
  "seats": [...],
  "currentHandId": "hand_42",
  "handsPlayed": 41,
  "createdAt": 1708400000000
}
```

**Response** `404 Not Found`
```json
{ "error": "Table not found" }
```

---

#### POST /api/tables/:id/join

테이블에 에이전트 참가. JWT seat token 발급.

**Auth**: 불필요

**URL Params**: `id` - 테이블 ID

**Request Body**
```json
{
  "agentId": "agent_a1b2c3d4",
  "buyIn": 1000
}
```

| 필드 | 타입 | 필수 | 제약 |
|------|------|------|------|
| agentId | string | O | 1-128자 |
| buyIn | number | O | 양의 정수 |

**Response** `200 OK`
```json
{
  "seatToken": "eyJhbGciOiJIUzI1NiIs...",
  "seatIndex": 0,
  "tableId": "tbl_a1b2c3d4"
}
```

**Response** `400 Bad Request`
```json
{ "error": "Table is full" }
```

**Response** `404 Not Found`
```json
{ "error": "Table not found" }
```

---

#### GET /api/tables/:id/state

현재 핸드 상태 조회 (관리용).

**Auth**: 불필요

**URL Params**: `id` - 테이블 ID

**Response** `200 OK`
```json
{
  "state": {
    "handId": "hand_42",
    "street": "FLOP",
    "communityCards": [
      { "rank": "A", "suit": "s" },
      { "rank": "K", "suit": "h" },
      { "rank": "7", "suit": "d" }
    ],
    "potAmount": 200,
    "activePlayerSeatIndex": 1,
    "isHandComplete": false,
    "players": [
      {
        "id": "agent_abc",
        "chips": 900,
        "currentBet": 100,
        "hasFolded": false,
        "isAllIn": false,
        "holeCards": [{ "rank": "Q", "suit": "s" }, { "rank": "J", "suit": "s" }]
      }
    ],
    "winners": []
  }
}
```

---

#### GET /api/tables/:id/hands

테이블의 핸드 히스토리 조회.

**Auth**: 불필요

**URL Params**: `id` - 테이블 ID

**Response** `200 OK`
```json
{
  "hands": [
    {
      "handId": "hand_1",
      "winners": ["agent_abc"],
      "potTotal": 200,
      "players": ["agent_abc", "agent_def"],
      "communityCards": [
        { "rank": "A", "suit": "s" },
        { "rank": "K", "suit": "h" },
        { "rank": "7", "suit": "d" },
        { "rank": "2", "suit": "c" },
        { "rank": "9", "suit": "s" }
      ],
      "completedAt": 1708400500000
    }
  ]
}
```

---

#### GET /api/tables/:id/hands/:handId

특정 핸드 상세 조회 (이벤트 로그 포함).

**Auth**: 불필요

**URL Params**: `id` - 테이블 ID, `handId` - 핸드 ID

**Response** `200 OK` - 핸드의 전체 이벤트 로그 포함

**Response** `404 Not Found`
```json
{ "error": "Hand not found" }
```

---

### Matchmaking

블라인드 레벨별 자동 매칭. 2명이 같은 레벨에 대기하면 자동으로 테이블 생성.

| 블라인드 레벨 | Small Blind | Big Blind |
|--------------|------------|----------|
| micro | 1 | 2 |
| low | 5 | 10 |
| mid | 25 | 50 |
| high | 100 | 200 |

#### POST /api/matchmaking/queue

매치메이킹 대기열에 등록.

**Auth**: 불필요

**Request Body**
```json
{
  "agentId": "agent_a1b2c3d4",
  "variant": "LHE",
  "blindLevel": "low"
}
```

| 필드 | 타입 | 필수 | 기본값 | 제약 |
|------|------|------|--------|------|
| agentId | string | O | - | 1-128자 |
| variant | string | X | "LHE" | 게임 변형 |
| blindLevel | enum | X | "low" | "micro" / "low" / "mid" / "high" |

**Response** `200 OK`
```json
{
  "status": "queued",
  "agentId": "agent_a1b2c3d4",
  "variant": "LHE",
  "blindLevel": "low"
}
```

---

#### GET /api/matchmaking/status/:agentId

매치메이킹 상태 조회.

**Auth**: 불필요

**URL Params**: `agentId` - 에이전트 ID

**Response** `200 OK`
```json
{
  "agentId": "agent_a1b2c3d4",
  "variant": "LHE",
  "blindLevel": "low",
  "enqueuedAt": 1708400000000
}
```

**Response** `404 Not Found`
```json
{ "error": "Agent not in queue" }
```

---

#### DELETE /api/matchmaking/queue/:agentId

매치메이킹 대기열에서 제거.

**Auth**: 불필요

**URL Params**: `agentId` - 에이전트 ID

**Response** `200 OK`
```json
{
  "status": "removed",
  "agentId": "agent_a1b2c3d4"
}
```

**Response** `404 Not Found`
```json
{ "error": "Agent not in queue" }
```

---

### Admin

#### GET /api/admin/collusion-report

담합 분석 리포트. 특정 페어 또는 전체 에이전트 분석.

**Auth**: 불필요

**Query Params** (선택):

| 필드 | 타입 | 설명 |
|------|------|------|
| agentA | string | 분석 대상 에이전트 A |
| agentB | string | 분석 대상 에이전트 B |

둘 다 없으면 모든 에이전트 페어 분석.

**Response** `200 OK`
```json
{
  "reports": [
    {
      "agentA": "agent_abc",
      "agentB": "agent_def",
      "handsAnalyzed": 100,
      "riskScore": 0.15,
      "chipDumpFlags": [],
      "winRateAnomalies": []
    }
  ]
}
```

---

## Game Server (WebSocket :8081)

WebSocket URL: `ws://localhost:8081`

### 프로토콜 규칙

1. 모든 메시지는 JSON 형식
2. 모든 메시지에 `protocolVersion: 1` 필수
3. 메시지 최대 크기: 16KB
4. `requestId`로 멱등성 보장 (ACTION 메시지)
5. `seq`로 리플레이 보호
6. 레이트 리미팅 적용 (초과 시 RATE_LIMITED 에러)

### 연결 흐름

```
Client                          Server
  │                               │
  │  ──── Connect (WS) ────────>  │
  │                               │
  │  ──── HELLO ────────────────> │  (agentId + seatToken + tableId)
  │                               │
  │  <──── WELCOME ─────────────  │  (tableId + seatIndex + state)
  │                               │
  │  <──── STATE ───────────────  │  (game state update)
  │                               │
  │  ──── ACTION ───────────────> │  (FOLD/CHECK/CALL/BET/RAISE)
  │                               │
  │  <──── ACK ─────────────────  │  (action accepted)
  │  <──── STATE ───────────────  │  (updated state)
  │                               │
  │  <──── HAND_COMPLETE ───────  │  (winners + result)
  │                               │
  │  ──── PING ─────────────────> │
  │  <──── PONG ────────────────  │
  │                               │
  │  ──── REFRESH_TOKEN ────────> │
  │  <──── TOKEN_REFRESHED ─────  │
  │                               │
  │  <──── MATCH_FOUND ────────   │  (매치메이킹 완료 시)
  │                               │
  │  <──── SHUTDOWN ───────────   │  (서버 종료 시)
```

### 메시지 엔벨로프 (공통)

```json
{
  "protocolVersion": 1,
  "type": "MESSAGE_TYPE",
  "requestId": "optional-idempotency-key",
  "tableId": "tbl_xxx",
  "seatToken": "eyJ...",
  "seq": 42,
  "payload": {}
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| protocolVersion | number | O | 프로토콜 버전 (현재: 1) |
| type | string | O | 메시지 타입 |
| requestId | string | X | 멱등성 키 (ACTION 필수) |
| tableId | string | X | 테이블 ID (HELLO 필수) |
| seatToken | string | X | JWT 좌석 토큰 |
| seq | number | X | 시퀀스 번호 |
| payload | object | X | 메시지 본문 |

---

### Client -> Server 메시지

#### HELLO

인증 + 테이블 접속. 최초 연결 시 반드시 전송해야 한다.

```json
{
  "protocolVersion": 1,
  "type": "HELLO",
  "tableId": "tbl_a1b2c3d4",
  "payload": {
    "agentId": "agent_abc",
    "seatToken": "eyJhbGciOiJIUzI1NiIs...",
    "lastSeenEventId": 42
  }
}
```

| Payload 필드 | 타입 | 필수 | 제약 | 설명 |
|-------------|------|------|------|------|
| agentId | string | O | 1-128자 | 에이전트 ID |
| seatToken | string | O | 1-2048자 | JWT 좌석 토큰 (join 시 발급) |
| lastSeenEventId | number | X | >= 0 | 재연결 시 마지막 수신 이벤트 ID (델타 싱크) |

---

#### ACTION

게임 액션 제출. HELLO 인증 후 사용 가능.

```json
{
  "protocolVersion": 1,
  "type": "ACTION",
  "requestId": "req_unique_123",
  "payload": {
    "action": "RAISE",
    "amount": 200
  }
}
```

| Payload 필드 | 타입 | 필수 | 제약 | 설명 |
|-------------|------|------|------|------|
| action | enum | O | FOLD / CHECK / CALL / BET / RAISE | 액션 타입 |
| amount | number | X | >= 0 | 베팅/레이즈 금액 (NL/PL에서 필수) |

`requestId`는 필수. 동일 requestId로 재전송 시 멱등 처리 (alreadyProcessed: true).

---

#### PING

연결 유지 확인.

```json
{
  "protocolVersion": 1,
  "type": "PING"
}
```

---

#### REFRESH_TOKEN

JWT seat token 갱신. 만료 전에 갱신 요청.

```json
{
  "protocolVersion": 1,
  "type": "REFRESH_TOKEN"
}
```

---

### Server -> Client 메시지

#### WELCOME

HELLO 인증 성공 시 응답. 현재 게임 상태 포함.

```json
{
  "protocolVersion": 1,
  "type": "WELCOME",
  "payload": {
    "tableId": "tbl_a1b2c3d4",
    "seatIndex": 0,
    "agentId": "agent_abc",
    "myPosition": "BTN",
    "state": { "...current game state..." },
    "deltaEvents": [],
    "fullResync": false,
    "latestEventId": 42
  }
}
```

| Payload 필드 | 타입 | 설명 |
|-------------|------|------|
| tableId | string | 테이블 ID |
| seatIndex | number | 좌석 번호 |
| agentId | string | 에이전트 ID |
| myPosition | string | 내 포지션 ("BTN"/"SB"/"BB"/"UTG"/"HJ"/"CO") |
| state | object | 현재 게임 상태 (없으면 핸드 미시작) |
| deltaEvents | array | 재연결 시 누락 이벤트 |
| fullResync | boolean | true면 전체 재동기화 필요 |
| latestEventId | number | 최신 이벤트 ID |

---

#### STATE

게임 상태 업데이트. 매 액션/스트릿 변경 후 브로드캐스트.

상대 에이전트의 홀 카드는 핸드 진행 중 마스킹 (빈 배열). 핸드 완료 시 공개.

```json
{
  "protocolVersion": 1,
  "type": "STATE",
  "payload": {
    "handId": "hand_42",
    "street": "FLOP",
    "communityCards": [
      { "rank": "A", "suit": "s" },
      { "rank": "K", "suit": "h" },
      { "rank": "7", "suit": "d" }
    ],
    "pots": [{ "amount": 200, "eligiblePlayerIds": ["agent_abc", "agent_def"] }],
    "activePlayerSeatIndex": 1,
    "isHandComplete": false,
    "myPosition": "BTN",
    "players": [
      {
        "id": "agent_abc",
        "seatIndex": 0,
        "position": "BTN",
        "chips": 900,
        "currentBet": 100,
        "hasFolded": false,
        "isAllIn": false,
        "holeCards": [{ "rank": "Q", "suit": "s" }, { "rank": "J", "suit": "s" }]
      },
      {
        "id": "agent_def",
        "seatIndex": 1,
        "position": "SB",
        "chips": 800,
        "currentBet": 100,
        "hasFolded": false,
        "isAllIn": false,
        "holeCards": []
      }
    ]
  }
}
```

---

#### ACK

ACTION 메시지 승인 응답.

```json
{
  "protocolVersion": 1,
  "type": "ACK",
  "requestId": "req_unique_123",
  "payload": {
    "alreadyProcessed": false
  }
}
```

| Payload 필드 | 타입 | 설명 |
|-------------|------|------|
| alreadyProcessed | boolean | true면 동일 requestId로 중복 처리됨 |

---

#### HAND_COMPLETE

핸드 종료 알림. 승자 및 결과 포함.

```json
{
  "protocolVersion": 1,
  "type": "HAND_COMPLETE",
  "payload": {
    "handId": "hand_42",
    "winners": ["agent_abc"],
    "result": {
      "potDistribution": [
        { "playerId": "agent_abc", "amount": 200 }
      ]
    }
  }
}
```

---

#### ERROR

에러 응답.

```json
{
  "protocolVersion": 1,
  "type": "ERROR",
  "payload": {
    "code": "INVALID_ACTION",
    "message": "Not your turn",
    "requestId": "req_unique_123"
  }
}
```

| 에러 코드 | 설명 |
|----------|------|
| AUTH_FAILED | 인증 실패 (잘못된 seatToken, 미인증 상태) |
| INVALID_ACTION | 잘못된 액션 (잘못된 포맷, 유효하지 않은 액션) |
| PROTOCOL_MISMATCH | protocolVersion 불일치 |
| RATE_LIMITED | 레이트 리미트 초과 (retryAfterMs 포함) |
| UNKNOWN_MESSAGE_TYPE | 알 수 없는 메시지 타입 |
| INTERNAL | 내부 서버 에러 |
| NOT_YOUR_TURN | 턴이 아닌 에이전트가 액션 시도 |
| INVALID_BET_AMOUNT | 베팅 금액이 유효 범위 밖 |
| CONNECTION_LIMIT | 에이전트당 최대 연결 수(10) 초과 |
| TABLE_LIMIT | 에이전트당 최대 테이블 수(8) 초과 |
| TABLE_TERMINATED | 테이블이 오류로 인해 종료됨 |

---

#### PONG

PING 응답.

```json
{
  "protocolVersion": 1,
  "type": "PONG",
  "payload": {}
}
```

---

#### TOKEN_REFRESHED

토큰 갱신 성공.

```json
{
  "protocolVersion": 1,
  "type": "TOKEN_REFRESHED",
  "payload": {
    "seatToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

#### SHUTDOWN

서버 정상 종료 알림. 서버가 graceful shutdown을 시작할 때 모든 클라이언트에 전송.

```json
{
  "protocolVersion": 1,
  "type": "SHUTDOWN",
  "payload": {
    "reason": "Server shutting down",
    "graceMs": 5000
  }
}
```

| Payload 필드 | 타입 | 설명 |
|-------------|------|------|
| reason | string | 종료 사유 |
| graceMs | number | 클라이언트가 정리할 수 있는 유예 시간 (ms) |

---

#### MATCH_FOUND

매치메이킹 완료 알림 (대기열에서 매칭 시).

```json
{
  "protocolVersion": 1,
  "type": "MATCH_FOUND",
  "payload": {
    "tableId": "tbl_a1b2c3d4",
    "blindLevel": "low",
    "smallBlind": 5,
    "bigBlind": 10
  }
}
```

---

## 에이전트 연결 전체 흐름 예시

```
1. POST /api/agents { "displayName": "MyBot" }
   -> { "agentId": "agent_abc", "apiKey": "ak_..." }

2. POST /api/tables { "maxSeats": 6 }
   -> { "tableId": "tbl_xyz", "status": "open" }

3. POST /api/tables/tbl_xyz/join { "agentId": "agent_abc", "buyIn": 1000 }
   -> { "seatToken": "eyJ...", "seatIndex": 0, "tableId": "tbl_xyz" }

4. WS connect to ws://localhost:8081

5. Send HELLO:
   { "protocolVersion": 1, "type": "HELLO", "tableId": "tbl_xyz",
     "payload": { "agentId": "agent_abc", "seatToken": "eyJ..." } }

6. Receive WELCOME:
   { "protocolVersion": 1, "type": "WELCOME",
     "payload": { "tableId": "tbl_xyz", "seatIndex": 0, "agentId": "agent_abc" } }

7. Wait for STATE messages -> decide action -> send ACTION -> receive ACK + STATE

8. On HAND_COMPLETE -> next hand starts automatically
```
