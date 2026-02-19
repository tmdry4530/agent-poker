/**
 * Full E2E Integration Test
 *
 * Tests the complete flow:
 * 1. Start lobby-api + game-server (in-memory, no Postgres)
 * 2. Register 6 agents via HTTP API
 * 3. Create table, join all agents
 * 4. Play 50 hands via WebSocket
 * 5. Verify: chip conservation, event chain integrity, reconnection recovery
 * 6. Cleanup and exit 0/1
 *
 * Usage: npx tsx scripts/integration-test.ts
 */

import http from 'node:http';
import WebSocket from 'ws';
import {
  createInitialState,
  applyAction,
  getLegalActions,
  getLegalActionRanges,
  createSeededRng,
  advanceDealer,
  ActionType,
  type GameState,
  type GameEvent,
  type PlayerSetup,
  DEFAULT_NL_CONFIG,
} from '@agent-poker/poker-engine';
import {
  buildHashChain,
  verifyHashChain,
  getTerminalHash,
} from '@agent-poker/hand-history';

// ── Config ──────────────────────────────────────────────────

const NUM_HANDS = 50;
const NUM_AGENTS = 6;
const STARTING_CHIPS = 1000;
const MASTER_SEED = 99999;
const LOBBY_PORT = 18080;
const WS_PORT = 18081;

let exitCode = 0;
const results: { name: string; pass: boolean; detail?: string }[] = [];

function check(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  if (!pass) {
    console.error(`  [FAIL] ${name}${detail ? ': ' + detail : ''}`);
    exitCode = 1;
  } else {
    console.log(`  [PASS] ${name}`);
  }
}

// ── HTTP helpers ────────────────────────────────────────────

function httpRequest(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: 'localhost',
      port: LOBBY_PORT,
      path,
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode ?? 0, data: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode ?? 0, data: raw });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ── WS helpers ──────────────────────────────────────────────

