/**
 * Live Demo: 4 bot agents play poker hands.
 * Watch in real-time at http://localhost:3000
 *
 * Usage: npx tsx scripts/demo-live.ts [numHands]
 */

import { GameServerWs } from '@agent-poker/game-server';
import { startLobbyApi } from '@agent-poker/lobby-api';
import { AgentClient, CallingStation, AggressiveBot, RandomBot } from '@agent-poker/agent-sdk';

const NUM_HANDS = parseInt(process.argv[2] ?? '10', 10);
const BUY_IN = 200;
const WS_PORT = 8081;
const HTTP_PORT = 8080;

async function main() {
  console.log('=== Agent Poker — Live Demo (4-player) ===');
  console.log(`Hands: ${NUM_HANDS} | Buy-in: ${BUY_IN} each`);
  console.log('Watch at http://localhost:3000\n');

  // 1. Start game server (WS) + lobby API (HTTP)
  const gameServer = new GameServerWs();
  await gameServer.start(WS_PORT);
  console.log(`[ws]   ws://localhost:${WS_PORT}`);
  await startLobbyApi(HTTP_PORT, { gameServer });
  console.log(`[http] http://localhost:${HTTP_PORT}\n`);

  // 2. Create table via HTTP (maxSeats: 6)
  const tableRes = await fetch(`http://localhost:${HTTP_PORT}/api/tables`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ maxSeats: 6 }),
  });
  const { tableId } = (await tableRes.json()) as { tableId: string };
  console.log(`Table created: ${tableId}`);

  // 3. Join 4 agents
  async function joinAgent(agentId: string) {
    const r = await fetch(`http://localhost:${HTTP_PORT}/api/tables/${tableId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, buyIn: BUY_IN }),
    });
    return r.json() as Promise<{ seatToken: string; seatIndex: number }>;
  }

  const s0 = await joinAgent('agent-alpha');
  const s1 = await joinAgent('agent-beta');
  const s2 = await joinAgent('agent-gamma');
  const s3 = await joinAgent('agent-delta');
  console.log(`agent-alpha (CallingStation) -> seat ${s0.seatIndex}`);
  console.log(`agent-beta  (Aggressive)     -> seat ${s1.seatIndex}`);
  console.log(`agent-gamma (RandomBot)      -> seat ${s2.seatIndex}`);
  console.log(`agent-delta (CallingStation)  -> seat ${s3.seatIndex}\n`);

  // 4. Connect bots via WebSocket
  const bot0 = new AgentClient(
    { serverUrl: `ws://localhost:${WS_PORT}`, tableId, agentId: 'agent-alpha', seatToken: s0.seatToken },
    new CallingStation(),
  );
  const bot1 = new AgentClient(
    { serverUrl: `ws://localhost:${WS_PORT}`, tableId, agentId: 'agent-beta', seatToken: s1.seatToken },
    new AggressiveBot(),
  );
  const bot2 = new AgentClient(
    { serverUrl: `ws://localhost:${WS_PORT}`, tableId, agentId: 'agent-gamma', seatToken: s2.seatToken },
    new RandomBot(),
  );
  const bot3 = new AgentClient(
    { serverUrl: `ws://localhost:${WS_PORT}`, tableId, agentId: 'agent-delta', seatToken: s3.seatToken },
    new CallingStation(),
  );

  const bots = [bot0, bot1, bot2, bot3];
  for (const b of bots) {
    b.onErrorHandler((err) => console.error(`  [error] ${err}`));
  }

  await Promise.all(bots.map((b) => b.connect()));
  console.log('All 4 bots connected via WebSocket');
  console.log('─'.repeat(50));

  // 5. Play hands
  const table = gameServer.getTable(tableId)!;
  let handsPlayed = 0;

  for (let h = 0; h < NUM_HANDS; h++) {
    if (!table.canStartHand()) {
      console.log('\nNot enough players — stopping.');
      break;
    }

    // Wait for hand completion
    const handDone = new Promise<void>((resolve) => {
      let resolved = false;
      const done = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };
      for (const b of bots) b.onComplete(() => done());
    });

    // Start hand and broadcast initial state
    const { state } = table.startHand();
    gameServer.broadcastState(tableId, state);

    await handDone;
    handsPlayed++;

    // Print result
    const info = table.getInfo();
    const chips = info.seats
      .filter((s) => s.agentId)
      .map((s) => `${s.agentId}=${s.chips}`)
      .join('  ');
    console.log(`  Hand ${handsPlayed}  |  ${chips}  |  hands_total=${info.handsPlayed}`);

    // Small pause so admin-ui polling can catch intermediate states
    await new Promise((r) => setTimeout(r, 800));
  }

  console.log('─'.repeat(50));
  console.log(`\nDone: ${handsPlayed} hands played.`);

  const finalInfo = table.getInfo();
  for (const s of finalInfo.seats) {
    if (s.agentId) console.log(`  ${s.agentId}: ${s.chips} chips`);
  }

  // Keep server alive for 5min so admin-ui can show final state
  const keepAlive = Number(process.env.KEEP_ALIVE_MS) || 300_000;
  console.log(`\nServers staying alive for ${keepAlive / 1000}s (check admin-ui)...`);
  await new Promise((r) => setTimeout(r, keepAlive));

  for (const b of bots) b.disconnect();
  gameServer.stop();
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
