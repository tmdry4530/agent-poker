import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  applyAction,
  getLegalActions,
  createSeededRng,
  ActionType,
  Street,
  PokerError,
  PokerErrorCode,
  DEFAULT_CONFIG,
  type PlayerSetup,
} from '../index.js';

function makeHand(seed = 42, chips0 = 100, chips1 = 100, dealerSeatIndex = 0) {
  const rng = createSeededRng(seed);
  const players: PlayerSetup[] = [
    { id: 'alice', seatIndex: 0, chips: chips0 },
    { id: 'bob', seatIndex: 1, chips: chips1 },
  ];
  return createInitialState('hand-1', players, dealerSeatIndex, rng);
}

function getActiveId(state: any): string {
  return state.players.find((p: any) => p.seatIndex === state.activePlayerSeatIndex)!.id;
}

describe('createInitialState', () => {
  it('creates a valid initial state with blinds posted', () => {
    const { state, events } = makeHand();
    expect(state.players).toHaveLength(2);
    expect(state.street).toBe(Street.PREFLOP);
    expect(state.isHandComplete).toBe(false);
    // HU: Dealer (seat 0) posts SB=1, other posts BB=2
    const p0 = state.players.find((p) => p.seatIndex === 0)!;
    const p1 = state.players.find((p) => p.seatIndex === 1)!;
    expect(p0.currentBet).toBe(1); // SB
    expect(p1.currentBet).toBe(2); // BB
    expect(p0.chips).toBe(99);
    expect(p1.chips).toBe(98);
    expect(state.pots[0]!.amount).toBe(3); // SB + BB
    // Each player has 2 hole cards
    expect(p0.holeCards).toHaveLength(2);
    expect(p1.holeCards).toHaveLength(2);
    // Events: HAND_START, BLINDS_POSTED, HOLE_CARDS_DEALT
    expect(events).toHaveLength(3);
  });
});

describe('chip conservation', () => {
  it('total chips are conserved after a complete hand (fold)', () => {
    const { state } = makeHand();
    const totalBefore = state.players.reduce((s, p) => s + p.chips, 0) + state.pots[0]!.amount;

    // Dealer (SB, seat 0) folds preflop
    const { state: afterFold } = applyAction(state, 'alice', { type: ActionType.FOLD });
    const totalAfter = afterFold.players.reduce((s, p) => s + p.chips, 0) + afterFold.pots[0]!.amount;
    expect(totalAfter).toBe(totalBefore);
    expect(afterFold.isHandComplete).toBe(true);
    expect(afterFold.winners).toEqual(['bob']);
  });

  it('total chips are conserved after a complete hand (call + showdown)', () => {
    const { state } = makeHand();
    const totalBefore = state.players.reduce((s, p) => s + p.chips, 0) + state.pots[0]!.amount;

    // Dealer calls BB
    const { state: s1 } = applyAction(state, 'alice', { type: ActionType.CALL });
    // BB checks
    const { state: s2 } = applyAction(s1, 'bob', { type: ActionType.CHECK });

    // Play through streets by checking
    let s = s2;
    while (!s.isHandComplete) {
      const activeId = getActiveId(s);
      const legal = getLegalActions(s);
      const action = legal.includes(ActionType.CHECK) ? ActionType.CHECK : ActionType.CALL;
      const result = applyAction(s, activeId, { type: action });
      s = result.state;
    }

    const totalAfter = s.players.reduce((sum, p) => sum + p.chips, 0) + s.pots[0]!.amount;
    expect(totalAfter).toBe(totalBefore);
    expect(s.isHandComplete).toBe(true);
    expect(s.winners).toBeDefined();
    expect(s.winners!.length).toBeGreaterThanOrEqual(1);
  });

  it('conserves chips through bet/raise/call sequences', () => {
    const { state } = makeHand(123);
    const totalBefore = state.players.reduce((s, p) => s + p.chips, 0) + state.pots[0]!.amount;

    // SB (dealer=alice) raises preflop
    const { state: s1 } = applyAction(state, 'alice', { type: ActionType.RAISE });
    // BB calls
    const { state: s2 } = applyAction(s1, 'bob', { type: ActionType.CALL });
    // Continue with checks
    let s = s2;
    while (!s.isHandComplete) {
      const activeId = getActiveId(s);
      const legal = getLegalActions(s);
      const action = legal.includes(ActionType.CHECK) ? ActionType.CHECK : ActionType.CALL;
      const result = applyAction(s, activeId, { type: action });
      s = result.state;
    }

    const totalAfter = s.players.reduce((sum, p) => sum + p.chips, 0) + s.pots[0]!.amount;
    expect(totalAfter).toBe(totalBefore);
  });
});

describe('turn order', () => {
  it('preflop: dealer (SB) acts first in HU', () => {
    const { state } = makeHand(42, 100, 100, 0);
    // HU: dealer=SB acts first preflop
    expect(state.activePlayerSeatIndex).toBe(0); // dealer seat
    expect(getActiveId(state)).toBe('alice');
  });

  it('post-flop: non-dealer acts first in HU', () => {
    const { state } = makeHand(42, 100, 100, 0);
    // Call to go to flop
    const { state: s1 } = applyAction(state, 'alice', { type: ActionType.CALL });
    const { state: s2 } = applyAction(s1, 'bob', { type: ActionType.CHECK });
    // Now on flop, non-dealer (seat 1) acts first
    expect(s2.street).toBe(Street.FLOP);
    expect(s2.activePlayerSeatIndex).toBe(1); // non-dealer
  });

  it('rejects actions from wrong player', () => {
    const { state } = makeHand();
    expect(() => applyAction(state, 'bob', { type: ActionType.FOLD })).toThrow(PokerError);
    try {
      applyAction(state, 'bob', { type: ActionType.FOLD });
    } catch (e) {
      expect((e as PokerError).code).toBe(PokerErrorCode.NOT_YOUR_TURN);
    }
  });
});

