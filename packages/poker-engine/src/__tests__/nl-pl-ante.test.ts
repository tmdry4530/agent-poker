import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  applyAction,
  getLegalActions,
  getLegalActionRanges,
  createSeededRng,
  ActionType,
  BettingMode,
  DEFAULT_NL_CONFIG,
  DEFAULT_PL_CONFIG,
  DEFAULT_CONFIG,
  type GameConfig,
  type GameState,
  type PlayerSetup,
  Street,
  PokerErrorCode,
} from '../index.js';

// ── Helpers ──────────────────────────────────────────────────

function twoPlayerSetup(chips1 = 100, chips2 = 100): PlayerSetup[] {
  return [
    { id: 'p0', seatIndex: 0, chips: chips1 },
    { id: 'p1', seatIndex: 1, chips: chips2 },
  ];
}

function threePlayerSetup(c1 = 200, c2 = 200, c3 = 200): PlayerSetup[] {
  return [
    { id: 'p0', seatIndex: 0, chips: c1 },
    { id: 'p1', seatIndex: 1, chips: c2 },
    { id: 'p2', seatIndex: 2, chips: c3 },
  ];
}

function getActiveId(state: GameState): string {
  return state.players.find((p) => p.seatIndex === state.activePlayerSeatIndex)!.id;
}

function totalChips(state: GameState): number {
  return (
    state.players.reduce((sum, p) => sum + p.chips, 0) +
    state.pots.reduce((sum, pot) => sum + pot.amount, 0)
  );
}

// ── No-Limit Tests ──────────────────────────────────────────

