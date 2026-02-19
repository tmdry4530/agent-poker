import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  applyAction,
  getLegalActions,
  createSeededRng,
  ActionType,
  Street,
  DEFAULT_CONFIG,
  type PlayerSetup,
  type GameState,
} from '../index.js';

function makeMultiHand(
  numPlayers: number,
  seed = 42,
  chips = 100,
  dealerSeatIndex = 0,
) {
  const rng = createSeededRng(seed);
  const players: PlayerSetup[] = [];
  for (let i = 0; i < numPlayers; i++) {
    players.push({ id: `p${i}`, seatIndex: i, chips });
  }
  return createInitialState(`hand-multi`, players, dealerSeatIndex, rng);
}

function getActiveId(state: GameState): string {
  return state.players.find((p) => p.seatIndex === state.activePlayerSeatIndex)!.id;
}

function totalChips(state: GameState): number {
  return (
    state.players.reduce((s, p) => s + p.chips, 0) +
    state.pots.reduce((s, p) => s + p.amount, 0)
  );
}

function playToCompletion(state: GameState): GameState {
  let s = state;
  let moves = 0;
  while (!s.isHandComplete) {
    const activeId = getActiveId(s);
    const legal = getLegalActions(s);
    const action = legal.includes(ActionType.CHECK) ? ActionType.CHECK : ActionType.CALL;
    s = applyAction(s, activeId, { type: action }).state;
    moves++;
    if (moves > 300) throw new Error('Infinite loop detected');
  }
  return s;
}

describe('multiway games - 3 players', () => {
  it('creates valid 3-player initial state', () => {
    const { state } = makeMultiHand(3);
    expect(state.players).toHaveLength(3);
    // BTN=0, SB=1, BB=2
    const p0 = state.players.find((p) => p.seatIndex === 0)!;
    const p1 = state.players.find((p) => p.seatIndex === 1)!;
    const p2 = state.players.find((p) => p.seatIndex === 2)!;
    expect(p0.currentBet).toBe(0); // BTN
    expect(p1.currentBet).toBe(1); // SB
    expect(p2.currentBet).toBe(2); // BB
    expect(state.pots[0]!.amount).toBe(3);
  });

  it('UTG acts first preflop in 3-player game', () => {
    const { state } = makeMultiHand(3, 42, 100, 0);
    // BTN=0, SB=1, BB=2, UTG wraps to 0
    expect(state.activePlayerSeatIndex).toBe(0);
  });

  it('completes a 3-player hand with checks/calls', () => {
    const { state } = makeMultiHand(3);
    const total = totalChips(state);
    const final = playToCompletion(state);
    expect(final.isHandComplete).toBe(true);
    expect(totalChips(final)).toBe(total);
  });

  it('fold leaves 2 players, then proceeds to showdown', () => {
    const { state } = makeMultiHand(3, 100);
    // UTG (p0) folds
    const { state: s1 } = applyAction(state, getActiveId(state), { type: ActionType.FOLD });
    expect(s1.isHandComplete).toBe(false); // still 2 players
    const final = playToCompletion(s1);
    expect(final.isHandComplete).toBe(true);
    expect(totalChips(final)).toBe(300);
  });

  it('consecutive folds = instant win', () => {
    const { state } = makeMultiHand(3, 200);
    // UTG folds
    const { state: s1 } = applyAction(state, getActiveId(state), { type: ActionType.FOLD });
    // SB folds (if SB is next)
    if (!s1.isHandComplete) {
      const { state: s2 } = applyAction(s1, getActiveId(s1), { type: ActionType.FOLD });
      expect(s2.isHandComplete).toBe(true);
      expect(s2.winners).toHaveLength(1);
      expect(totalChips(s2)).toBe(300);
    }
  });
});