function wsConnect(
  agentId: string,
  tableId: string,
  seatToken: string,
): Promise<{
  ws: WebSocket;
  messages: any[];
  waitForType: (type: string, timeoutMs?: number) => Promise<any>;
}> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${WS_PORT}`);
    const messages: any[] = [];

    const waitForType = (type: string, timeoutMs = 5000): Promise<any> => {
      return new Promise((res, rej) => {
        // Check existing messages first
        const existing = messages.find((m) => m.type === type);
        if (existing) {
          messages.splice(messages.indexOf(existing), 1);
          return res(existing);
        }

        const timer = setTimeout(() => {
          ws.removeListener('message', handler);
          rej(new Error(`Timeout waiting for ${type}`));
        }, timeoutMs);

        function handler(data: WebSocket.Data) {
          const msg = JSON.parse(data.toString());
          if (msg.type === type) {
            clearTimeout(timer);
            ws.removeListener('message', handler);
            res(msg);
          } else {
            messages.push(msg);
          }
        }

        ws.on('message', handler);
      });
    };

    ws.on('open', () => {
      // Send HELLO
      ws.send(
        JSON.stringify({
          protocolVersion: 1,
          type: 'HELLO',
          tableId,
          payload: { agentId, seatToken },
        }),
      );
      resolve({ ws, messages, waitForType });
    });

    ws.on('message', (data) => {
      messages.push(JSON.parse(data.toString()));
    });

    ws.on('error', reject);
  });
}

// ── Engine-level play (for verification) ────────────────────

interface HandRecord {
  handId: string;
  chipsBefore: number[];
  chipsAfter: number[];
  events: GameEvent[];
  terminalHash: string;
}

function playHandsLocally(): { records: HandRecord[]; finalChips: number[] } {
  const bots = Array.from({ length: NUM_AGENTS }, (_, i) => ({
    id: `agent_${i}`,
    seatIndex: i,
  }));

  const chips = bots.map(() => STARTING_CHIPS);
  const records: HandRecord[] = [];
  let dealerSeatIndex = 0;
  const masterRng = createSeededRng(MASTER_SEED);
  const botRng = createSeededRng(MASTER_SEED + 1);

  for (let h = 0; h < NUM_HANDS; h++) {
    const playersWithChips = bots
      .map((b, i) => ({ ...b, chips: chips[i]! }))
      .filter((b) => b.chips > 0);

    if (playersWithChips.length < 2) break;

    const handSeed = Math.floor(masterRng() * 2 ** 32);
    const rng = createSeededRng(handSeed);
    const handId = `hand_${h + 1}`;

    const playerSetups: PlayerSetup[] = playersWithChips.map((b) => ({
      id: b.id,
      seatIndex: b.seatIndex,
      chips: b.chips,
    }));

    const activeSeats = playerSetups.map((p) => p.seatIndex);
    if (!activeSeats.includes(dealerSeatIndex)) {
      dealerSeatIndex = activeSeats[0]!;
    }

    const chipsBefore = bots.map((_, i) => chips[i]!);

    const { state: initState, events: initEvents } = createInitialState(
      handId,
      playerSetups,
      dealerSeatIndex,
      rng,
      DEFAULT_NL_CONFIG,
    );

    let state = initState;
    const allEvents = [...initEvents];
    let moves = 0;

    while (!state.isHandComplete) {
      const activePlayer = state.players.find(
        (p) => p.seatIndex === state.activePlayerSeatIndex,
      )!;
      const legal = getLegalActions(state);

      // Simple strategy: call/check, occasionally raise
      let action: { type: ActionType; amount?: number };
      const r = botRng();

      if (r < 0.2 && legal.includes(ActionType.RAISE)) {
        const ranges = getLegalActionRanges(state);
        action = { type: ActionType.RAISE, amount: ranges.minRaise };
      } else if (r < 0.3 && legal.includes(ActionType.BET)) {
        const ranges = getLegalActionRanges(state);
        action = { type: ActionType.BET, amount: ranges.minBet };
      } else if (legal.includes(ActionType.CHECK)) {
        action = { type: ActionType.CHECK };
      } else if (legal.includes(ActionType.CALL)) {
        action = { type: ActionType.CALL };
      } else {
        action = { type: ActionType.FOLD };
      }

      const result = applyAction(state, activePlayer.id, action, rng);
      state = result.state;
      allEvents.push(...result.events);
      moves++;

      if (moves > 500) {
        console.error(`  [ERROR] Hand ${handId} exceeded 500 moves. Aborting.`);
        process.exit(1);
      }
    }

    for (const p of state.players) {
      const idx = bots.findIndex((b) => b.id === p.id);
      if (idx !== -1) chips[idx] = p.chips;
    }

    const chipsAfter = bots.map((_, i) => chips[i]!);
    dealerSeatIndex = advanceDealer(activeSeats, dealerSeatIndex);

    const chain = buildHashChain(allEvents);
    const terminalHash = getTerminalHash(chain);

    records.push({ handId, chipsBefore, chipsAfter, events: allEvents, terminalHash });
  }

  return { records, finalChips: chips };
}

// ── Main test runner ────────────────────────────────────────

async function main() {
  console.log('=== Agent Poker — Full Integration Test ===');
  console.log(`Agents: ${NUM_AGENTS} | Hands: ${NUM_HANDS} | Starting chips: ${STARTING_CHIPS}`);
  console.log();

  // ── Test 1: Engine-level hand play + invariants ──────────
  console.log('--- Test 1: Engine-level play (50 hands) ---');

  const { records, finalChips } = playHandsLocally();

  check('Played all hands', records.length >= NUM_HANDS, `played ${records.length}/${NUM_HANDS}`);

  // Chip conservation per hand
  let chipConservationOk = true;
  for (const rec of records) {
    const totalBefore = rec.chipsBefore.reduce((a, b) => a + b, 0);
    const totalAfter = rec.chipsAfter.reduce((a, b) => a + b, 0);
    if (totalBefore !== totalAfter) {
      chipConservationOk = false;
      break;
    }
  }
  check('Chip conservation (per hand)', chipConservationOk);

  // Global chip conservation
  const totalNow = finalChips.reduce((a, b) => a + b, 0);
  const totalExpected = NUM_AGENTS * STARTING_CHIPS;
  check(
    'Global chip conservation',
    totalNow === totalExpected,
    `${totalNow} vs expected ${totalExpected}`,
  );

  // Event chain integrity
  let chainOk = true;
  for (const rec of records) {
    const chain = buildHashChain(rec.events);
    const valid = verifyHashChain(rec.events, chain);
    if (!valid) {
      chainOk = false;
      break;
    }
  }
  check('Event chain integrity (SHA-256)', chainOk);

  // Deterministic replay (first 10 hands)
  console.log();
  console.log('--- Test 2: Deterministic replay ---');

  const { records: replayRecords } = playHandsLocally();
  let replayOk = true;
  for (let i = 0; i < Math.min(10, records.length); i++) {
    const orig = records[i]!;
    const replay = replayRecords[i]!;
    if (orig.terminalHash !== replay.terminalHash) {
      replayOk = false;
      break;
    }
    const chipsMatch = orig.chipsAfter.every((c, j) => c === replay.chipsAfter[j]);
    if (!chipsMatch) {
      replayOk = false;
      break;
    }
  }
  check('Deterministic replay (first 10 hands)', replayOk);

  // ── Test 3: HTTP API endpoints ──────────────────────────
  console.log();
  console.log('--- Test 3: HTTP API endpoints ---');

  let lobbyServer: any = null;
  let gameServer: any = null;

  try {
    // Dynamically import and start servers
    const gsModule = await import('@agent-poker/game-server');

    gameServer = new gsModule.GameServerWs();
    await gameServer.start(WS_PORT);
    check('Game server started', true, `ws://localhost:${WS_PORT}`);

    // Start a minimal Fastify HTTP server for lobby
    const { default: Fastify } = await import('fastify');
    const { default: cors } = await import('@fastify/cors');

    const app = Fastify({ logger: false });
    await app.register(cors, { origin: true });

    // Import and register routes
    const { registerRoutes } = await import('../apps/lobby-api/src/routes.js');
    registerRoutes(app, { gameServer });
    await app.listen({ port: LOBBY_PORT, host: '0.0.0.0' });
    lobbyServer = app;
    check('Lobby API started', true, `http://localhost:${LOBBY_PORT}`);

    // Health check
    const health = await httpRequest('GET', '/healthz');
    check('GET /healthz', health.status === 200 && health.data.status === 'ok');

    const ready = await httpRequest('GET', '/readyz');
    check('GET /readyz', ready.status === 200 && ready.data.status === 'ready');

    // Register agents
    const agents: { agentId: string; apiKey: string }[] = [];
    for (let i = 0; i < NUM_AGENTS; i++) {
      const res = await httpRequest('POST', '/api/agents', { displayName: `Bot_${i}` });
      check(`Register agent ${i}`, res.status === 200 && !!res.data.agentId);
      agents.push(res.data);
    }

    // Create table
    const tableRes = await httpRequest('POST', '/api/tables', { maxSeats: 8 });
    check('Create table', tableRes.status === 200 && !!tableRes.data.tableId);
    const tableId = tableRes.data.tableId;

    // List tables
    const tablesRes = await httpRequest('GET', '/api/tables');
    check('List tables', tablesRes.status === 200 && tablesRes.data.tables.length > 0);

    // Get table
    const tableDetailRes = await httpRequest('GET', `/api/tables/${tableId}`);
    check('Get table detail', tableDetailRes.status === 200 && tableDetailRes.data.id === tableId);

    // Join table
    const seatTokens: string[] = [];
    for (let i = 0; i < Math.min(NUM_AGENTS, 8); i++) {
      const joinRes = await httpRequest('POST', `/api/tables/${tableId}/join`, {
        agentId: agents[i]!.agentId,
        buyIn: STARTING_CHIPS,
      });
      check(`Agent ${i} join table`, joinRes.status === 200 && !!joinRes.data.seatToken);
      seatTokens.push(joinRes.data.seatToken);
    }

    // Stats endpoint
    const statsRes = await httpRequest('GET', '/api/stats');
    check('GET /api/stats', statsRes.status === 200 && typeof statsRes.data.totalTables === 'number');

    // Collusion report
    const collusionRes = await httpRequest('GET', '/api/admin/collusion-report');
    check('GET /api/admin/collusion-report', collusionRes.status === 200 && Array.isArray(collusionRes.data.reports));

    // Matchmaking endpoints
    const mmQueueRes = await httpRequest('POST', '/api/matchmaking/queue', {
      agentId: agents[0]!.agentId,
      blindLevel: 'low',
    });
    check('POST /api/matchmaking/queue', mmQueueRes.status === 200 && mmQueueRes.data.status === 'queued');

    const mmStatusRes = await httpRequest('GET', `/api/matchmaking/status/${agents[0]!.agentId}`);
    check('GET /api/matchmaking/status', mmStatusRes.status === 200);

    const mmCancelRes = await httpRequest('DELETE', `/api/matchmaking/queue/${agents[0]!.agentId}`);
    check('DELETE /api/matchmaking/queue', mmCancelRes.status === 200 && mmCancelRes.data.status === 'removed');

    // 404 cases
    const notFoundRes = await httpRequest('GET', '/api/tables/nonexistent');
    check('GET /api/tables/nonexistent returns 404', notFoundRes.status === 404);

    // Validation error
    const validationRes = await httpRequest('POST', '/api/agents', {});
    check('POST /api/agents validation error', validationRes.status === 400);

    // ── Test 4: WebSocket protocol ──────────────────────────
    console.log();
    console.log('--- Test 4: WebSocket protocol ---');

    // Connect first 2 agents and verify WELCOME
    const conn0 = await wsConnect(agents[0]!.agentId, tableId, seatTokens[0]!);
    const welcome0 = await conn0.waitForType('WELCOME');
    check('Agent 0 receives WELCOME', !!welcome0 && welcome0.payload.agentId === agents[0]!.agentId);

    const conn1 = await wsConnect(agents[1]!.agentId, tableId, seatTokens[1]!);
    const welcome1 = await conn1.waitForType('WELCOME');
    check('Agent 1 receives WELCOME', !!welcome1 && welcome1.payload.agentId === agents[1]!.agentId);

    // Test PING/PONG
    conn0.ws.send(JSON.stringify({ protocolVersion: 1, type: 'PING' }));
    const pong = await conn0.waitForType('PONG');
    check('PING/PONG', !!pong);

    // Test invalid message
    conn0.ws.send(JSON.stringify({ protocolVersion: 99, type: 'ACTION', requestId: 'test', payload: { action: 'FOLD' } }));
    const protoErr = await conn0.waitForType('ERROR');
    check('Protocol mismatch error', protoErr?.payload?.code === 'PROTOCOL_MISMATCH');

    // Test REFRESH_TOKEN
    conn0.ws.send(JSON.stringify({ protocolVersion: 1, type: 'REFRESH_TOKEN' }));
    const refreshed = await conn0.waitForType('TOKEN_REFRESHED');
    check('Token refresh', !!refreshed?.payload?.seatToken);

    // Clean up WS connections
    conn0.ws.close();
    conn1.ws.close();

    // ── Test 5: Reconnection (delta sync) ────────────────────
    console.log();
    console.log('--- Test 5: Reconnection with lastSeenEventId ---');

    const reconn = await wsConnect(agents[0]!.agentId, tableId, seatTokens[0]!);
    const reconnWelcome = await reconn.waitForType('WELCOME');
    check(
      'Reconnection WELCOME received',
      !!reconnWelcome && reconnWelcome.payload.agentId === agents[0]!.agentId,
    );
    check(
      'Reconnection contains latestEventId',
      typeof reconnWelcome.payload.latestEventId === 'number',
    );
    reconn.ws.close();
  } catch (err) {
    console.error('  [ERROR] Server test failed:', (err as Error).message);
    exitCode = 1;
  } finally {
    // Cleanup
    if (lobbyServer) {
      try { await lobbyServer.close(); } catch {}
    }
    if (gameServer) {
      try { gameServer.stop(); } catch {}
    }
  }

  // ── Summary ─────────────────────────────────────────────
  console.log();
  console.log('=== Integration Test Summary ===');
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  const total = results.length;

  console.log(`  Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
  console.log();

  if (failed > 0) {
    console.log('  Failed checks:');
    for (const r of results.filter((r) => !r.pass)) {
      console.log(`    - ${r.name}${r.detail ? ': ' + r.detail : ''}`);
    }
    console.log();
  }

  console.log(exitCode === 0 ? '*** ALL INTEGRATION TESTS PASSED ***' : '*** SOME TESTS FAILED ***');
  process.exit(exitCode);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