describe('No-Limit Hold\'em', () => {
  const rng = () => createSeededRng(42);

  describe('getLegalActions', () => {
    it('allows BET with any chips in NL', () => {
      const { state } = createInitialState('nl-1', twoPlayerSetup(), 0, rng(), DEFAULT_NL_CONFIG);
      // HU: p0 is BTN/SB and acts first preflop
      const actions = getLegalActions(state);
      expect(actions).toContain('CALL' as ActionType);
      expect(actions).toContain('RAISE' as ActionType);
      expect(actions).toContain('FOLD' as ActionType);
    });

    it('unlimited raises in NL (maxRaisesPerStreet=0)', () => {
      let { state } = createInitialState('nl-2', twoPlayerSetup(1000, 1000), 0, rng(), DEFAULT_NL_CONFIG);
      // p0 (BTN/SB) acts first in HU
      let activeId = getActiveId(state);

      // Do many raises
      for (let i = 0; i < 10; i++) {
        const actions = getLegalActions(state);
        expect(actions).toContain('RAISE' as ActionType);
        const ranges = getLegalActionRanges(state);
        const result = applyAction(state, activeId, { type: 'RAISE' as ActionType, amount: ranges.minRaise });
        state = result.state;
        activeId = getActiveId(state);
      }
      // Should still have RAISE available after 10 raises
      const actions = getLegalActions(state);
      expect(actions).toContain('RAISE' as ActionType);
    });
  });

  describe('getLegalActionRanges', () => {
    it('returns correct NL ranges for initial state', () => {
      const { state } = createInitialState('nl-3', twoPlayerSetup(), 0, rng(), DEFAULT_NL_CONFIG);
      const ranges = getLegalActionRanges(state);
      // HU: p0 is BTN/SB, needs to call 1 (BB is 2, SB is 1)
      // Min raise = toCall + max(lastRaiseSize, bigBlind) = 1 + 2 = 3
      // But capped at player.chips
      expect(ranges.minRaise).toBeGreaterThanOrEqual(2);
      expect(ranges.maxRaise).toBeLessThanOrEqual(99); // 100 - 1 (SB)
    });

    it('min raise tracks last raise size', () => {
      let { state } = createInitialState('nl-4', twoPlayerSetup(500, 500), 0, rng(), DEFAULT_NL_CONFIG);

      // p0 (BTN/SB) raises to 10 total (call 1 + raise 9 = amount 10)
      let result = applyAction(state, getActiveId(state), { type: 'RAISE' as ActionType, amount: 10 });
      state = result.state;

      // p1 (BB) should have min raise = toCall + lastRaiseSize
      const ranges = getLegalActionRanges(state);
      // p0 currentBet = 1(SB) + 10 = 11, p1 currentBet = 2(BB)
      // toCall = 11 - 2 = 9, lastRaiseSize = 10 - toCall = 10 - 1 = 9...
      // Actually: action.amount = 10 is total chips put in. raiseIncrement = 10 - 1 = 9
      // So minRaise = toCall(9) + max(9, 2) = 9 + 9 = 18
      expect(ranges.minRaise).toBe(18);
    });
  });

  describe('applyAction BET/RAISE validation', () => {
    it('rejects NL BET below minimum', () => {
      // Get to a postflop state where BET is available
      let { state } = createInitialState('nl-5', twoPlayerSetup(), 0, rng(), DEFAULT_NL_CONFIG);

      // p0 calls
      let result = applyAction(state, getActiveId(state), { type: 'CALL' as ActionType });
      state = result.state;

      // p1 checks
      result = applyAction(state, getActiveId(state), { type: 'CHECK' as ActionType });
      state = result.state;

      // Now on flop, first player can BET
      if (state.isHandComplete) return; // edge case: may end on all-in
      const actions = getLegalActions(state);
      if (!actions.includes('BET' as ActionType)) return;

      const ranges = getLegalActionRanges(state);
      expect(() => {
        applyAction(state, getActiveId(state), { type: 'BET' as ActionType, amount: 0 });
      }).toThrow();
    });

    it('allows NL all-in BET', () => {
      let { state } = createInitialState('nl-6', twoPlayerSetup(10, 10), 0, rng(), DEFAULT_NL_CONFIG);

      // p0 calls (HU: BTN/SB acts first)
      let result = applyAction(state, getActiveId(state), { type: 'CALL' as ActionType });
      state = result.state;

      // p1 checks
      result = applyAction(state, getActiveId(state), { type: 'CHECK' as ActionType });
      state = result.state;

      // Flop: first player bets all-in
      if (state.isHandComplete) return;
      const actions = getLegalActions(state);
      if (!actions.includes('BET' as ActionType)) return;

      const activeId = getActiveId(state);
      const player = state.players.find((p) => p.id === activeId)!;
      result = applyAction(state, activeId, { type: 'BET' as ActionType, amount: player.chips });
      expect(result.state.players.find((p) => p.id === activeId)!.isAllIn).toBe(true);
    });

    it('rejects NL RAISE below minimum', () => {
      const { state } = createInitialState('nl-7', twoPlayerSetup(500, 500), 0, rng(), DEFAULT_NL_CONFIG);

      // p0 tries to raise with too small amount
      expect(() => {
        applyAction(state, getActiveId(state), { type: 'RAISE' as ActionType, amount: 1 });
      }).toThrow();
    });

    it('allows NL all-in RAISE even if below min raise', () => {
      // Player with just barely enough to raise should be able to go all-in
      const config: GameConfig = { ...DEFAULT_NL_CONFIG, smallBlind: 5, bigBlind: 10 };
      const { state } = createInitialState('nl-8', twoPlayerSetup(15, 100), 0, rng(), config);

      // p0 (BTN/SB with 15 chips) posted SB=5, has 10 left
      // needs to call 5 more. Can go all-in for 10 (call 5 + raise 5)
      // Even though min raise increment would be 10, all-in is always allowed
      const ranges = getLegalActionRanges(state);
      expect(ranges.maxRaise).toBe(10); // all chips left
    });
  });

  describe('chip conservation in NL', () => {
    it('chips are conserved through a full NL hand', () => {
      const players = twoPlayerSetup(100, 100);
      const initialChips = players.reduce((s, p) => s + p.chips, 0);
      let { state } = createInitialState('nl-9', players, 0, rng(), DEFAULT_NL_CONFIG);

      expect(totalChips(state)).toBe(initialChips);

      // Play through: p0 raises, p1 calls
      let result = applyAction(state, getActiveId(state), { type: 'RAISE' as ActionType, amount: 6 });
      state = result.state;
      expect(totalChips(state)).toBe(initialChips);

      result = applyAction(state, getActiveId(state), { type: 'CALL' as ActionType });
      state = result.state;
      expect(totalChips(state)).toBe(initialChips);

      // Continue checking through streets
      while (!state.isHandComplete) {
        const actions = getLegalActions(state);
        if (actions.length === 0) break;
        result = applyAction(state, getActiveId(state), { type: 'CHECK' as ActionType });
        state = result.state;
        expect(totalChips(state)).toBe(initialChips);
      }

      expect(totalChips(state)).toBe(initialChips);
    });
  });
});

// ── Pot-Limit Tests ─────────────────────────────────────────

