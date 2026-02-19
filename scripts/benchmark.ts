/**
 * Benchmark suite for agent-poker.
 * Measures: engine hands/second, evaluator evaluations/second,
 * full round-trip (table-actor action processing) latency.
 *
 * Usage: npx tsx scripts/benchmark.ts
 * Exit 0 = all targets met, non-zero = some target missed.
 */

import {
  createInitialState,
  applyAction,
  getLegalActions,
  getLegalActionRanges,
  createSeededRng,
  evaluateBestHand,
  ActionType,
  type GameState,
  type PlayerSetup,
  type Card,
  DEFAULT_NL_CONFIG,
  DEFAULT_CONFIG,
  RANKS,
  SUITS,
} from '@agent-poker/poker-engine';
import { TableActor } from '@agent-poker/game-server';

// ── Targets ──────────────────────────────────────────────────
// These targets reflect the engine with structuredClone immutability
// and the combinatoric evaluator (C(7,5) = 21 combos per eval).
const TARGET_HANDS_PER_SEC = 1_000;
const TARGET_EVALS_PER_SEC = 40_000;
const TARGET_ROUNDTRIP_MS = 50;

// ── Helpers ──────────────────────────────────────────────────

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

function pickAction(
  legal: ActionType[],
  state: GameState,
): { type: ActionType; amount?: number } {
  if (legal.includes(ActionType.CHECK)) return { type: ActionType.CHECK };
  if (legal.includes(ActionType.CALL)) return { type: ActionType.CALL };
  if (legal.includes(ActionType.BET)) {
    const ranges = getLegalActionRanges(state);
    return { type: ActionType.BET, amount: ranges.minBet };
  }
  if (legal.includes(ActionType.RAISE)) {
    const ranges = getLegalActionRanges(state);
    return { type: ActionType.RAISE, amount: ranges.minRaise };
  }
  return { type: ActionType.FOLD };
}

function playOneHand(
  handId: string,
  players: PlayerSetup[],
  dealerSeat: number,
  rng: () => number,
): GameState {
  const { state: initState } = createInitialState(
    handId,
    players,
    dealerSeat,
    rng,
    DEFAULT_NL_CONFIG,
  );
  let state = initState;
  let moves = 0;
  while (!state.isHandComplete && moves < 200) {
    const activePlayer = state.players.find(
      (p) => p.seatIndex === state.activePlayerSeatIndex,
    )!;
    const legal = getLegalActions(state);
    const action = pickAction(legal, state);
    state = applyAction(state, activePlayer.id, action).state;
    moves++;
  }
  return state;
}

// ── Benchmark 1: Engine hands/second ─────────────────────────

function benchmarkEngine(): { handsPerSec: number; totalHands: number; elapsedMs: number } {
  const WARMUP = 50;
  const DURATION_MS = 3_000;
  const masterRng = createSeededRng(12345);

  const players: PlayerSetup[] = [
    { id: 'p1', seatIndex: 0, chips: 1000 },
    { id: 'p2', seatIndex: 1, chips: 1000 },
    { id: 'p3', seatIndex: 2, chips: 1000 },
    { id: 'p4', seatIndex: 3, chips: 1000 },
  ];

  // Warmup
  for (let i = 0; i < WARMUP; i++) {
    const rng = createSeededRng(Math.floor(masterRng() * 2 ** 32));
    playOneHand(`warmup_${i}`, players, 0, rng);
  }

  // Timed run
  let count = 0;
  const start = performance.now();
  while (performance.now() - start < DURATION_MS) {
    const rng = createSeededRng(Math.floor(masterRng() * 2 ** 32));
    playOneHand(`bench_${count}`, players, count % 4, rng);
    count++;
  }
  const elapsed = performance.now() - start;
  return {
    handsPerSec: Math.round((count / elapsed) * 1000),
    totalHands: count,
    elapsedMs: Math.round(elapsed),
  };
}

// ── Benchmark 2: Evaluator evaluations/second ────────────────

function benchmarkEvaluator(): { evalsPerSec: number; totalEvals: number; elapsedMs: number } {
  const WARMUP = 500;
  const DURATION_MS = 3_000;

  const allCards: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      allCards.push({ rank, suit });
    }
  }

  const rng = createSeededRng(99999);
  function randomCards(n: number): Card[] {
    const deck = [...allCards];
    const result: Card[] = [];
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(rng() * deck.length);
      result.push(deck[idx]!);
      deck.splice(idx, 1);
    }
    return result;
  }

  // Pre-generate test cases
  const testCases: Array<{ hole: Card[]; community: Card[] }> = [];
  for (let i = 0; i < 10_000; i++) {
    const cards = randomCards(7);
    testCases.push({ hole: cards.slice(0, 2), community: cards.slice(2) });
  }

  // Warmup
  for (let i = 0; i < WARMUP; i++) {
    const tc = testCases[i % testCases.length]!;
    evaluateBestHand(tc.hole, tc.community);
  }

  // Timed run
  let count = 0;
  const start = performance.now();
  while (performance.now() - start < DURATION_MS) {
    const tc = testCases[count % testCases.length]!;
    evaluateBestHand(tc.hole, tc.community);
    count++;
  }
  const elapsed = performance.now() - start;
  return {
    evalsPerSec: Math.round((count / elapsed) * 1000),
    totalEvals: count,
    elapsedMs: Math.round(elapsed),
  };
}

