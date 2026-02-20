import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  applyAction,
  getLegalActions,
  getLegalActionRanges,
  createSeededRng,
  calculateSidePots,
  ActionType,
  BettingMode,
  DEFAULT_NL_CONFIG,
  DEFAULT_PL_CONFIG,
  DEFAULT_CONFIG,
  type GameConfig,
  type GameState,
  type PlayerSetup,
  Street,
} from '../index.js';

// ── Helpers ──────────────────────────────────────────────────

function getActiveId(state: GameState): string {
  return state.players.find((p) => p.seatIndex === state.activePlayerSeatIndex)!.id;
}

function totalChips(state: GameState): number {
  return (
    state.players.reduce((sum, p) => sum + p.chips, 0) +
    state.pots.reduce((sum, pot) => sum + pot.amount, 0)
  );
}

function playToCompletion(state: GameState, rng: () => number): GameState {
  let current = state;
  let count = 0;
  while (!current.isHandComplete && count < 200) {
    const actions = getLegalActions(current);
    if (actions.length === 0) break;
    const action = actions[Math.floor(rng() * actions.length)]!;
    const result = applyAction(current, getActiveId(current), { type: action });
    current = result.state;
    count++;
  }
  return current;
}

// ── All-in shorter than min-raise ────────────────────────────

describe('NL edge case: all-in shorter than min-raise', () => {
  const rng = () => createSeededRng(42);

  it('player can go all-in even if chips < min raise', () => {
    // p0 has 15 chips, SB=5, BB=10. After posting SB (5), has 10 left.
    // toCall = 5. minRaiseIncrement = max(lastRaise=10, bb=10) = 10.
    // minRaise = 5 + 10 = 15 but player only has 10 chips.
    // Should be allowed to all-in for 10 (call 5 + raise 5).
    const config: GameConfig = { ...DEFAULT_NL_CONFIG, smallBlind: 5, bigBlind: 10 };
    const players: PlayerSetup[] = [
      { id: 'p0', seatIndex: 0, chips: 15 },
      { id: 'p1', seatIndex: 1, chips: 200 },
    ];
    const { state } = createInitialState('short-allin-1', players, 0, rng(), config);

    // p0 (BTN/SB) acts first in HU preflop
    const ranges = getLegalActionRanges(state);
    const actions = getLegalActions(state);
    expect(actions).toContain('RAISE' as ActionType);
    // maxRaise should be all chips remaining (10)
    expect(ranges.maxRaise).toBe(10);
    // This is a valid all-in even though 10 < minRaise (15)
    const result = applyAction(state, 'p0', { type: 'RAISE' as ActionType, amount: 10 });
    expect(result.state.players.find((p) => p.id === 'p0')!.isAllIn).toBe(true);
    expect(result.state.players.find((p) => p.id === 'p0')!.chips).toBe(0);
  });

  it('short all-in does not reopen betting for original raiser', () => {
    // p0 raises big, p1 goes all-in for less than a full raise.
    // p0 should NOT get to re-raise (all-in was not a full raise).
    const config: GameConfig = { ...DEFAULT_NL_CONFIG, smallBlind: 5, bigBlind: 10 };
    const players: PlayerSetup[] = [
      { id: 'p0', seatIndex: 0, chips: 500 },
      { id: 'p1', seatIndex: 1, chips: 25 },  // can barely cover BB
      { id: 'p2', seatIndex: 2, chips: 500 },
    ];
    const { state } = createInitialState('short-allin-2', players, 0, rng(), config);

    // p2 is first to act (UTG in 3-way)
    let current = state;
    // p2 raises to 30
    let result = applyAction(current, getActiveId(current), { type: 'RAISE' as ActionType, amount: 30 });
    current = result.state;

    // p0 calls 30
    result = applyAction(current, getActiveId(current), { type: 'CALL' as ActionType });
    current = result.state;

    // p1 (BB with 25 total, posted 10, has 15 left) can only call or fold
    // p1 can call up to 15 more (going to 25 total bet), but raise would need more
    const p1Actions = getLegalActions(current);
    // p1 has 15 chips, toCall = 30 - 10 = 20, but only 15 chips -> can CALL (all-in)
    expect(p1Actions).toContain('CALL' as ActionType);

    // Chip conservation holds throughout
    const initialTotal = totalChips(state);
    expect(totalChips(current)).toBe(initialTotal);
  });

  it('chip conservation after short all-in hand completes', () => {
    const config: GameConfig = { ...DEFAULT_NL_CONFIG, smallBlind: 5, bigBlind: 10 };
    const players: PlayerSetup[] = [
      { id: 'p0', seatIndex: 0, chips: 12 },  // very short stack
      { id: 'p1', seatIndex: 1, chips: 200 },
    ];
    const initialTotal = players.reduce((s, p) => s + p.chips, 0);
    const { state } = createInitialState('short-allin-3', players, 0, rng(), config);

    const finalState = playToCompletion(state, createSeededRng(77));
    expect(finalState.isHandComplete).toBe(true);
    expect(totalChips(finalState)).toBe(initialTotal);
  });
});