describe('legal actions', () => {
  it('preflop SB can fold, call, or raise', () => {
    const { state } = makeHand();
    const legal = getLegalActions(state);
    expect(legal).toContain(ActionType.FOLD);
    expect(legal).toContain(ActionType.CALL);
    expect(legal).toContain(ActionType.RAISE);
    expect(legal).not.toContain(ActionType.CHECK);
    expect(legal).not.toContain(ActionType.BET);
  });

  it('after a call, BB can check or bet or fold', () => {
    const { state } = makeHand();
    const { state: s1 } = applyAction(state, 'alice', { type: ActionType.CALL });
    const legal = getLegalActions(s1);
    expect(legal).toContain(ActionType.CHECK);
    expect(legal).toContain(ActionType.BET);
    expect(legal).toContain(ActionType.FOLD);
  });

  it('returns empty for completed hands', () => {
    const { state } = makeHand();
    const { state: done } = applyAction(state, 'alice', { type: ActionType.FOLD });
    expect(getLegalActions(done)).toEqual([]);
  });
});

describe('street transitions', () => {
  it('transitions from preflop to flop', () => {
    const { state } = makeHand();
    const { state: s1 } = applyAction(state, 'alice', { type: ActionType.CALL });
    expect(s1.street).toBe(Street.PREFLOP);
    const { state: s2 } = applyAction(s1, 'bob', { type: ActionType.CHECK });
    expect(s2.street).toBe(Street.FLOP);
    expect(s2.communityCards).toHaveLength(3);
  });

  it('transitions through all streets to showdown', () => {
    const { state } = makeHand();
    // Preflop: call + check
    let s = applyAction(state, 'alice', { type: ActionType.CALL }).state;
    s = applyAction(s, 'bob', { type: ActionType.CHECK }).state;
    expect(s.street).toBe(Street.FLOP);
    expect(s.communityCards).toHaveLength(3);

    // Flop: check + check
    s = applyAction(s, 'bob', { type: ActionType.CHECK }).state;
    s = applyAction(s, 'alice', { type: ActionType.CHECK }).state;
    expect(s.street).toBe(Street.TURN);
    expect(s.communityCards).toHaveLength(4);

    // Turn: check + check
    s = applyAction(s, 'bob', { type: ActionType.CHECK }).state;
    s = applyAction(s, 'alice', { type: ActionType.CHECK }).state;
    expect(s.street).toBe(Street.RIVER);
    expect(s.communityCards).toHaveLength(5);

    // River: check + check -> showdown
    s = applyAction(s, 'bob', { type: ActionType.CHECK }).state;
    s = applyAction(s, 'alice', { type: ActionType.CHECK }).state;
    expect(s.isHandComplete).toBe(true);
    expect(s.street).toBe(Street.SHOWDOWN);
    expect(s.winners).toBeDefined();
  });
});

describe('showdown pot distribution', () => {
  it('gives entire pot to winner', () => {
    const { state } = makeHand(42);
    let s = state;
    while (!s.isHandComplete) {
      const activeId = getActiveId(s);
      const legal = getLegalActions(s);
      const action = legal.includes(ActionType.CHECK) ? ActionType.CHECK : ActionType.CALL;
      s = applyAction(s, activeId, { type: action }).state;
    }

    expect(s.resultSummary).toBeDefined();
    expect(s.players.reduce((sum, p) => sum + p.chips, 0)).toBe(200);
  });
});

describe('invalid actions', () => {
  it('rejects action on completed hand', () => {
    const { state } = makeHand();
    const { state: done } = applyAction(state, 'alice', { type: ActionType.FOLD });
    expect(() => applyAction(done, 'bob', { type: ActionType.CHECK })).toThrow(PokerError);
  });

  it('rejects check when there is a bet to call', () => {
    const { state } = makeHand();
    expect(() => applyAction(state, 'alice', { type: ActionType.CHECK })).toThrow(PokerError);
  });
});

describe('raise cap', () => {
  it('enforces maximum raises per street', () => {
    const { state } = makeHand(42);
    // betsThisStreet starts at 1 (BB counts). maxRaisesPerStreet=4
    let s = applyAction(state, 'alice', { type: ActionType.RAISE }).state;
    s = applyAction(s, 'bob', { type: ActionType.RAISE }).state;
    s = applyAction(s, 'alice', { type: ActionType.RAISE }).state;
    // Now at cap (4), bob cannot raise
    const legal = getLegalActions(s);
    expect(legal).not.toContain(ActionType.RAISE);
    expect(legal).toContain(ActionType.CALL);
    expect(legal).toContain(ActionType.FOLD);
  });
});

describe('determinism', () => {
  it('same seed produces identical hands', () => {
    const h1 = makeHand(999);
    const h2 = makeHand(999);
    expect(h1.state.players[0]!.holeCards).toEqual(h2.state.players[0]!.holeCards);
    expect(h1.state.players[1]!.holeCards).toEqual(h2.state.players[1]!.holeCards);
    expect(h1.state.deck).toEqual(h2.state.deck);
  });

  it('different seeds produce different hands', () => {
    const h1 = makeHand(1);
    const h2 = makeHand(2);
    const cards1 = h1.state.players[0]!.holeCards.map((c) => `${c.rank}${c.suit}`).join(',');
    const cards2 = h2.state.players[0]!.holeCards.map((c) => `${c.rank}${c.suit}`).join(',');
    expect(cards1).not.toBe(cards2);
  });
});