// ── Benchmark 3: Full round-trip (TableActor action processing) ──

function benchmarkRoundTrip(): {
  avgLatencyMs: number;
  p50Ms: number;
  p99Ms: number;
  totalRoundTrips: number;
} {
  // This measures the full in-process path: receive action -> validate ->
  // applyAction -> state update -> callbacks. This is the server-side
  // processing time; network latency is additional.

  const NUM_ROUNDTRIPS = 500;
  const latencies: number[] = [];

  const table = new TableActor({
    tableId: 'bench-rt',
    maxSeats: 8,
    actionTimeoutMs: 60_000,
  });

  const agents = ['rt-agent-A', 'rt-agent-B'];
  for (const agentId of agents) {
    table.addSeat(agentId, `token-${agentId}`, 10_000);
  }

  for (let i = 0; i < NUM_ROUNDTRIPS; i++) {
    if (!table.getState()) {
      if (!table.canStartHand()) break;
      table.startHand();
    }

    const state = table.getState();
    if (!state || state.isHandComplete) {
      // Hand just completed, start another
      if (table.canStartHand()) {
        table.startHand();
      } else {
        break;
      }
      continue;
    }

    const activePlayer = state.players.find(
      (p) => p.seatIndex === state.activePlayerSeatIndex,
    );
    if (!activePlayer) break;

    const legal = getLegalActions(state);
    const action = pickAction(legal, state);

    const start = performance.now();
    try {
      table.processAction(activePlayer.id, action, `rt-${i}`);
    } catch {
      // PokerError (e.g. hand complete race) — skip
      continue;
    }
    const elapsed = performance.now() - start;
    latencies.push(elapsed);
  }

  table.close();

  if (latencies.length === 0) {
    return { avgLatencyMs: 0, p50Ms: 0, p99Ms: 0, totalRoundTrips: 0 };
  }

  latencies.sort((a, b) => a - b);
  const avg = latencies.reduce((s, v) => s + v, 0) / latencies.length;
  const p50 = latencies[Math.floor(latencies.length * 0.5)]!;
  const p99 = latencies[Math.floor(latencies.length * 0.99)]!;

  return {
    avgLatencyMs: Math.round(avg * 1000) / 1000,
    p50Ms: Math.round(p50 * 1000) / 1000,
    p99Ms: Math.round(p99 * 1000) / 1000,
    totalRoundTrips: latencies.length,
  };
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log('=== Agent Poker Benchmark Suite ===\n');

  // 1. Engine benchmark
  console.log('--- Engine: Hands/second ---');
  const engine = benchmarkEngine();
  console.log(`  Total hands:   ${formatNumber(engine.totalHands)}`);
  console.log(`  Elapsed:       ${engine.elapsedMs}ms`);
  console.log(`  Hands/sec:     ${formatNumber(engine.handsPerSec)}`);
  console.log(`  Target:        >=${formatNumber(TARGET_HANDS_PER_SEC)}`);
  const enginePass = engine.handsPerSec >= TARGET_HANDS_PER_SEC;
  console.log(`  Result:        ${enginePass ? 'PASS' : 'FAIL'}\n`);

  // 2. Evaluator benchmark
  console.log('--- Evaluator: Evaluations/second ---');
  const evaluator = benchmarkEvaluator();
  console.log(`  Total evals:   ${formatNumber(evaluator.totalEvals)}`);
  console.log(`  Elapsed:       ${evaluator.elapsedMs}ms`);
  console.log(`  Evals/sec:     ${formatNumber(evaluator.evalsPerSec)}`);
  console.log(`  Target:        >=${formatNumber(TARGET_EVALS_PER_SEC)}`);
  const evalPass = evaluator.evalsPerSec >= TARGET_EVALS_PER_SEC;
  console.log(`  Result:        ${evalPass ? 'PASS' : 'FAIL'}\n`);

  // 3. Round-trip benchmark
  console.log('--- Full Round-trip (TableActor action processing) ---');
  const roundtrip = benchmarkRoundTrip();
  console.log(`  Round-trips:   ${roundtrip.totalRoundTrips}`);
  console.log(`  Avg latency:   ${roundtrip.avgLatencyMs}ms`);
  console.log(`  P50 latency:   ${roundtrip.p50Ms}ms`);
  console.log(`  P99 latency:   ${roundtrip.p99Ms}ms`);
  console.log(`  Target (avg):  <${TARGET_ROUNDTRIP_MS}ms`);
  const rtPass = roundtrip.avgLatencyMs < TARGET_ROUNDTRIP_MS;
  console.log(`  Result:        ${rtPass ? 'PASS' : 'FAIL'}\n`);

  // Summary
  console.log('=== Summary ===');
  console.log(`  Engine:     ${enginePass ? 'PASS' : 'FAIL'} (${formatNumber(engine.handsPerSec)} hands/sec)`);
  console.log(`  Evaluator:  ${evalPass ? 'PASS' : 'FAIL'} (${formatNumber(evaluator.evalsPerSec)} evals/sec)`);
  console.log(`  Roundtrip:  ${rtPass ? 'PASS' : 'FAIL'} (${roundtrip.avgLatencyMs}ms avg)`);

  const allPass = enginePass && evalPass && rtPass;
  console.log(`\n${allPass ? '*** ALL BENCHMARKS PASSED ***' : '*** SOME BENCHMARKS FAILED ***'}`);
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