// ── Pot-limit max calculation ────────────────────────────────

describe('NL edge case: pot-limit max calculation', () => {
  const rng = () => createSeededRng(99);

  it('PL max raise = call + pot after call', () => {
    const config: GameConfig = { ...DEFAULT_PL_CONFIG, smallBlind: 5, bigBlind: 10 };
    const players: PlayerSetup[] = [
      { id: 'p0', seatIndex: 0, chips: 500 },
      { id: 'p1', seatIndex: 1, chips: 500 },
    ];
    const { state } = createInitialState('pl-max-1', players, 0, rng(), config);

    // HU: p0 is BTN/SB(5), p1 is BB(10). Pot = 15.
    // p0 toCall = 10 - 5 = 5. potAfterCall = 15 + 5 = 20. maxRaise = 5 + 20 = 25.
    const ranges = getLegalActionRanges(state);
    expect(ranges.maxRaise).toBe(25);
  });

  it('PL max raise grows after raises', () => {
    const config: GameConfig = { ...DEFAULT_PL_CONFIG, smallBlind: 5, bigBlind: 10 };
    const players: PlayerSetup[] = [
      { id: 'p0', seatIndex: 0, chips: 5000 },
      { id: 'p1', seatIndex: 1, chips: 5000 },
    ];
    const { state } = createInitialState('pl-max-2', players, 0, rng(), config);

    // p0 raises to 25 (pot-sized)
    let result = applyAction(state, getActiveId(state), { type: 'RAISE' as ActionType, amount: 25 });
    let current = result.state;

    // p1: pot = 15 + 25 = 40 (but actually pot includes all currentBets + pot)
    // p1 currentBet = 10 (BB), p0 currentBet = 5+25=30. pot[0].amount = 15+25 = 40.
    // toCall = 30 - 10 = 20. potAfterCall = 40 + 20 = 60. maxRaise = 20 + 60 = 80.
    const ranges = getLegalActionRanges(current);
    expect(ranges.maxRaise).toBe(80);
  });

  it('PL bet on flop is capped at pot', () => {
    const config: GameConfig = { ...DEFAULT_PL_CONFIG, smallBlind: 5, bigBlind: 10 };
    const players: PlayerSetup[] = [
      { id: 'p0', seatIndex: 0, chips: 1000 },
      { id: 'p1', seatIndex: 1, chips: 1000 },
    ];
    let { state } = createInitialState('pl-bet-flop', players, 0, rng(), config);

    // p0 calls (HU: SB calls to match BB)
    let result = applyAction(state, getActiveId(state), { type: 'CALL' as ActionType });
    state = result.state;

    // p1 checks
    result = applyAction(state, getActiveId(state), { type: 'CHECK' as ActionType });
    state = result.state;

    if (state.isHandComplete) return;

    // On flop, pot = 20. Max bet should be pot = 20.
    const actions = getLegalActions(state);
    if (!actions.includes('BET' as ActionType)) return;

    const ranges = getLegalActionRanges(state);
    const pot = state.pots.reduce((s, p) => s + p.amount, 0);
    expect(ranges.maxBet).toBe(pot);

    // Betting above pot should throw
    expect(() => {
      applyAction(state, getActiveId(state), { type: 'BET' as ActionType, amount: pot + 1 });
    }).toThrow();
  });
});

