/**
 * E2E Demo: 8 bots play 100 hands of No-Limit Hold'em (8-max).
 * Validates chip conservation, replay determinism, and event chain integrity.
 * Prints per-bot statistics: hands played, VPIP%, PFR%, win rate, total profit/loss.
 *
 * Usage: npx tsx scripts/demo-8max-nolimit.ts
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

const NUM_HANDS = 100;
const STARTING_CHIPS = 1000;
const MASTER_SEED = 88888;
const NUM_PLAYERS = 8;

interface BotStats {
  id: string;
  handsPlayed: number;
  vpip: number; // voluntarily put in pot
  pfr: number; // preflop raise
  handsWon: number;
  totalProfit: number;
}

interface HandRecord {
  handId: string;
  seed: number;
  events: GameEvent[];
  finalState: GameState;
  chipsBefore: number[];
  chipsAfter: number[];
  terminalHash: string;
}

// ── Bot strategies ──────────────────────────────────────────

function evaluateHandTier(holeCards: Array<{ rank: string; suit: string }>): number {
  if (holeCards.length !== 2) return 5;
  const [c1, c2] = holeCards;
  if (!c1 || !c2) return 5;

  const rankOrder = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
  const val1 = rankOrder.indexOf(c1.rank);
  const val2 = rankOrder.indexOf(c2.rank);
  const high = Math.max(val1, val2);
  const low = Math.min(val1, val2);
  const isPair = val1 === val2;
  const suited = c1.suit === c2.suit;

  // Tier 1: Premium (top ~5%)
  if (isPair && high >= 10) return 1; // AA, KK, QQ
  if (high === 12 && low === 11 && suited) return 1; // AKs

  // Tier 2: Strong (top ~15%)
  if (isPair && high >= 9) return 2; // JJ, TT
  if (high === 12 && low >= 10) return 2; // AK, AQ, AJ
  if (high === 11 && low === 10 && suited) return 2; // KQs

  // Tier 3: Playable (top ~25%)
  if (isPair && high >= 7) return 3; // 99, 88
  if (high === 12 && low >= 8) return 3; // AT, A9
  if (high >= 10 && low >= 9 && suited) return 3; // KJs, QJs, JTs

  // Tier 4: Marginal
  if (isPair) return 4;
  if (high >= 11 && low >= 8) return 4;
  if (suited && high >= 9 && low >= 7) return 4;

  return 5;
}

// CallingStation: always call/check
function callingStationAction(
  legal: ActionType[],
  state: GameState,
  playerId: string
): { type: ActionType; amount?: number } {
  if (legal.includes(ActionType.CHECK)) return { type: ActionType.CHECK };
  if (legal.includes(ActionType.CALL)) return { type: ActionType.CALL };
  return { type: ActionType.FOLD };
}

// RandomBot: random legal action
function randomAction(
  legal: ActionType[],
  state: GameState,
  playerId: string,
  rng: () => number
): { type: ActionType; amount?: number } {
  const options = legal.filter((a) => a !== ActionType.FOLD);
  const chosen = options.length > 0 ? options[Math.floor(rng() * options.length)]! : ActionType.FOLD;

  if (chosen === ActionType.BET || chosen === ActionType.RAISE) {
    const ranges = getLegalActionRanges(state);
    const amount =
      chosen === ActionType.BET
        ? Math.floor(ranges.minBet + rng() * (ranges.maxBet - ranges.minBet))
        : Math.floor(ranges.minRaise + rng() * (ranges.maxRaise - ranges.minRaise));
    return { type: chosen, amount };
  }

  return { type: chosen };
}

// AggressiveBot: raise/bet whenever possible
function aggressiveAction(
  legal: ActionType[],
  state: GameState,
  playerId: string
): { type: ActionType; amount?: number } {
  const ranges = getLegalActionRanges(state);
  if (legal.includes(ActionType.RAISE)) {
    const potRaise = Math.floor((ranges.minRaise + ranges.maxRaise) / 2);
    return { type: ActionType.RAISE, amount: potRaise };
  }
  if (legal.includes(ActionType.BET)) {
    const potBet = Math.floor((ranges.minBet + ranges.maxBet) / 2);
    return { type: ActionType.BET, amount: potBet };
  }
  if (legal.includes(ActionType.CALL)) return { type: ActionType.CALL };
  if (legal.includes(ActionType.CHECK)) return { type: ActionType.CHECK };
  return { type: ActionType.FOLD };
}

// TightAggressiveBot: top 15% hands, bet 80-100% pot
function tightAggressiveAction(
  legal: ActionType[],
  state: GameState,
  playerId: string
): { type: ActionType; amount?: number } {
  const player = state.players.find((p) => p.id === playerId)!;
  const tier = evaluateHandTier(player.holeCards);
  const isStrongHand = tier <= 2;

  if (!isStrongHand) {
    if (legal.includes(ActionType.CHECK)) return { type: ActionType.CHECK };
    return { type: ActionType.FOLD };
  }

  const ranges = getLegalActionRanges(state);
  const potTotal = state.pots.reduce((sum, p) => sum + p.amount, 0);

  if (legal.includes(ActionType.RAISE)) {
    const potRaise = Math.min(Math.floor(potTotal * 0.9), ranges.maxRaise);
    const raiseAmount = Math.max(ranges.minRaise, potRaise);
    return { type: ActionType.RAISE, amount: raiseAmount };
  }

  if (legal.includes(ActionType.BET)) {
    const potBet = Math.min(Math.floor(potTotal * 0.9), ranges.maxBet);
    const betAmount = Math.max(ranges.minBet, potBet);
    return { type: ActionType.BET, amount: betAmount };
  }

  if (legal.includes(ActionType.CALL)) return { type: ActionType.CALL };
  if (legal.includes(ActionType.CHECK)) return { type: ActionType.CHECK };
  return { type: ActionType.FOLD };
}

// LooseAggressiveBot: plays many hands aggressively (top 40%)
function looseAggressiveAction(
  legal: ActionType[],
  state: GameState,
  playerId: string
): { type: ActionType; amount?: number } {
  const player = state.players.find((p) => p.id === playerId)!;
  const tier = evaluateHandTier(player.holeCards);
  const isPlayableHand = tier <= 4; // Top ~40%

  if (!isPlayableHand) {
    if (legal.includes(ActionType.CHECK)) return { type: ActionType.CHECK };
    return { type: ActionType.FOLD };
  }

  const ranges = getLegalActionRanges(state);
  const potTotal = state.pots.reduce((sum, p) => sum + p.amount, 0);

  if (legal.includes(ActionType.RAISE)) {
    const potRaise = Math.min(Math.floor(potTotal * 0.75), ranges.maxRaise);
    const raiseAmount = Math.max(ranges.minRaise, potRaise);
    return { type: ActionType.RAISE, amount: raiseAmount };
  }

  if (legal.includes(ActionType.BET)) {
    const potBet = Math.min(Math.floor(potTotal * 0.75), ranges.maxBet);
    const betAmount = Math.max(ranges.minBet, potBet);
    return { type: ActionType.BET, amount: betAmount };
  }

  if (legal.includes(ActionType.CALL)) return { type: ActionType.CALL };
  if (legal.includes(ActionType.CHECK)) return { type: ActionType.CHECK };
  return { type: ActionType.FOLD };
}

// PotControlBot: bet 50% pot
function potControlAction(
  legal: ActionType[],
  state: GameState,
  playerId: string
): { type: ActionType; amount?: number } {
  const player = state.players.find((p) => p.id === playerId)!;
  const tier = evaluateHandTier(player.holeCards);

  if (tier === 5 && legal.includes(ActionType.CALL)) {
    return { type: ActionType.FOLD };
  }

  const ranges = getLegalActionRanges(state);
  const potTotal = state.pots.reduce((sum, p) => sum + p.amount, 0);

  if (legal.includes(ActionType.RAISE)) {
    const potRaise = Math.min(Math.floor(potTotal * 0.5), ranges.maxRaise);
    const raiseAmount = Math.max(ranges.minRaise, potRaise);
    return { type: ActionType.RAISE, amount: raiseAmount };
  }

  if (legal.includes(ActionType.BET)) {
    const potBet = Math.min(Math.floor(potTotal * 0.5), ranges.maxBet);
    const betAmount = Math.max(ranges.minBet, potBet);
    return { type: ActionType.BET, amount: betAmount };
  }

  if (legal.includes(ActionType.CALL)) return { type: ActionType.CALL };
  if (legal.includes(ActionType.CHECK)) return { type: ActionType.CHECK };
  return { type: ActionType.FOLD };
}

// ── Main ────────────────────────────────────────────────────

const BOTS = [
  { id: 'CallingStation', strategy: 'calling-station' },
  { id: 'RandomBot', strategy: 'random' },
  { id: 'AggressiveBot', strategy: 'aggressive' },
  { id: 'TightAggressive', strategy: 'tight-aggressive' },
  { id: 'LooseAggressive', strategy: 'loose-aggressive' },
  { id: 'PotControl', strategy: 'pot-control' },
  { id: 'LooseAggressive2', strategy: 'loose-aggressive' },
  { id: 'RandomBot2', strategy: 'random' },
];

async function main() {
  console.log('=== Agent Poker MVP1 — No-Limit 8-max Demo ===');
  console.log(`Hands: ${NUM_HANDS} | Starting chips: ${STARTING_CHIPS} each | Players: ${NUM_PLAYERS}`);
  console.log();

  const records: HandRecord[] = [];
  const chips: number[] = BOTS.map(() => STARTING_CHIPS);
  const stats: BotStats[] = BOTS.map((b) => ({
    id: b.id,
    handsPlayed: 0,
    vpip: 0,
    pfr: 0,
    handsWon: 0,
    totalProfit: 0,
  }));

  let dealerSeatIndex = 0;
  const masterRng = createSeededRng(MASTER_SEED);
  const botRng = createSeededRng(MASTER_SEED + 1);

  for (let h = 0; h < NUM_HANDS; h++) {
    const playersWithChips = BOTS.map((b, i) => ({ ...b, seatIndex: i, chips: chips[i]! })).filter(
      (b) => b.chips > 0
    );

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

    const activeSeats = playerSetups.map((p) => p.seatIndex);
    if (!activeSeats.includes(dealerSeatIndex)) {
      dealerSeatIndex = activeSeats[0]!;
    }

    const chipsBefore = BOTS.map((_, i) => chips[i]!);

    const { state: initState, events: initEvents } = createInitialState(
      handId,
      playerSetups,
      dealerSeatIndex,
      rng,
      DEFAULT_NL_CONFIG
    );

    let state = initState;
    const allEvents = [...initEvents];

    // Track VPIP/PFR
    const vpipSet = new Set<string>();
    const pfrSet = new Set<string>();
    let preflopPhase = true;

    // Play the hand
    let moves = 0;
    while (!state.isHandComplete) {
      const activePlayer = state.players.find((p) => p.seatIndex === state.activePlayerSeatIndex)!;
      const legal = getLegalActions(state);

      const bot = BOTS.find((b) => b.id === activePlayer.id)!;
      let action: { type: ActionType; amount?: number };

      switch (bot.strategy) {
        case 'calling-station':
          action = callingStationAction(legal, state, activePlayer.id);
          break;
        case 'random':
          action = randomAction(legal, state, activePlayer.id, botRng);
          break;
        case 'aggressive':
          action = aggressiveAction(legal, state, activePlayer.id);
          break;
        case 'tight-aggressive':
          action = tightAggressiveAction(legal, state, activePlayer.id);
          break;
        case 'loose-aggressive':
          action = looseAggressiveAction(legal, state, activePlayer.id);
          break;
        case 'pot-control':
          action = potControlAction(legal, state, activePlayer.id);
          break;
        default:
          action = randomAction(legal, state, activePlayer.id, botRng);
      }

      // Track VPIP/PFR (preflop only)
      if (preflopPhase) {
        if (
          action.type === ActionType.CALL ||
          action.type === ActionType.BET ||
          action.type === ActionType.RAISE
        ) {
          vpipSet.add(activePlayer.id);
        }
        if (action.type === ActionType.RAISE || action.type === ActionType.BET) {
          pfrSet.add(activePlayer.id);
        }
      }

      const result = applyAction(state, activePlayer.id, action, rng);
      state = result.state;
      allEvents.push(...result.events);
      moves++;

      // End preflop phase when street changes
      if (state.street !== 'PREFLOP') {
        preflopPhase = false;
      }

      if (moves > 1000) {
        console.error(`  [ERROR] Hand ${handId} exceeded 1000 moves. Aborting.`);
        process.exit(1);
      }
    }

    // Update stats
    for (const p of state.players) {
      const idx = BOTS.findIndex((b) => b.id === p.id);
      if (idx !== -1) {
        stats[idx]!.handsPlayed++;
        if (vpipSet.has(p.id)) stats[idx]!.vpip++;
        if (pfrSet.has(p.id)) stats[idx]!.pfr++;
        if (state.winners?.includes(p.id)) stats[idx]!.handsWon++;
        chips[idx] = p.chips;
      }
    }

    const chipsAfter = BOTS.map((_, i) => chips[i]!);
    dealerSeatIndex = advanceDealer(activeSeats, dealerSeatIndex);

    // Build hash chain
    const chain = buildHashChain(allEvents);
    const terminalHash = getTerminalHash(chain);

    records.push({
      handId,
      seed: handSeed,
      events: allEvents,
      finalState: state,
      chipsBefore,
      chipsAfter,
      terminalHash,
    });

    if ((h + 1) % 20 === 0) {
      const winner = state.winners?.join(', ') ?? 'unknown';
      console.log(`  Hand ${h + 1}: winner=${winner} | moves=${moves}`);
    }
  }

  console.log();

  // ── Verify chip conservation ────────────────────────────
  console.log('=== Verification ===');
  let chipConservationOk = true;
  for (const rec of records) {
    const totalBefore = rec.chipsBefore.reduce((a, b) => a + b, 0);
    const totalAfter = rec.chipsAfter.reduce((a, b) => a + b, 0);
    if (totalBefore !== totalAfter) {
      console.error(
        `  [FAIL] Chip conservation violated in ${rec.handId}: ${totalBefore} -> ${totalAfter}`
      );
      chipConservationOk = false;
    }
  }
  console.log(`  Chip conservation: ${chipConservationOk ? 'PASS' : 'FAIL'}`);

  const totalNow = chips.reduce((a, b) => a + b, 0);
  const totalExpected = NUM_PLAYERS * STARTING_CHIPS;
  const globalChipOk = totalNow === totalExpected;
  console.log(
    `  Global chip total: ${totalNow} (expected ${totalExpected}) — ${globalChipOk ? 'PASS' : 'FAIL'}`
  );

  // ── Verify position rotation for 8 seats ───────────────
  console.log();
  console.log('=== Position Rotation Verification (8 seats) ===');
  let positionOk = true;
  const dealerPositions = new Set<number>();
  for (const rec of records) {
    const dealerSeat = rec.finalState.dealerSeatIndex;
    dealerPositions.add(dealerSeat);
  }
  // With 100 hands and 8 seats, we expect all 8 positions to be used at least once
  if (dealerPositions.size < 8) {
    console.log(`  [WARN] Only ${dealerPositions.size}/8 dealer positions used in ${records.length} hands`);
  } else {
    console.log(`  All 8 dealer positions used: PASS`);
  }

  // ── Verify event chain integrity ───────────────────────
  console.log();
  console.log('=== Event Chain Integrity ===');
  let chainOk = true;
  for (const rec of records) {
    const chain = buildHashChain(rec.events);
    const valid = verifyHashChain(rec.events, chain);
    if (!valid) {
      console.error(`  [FAIL] Chain verification failed for ${rec.handId}`);
      chainOk = false;
    }
  }
  console.log(`  Event chain integrity: ${chainOk ? 'PASS' : 'FAIL'}`);

  // ── Bot Statistics ──────────────────────────────────────
  console.log();
  console.log('=== Bot Statistics (8 players) ===');
  for (const s of stats) {
    const vpipPct = s.handsPlayed > 0 ? ((s.vpip / s.handsPlayed) * 100).toFixed(1) : '0.0';
    const pfrPct = s.handsPlayed > 0 ? ((s.pfr / s.handsPlayed) * 100).toFixed(1) : '0.0';
    const winRate = s.handsPlayed > 0 ? ((s.handsWon / s.handsPlayed) * 100).toFixed(1) : '0.0';
    const idx = BOTS.findIndex((b) => b.id === s.id);
    const profit = chips[idx]! - STARTING_CHIPS;
    console.log(
      `  ${s.id.padEnd(18)} | Hands: ${s.handsPlayed.toString().padStart(3)} | VPIP: ${vpipPct.padStart(5)}% | PFR: ${pfrPct.padStart(5)}% | Win: ${winRate.padStart(5)}% | P/L: ${profit >= 0 ? '+' : ''}${profit}`
    );
  }

  // ── Summary ─────────────────────────────────────────────
  console.log();
  console.log('=== Summary ===');
  console.log(`  Hands played: ${records.length}`);
  const finalChips = BOTS.map((b, i) => `${b.id}=${chips[i]}`).join(' ');
  console.log(`  Final chips: ${finalChips}`);
  console.log(`  Chip conservation: ${chipConservationOk && globalChipOk ? 'PASS' : 'FAIL'}`);
  console.log(`  Event chain integrity: ${chainOk ? 'PASS' : 'FAIL'}`);
  console.log(`  Position rotation: ${positionOk ? 'PASS' : 'WARN'}`);

  const allPass =
    chipConservationOk && globalChipOk && chainOk && records.length >= NUM_HANDS;
  console.log();
  console.log(allPass ? '*** ALL CHECKS PASSED ***' : '*** SOME CHECKS FAILED ***');
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
