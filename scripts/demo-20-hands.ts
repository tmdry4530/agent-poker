/**
 * E2E Demo: bots play 20 hands using the poker engine directly.
 * Validates chip conservation, deterministic replay, and ledger integrity.
 * Supports 2-8 players.
 *
 * Usage: npx tsx scripts/demo-20-hands.ts
 * Exit 0 = success, non-zero = failure
 */

import {
  createInitialState,
  applyAction,
  getLegalActions,
  getLegalActionRanges,
  createSeededRng,
  advanceDealer,
  ActionType,
  BettingMode,
  type GameState,
  type GameEvent,
  type PlayerSetup,
  type GameConfig,
  DEFAULT_CONFIG,
  DEFAULT_NL_CONFIG,
  DEFAULT_PL_CONFIG,
} from '@agent-poker/poker-engine';

// Parse mode from command line: --mode=limit|nolimit|potlimit
const args = process.argv.slice(2);
const modeArg = args.find((a) => a.startsWith('--mode='));
const mode = modeArg ? modeArg.split('=')[1] : 'limit';

let config: GameConfig;
switch (mode) {
  case 'nolimit':
    config = DEFAULT_NL_CONFIG;
    break;
  case 'potlimit':
    config = DEFAULT_PL_CONFIG;
    break;
  default:
    config = DEFAULT_CONFIG;
}

const NUM_HANDS = 20;
const STARTING_CHIPS = 200;
const MASTER_SEED = 12345;
const NUM_PLAYERS = 4; // 4-player demo

interface HandRecord {
  handId: string;
  seed: number;
  events: GameEvent[];
  finalState: GameState;
  chipsBefore: number[];
  chipsAfter: number[];
}

// ── Bot strategies ──────────────────────────────────────────

function callingStationAction(
  legalActions: ActionType[],
  state: GameState
): { type: ActionType; amount?: number } {
  if (legalActions.includes(ActionType.CHECK)) return { type: ActionType.CHECK };
  if (legalActions.includes(ActionType.CALL)) return { type: ActionType.CALL };
  return { type: ActionType.FOLD };
}

function randomAction(
  legalActions: ActionType[],
  state: GameState,
  rng: () => number
): { type: ActionType; amount?: number } {
  const options = legalActions.filter((a) => a !== ActionType.FOLD);
  if (options.length === 0) return { type: ActionType.FOLD };
  const chosen = options[Math.floor(rng() * options.length)]!;

  if (
    (chosen === ActionType.BET || chosen === ActionType.RAISE) &&
    (config.bettingMode === BettingMode.NO_LIMIT || config.bettingMode === BettingMode.POT_LIMIT)
  ) {
    const ranges = getLegalActionRanges(state);
    const amount =
      chosen === ActionType.BET
        ? Math.floor(ranges.minBet + rng() * (ranges.maxBet - ranges.minBet))
        : Math.floor(ranges.minRaise + rng() * (ranges.maxRaise - ranges.minRaise));
    return { type: chosen, amount };
  }

  return { type: chosen };
}

function aggressiveAction(
  legalActions: ActionType[],
  state: GameState
): { type: ActionType; amount?: number } {
  if (legalActions.includes(ActionType.RAISE)) {
    if (config.bettingMode === BettingMode.NO_LIMIT || config.bettingMode === BettingMode.POT_LIMIT) {
      const ranges = getLegalActionRanges(state);
      const amount = Math.floor((ranges.minRaise + ranges.maxRaise) / 2);
      return { type: ActionType.RAISE, amount };
    }
    return { type: ActionType.RAISE };
  }
  if (legalActions.includes(ActionType.BET)) {
    if (config.bettingMode === BettingMode.NO_LIMIT || config.bettingMode === BettingMode.POT_LIMIT) {
      const ranges = getLegalActionRanges(state);
      const amount = Math.floor((ranges.minBet + ranges.maxBet) / 2);
      return { type: ActionType.BET, amount };
    }
    return { type: ActionType.BET };
  }
  if (legalActions.includes(ActionType.CALL)) return { type: ActionType.CALL };
  if (legalActions.includes(ActionType.CHECK)) return { type: ActionType.CHECK };
  return { type: ActionType.FOLD };
}

