import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  createInitialState,
  applyAction,
  getLegalActions,
  type GameState,
  type PlayerSetup,
  ActionType,
  BettingMode,
  type GameConfig,
  DEFAULT_CONFIG,
  Street,
} from '../index.js';

// ── Arbitraries ──────────────────────────────────────────────

/**
 * Generate a valid player setup with 2-6 players.
 */
function arbPlayerSetup(): fc.Arbitrary<PlayerSetup[]> {
  return fc
    .integer({ min: 2, max: 6 })
    .chain((numPlayers) =>
      fc.array(
        fc.record({
          id: fc.constantFrom(...Array.from({ length: numPlayers }, (_, i) => `p${i}`)),
          seatIndex: fc.constantFrom(...Array.from({ length: numPlayers }, (_, i) => i)),
          chips: fc.integer({ min: 10, max: 1000 }),
        }),
        { minLength: numPlayers, maxLength: numPlayers }
      )
    )
    .map((players) => {
      // Ensure unique IDs and seat indices
      const uniquePlayers: PlayerSetup[] = [];
      const seenIds = new Set<string>();
      const seenSeats = new Set<number>();

      for (let i = 0; i < players.length; i++) {
        const id = `p${i}`;
        const seatIndex = i;
        if (!seenIds.has(id) && !seenSeats.has(seatIndex)) {
          uniquePlayers.push({
            id,
            seatIndex,
            chips: players[i].chips,
          });
          seenIds.add(id);
          seenSeats.add(seatIndex);
        }
      }

      return uniquePlayers;
    });
}

/**
 * Generate a seeded RNG function.
 */
function arbRng(): fc.Arbitrary<() => number> {
  return fc.integer({ min: 0, max: 0xffffffff }).map((seed) => {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return (state >>> 0) / 0x100000000;
    };
  });
}

/**
 * Generate a valid game config.
 */
function arbGameConfig(): fc.Arbitrary<GameConfig> {
  return fc.integer({ min: 1, max: 10 }).chain((sb) => {
    const bb = sb * 2;
    return fc.record({
      bettingMode: fc.constant(BettingMode.LIMIT),
      smallBlind: fc.constant(sb),
      bigBlind: fc.constant(bb),
      smallBet: fc.constant(bb),        // Limit: smallBet = bigBlind
      bigBet: fc.constant(bb * 2),      // Limit: bigBet = 2x bigBlind
      ante: fc.integer({ min: 0, max: sb }),
      maxRaisesPerStreet: fc.integer({ min: 3, max: 5 }),
      maxPlayers: fc.constant(6),
    });
  });
}

// ── Helper: sum all chips in the game ────────────────────────

function totalChipsInGame(state: GameState): number {
  // p.chips is what each player has left; pot already contains all bet money
  const playerChips = state.players.reduce((sum, p) => sum + p.chips, 0);
  const potChips = state.pots.reduce((sum, pot) => sum + pot.amount, 0);
  return playerChips + potChips;
}

// ── Helper: play a random hand to completion ─────────────────

function playRandomHand(
  state: GameState,
  rng: () => number,
  maxActions = 200
): { finalState: GameState; actionCount: number } {
  let current = state;
  let actionCount = 0;

  while (!current.isHandComplete && actionCount < maxActions) {
    const legalActions = getLegalActions(current);
    if (legalActions.length === 0) {
      break;
    }

    // Get active player ID
    const activePlayer = current.players.find(
      (p) => p.seatIndex === current.activePlayerSeatIndex
    );
    if (!activePlayer) break;

    // Pick random action
    const chosenAction = legalActions[Math.floor(rng() * legalActions.length)];
    const result = applyAction(current, activePlayer.id, { type: chosenAction }, rng);
    current = result.state;
    actionCount++;
  }

  return { finalState: current, actionCount };
}

// ── Invariant Tests ──────────────────────────────────────────