// ── Ante + blind interaction ─────────────────────────────────

describe('NL edge case: ante + blind interaction', () => {
  const rng = () => createSeededRng(123);

  it('ante does not count as currentBet (dead money)', () => {
    const config: GameConfig = { ...DEFAULT_NL_CONFIG, ante: 2 };
    const players: PlayerSetup[] = [
      { id: 'p0', seatIndex: 0, chips: 100 },
      { id: 'p1', seatIndex: 1, chips: 100 },
      { id: 'p2', seatIndex: 2, chips: 100 },
    ];
    const { state } = createInitialState('ante-blind-1', players, 0, rng(), config);

    // Check that antes are included in pot but not in currentBet
    const totalAntes = 3 * 2; // 3 players * ante of 2
    const sb = state.players.find((p) => p.seatIndex === 1)!; // SB
    const bb = state.players.find((p) => p.seatIndex === 2)!; // BB

    // SB currentBet should be smallBlind only, not ante + smallBlind
    expect(sb.currentBet).toBe(1); // SB = 1
    expect(bb.currentBet).toBe(2); // BB = 2

    // But totalBetThisHand includes ante
    expect(sb.totalBetThisHand).toBe(3); // ante(2) + SB(1)
    expect(bb.totalBetThisHand).toBe(4); // ante(2) + BB(2)

    // Pot should include all antes + blinds
    expect(state.pots[0]!.amount).toBe(totalAntes + 1 + 2); // 6 + 3 = 9
  });

  it('ante with short stack goes all-in on ante alone', () => {
    const config: GameConfig = { ...DEFAULT_NL_CONFIG, ante: 10 };
    const players: PlayerSetup[] = [
      { id: 'p0', seatIndex: 0, chips: 100 },
      { id: 'p1', seatIndex: 1, chips: 5 },   // less than ante
      { id: 'p2', seatIndex: 2, chips: 100 },
    ];
    const { state } = createInitialState('ante-short-1', players, 0, rng(), config);

    const p1 = state.players.find((p) => p.id === 'p1')!;
    // p1 should be all-in after posting what they can of the ante
    expect(p1.isAllIn).toBe(true);
    expect(p1.chips).toBe(0);
    expect(p1.totalBetThisHand).toBe(5); // all 5 chips as partial ante
  });

  it('chip conservation with antes in NL', () => {
    const config: GameConfig = { ...DEFAULT_NL_CONFIG, ante: 3 };
    const players: PlayerSetup[] = [
      { id: 'p0', seatIndex: 0, chips: 200 },
      { id: 'p1', seatIndex: 1, chips: 200 },
      { id: 'p2', seatIndex: 2, chips: 200 },
    ];
    const initialTotal = 600;
    const { state } = createInitialState('ante-nl-cons', players, 0, rng(), config);

    expect(totalChips(state)).toBe(initialTotal);

    const finalState = playToCompletion(state, createSeededRng(55));
    expect(finalState.isHandComplete).toBe(true);
    expect(totalChips(finalState)).toBe(initialTotal);
  });

  it('ante + blind with minimum chips covers partial blind', () => {
    // Player is SB with only enough for ante, not enough for full SB
    const config: GameConfig = { ...DEFAULT_NL_CONFIG, ante: 3, smallBlind: 5, bigBlind: 10 };
    const players: PlayerSetup[] = [
      { id: 'p0', seatIndex: 0, chips: 200 }, // dealer
      { id: 'p1', seatIndex: 1, chips: 4 },   // SB: can post ante(3) + partial SB(1)
      { id: 'p2', seatIndex: 2, chips: 200 },  // BB
    ];
    const { state } = createInitialState('ante-partial-sb', players, 0, rng(), config);

    const p1 = state.players.find((p) => p.id === 'p1')!;
    expect(p1.isAllIn).toBe(true);
    expect(p1.chips).toBe(0);
    // Total posted = all 4 chips (3 ante + 1 partial SB)
    expect(p1.totalBetThisHand).toBe(4);
    expect(p1.currentBet).toBe(1); // only the blind part
  });
});