// ── Main ────────────────────────────────────────────────────

const BOTS = [
  { id: 'bot-alpha', strategy: 'calling-station' },
  { id: 'bot-beta', strategy: 'random' },
  { id: 'bot-gamma', strategy: 'aggressive' },
  { id: 'bot-delta', strategy: 'calling-station' },
];

async function main() {
  console.log(`=== Agent Poker MVP1 — E2E Demo (${NUM_PLAYERS}-player, ${config.bettingMode}) ===`);
  console.log(`Hands: ${NUM_HANDS} | Starting chips: ${STARTING_CHIPS} each`);
  console.log();

  const activeBots = BOTS.slice(0, NUM_PLAYERS);
  const records: HandRecord[] = [];
  const chips: number[] = activeBots.map(() => STARTING_CHIPS);
  let dealerSeatIndex = 0;
  const masterRng = createSeededRng(MASTER_SEED);
  const botRng = createSeededRng(MASTER_SEED + 1);

  for (let h = 0; h < NUM_HANDS; h++) {
    // Find players with chips
    const playersWithChips = activeBots
      .map((b, i) => ({ ...b, seatIndex: i, chips: chips[i]! }))
      .filter((b) => b.chips > 0);

    if (playersWithChips.length < 2) {
      console.log(`  [!] Not enough players with chips after hand ${h}. Stopping.`);
      break;
    }

    const handSeed = Math.floor(masterRng() * 2 ** 32);
    const rng = createSeededRng(handSeed);
    const handId = `hand_${h + 1}`;

    const playerSetups: PlayerSetup[] = playersWithChips.map((b) => ({
      id: b.id,
      seatIndex: b.seatIndex,
      chips: b.chips,
    }));

    // Ensure dealer is valid
    const activeSeats = playerSetups.map((p) => p.seatIndex);
    if (!activeSeats.includes(dealerSeatIndex)) {
      dealerSeatIndex = activeSeats[0]!;
    }

    const chipsBefore = activeBots.map((_, i) => chips[i]!);

    const { state: initState, events: initEvents } = createInitialState(
      handId, playerSetups, dealerSeatIndex, rng, config,
    );

    let state = initState;
    const allEvents = [...initEvents];

    // Play the hand
    let moves = 0;
    while (!state.isHandComplete) {
      const activePlayer = state.players.find((p) => p.seatIndex === state.activePlayerSeatIndex)!;
      const legal = getLegalActions(state);

      const bot = activeBots.find((b) => b.id === activePlayer.id)!;
      let action: { type: ActionType; amount?: number };
      switch (bot.strategy) {
        case 'calling-station':
          action = callingStationAction(legal, state);
          break;
        case 'aggressive':
          action = aggressiveAction(legal, state);
          break;
        default:
          action = randomAction(legal, state, botRng);
      }

      const result = applyAction(state, activePlayer.id, action, rng);
      state = result.state;
      allEvents.push(...result.events);
      moves++;

      if (moves > 200) {
        console.error(`  [ERROR] Hand ${handId} exceeded 200 moves. Aborting.`);
        process.exit(1);
      }
    }

    // Update chips
    for (const p of state.players) {
      const idx = activeBots.findIndex((b) => b.id === p.id);
      if (idx !== -1) chips[idx] = p.chips;
    }

    const chipsAfter = activeBots.map((_, i) => chips[i]!);
    dealerSeatIndex = advanceDealer(activeSeats, dealerSeatIndex);

    records.push({ handId, seed: handSeed, events: allEvents, finalState: state, chipsBefore, chipsAfter });

    const winner = state.winners?.join(', ') ?? 'unknown';
    const chipStr = activeBots.map((b, i) => `${b.id.replace('bot-', '')}=${chips[i]}`).join(' ');
    console.log(`  Hand ${h + 1}: winner=${winner} | ${chipStr} | moves=${moves}`);
  }

  console.log();

  // ── Verify chip conservation ────────────────────────────
  console.log('=== Verification ===');
  let chipConservationOk = true;
  for (const rec of records) {
    const totalBefore = rec.chipsBefore.reduce((a, b) => a + b, 0);
    const totalAfter = rec.chipsAfter.reduce((a, b) => a + b, 0);
    if (totalBefore !== totalAfter) {
      console.error(`  [FAIL] Chip conservation violated in ${rec.handId}: ${totalBefore} -> ${totalAfter}`);
      chipConservationOk = false;
    }
  }
  console.log(`  Chip conservation: ${chipConservationOk ? 'PASS' : 'FAIL'}`);

  const totalNow = chips.reduce((a, b) => a + b, 0);
  const totalExpected = NUM_PLAYERS * STARTING_CHIPS;
  const globalChipOk = totalNow === totalExpected;
  console.log(`  Global chip total: ${totalNow} (expected ${totalExpected}) — ${globalChipOk ? 'PASS' : 'FAIL'}`);

  // ── Verify deterministic replay ─────────────────────────
  console.log();
  console.log('=== Deterministic Replay ===');
  let replayOk = true;
  const masterRng2 = createSeededRng(MASTER_SEED);
  const botRng2 = createSeededRng(MASTER_SEED + 1);
  const r_chips: number[] = activeBots.map(() => STARTING_CHIPS);
  let r_dealer = 0;

  for (let h = 0; h < records.length; h++) {
    const playersWithChips = activeBots
      .map((b, i) => ({ ...b, seatIndex: i, chips: r_chips[i]! }))
      .filter((b) => b.chips > 0);

    if (playersWithChips.length < 2) break;

    const handSeed = Math.floor(masterRng2() * 2 ** 32);
    const rng = createSeededRng(handSeed);
    const handId = `hand_${h + 1}`;

    const playerSetups: PlayerSetup[] = playersWithChips.map((b) => ({
      id: b.id, seatIndex: b.seatIndex, chips: b.chips,
    }));

    const activeSeats = playerSetups.map((p) => p.seatIndex);
    if (!activeSeats.includes(r_dealer)) r_dealer = activeSeats[0]!;

    const { state: initState } = createInitialState(handId, playerSetups, r_dealer, rng, config);

    let state = initState;
    let moves = 0;
    while (!state.isHandComplete) {
      const activePlayer = state.players.find((p) => p.seatIndex === state.activePlayerSeatIndex)!;
      const legal = getLegalActions(state);
      const bot = activeBots.find((b) => b.id === activePlayer.id)!;
      let action: { type: ActionType; amount?: number };
      switch (bot.strategy) {
        case 'calling-station':
          action = callingStationAction(legal, state);
          break;
        case 'aggressive':
          action = aggressiveAction(legal, state);
          break;
        default:
          action = randomAction(legal, state, botRng2);
      }
      state = applyAction(state, activePlayer.id, action, rng).state;
      moves++;
      if (moves > 200) break;
    }

    for (const p of state.players) {
      const idx = activeBots.findIndex((b) => b.id === p.id);
      if (idx !== -1) r_chips[idx] = p.chips;
    }
    r_dealer = advanceDealer(activeSeats, r_dealer);

    const original = records[h]!;
    const match = activeBots.every((_, i) => r_chips[i] === original.chipsAfter[i]);
    if (!match) {
      console.error(`  [FAIL] Replay mismatch at hand ${h + 1}: orig=[${original.chipsAfter}] replay=[${r_chips}]`);
      replayOk = false;
    }
  }
  console.log(`  Replay determinism: ${replayOk ? 'PASS' : 'FAIL'}`);

  // ── Summary ─────────────────────────────────────────────
  console.log();
  console.log('=== Summary ===');
  console.log(`  Hands played: ${records.length}`);
  const finalChips = activeBots.map((b, i) => `${b.id}=${chips[i]}`).join(' ');
  console.log(`  Final chips: ${finalChips}`);
  console.log(`  Chip conservation: ${chipConservationOk && globalChipOk ? 'PASS' : 'FAIL'}`);
  console.log(`  Replay determinism: ${replayOk ? 'PASS' : 'FAIL'}`);

  const allPass = chipConservationOk && globalChipOk && replayOk && records.length >= NUM_HANDS;
  console.log();
  console.log(allPass ? '*** ALL CHECKS PASSED ***' : '*** SOME CHECKS FAILED ***');
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
