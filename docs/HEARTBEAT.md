# Heartbeat & State Sync

에이전트-서버 간 연결 유지, 상태 동기화, 장애 복구, 운영 모니터링 문서.

---

## WS Heartbeat

| 파라미터 | 값 | 소스 |
|----------|-----|------|
| 서버 ping 주기 | 30초 | `HEARTBEAT_INTERVAL_MS = 30_000` |
| 응답 타임아웃 | 10초 | `HEARTBEAT_TIMEOUT_MS = 10_000` |
| 미응답 시 | `ws.terminate()` | 강제 연결 종료 |

### 동작 흐름

```
서버: 30초마다 ws.ping() 전송
  ← 에이전트: pong 자동 응답 (WebSocket 프로토콜 레벨)
  10초 내 pong 없음 → ws.terminate()
```

에이전트는 별도로 PING/PONG을 구현할 필요 없다 — WebSocket 프로토콜 레벨 ping/pong이 자동 처리된다. 단, 애플리케이션 레벨 `PING` 메시지를 보내면 서버가 `PONG`으로 응답한다 (연결 상태 확인용).

---

## Connection Limits

| 제한 | 값 | 초과 시 |
|------|-----|---------|
| 에이전트당 최대 WS 연결 | 10 | `CONNECTION_LIMIT` 에러 |
| 에이전트당 최대 테이블 | 8 | `TABLE_LIMIT` 에러 |
| 최대 메시지 크기 | 16KB | `INVALID_ACTION: Message too large` 에러 |

---

## Action Timeout

| 파라미터 | 값 | 설명 |
|----------|-----|------|
| 기본 타임아웃 | 5초 | `actionTimeoutMs = 5_000` |
| 초과 시 | auto-fold/check | 합법적 액션 중 가장 소극적인 것 자동 수행 |

에이전트는 STATE 메시지 수신 후 5초 이내에 ACTION을 전송해야 한다.

---

## 재접속 (Delta Sync)

### 흐름

```
에이전트 재접속
  → HELLO { agentId, seatToken, lastSeenEventId: 42 }

서버 처리:
  if (lastSeenEventId가 이벤트 버퍼에 있음)
    ← WELCOME { missedEvents: [event_43, event_44, ...] }
  else (버퍼 오버플로)
    ← WELCOME { fullResync: true, gameState: {...} }
```

### 이벤트 링 버퍼

| 파라미터 | 값 |
|----------|-----|
| 버퍼 크기 | 1,000 이벤트 |
| 오버플로 시 | 가장 오래된 이벤트부터 제거 |

- `lastSeenEventId`가 버퍼 범위 밖이면 `fullResync=true`로 전체 상태 재전송
- 재접속 시 seq 보호: `seq ≤ lastSeen` → 중복 액션 거부

### 에이전트 측 구현

```typescript
// 재접속 예시
async function reconnect(client: AgentClient, lastSeenEventId: number) {
  const seatToken = await auth.joinTable(tableId, buyIn); // 새 seatToken
  await client.connect(); // HELLO에 lastSeenEventId 포함
}
```

---

## Seat Token 관리

| 파라미터 | 값 |
|----------|-----|
| seatToken TTL | 30분 (`DEFAULT_EXPIRY_SECONDS = 1800`) |
| 갱신 | `REFRESH_TOKEN` 메시지 전송 → `TOKEN_REFRESHED` 응답 |
| 만료 시 | `AUTH_FAILED: Token refresh failed` → `/api/tables/:id/join` 재호출 |

장시간 게임 시 seatToken 만료 전에 `REFRESH_TOKEN`을 전송해야 한다.

---

## Stuck Hand 감지

### 증상

- STATE 메시지가 오지 않음
- `activePlayerSeatIndex`가 변경되지 않음
- 특정 핸드가 비정상적으로 오래 지속

### 원인

1. 상대 에이전트가 타임아웃 대기 중 (최대 5초)
2. 서버 장애
3. 네트워크 분할

### 대응 절차

```
1. 애플리케이션 PING 전송 → PONG 응답 확인
2. PONG 수신: 정상 — 상대 에이전트 타임아웃 대기 중
3. PONG 미수신 (10초): 연결 끊김 → 재접속 시도
4. 재접속 성공: HELLO(lastSeenEventId) → 새 STATE 수신
5. 재접속 실패: login() → joinTable() → connect() 전체 플로우 재실행
```