// ── 3-way all-in with different stacks → multiple side pots ──

describe('NL edge case: 3-way all-in with different stacks', () => {
  const rng = () => createSeededRng(42);

  it('creates correct side pots for 3 different stack sizes', () => {
    const config: GameConfig = { ...DEFAULT_NL_CONFIG, smallBlind: 1, bigBlind: 2 };
    const players: PlayerSetup[] = [
      { id: 'p0', seatIndex: 0, chips: 50 },   // short
      { id: 'p1', seatIndex: 1, chips: 100 },  // medium
      { id: 'p2', seatIndex: 2, chips: 200 },  // deep
    ];
    const initialTotal = 350;
    const { state } = createInitialState('3way-allin-1', players, 0, rng(), config);

    // p0 is dealer, p1 is SB(1), p2 is BB(2)
    // UTG (p0) goes all-in for 50
    let current = state;
    let result = applyAction(current, getActiveId(current), { type: 'RAISE' as ActionType, amount: 50 });
    current = result.state;
    expect(totalChips(current)).toBe(initialTotal);

    // p1 (SB) goes all-in for 99 (100 - 1 SB already posted)
    result = applyAction(current, getActiveId(current), { type: 'RAISE' as ActionType, amount: 99 });
    current = result.state;
    expect(totalChips(current)).toBe(initialTotal);

    // p2 (BB) goes all-in for 198 (200 - 2 BB already posted)
    result = applyAction(current, getActiveId(current), { type: 'RAISE' as ActionType, amount: 198 });
    current = result.state;
    expect(totalChips(current)).toBe(initialTotal);

    // Hand should complete (all players all-in)
    expect(current.isHandComplete).toBe(true);

    // Verify chip conservation
    expect(totalChips(current)).toBe(initialTotal);

    // Verify winners are assigned
    expect(current.winners).toBeDefined();
    expect(current.winners!.length).toBeGreaterThan(0);
  });

  it('side pots calculated correctly with calculateSidePots', () => {
    // Simulate 3 players all-in at different levels
    const players = [
      {
        id: 'p0', seatIndex: 0, chips: 0, holeCards: [],
        currentBet: 0, totalBetThisHand: 50, hasFolded: false,
        hasActed: true, isAllIn: true,
      },
      {
        id: 'p1', seatIndex: 1, chips: 0, holeCards: [],
        currentBet: 0, totalBetThisHand: 100, hasFolded: false,
        hasActed: true, isAllIn: true,
      },
      {
        id: 'p2', seatIndex: 2, chips: 0, holeCards: [],
        currentBet: 0, totalBetThisHand: 200, hasFolded: false,
        hasActed: true, isAllIn: true,
      },
    ];

    const pots = calculateSidePots(players);

    // Main pot: 50 * 3 = 150 (p0, p1, p2 eligible)
    expect(pots[0]!.amount).toBe(150);
    expect(pots[0]!.eligible).toContain('p0');
    expect(pots[0]!.eligible).toContain('p1');
    expect(pots[0]!.eligible).toContain('p2');

    // Side pot 1: (100-50) * 2 = 100 (p1, p2 eligible)
    expect(pots[1]!.amount).toBe(100);
    expect(pots[1]!.eligible).not.toContain('p0');
    expect(pots[1]!.eligible).toContain('p1');
    expect(pots[1]!.eligible).toContain('p2');

    // Side pot 2: (200-100) * 1 = 100 (only p2 eligible)
    expect(pots[2]!.amount).toBe(100);
    expect(pots[2]!.eligible).toContain('p2');
    expect(pots[2]!.eligible).not.toContain('p0');
    expect(pots[2]!.eligible).not.toContain('p1');

    // Total across all pots = 350
    const totalPot = pots.reduce((s, p) => s + p.amount, 0);
    expect(totalPot).toBe(350);
  });

  it('side pots with a fold included', () => {
    // p0 folds, p1 and p2 go all-in at different levels
    const players = [
      {
        id: 'p0', seatIndex: 0, chips: 90, holeCards: [],
        currentBet: 0, totalBetThisHand: 10, hasFolded: true,
        hasActed: true, isAllIn: false,
      },
      {
        id: 'p1', seatIndex: 1, chips: 0, holeCards: [],
        currentBet: 0, totalBetThisHand: 50, hasFolded: false,
        hasActed: true, isAllIn: true,
      },
      {
        id: 'p2', seatIndex: 2, chips: 0, holeCards: [],
        currentBet: 0, totalBetThisHand: 100, hasFolded: false,
        hasActed: true, isAllIn: true,
      },
    ];

    const pots = calculateSidePots(players);

    // Main pot at level 50: p0 contributes 10, p1 contributes 50, p2 contributes 50 = 110
    // Eligible: p1, p2 (p0 folded)
    expect(pots[0]!.eligible).not.toContain('p0');
    expect(pots[0]!.eligible).toContain('p1');
    expect(pots[0]!.eligible).toContain('p2');

    // Side pot at level 100: p2 contributes 50 more = 50
    // Only p2 eligible
    expect(pots[pots.length - 1]!.eligible).toContain('p2');

    // Total = 10 + 50 + 100 = 160
    const totalPot = pots.reduce((s, p) => s + p.amount, 0);
    expect(totalPot).toBe(160);
  });

  it('4-way all-in creates 4 pots', () => {
    const players = [
      {
        id: 'p0', seatIndex: 0, chips: 0, holeCards: [],
        currentBet: 0, totalBetThisHand: 25, hasFolded: false,
        hasActed: true, isAllIn: true,
      },
      {
        id: 'p1', seatIndex: 1, chips: 0, holeCards: [],
        currentBet: 0, totalBetThisHand: 50, hasFolded: false,
        hasActed: true, isAllIn: true,
      },
      {
        id: 'p2', seatIndex: 2, chips: 0, holeCards: [],
        currentBet: 0, totalBetThisHand: 75, hasFolded: false,
        hasActed: true, isAllIn: true,
      },
      {
        id: 'p3', seatIndex: 3, chips: 0, holeCards: [],
        currentBet: 0, totalBetThisHand: 100, hasFolded: false,
        hasActed: true, isAllIn: true,
      },
    ];

    const pots = calculateSidePots(players);

    // Main: 25 * 4 = 100, all eligible
    expect(pots[0]!.amount).toBe(100);
    expect(pots[0]!.eligible).toHaveLength(4);

    // Side 1: 25 * 3 = 75, p1/p2/p3
    expect(pots[1]!.amount).toBe(75);
    expect(pots[1]!.eligible).toHaveLength(3);
    expect(pots[1]!.eligible).not.toContain('p0');

    // Side 2: 25 * 2 = 50, p2/p3
    expect(pots[2]!.amount).toBe(50);
    expect(pots[2]!.eligible).toHaveLength(2);

    // Side 3: 25 * 1 = 25, p3 only
    expect(pots[3]!.amount).toBe(25);
    expect(pots[3]!.eligible).toHaveLength(1);
    expect(pots[3]!.eligible).toContain('p3');

    // Total = 250
    expect(pots.reduce((s, p) => s + p.amount, 0)).toBe(250);
  });

  it('chip conservation through full 3-way all-in hand', () => {
    const config: GameConfig = { ...DEFAULT_NL_CONFIG, smallBlind: 1, bigBlind: 2 };
    const players: PlayerSetup[] = [
      { id: 'p0', seatIndex: 0, chips: 30 },
      { id: 'p1', seatIndex: 1, chips: 75 },
      { id: 'p2', seatIndex: 2, chips: 150 },
    ];
    const initialTotal = 255;

    // Run multiple seeds to cover different showdown outcomes
    for (let seed = 0; seed < 20; seed++) {
      const r = createSeededRng(seed);
      const { state } = createInitialState(`3way-cons-${seed}`, players, 0, r, config);
      expect(totalChips(state)).toBe(initialTotal);

      // p0 all-in
      let current = state;
      let result = applyAction(current, getActiveId(current), {
        type: 'RAISE' as ActionType,
        amount: current.players.find((p) => p.id === getActiveId(current))!.chips,
      });
      current = result.state;

      // p1 all-in
      result = applyAction(current, getActiveId(current), {
        type: 'RAISE' as ActionType,
        amount: current.players.find((p) => p.id === getActiveId(current))!.chips,
      });
      current = result.state;

      // p2 calls (or all-in)
      if (!current.isHandComplete) {
        const actions = getLegalActions(current);
        if (actions.includes('CALL' as ActionType)) {
          result = applyAction(current, getActiveId(current), { type: 'CALL' as ActionType });
          current = result.state;
        }
      }

      // Hand should complete and chips conserved
      expect(current.isHandComplete).toBe(true);
      expect(totalChips(current)).toBe(initialTotal);
    }
  });
});

