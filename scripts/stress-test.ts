/**
 * Stress test for agent-poker.
 * Spins up 50 bot agents across 10 tables, plays 500 hands simultaneously.
 * Verifies: no crashes, no chip conservation violations, no deadlocks.
 * Reports: total hands, elapsed time, errors, avg latency per hand.
 *
 * Usage: npx tsx scripts/stress-test.ts
 * Exit 0 = success, non-zero = failure.
 */

import {
  createInitialState,
  applyAction,
  getLegalActions,
  getLegalActionRanges,
  createSeededRng,
  advanceDealer,
  ActionType,
  type GameState,
  type PlayerSetup,
  DEFAULT_NL_CONFIG,
} from '@agent-poker/poker-engine';

// ── Config ───────────────────────────────────────────────────
const NUM_TABLES = 10;
const AGENTS_PER_TABLE = 5; // 50 total agents
const HANDS_PER_TABLE = 50; // 500 total hands
const STARTING_CHIPS = 1000;
const MAX_MOVES_PER_HAND = 300;
const MASTER_SEED = 777;

// ── Types ────────────────────────────────────────────────────

interface TableResult {
  tableId: number;
  handsPlayed: number;
  errors: string[];
  chipConservationViolations: number;
  deadlocks: number;
  totalMoves: number;
  handLatencies: number[];
}

// ── Bot action (simple mixed strategy) ───────────────────────

function pickAction(
  legal: ActionType[],
  state: GameState,
  rng: () => number,
): { type: ActionType; amount?: number } {
  const r = rng();

  // 40% call/check, 30% raise/bet, 30% fold
  if (r < 0.4) {
    if (legal.includes(ActionType.CHECK)) return { type: ActionType.CHECK };
    if (legal.includes(ActionType.CALL)) return { type: ActionType.CALL };
  } else if (r < 0.7) {
    if (legal.includes(ActionType.RAISE)) {
      const ranges = getLegalActionRanges(state);
      const amount = Math.floor(ranges.minRaise + rng() * (ranges.maxRaise - ranges.minRaise));
      return { type: ActionType.RAISE, amount: Math.max(ranges.minRaise, amount) };
    }
    if (legal.includes(ActionType.BET)) {
      const ranges = getLegalActionRanges(state);
      const amount = Math.floor(ranges.minBet + rng() * (ranges.maxBet - ranges.minBet));
      return { type: ActionType.BET, amount: Math.max(ranges.minBet, amount) };
    }
    if (legal.includes(ActionType.CALL)) return { type: ActionType.CALL };
    if (legal.includes(ActionType.CHECK)) return { type: ActionType.CHECK };
  }

  // Fallback
  if (legal.includes(ActionType.CHECK)) return { type: ActionType.CHECK };
  if (legal.includes(ActionType.CALL)) return { type: ActionType.CALL };
  return { type: ActionType.FOLD };
}

// ── Run one table ────────────────────────────────────────────