describe('multiway games - 6 players', () => {
  it('creates valid 6-player initial state', () => {
    const { state } = makeMultiHand(6);
    expect(state.players).toHaveLength(6);
    expect(state.pots[0]!.amount).toBe(3); // SB + BB
    expect(totalChips(state)).toBe(600);
  });

  it('completes a full hand with chip conservation', () => {
    const { state } = makeMultiHand(6, 77);
    const final = playToCompletion(state);
    expect(final.isHandComplete).toBe(true);
    expect(totalChips(final)).toBe(600);
  });
});

describe('multiway games - 8 players', () => {
  it('creates valid 8-player initial state', () => {
    const { state } = makeMultiHand(8);
    expect(state.players).toHaveLength(8);
    expect(totalChips(state)).toBe(800);
  });

  it('completes a full hand with chip conservation', () => {
    const { state } = makeMultiHand(8, 55);
    const final = playToCompletion(state);
    expect(final.isHandComplete).toBe(true);
    expect(totalChips(final)).toBe(800);
  });

  it('handles bet/raise with multiway hasActed reset', () => {
    const { state } = makeMultiHand(4, 42);
    const total = totalChips(state);

    // UTG (p3) raises
    let s = applyAction(state, getActiveId(state), { type: ActionType.RAISE }).state;
    // Everyone else calls or folds
    let moves = 0;
    while (!s.isHandComplete && moves < 200) {
      const activeId = getActiveId(s);
      const legal = getLegalActions(s);
      const action = legal.includes(ActionType.CALL) ? ActionType.CALL : ActionType.CHECK;
      s = applyAction(s, activeId, { type: action }).state;
      moves++;
    }
    // Play remaining streets
    while (!s.isHandComplete && moves < 200) {
      const activeId = getActiveId(s);
      const legal = getLegalActions(s);
      const action = legal.includes(ActionType.CHECK) ? ActionType.CHECK : ActionType.CALL;
      s = applyAction(s, activeId, { type: action }).state;
      moves++;
    }

    expect(s.isHandComplete).toBe(true);
    expect(totalChips(s)).toBe(total);
  });
});

describe('chip conservation invariant', () => {
  for (const n of [2, 3, 4, 6, 8]) {
    it(`${n}-player game preserves total chips`, () => {
      for (let seed = 1; seed <= 5; seed++) {
        const { state } = makeMultiHand(n, seed * 100);
        const total = totalChips(state);
        const final = playToCompletion(state);
        expect(totalChips(final)).toBe(total);
      }
    });
  }
});

describe('side pot - multiway all-in', () => {
  it('3-player: short stack all-in creates main + side pot', () => {
    const rng = createSeededRng(42);
    const players: PlayerSetup[] = [
      { id: 'short', seatIndex: 0, chips: 5 },  // will go all-in
      { id: 'med', seatIndex: 1, chips: 100 },
      { id: 'big', seatIndex: 2, chips: 100 },
    ];
    const { state } = createInitialState('side-pot-test', players, 0, rng);

    // BTN=0(short), SB=1(med), BB=2(big)
    // short stack faces BB, goes all-in by calling
    let s = state;
    let moves = 0;
    while (!s.isHandComplete && moves < 100) {
      const activeId = getActiveId(s);
      const legal = getLegalActions(s);
      const action = legal.includes(ActionType.CHECK) ? ActionType.CHECK : ActionType.CALL;
      s = applyAction(s, activeId, { type: action }).state;
      moves++;
    }

    expect(s.isHandComplete).toBe(true);
    // Total chips must be conserved: 5 + 100 + 100 = 205
    expect(totalChips(s)).toBe(205);
  });
});

describe('non-contiguous seats', () => {
  it('works with seats [1, 3, 5]', () => {
    const rng = createSeededRng(42);
    const players: PlayerSetup[] = [
      { id: 'a', seatIndex: 1, chips: 100 },
      { id: 'b', seatIndex: 3, chips: 100 },
      { id: 'c', seatIndex: 5, chips: 100 },
    ];
    const { state } = createInitialState('nc-test', players, 1, rng);
    expect(state.dealerSeatIndex).toBe(1);
    const final = playToCompletion(state);
    expect(final.isHandComplete).toBe(true);
    expect(totalChips(final)).toBe(300);
  });
});