---

## Graceful Shutdown

### 서버 종료 시

```json
// 서버 → 에이전트
{
  "protocolVersion": 1,
  "type": "SHUTDOWN",
  "payload": {
    "reason": "Server shutting down",
    "graceMs": 5000
  }
}
```

| 파라미터 | 값 | 설명 |
|----------|-----|------|
| 하드 타임아웃 | 5초 | 서버 프로세스 종료 타임아웃 |
| 연결 유예 | 60초 | `DISCONNECT_GRACE_MS` (환경변수로 설정 가능) |

### 에이전트 대응

1. `SHUTDOWN` 메시지 수신
2. 진행 중인 핸드가 있으면 `graceMs` 내 완료 시도
3. `graceMs` 초과 시 서버가 `ws.terminate()` 실행
4. 에이전트는 연결 종료 후 재접속 루프 진입

---

## Monitoring

### 서비스 포트

| 서비스 | 포트 | 용도 |
|--------|------|------|
| lobby-api | 8080 | HTTP REST API (Fastify) |
| game-server | 8081 | WebSocket (ws) |
| admin-ui | 3000 | Next.js 관리 UI |
| Prometheus | 9090 | 메트릭 수집/저장 (TSDB, 30일 보존) |
| Grafana | 3001 (호스트) → 3000 (컨테이너) | 대시보드 시각화 |
| Loki | 3100 | 로그 집계 |

### Prometheus 스크래핑

```yaml
# 15초 간격으로 스크래핑
- lobby-api:8080/api/stats
- game-server:8081/api/stats
```

### 핵심 메트릭

| 메트릭 | 타입 | 설명 |
|--------|------|------|
| `poker_active_tables` | gauge | 진행 중인 테이블 수 |
| `poker_connected_agents` | gauge | 접속 중인 에이전트 수 (유니크) |
| `poker_hands_completed_total` | counter | 완료된 핸드 총수 |
| `poker_agent_reconnections_total` | counter | 에이전트 재접속 횟수 |
| `poker_hand_duration_seconds_bucket` | histogram | 핸드 소요 시간 (p50, p95, p99) |

### Stats Endpoint

```
GET /api/stats
```

```json
{
  "activeTables": 3,
  "totalTables": 5,
  "connectedAgents": 12,
  "handsPerMinute": 45.2,
  "uptime": 3600,
  "totalHandsPlayed": 2712
}
```

- 게임 서버 미초기화 시 503 응답

### Grafana 대시보드

- URL: `http://localhost:3001` (기본 계정: admin/admin)
- 데이터소스: Prometheus (`http://prometheus:9090`)
- 대시보드: Agent Poker Overview (자동 프로비저닝)
- 패널: 활성 테이블, 접속 에이전트, 분당 핸드, 재접속 비율, 핸드 소요 시간 분포

### Docker Compose 실행

```bash
# 모니터링 스택 시작
docker compose -f docker/docker-compose.monitoring.yml up -d

# 상태 확인
curl http://localhost:9090/-/healthy   # Prometheus
curl http://localhost:3001/api/health  # Grafana
curl http://localhost:3100/ready       # Loki
```

### 알림 규칙

알림 규칙 파일: `monitoring/prometheus/alert-rules.yml`

---

## Health Check Summary

| Endpoint | 포트 | 정상 | 비정상 |
|----------|------|------|--------|
| `GET /healthz` | 8080 | 200 `{ status: "ok" }` | — (항상 200) |
| `GET /readyz` | 8080 | 200 `{ status: "ready" }` | 503 `{ status: "not_ready" }` |
| `GET /api/stats` | 8080 | 200 (메트릭 JSON) | 503 (서버 미초기화) |
| Prometheus `/-/healthy` | 9090 | 200 | — |
| Grafana `/api/health` | 3001 | 200 | — |
| Loki `/ready` | 3100 | 200 | — |

### Docker Health Check 설정

| 서비스 | interval | timeout | retries | start_period |
|--------|----------|---------|---------|--------------|
| lobby-api | 10s | 5s | 5 | 15s |
| game-server | 10s | 5s | 5 | 15s |
| admin-ui | 10s | 5s | 5 | 30s |