describe('Pot-Limit Hold\'em', () => {
  const rng = () => createSeededRng(99);

  describe('getLegalActionRanges', () => {
    it('max bet equals pot size', () => {
      const config: GameConfig = { ...DEFAULT_PL_CONFIG, smallBlind: 1, bigBlind: 2 };
      const { state } = createInitialState('pl-1', twoPlayerSetup(100, 100), 0, rng(), config);
      // HU: p0 is BTN/SB (1), p1 is BB (2). Pot = 3.
      // p0 acts first, toCall = 2 - 1 = 1
      const ranges = getLegalActionRanges(state);
      // For RAISE: toCall=1, potAfterCall = 3+1=4, maxRaise = 1+4=5
      expect(ranges.maxRaise).toBe(5);
    });

    it('pot-limit BET is capped by pot', () => {
      let { state } = createInitialState('pl-2', twoPlayerSetup(500, 500), 0, rng(), DEFAULT_PL_CONFIG);

      // p0 calls, p1 checks to get to flop
      let result = applyAction(state, getActiveId(state), { type: 'CALL' as ActionType });
      state = result.state;
      result = applyAction(state, getActiveId(state), { type: 'CHECK' as ActionType });
      state = result.state;

      if (state.isHandComplete) return;

      const actions = getLegalActions(state);
      if (!actions.includes('BET' as ActionType)) return;

      const ranges = getLegalActionRanges(state);
      const pot = state.pots.reduce((s, p) => s + p.amount, 0);
      // Max BET = pot
      expect(ranges.maxBet).toBe(pot);
    });
  });

  describe('applyAction validation', () => {
    it('rejects PL bet above pot', () => {
      let { state } = createInitialState('pl-3', twoPlayerSetup(500, 500), 0, rng(), DEFAULT_PL_CONFIG);

      // p0 calls, p1 checks
      let result = applyAction(state, getActiveId(state), { type: 'CALL' as ActionType });
      state = result.state;
      result = applyAction(state, getActiveId(state), { type: 'CHECK' as ActionType });
      state = result.state;

      if (state.isHandComplete) return;

      const actions = getLegalActions(state);
      if (!actions.includes('BET' as ActionType)) return;

      const ranges = getLegalActionRanges(state);
      // Bet above pot max should throw
      expect(() => {
        applyAction(state, getActiveId(state), {
          type: 'BET' as ActionType,
          amount: ranges.maxBet + 1,
        });
      }).toThrow();
    });

    it('allows pot-sized bet', () => {
      let { state } = createInitialState('pl-4', twoPlayerSetup(500, 500), 0, rng(), DEFAULT_PL_CONFIG);

      // p0 calls, p1 checks
      let result = applyAction(state, getActiveId(state), { type: 'CALL' as ActionType });
      state = result.state;
      result = applyAction(state, getActiveId(state), { type: 'CHECK' as ActionType });
      state = result.state;

      if (state.isHandComplete) return;

      const actions = getLegalActions(state);
      if (!actions.includes('BET' as ActionType)) return;

      const ranges = getLegalActionRanges(state);
      // Should not throw
      result = applyAction(state, getActiveId(state), {
        type: 'BET' as ActionType,
        amount: ranges.maxBet,
      });
      expect(result.state).toBeDefined();
    });
  });

  describe('chip conservation in PL', () => {
    it('chips are conserved through a PL hand', () => {
      const players = threePlayerSetup();
      const initialChips = players.reduce((s, p) => s + p.chips, 0);
      let { state } = createInitialState('pl-5', players, 0, rng(), DEFAULT_PL_CONFIG);

      expect(totalChips(state)).toBe(initialChips);

      // Play to completion with random legal actions
      const localRng = createSeededRng(77);
      let count = 0;
      while (!state.isHandComplete && count < 100) {
        const actions = getLegalActions(state);
        if (actions.length === 0) break;
        const action = actions[Math.floor(localRng() * actions.length)]!;
        const result = applyAction(state, getActiveId(state), { type: action });
        state = result.state;
        expect(totalChips(state)).toBe(initialChips);
        count++;
      }
    });
  });
});

// ── Ante Tests ──────────────────────────────────────────────

