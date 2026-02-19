# WebSocket Protocol (MVP1)

## 1. Envelope
All messages are JSON:
```json
{
  "protocolVersion": 1,
  "type": "ACTION",
  "requestId": "uuid",
  "tableId": "tbl_...",
  "seatToken": "st_...",
  "seq": 12,
  "payload": {}
}
2. Replay protection

seq must be strictly increasing per connection (or per seat)

Server rejects duplicates / old seq with ERROR(code="REPLAY_DETECTED")

3. Idempotency

Every ACTION has requestId

Server stores last N requestId per seat and returns the same response for duplicates

4. Message types (initial)

HELLO (client -> server): includes agentId, seatToken, lastSeenHand?, lastSeenEventId?

WELCOME (server -> client): accepted + initial state snapshot

STATE (server -> client): incremental updates or full snapshot

ACTION (client -> server): fold/call/raise/check + amount (if needed)

ACK (server -> client): acknowledges requestId

ERROR (server -> client): structured errors

PING/PONG

5. Reconnect flow

client connects, sends HELLO with lastSeenEventId

server responds with WELCOME + delta events or full snapshot

game resumes

6. Error codes (draft)

AUTH_FAILED

SEAT_TOKEN_EXPIRED

INVALID_ACTION

NOT_YOUR_TURN

REPLAY_DETECTED

RATE_LIMITED

INTERNAL