function runTable(tableId: number, seed: number): TableResult {
  const masterRng = createSeededRng(seed);
  const result: TableResult = {
    tableId,
    handsPlayed: 0,
    errors: [],
    chipConservationViolations: 0,
    deadlocks: 0,
    totalMoves: 0,
    handLatencies: [],
  };

  // Create agents for this table
  const agents: Array<{ id: string; seatIndex: number }> = [];
  for (let i = 0; i < AGENTS_PER_TABLE; i++) {
    agents.push({
      id: `table${tableId}_agent${i}`,
      seatIndex: i,
    });
  }

  const chips: number[] = agents.map(() => STARTING_CHIPS);
  const totalChipsExpected = AGENTS_PER_TABLE * STARTING_CHIPS;
  let dealerSeatIndex = 0;

  for (let h = 0; h < HANDS_PER_TABLE; h++) {
    const handStart = performance.now();

    // Build players with chips > 0; reset all if too few remain
    let activePlayers = agents
      .map((a, i) => ({ ...a, chips: chips[i]! }))
      .filter((a) => a.chips > 0);

    if (activePlayers.length < 2) {
      for (let i = 0; i < chips.length; i++) {
        chips[i] = STARTING_CHIPS;
      }
      activePlayers = agents.map((a, i) => ({ ...a, chips: chips[i]! }));
    }

    const handSeed = Math.floor(masterRng() * 2 ** 32);
    const rng = createSeededRng(handSeed);
    const botRng = createSeededRng(handSeed + 1);
    const handId = `table${tableId}_hand${h}`;

    const playerSetups: PlayerSetup[] = activePlayers.map((a) => ({
      id: a.id,
      seatIndex: a.seatIndex,
      chips: a.chips,
    }));

    const activeSeats = playerSetups.map((p) => p.seatIndex);
    if (!activeSeats.includes(dealerSeatIndex)) {
      dealerSeatIndex = activeSeats[0]!;
    }

    const chipsBefore = chips.reduce((a, b) => a + b, 0);

    try {
      const { state: initState } = createInitialState(
        handId,
        playerSetups,
        dealerSeatIndex,
        rng,
        DEFAULT_NL_CONFIG,
      );

      let state = initState;
      let moves = 0;

      while (!state.isHandComplete && moves < MAX_MOVES_PER_HAND) {
        const activePlayer = state.players.find(
          (p) => p.seatIndex === state.activePlayerSeatIndex,
        )!;
        const legal = getLegalActions(state);

        if (legal.length === 0) {
          result.deadlocks++;
          result.errors.push(`${handId}: No legal actions (deadlock)`);
          break;
        }

        const action = pickAction(legal, state, botRng);
        state = applyAction(state, activePlayer.id, action).state;
        moves++;
      }

      if (moves >= MAX_MOVES_PER_HAND && !state.isHandComplete) {
        result.deadlocks++;
        result.errors.push(`${handId}: Exceeded ${MAX_MOVES_PER_HAND} moves`);
      }

      result.totalMoves += moves;

      // Update chips
      for (const p of state.players) {
        const idx = agents.findIndex((a) => a.id === p.id);
        if (idx !== -1) {
          chips[idx] = p.chips;
        }
      }

      // Verify chip conservation
      const chipsAfter = chips.reduce((a, b) => a + b, 0);
      if (chipsAfter !== totalChipsExpected) {
        result.chipConservationViolations++;
        result.errors.push(
          `${handId}: Chip conservation violation: ${chipsBefore} -> ${chipsAfter} (expected ${totalChipsExpected})`,
        );
      }

      // Advance dealer
      dealerSeatIndex = advanceDealer(activeSeats, dealerSeatIndex);
      result.handsPlayed++;
    } catch (err) {
      result.errors.push(`${handId}: ${(err as Error).message}`);
    }

    const handLatency = performance.now() - handStart;
    result.handLatencies.push(handLatency);
  }

  return result;
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log('=== Agent Poker Stress Test ===');
  console.log(`Tables: ${NUM_TABLES} | Agents/table: ${AGENTS_PER_TABLE} | Hands/table: ${HANDS_PER_TABLE}`);
  console.log(`Total agents: ${NUM_TABLES * AGENTS_PER_TABLE} | Total hands: ${NUM_TABLES * HANDS_PER_TABLE}`);
  console.log();

  const overallStart = performance.now();
  const masterRng = createSeededRng(MASTER_SEED);

  // Run all tables concurrently (simulated — single-threaded but interleaved)
  const tableSeeds: number[] = [];
  for (let i = 0; i < NUM_TABLES; i++) {
    tableSeeds.push(Math.floor(masterRng() * 2 ** 32));
  }

  // Run tables in parallel using Promise.all (each is sync but we wrap for structure)
  const results: TableResult[] = [];
  const tablePromises = tableSeeds.map((seed, i) =>
    Promise.resolve().then(() => runTable(i, seed)),
  );
  const settled = await Promise.all(tablePromises);
  results.push(...settled);

  const overallElapsed = performance.now() - overallStart;

  // ── Aggregate results ──────────────────────────────────
  let totalHands = 0;
  let totalErrors = 0;
  let totalChipViolations = 0;
  let totalDeadlocks = 0;
  let totalMoves = 0;
  const allLatencies: number[] = [];
  const tableErrors: string[] = [];

  for (const r of results) {
    totalHands += r.handsPlayed;
    totalErrors += r.errors.length;
    totalChipViolations += r.chipConservationViolations;
    totalDeadlocks += r.deadlocks;
    totalMoves += r.totalMoves;
    allLatencies.push(...r.handLatencies);
    tableErrors.push(...r.errors);
  }

  // Per-table summary
  console.log('--- Per-table Results ---');
  for (const r of results) {
    const avgLatency = r.handLatencies.length > 0
      ? (r.handLatencies.reduce((a, b) => a + b, 0) / r.handLatencies.length).toFixed(2)
      : '0.00';
    const status = r.errors.length === 0 ? 'OK' : `${r.errors.length} errors`;
    console.log(
      `  Table ${r.tableId}: ${r.handsPlayed} hands, ${r.totalMoves} moves, ${avgLatency}ms avg, ${status}`,
    );
  }

  // Latency stats
  allLatencies.sort((a, b) => a - b);
  const avgLatency = allLatencies.length > 0
    ? allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length
    : 0;
  const p50 = allLatencies.length > 0 ? allLatencies[Math.floor(allLatencies.length * 0.5)]! : 0;
  const p99 = allLatencies.length > 0 ? allLatencies[Math.floor(allLatencies.length * 0.99)]! : 0;

  console.log();
  console.log('--- Aggregate Results ---');
  console.log(`  Total hands played:   ${totalHands}`);
  console.log(`  Total moves:          ${totalMoves}`);
  console.log(`  Elapsed time:         ${(overallElapsed / 1000).toFixed(2)}s`);
  console.log(`  Hands/sec:            ${(totalHands / (overallElapsed / 1000)).toFixed(0)}`);
  console.log(`  Avg hand latency:     ${avgLatency.toFixed(2)}ms`);
  console.log(`  P50 hand latency:     ${p50.toFixed(2)}ms`);
  console.log(`  P99 hand latency:     ${p99.toFixed(2)}ms`);
  console.log(`  Errors:               ${totalErrors}`);
  console.log(`  Chip violations:      ${totalChipViolations}`);
  console.log(`  Deadlocks:            ${totalDeadlocks}`);

  // Print first 10 errors if any
  if (tableErrors.length > 0) {
    console.log();
    console.log('--- Errors (first 10) ---');
    for (const e of tableErrors.slice(0, 10)) {
      console.log(`  ${e}`);
    }
  }

  // ── Verdict ────────────────────────────────────────────
  console.log();
  const noErrors = totalErrors === 0;
  const noChipViolations = totalChipViolations === 0;
  const noDeadlocks = totalDeadlocks === 0;
  const enoughHands = totalHands >= NUM_TABLES * HANDS_PER_TABLE * 0.9; // allow 10% margin for chip-out

  console.log('=== Verification ===');
  console.log(`  No crashes:           ${noErrors ? 'PASS' : 'FAIL'}`);
  console.log(`  Chip conservation:    ${noChipViolations ? 'PASS' : 'FAIL'}`);
  console.log(`  No deadlocks:         ${noDeadlocks ? 'PASS' : 'FAIL'}`);
  console.log(`  Hands completed:      ${enoughHands ? 'PASS' : 'FAIL'} (${totalHands}/${NUM_TABLES * HANDS_PER_TABLE})`);

  const allPass = noErrors && noChipViolations && noDeadlocks && enoughHands;
  console.log(`\n${allPass ? '*** STRESS TEST PASSED ***' : '*** STRESS TEST FAILED ***'}`);
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