describe('Ante support', () => {
  const rng = () => createSeededRng(123);

  it('collects antes from all players', () => {
    const config: GameConfig = { ...DEFAULT_CONFIG, ante: 1 };
    const players = threePlayerSetup(100, 100, 100);
    const { state, events } = createInitialState('ante-1', players, 0, rng(), config);

    // Check that ANTES_POSTED event was emitted
    const anteEvent = events.find((e) => e.type === 'ANTES_POSTED');
    expect(anteEvent).toBeDefined();
    expect((anteEvent!.payload as any).totalAnte).toBe(3); // 3 players * 1

    // Pot should include antes + blinds
    const totalAntes = 3;
    const totalBlinds = state.players
      .filter((p) => p.currentBet > 0)
      .reduce((s, p) => s + p.currentBet, 0);
    expect(state.pots[0]!.amount).toBe(totalAntes + totalBlinds);
  });

  it('handles player with fewer chips than ante', () => {
    const config: GameConfig = { ...DEFAULT_CONFIG, ante: 5 };
    const players: PlayerSetup[] = [
      { id: 'p0', seatIndex: 0, chips: 100 },
      { id: 'p1', seatIndex: 1, chips: 3 }, // less than ante
      { id: 'p2', seatIndex: 2, chips: 100 },
    ];
    const { state } = createInitialState('ante-2', players, 0, rng(), config);

    // p1 should have posted only 3 (all chips) as ante
    const p1 = state.players.find((p) => p.id === 'p1')!;
    expect(p1.totalBetThisHand).toBe(3);
    expect(p1.chips).toBe(0);
    expect(p1.isAllIn).toBe(true);
  });

  it('no ante event when ante is 0', () => {
    const { events } = createInitialState('ante-3', twoPlayerSetup(), 0, rng(), DEFAULT_CONFIG);
    const anteEvent = events.find((e) => e.type === 'ANTES_POSTED');
    expect(anteEvent).toBeUndefined();
  });

  it('chip conservation with antes', () => {
    const config: GameConfig = { ...DEFAULT_CONFIG, ante: 2 };
    const players = threePlayerSetup(100, 100, 100);
    const initialChips = 300;
    let { state } = createInitialState('ante-4', players, 0, rng(), config);

    expect(totalChips(state)).toBe(initialChips);

    // Play to completion
    const localRng = createSeededRng(55);
    let count = 0;
    while (!state.isHandComplete && count < 100) {
      const actions = getLegalActions(state);
      if (actions.length === 0) break;
      const action = actions[Math.floor(localRng() * actions.length)]!;
      const result = applyAction(state, getActiveId(state), { type: action });
      state = result.state;
      expect(totalChips(state)).toBe(initialChips);
      count++;
    }

    expect(totalChips(state)).toBe(initialChips);
  });

  it('ante with NL config', () => {
    const config: GameConfig = { ...DEFAULT_NL_CONFIG, ante: 1 };
    const players = twoPlayerSetup(100, 100);
    const { state, events } = createInitialState('ante-5', players, 0, rng(), config);

    const anteEvent = events.find((e) => e.type === 'ANTES_POSTED');
    expect(anteEvent).toBeDefined();
    expect(totalChips(state)).toBe(200);
  });
});

// ── Limit backward compatibility ────────────────────────────

describe('Limit backward compatibility', () => {
  const rng = () => createSeededRng(7);

  it('DEFAULT_CONFIG still works with bettingMode LIMIT', () => {
    expect(DEFAULT_CONFIG.bettingMode).toBe(BettingMode.LIMIT);
    const { state } = createInitialState('limit-1', twoPlayerSetup(), 0, rng(), DEFAULT_CONFIG);
    expect(state.config.bettingMode).toBe(BettingMode.LIMIT);
  });

  it('getLegalActionRanges returns fixed sizes for Limit', () => {
    const { state } = createInitialState('limit-2', twoPlayerSetup(), 0, rng(), DEFAULT_CONFIG);
    const ranges = getLegalActionRanges(state);
    // Preflop: smallBet = 2
    expect(ranges.minBet).toBe(2);
    expect(ranges.maxBet).toBe(2);
  });

  it('Limit BET ignores action.amount', () => {
    let { state } = createInitialState('limit-3', twoPlayerSetup(), 0, rng(), DEFAULT_CONFIG);

    // p0 calls
    let result = applyAction(state, getActiveId(state), { type: 'CALL' as ActionType });
    state = result.state;

    // p1 checks
    result = applyAction(state, getActiveId(state), { type: 'CHECK' as ActionType });
    state = result.state;

    if (state.isHandComplete) return;

    const actions = getLegalActions(state);
    if (!actions.includes('BET' as ActionType)) return;

    // Even if amount is specified, Limit uses fixed betSize
    result = applyAction(state, getActiveId(state), { type: 'BET' as ActionType, amount: 999 });
    // The actual bet should be smallBet (2), not 999
    const betEvent = result.events.find(
      (e) => (e.payload as any).action === 'BET',
    );
    expect((betEvent!.payload as any).amount).toBe(2);
  });

  it('raise cap enforced in Limit', () => {
    const config: GameConfig = { ...DEFAULT_CONFIG, maxRaisesPerStreet: 2 };
    let { state } = createInitialState('limit-4', twoPlayerSetup(100, 100), 0, rng(), config);

    // betsThisStreet starts at 1 (BB). maxRaisesPerStreet=2.
    // p0 raises (betsThisStreet -> 2 = cap)
    let result = applyAction(state, getActiveId(state), { type: 'RAISE' as ActionType });
    state = result.state;

    // p1 should NOT be able to raise (cap reached)
    const actions = getLegalActions(state);
    expect(actions).not.toContain('RAISE' as ActionType);
    expect(actions).toContain('CALL' as ActionType);
  });
});
