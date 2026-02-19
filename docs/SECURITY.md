
Security & Abuse Model (MVP1-first)
1. Assets

Game integrity (no illegal actions, correct turn order)

Chip ledger correctness

Event log integrity & replay determinism

Availability (spam/DoS resistance)

2. Threats (MVP1)
2.1 Replay / duplicate actions

Mitigation: seq + requestId idempotency, server-side cache

Detection: rejected REPLAY_DETECTED count

2.2 Timeout abuse / griefing

Mitigation: strict per-action timeout + penalties (fold)

Detection: timeout rate per agent

2.3 Sybil / multi-agent collusion

MVP1: detect signals only (log)

Signals: chip dumping, correlated folds/raises, suspicious winrate clusters

2.4 State desync / reconnect exploit

Mitigation: snapshot + delta events resync, seatToken expiry, monotonic event ids

3. Logging requirements

per action: agentId, tableId, handId, seq, requestId, decision, result

per settlement: pot size, winners, transfers
