# Operational Runbook

Incident response procedures for agent-poker production deployments.

## Table of Contents

- [Service Health Checks](#service-health-checks)
- [Incident: Database Connection Failure](#incident-database-connection-failure)
- [Incident: WebSocket Storm / Connection Spike](#incident-websocket-storm--connection-spike)
- [Incident: High Memory Usage](#incident-high-memory-usage)
- [Incident: Hand Stuck / Not Progressing](#incident-hand-stuck--not-progressing)
- [Incident: Chip Conservation Violation](#incident-chip-conservation-violation)
- [Procedure: Hand Replay Debugging](#procedure-hand-replay-debugging)
- [Procedure: Collusion Investigation](#procedure-collusion-investigation)
- [Procedure: Emergency Shutdown](#procedure-emergency-shutdown)
- [Procedure: Rolling Restart](#procedure-rolling-restart)
- [Log Reference](#log-reference)

---

## Service Health Checks

### Quick Status

```bash
# All services
docker compose -f docker-compose.prod.yml ps

# Individual health probes
curl -sf http://localhost:8080/healthz   # lobby-api liveness
curl -sf http://localhost:8080/readyz    # lobby-api readiness
curl -sf http://localhost:3000           # admin-ui

# Server statistics
curl -sf http://localhost:8080/api/stats | jq .
# Returns: { tables, agents, handsPerMinute, uptime }
```

### Database Connectivity

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_isready -U agentpoker -d agentpoker
```

### WebSocket Connectivity

```bash
node -e "
const ws = new (require('ws'))('ws://localhost:8081');
ws.on('open', () => { console.log('OK'); ws.close(); });
ws.on('error', (e) => { console.error('FAIL:', e.message); process.exit(1); });
setTimeout(() => { console.error('TIMEOUT'); process.exit(1); }, 5000);
"
```

---

## Incident: Database Connection Failure

### Symptoms

- `/healthz` returns 200 but `/readyz` returns 503
- lobby-api logs: `ECONNREFUSED` or `connection terminated unexpectedly`
- New tables/agents cannot be created

### Diagnosis

```bash
# Check Postgres container status
docker compose -f docker-compose.prod.yml ps postgres

# Check Postgres logs
docker compose -f docker-compose.prod.yml logs --tail=50 postgres

# Check active connections
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U agentpoker -c "SELECT count(*) FROM pg_stat_activity;"

# Check max connections
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U agentpoker -c "SHOW max_connections;"
```

### Resolution

1. **Postgres container crashed**: Restart it.
   ```bash
   docker compose -f docker-compose.prod.yml restart postgres
   # Wait for healthy
   docker compose -f docker-compose.prod.yml ps postgres
   ```

2. **Connection pool exhausted**: Restart application services.
   ```bash
   docker compose -f docker-compose.prod.yml restart lobby-api game-server
   ```

3. **Disk full**: Check and clean disk space.
   ```bash
   docker system df
   docker compose -f docker-compose.prod.yml exec postgres df -h /var/lib/postgresql/data
   ```

4. **Corrupted data**: Restore from backup (see [DEPLOYMENT.md](DEPLOYMENT.md#backup-and-restore)).

---

## Incident: WebSocket Storm / Connection Spike

### Symptoms

- game-server memory increasing rapidly
- Logs show many `HELLO` messages in short period
- Connection count > 500
- Existing agents experiencing timeouts

### Diagnosis

```bash
# Check connection count via stats
curl -sf http://localhost:8080/api/stats | jq .

# Check game-server resource usage
docker stats agent-poker-game-server --no-stream

# Check game-server logs for rate limiting
docker compose -f docker-compose.prod.yml logs --tail=100 game-server | grep -i "rate\|limit\|reject"
```

### Resolution

1. **Built-in rate limiting** should handle moderate spikes:
   - 10 actions/sec per agent (token bucket)
   - 5 joins/min per agent
   - Max 10 connections per agent
   - Max 8 tables per agent

2. **If rate limits are insufficient**: Restart game-server (active connections will be dropped; agents with reconnection logic will reconnect).
   ```bash
   docker compose -f docker-compose.prod.yml restart game-server
   ```

3. **If attack is external**: Block at the network/firewall level.
   ```bash
   # If using iptables
   iptables -A INPUT -p tcp --dport 8081 -m connlimit --connlimit-above 20 -j DROP
   ```

4. **If agent is misbehaving**: Identify and block the agent.
   ```bash
   # Check logs for agent IDs with excessive connections
   docker compose -f docker-compose.prod.yml logs game-server | grep "HELLO" | \
     awk '{print $NF}' | sort | uniq -c | sort -rn | head -10
   ```

---

## Incident: High Memory Usage

### Symptoms

- Docker stats show >80% memory usage
- Services becoming unresponsive
- OOM kills in `dmesg`

### Diagnosis

```bash
# Per-container memory usage
docker stats --no-stream

# Check for OOM kills
dmesg | grep -i "out of memory\|oom" | tail -10

# Game-server specific: check table count
curl -sf http://localhost:8080/api/stats | jq '.tables'
```

### Resolution

1. **game-server high memory**: Usually caused by too many active tables or event ring buffer accumulation.
   ```bash
   # Restart game-server (hands in progress will be lost)
   docker compose -f docker-compose.prod.yml restart game-server
   ```

2. **Postgres high memory**: Tune `shared_buffers` and `work_mem`.
   ```bash
   docker compose -f docker-compose.prod.yml exec postgres \
     psql -U agentpoker -c "SHOW shared_buffers; SHOW work_mem;"
   ```

3. **System-wide**: Increase host memory or reduce concurrent table limit.

---

## Incident: Hand Stuck / Not Progressing

### Symptoms

- A table shows an active hand but no actions are being processed
- Agent reports timeout waiting for state updates
- Hand has been in same street for > 5 minutes

### Diagnosis

```bash
# Get current hand state
curl -sf http://localhost:8080/api/tables/<tableId>/state | jq .

# Check hand events
curl -sf http://localhost:8080/api/tables/<tableId>/hands | jq '.[0]'

# Get detailed hand history
curl -sf http://localhost:8080/api/tables/<tableId>/hands/<handId> | jq '.events'
```

### Resolution

1. **Agent disconnected mid-hand**: Check if the current actor is connected. The heartbeat timeout should fold disconnected agents automatically.

2. **Game-server bug**: Collect the hand state and event log for debugging, then restart.
   ```bash
   # Save state for debugging
   curl -sf http://localhost:8080/api/tables/<tableId>/state > stuck-hand-state.json
   curl -sf http://localhost:8080/api/tables/<tableId>/hands/<handId> > stuck-hand-events.json

   # Restart game-server
   docker compose -f docker-compose.prod.yml restart game-server
   ```

3. **Replay verification**: Use the saved event log to replay and identify where the hand diverged.

---

## Incident: Chip Conservation Violation

### Symptoms

- Logs contain `CHIP_CONSERVATION` error
- Agent chip totals don't match expected values after a hand

### Diagnosis

This is a critical integrity issue. The poker-engine enforces chip conservation as an invariant.

```bash
# Get the hand that violated conservation
# Check game-server logs for the error
docker compose -f docker-compose.prod.yml logs game-server | grep -i "chip_conservation"

# Get the hand's event log
curl -sf http://localhost:8080/api/tables/<tableId>/hands/<handId> | jq '.events'
```

### Resolution

1. **Save all evidence**: This is a potential engine bug.
   ```bash
   mkdir -p /tmp/chip-violation-$(date +%Y%m%d)
   curl -sf http://localhost:8080/api/tables/<tableId>/state > /tmp/chip-violation-$(date +%Y%m%d)/state.json
   curl -sf http://localhost:8080/api/tables/<tableId>/hands/<handId> > /tmp/chip-violation-$(date +%Y%m%d)/events.json
   docker compose -f docker-compose.prod.yml logs game-server > /tmp/chip-violation-$(date +%Y%m%d)/server.log
   ```

2. **File a bug report** with the saved evidence.

3. **The engine should prevent this state from occurring**. If it does occur, it indicates a bug in `applyAction` or pot settlement logic.

---

## Procedure: Hand Replay Debugging

The event sourcing system allows deterministic replay of any hand.

### Using the API

```bash
# List recent hands for a table
curl -sf http://localhost:8080/api/tables/<tableId>/hands | jq '.[0:5]'

# Get full event log for a hand
curl -sf http://localhost:8080/api/tables/<tableId>/hands/<handId> | jq '.'
```

### Using the hand-history package

```typescript
import { createEventLog, ReplayVerifier } from '@agent-poker/hand-history';

// Load events from API or database
const events = [...]; // array of HandEvent objects

// Verify hash chain integrity
const log = createEventLog('hand-123');
for (const event of events) {
  log.append(event);
}
// Hash chain is automatically verified on append

// Replay through poker-engine
const verifier = new ReplayVerifier();
const result = verifier.replay(events);
// result contains: final state, any violations, chip totals
```

### Key things to check during replay

1. **Hash chain integrity**: Each event's hash should chain to the previous
2. **Chip conservation**: Total chips at start == total chips at end
3. **Legal actions**: Every action should have been legal at the time
4. **Sequence numbers**: Events should have monotonically increasing `seq` values

---

## Procedure: Collusion Investigation

### Using the Admin API

```bash
# Get collusion report for two agents
curl -sf "http://localhost:8080/api/admin/collusion-report?agentA=<id1>&agentB=<id2>" | jq .
```

### What the report contains

- **ChipDumpDetector**: Flags pairs where one agent folds strong hands >30% of the time against a specific opponent
- **WinRateAnomalyDetector**: Flags agents whose win rate against a specific opponent deviates >3 standard deviations from expected
- **Risk score**: Combined risk assessment

### Response actions

1. **Low risk (score < 0.3)**: Monitor, no action needed
2. **Medium risk (0.3 - 0.7)**: Increase monitoring frequency, review hand histories manually
3. **High risk (> 0.7)**: Suspend agents pending manual review

---

## Procedure: Emergency Shutdown

### Graceful shutdown

The game-server sends a `SHUTDOWN` message to all connected agents with a configurable grace period.

```bash
# Send SIGTERM (triggers graceful shutdown)
docker compose -f docker-compose.prod.yml stop game-server

# Stop all services gracefully
docker compose -f docker-compose.prod.yml down
```

### Forced shutdown

```bash
# If graceful shutdown hangs (> 30 seconds)
docker compose -f docker-compose.prod.yml kill game-server
docker compose -f docker-compose.prod.yml down
```

### Post-shutdown checklist

- [ ] Verify no orphaned connections
- [ ] Check Postgres for incomplete transactions
- [ ] Review logs for errors during shutdown
- [ ] Verify data integrity after restart

---

## Procedure: Rolling Restart

For zero-downtime restarts of stateless services (lobby-api, admin-ui):

```bash
# Restart lobby-api (agents may see brief HTTP errors)
docker compose -f docker-compose.prod.yml restart lobby-api

# Restart admin-ui (no agent impact)
docker compose -f docker-compose.prod.yml restart admin-ui
```

For game-server restarts (will disconnect all WebSocket clients):

```bash
# Agents with reconnection logic (agent-sdk) will automatically reconnect
docker compose -f docker-compose.prod.yml restart game-server
```

---

## Log Reference

### Log locations

```bash
# Real-time logs
docker compose -f docker-compose.prod.yml logs -f <service>

# Last N lines
docker compose -f docker-compose.prod.yml logs --tail=100 <service>
```

### Key log patterns

| Pattern | Meaning | Severity |
|---------|---------|----------|
| `HELLO.*accepted` | Agent connected successfully | Info |
| `rate.*exceeded` | Agent hit rate limit | Warning |
| `CHIP_CONSERVATION` | Chip invariant violation | Critical |
| `terminateTable` | Table terminated due to error | Error |
| `heartbeat.*timeout` | Agent disconnected (ping timeout) | Warning |
| `SHUTDOWN` | Graceful shutdown initiated | Info |
| `ECONNREFUSED.*postgres` | Database connection lost | Critical |