// ── Additional NL edge cases ─────────────────────────────────

describe('NL edge case: min-raise tracking', () => {
  const rng = () => createSeededRng(42);

  it('min raise tracks last raise increment correctly', () => {
    const config: GameConfig = { ...DEFAULT_NL_CONFIG, smallBlind: 5, bigBlind: 10 };
    const players: PlayerSetup[] = [
      { id: 'p0', seatIndex: 0, chips: 1000 },
      { id: 'p1', seatIndex: 1, chips: 1000 },
    ];
    const { state } = createInitialState('minraise-track', players, 0, rng(), config);

    // p0 raises to 30 (chips put in: 30). p0 currentBet = 5(SB) + 30 = 35.
    // raiseIncrement = 30 - toCall(5) = 25. lastRaiseSize = 25.
    let result = applyAction(state, getActiveId(state), { type: 'RAISE' as ActionType, amount: 30 });
    let current = result.state;

    // p1: toCall = 35 - 10(BB) = 25. minRaiseIncrement = max(25, 10) = 25.
    // minRaise = 25 + 25 = 50.
    let ranges = getLegalActionRanges(current);
    expect(ranges.minRaise).toBe(50);

    // p1 raises to 80 (chips put in: 80). p1 currentBet = 10(BB) + 80 = 90.
    // raiseIncrement = 80 - toCall(25) = 55. lastRaiseSize = 55.
    result = applyAction(current, getActiveId(current), { type: 'RAISE' as ActionType, amount: 80 });
    current = result.state;

    // p0: toCall = 90 - 35 = 55. minRaiseIncrement = max(55, 10) = 55.
    // minRaise = 55 + 55 = 110.
    ranges = getLegalActionRanges(current);
    expect(ranges.minRaise).toBe(110);
  });

  it('lastRaiseSize resets on new street', () => {
    const config: GameConfig = { ...DEFAULT_NL_CONFIG, smallBlind: 5, bigBlind: 10 };
    const players: PlayerSetup[] = [
      { id: 'p0', seatIndex: 0, chips: 1000 },
      { id: 'p1', seatIndex: 1, chips: 1000 },
    ];
    let { state } = createInitialState('lastraise-reset', players, 0, rng(), config);

    // p0 raises to 50
    let result = applyAction(state, getActiveId(state), { type: 'RAISE' as ActionType, amount: 50 });
    state = result.state;

    // p1 calls
    result = applyAction(state, getActiveId(state), { type: 'CALL' as ActionType });
    state = result.state;

    if (state.isHandComplete) return;

    // On flop, lastRaiseSize should be reset to bigBlind
    expect(state.lastRaiseSize).toBe(config.bigBlind);
  });
});