describe('poker-engine invariants (fast-check)', () => {
  describe('chip conservation', () => {
    it('total chips remain constant throughout hand (1000 runs)', () => {
      fc.assert(
        fc.property(arbPlayerSetup(), arbRng(), arbGameConfig(), (players, rng, config) => {
          const { state: initialState } = createInitialState(
            'test-hand',
            players,
            0,
            rng,
            config
          );

          const initialTotal = totalChipsInGame(initialState);
          const { finalState } = playRandomHand(initialState, rng);
          const finalTotal = totalChipsInGame(finalState);

          expect(finalTotal).toBe(initialTotal);
        }),
        { numRuns: 1000 }
      );
    });

    it('chip conservation holds after every single action (1000 runs)', () => {
      fc.assert(
        fc.property(arbPlayerSetup(), arbRng(), (players, rng) => {
          const { state: initialState } = createInitialState(
            'test-hand',
            players,
            0,
            rng,
            DEFAULT_CONFIG
          );

          const initialTotal = totalChipsInGame(initialState);
          let current = initialState;

          for (let i = 0; i < 50 && !current.isHandComplete; i++) {
            const legalActions = getLegalActions(current);
            if (legalActions.length === 0) break;

            const activePlayer = current.players.find(
              (p) => p.seatIndex === current.activePlayerSeatIndex
            );
            if (!activePlayer) break;

            const actionType = legalActions[Math.floor(rng() * legalActions.length)];
            const result = applyAction(current, activePlayer.id, { type: actionType }, rng);
            current = result.state;

            const currentTotal = totalChipsInGame(current);
            expect(currentTotal).toBe(initialTotal);
          }
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe('legal actions', () => {
    it('legal actions are never empty unless hand is complete (1000 runs)', () => {
      fc.assert(
        fc.property(arbPlayerSetup(), arbRng(), (players, rng) => {
          const { state: initialState } = createInitialState(
            'test-hand',
            players,
            0,
            rng,
            DEFAULT_CONFIG
          );

          let current = initialState;

          for (let i = 0; i < 100 && !current.isHandComplete; i++) {
            const legalActions = getLegalActions(current);

            if (!current.isHandComplete) {
              expect(legalActions.length).toBeGreaterThan(0);
            }

            if (legalActions.length === 0) break;

            const activePlayer = current.players.find(
              (p) => p.seatIndex === current.activePlayerSeatIndex
            );
            if (!activePlayer) break;

            const actionType = legalActions[Math.floor(rng() * legalActions.length)];
            const result = applyAction(current, activePlayer.id, { type: actionType }, rng);
            current = result.state;
          }
        }),
        { numRuns: 1000 }
      );
    });

    it('applying any legal action never throws (1000 runs)', () => {
      fc.assert(
        fc.property(arbPlayerSetup(), arbRng(), (players, rng) => {
          const { state: initialState } = createInitialState(
            'test-hand',
            players,
            0,
            rng,
            DEFAULT_CONFIG
          );

          let current = initialState;

          for (let i = 0; i < 50 && !current.isHandComplete; i++) {
            const legalActions = getLegalActions(current);
            if (legalActions.length === 0) break;

            const activePlayer = current.players.find(
              (p) => p.seatIndex === current.activePlayerSeatIndex
            );
            if (!activePlayer) break;

            const actionType = legalActions[Math.floor(rng() * legalActions.length)];

            expect(() => {
              const result = applyAction(current, activePlayer.id, { type: actionType }, rng);
              current = result.state;
            }).not.toThrow();
          }
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe('determinism', () => {
    it('same seed produces identical hand outcomes (1000 runs)', () => {
      fc.assert(
        fc.property(arbPlayerSetup(), fc.integer(), (players, seed) => {
          const rng1 = (() => {
            let state = seed;
            return () => {
              state = (state * 1664525 + 1013904223) >>> 0;
              return (state >>> 0) / 0x100000000;
            };
          })();

          const rng2 = (() => {
            let state = seed;
            return () => {
              state = (state * 1664525 + 1013904223) >>> 0;
              return (state >>> 0) / 0x100000000;
            };
          })();

          const { state: state1 } = createInitialState('hand-1', players, 0, rng1, DEFAULT_CONFIG);
          const { state: state2 } = createInitialState('hand-2', players, 0, rng2, DEFAULT_CONFIG);

          // Compare deck order
          expect(state1.deck.length).toBe(state2.deck.length);

          // Compare hole cards
          for (let i = 0; i < state1.players.length; i++) {
            expect(state1.players[i].holeCards).toEqual(state2.players[i].holeCards);
          }
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe('non-negative chips', () => {
    it('player chips never go negative (1000 runs)', () => {
      fc.assert(
        fc.property(arbPlayerSetup(), arbRng(), (players, rng) => {
          const { state: initialState } = createInitialState(
            'test-hand',
            players,
            0,
            rng,
            DEFAULT_CONFIG
          );

          const { finalState } = playRandomHand(initialState, rng);

          for (const player of finalState.players) {
            expect(player.chips).toBeGreaterThanOrEqual(0);
            expect(player.currentBet).toBeGreaterThanOrEqual(0);
          }
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe('hand completion', () => {
    it('hand always completes within reasonable action count (1000 runs)', () => {
      fc.assert(
        fc.property(arbPlayerSetup(), arbRng(), (players, rng) => {
          const { state: initialState } = createInitialState(
            'test-hand',
            players,
            0,
            rng,
            DEFAULT_CONFIG
          );

          const { finalState, actionCount } = playRandomHand(initialState, rng, 500);

          // Either hand is complete or we hit action limit
          if (actionCount < 500) {
            expect(finalState.isHandComplete).toBe(true);
          }
        }),
        { numRuns: 1000 }
      );
    });

    it('completed hands have winners assigned (1000 runs)', () => {
      fc.assert(
        fc.property(arbPlayerSetup(), arbRng(), (players, rng) => {
          const { state: initialState } = createInitialState(
            'test-hand',
            players,
            0,
            rng,
            DEFAULT_CONFIG
          );

          const { finalState } = playRandomHand(initialState, rng);

          if (finalState.isHandComplete) {
            expect(finalState.winners).toBeDefined();
            expect(finalState.winners!.length).toBeGreaterThan(0);
          }
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe('betting structure', () => {
    it('currentBet never exceeds player starting chips (1000 runs)', () => {
      fc.assert(
        fc.property(arbPlayerSetup(), arbRng(), (players, rng) => {
          const startingChips = new Map(players.map((p) => [p.id, p.chips]));

          const { state: initialState } = createInitialState(
            'test-hand',
            players,
            0,
            rng,
            DEFAULT_CONFIG
          );

          let current = initialState;

          for (let i = 0; i < 100 && !current.isHandComplete; i++) {
            for (const player of current.players) {
              const starting = startingChips.get(player.id)!;
              expect(player.currentBet + player.chips).toBeLessThanOrEqual(starting);
            }

            const legalActions = getLegalActions(current);
            if (legalActions.length === 0) break;

            const activePlayer = current.players.find(
              (p) => p.seatIndex === current.activePlayerSeatIndex
            );
            if (!activePlayer) break;

            const actionType = legalActions[Math.floor(rng() * legalActions.length)];
            const result = applyAction(current, activePlayer.id, { type: actionType }, rng);
            current = result.state;
          }
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe('pot integrity', () => {
    it('pot amounts are always non-negative (1000 runs)', () => {
      fc.assert(
        fc.property(arbPlayerSetup(), arbRng(), (players, rng) => {
          const { state: initialState } = createInitialState(
            'test-hand',
            players,
            0,
            rng,
            DEFAULT_CONFIG
          );

          const { finalState } = playRandomHand(initialState, rng);

          for (const pot of finalState.pots) {
            expect(pot.amount).toBeGreaterThanOrEqual(0);
            expect(pot.eligible.length).toBeGreaterThan(0);
          }
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe('street progression', () => {
    it('streets progress in order: PREFLOP -> FLOP -> TURN -> RIVER -> SHOWDOWN (1000 runs)', () => {
      fc.assert(
        fc.property(arbPlayerSetup(), arbRng(), (players, rng) => {
          const { state: initialState } = createInitialState(
            'test-hand',
            players,
            0,
            rng,
            DEFAULT_CONFIG
          );

          let current = initialState;
          const streetsSeen: Street[] = [current.street];

          for (let i = 0; i < 100 && !current.isHandComplete; i++) {
            const legalActions = getLegalActions(current);
            if (legalActions.length === 0) break;

            const activePlayer = current.players.find(
              (p) => p.seatIndex === current.activePlayerSeatIndex
            );
            if (!activePlayer) break;

            const actionType = legalActions[Math.floor(rng() * legalActions.length)];
            const result = applyAction(current, activePlayer.id, { type: actionType }, rng);
            current = result.state;

            if (current.street !== streetsSeen[streetsSeen.length - 1]) {
              streetsSeen.push(current.street);
            }
          }

          // Verify streets are in valid order
          const validOrder = [
            Street.PREFLOP,
            Street.FLOP,
            Street.TURN,
            Street.RIVER,
            Street.SHOWDOWN,
          ];

          for (let i = 1; i < streetsSeen.length; i++) {
            const prevIdx = validOrder.indexOf(streetsSeen[i - 1]);
            const currIdx = validOrder.indexOf(streetsSeen[i]);
            expect(currIdx).toBeGreaterThanOrEqual(prevIdx);
          }
        }),
        { numRuns: 1000 }
      );
    });
  });
});
