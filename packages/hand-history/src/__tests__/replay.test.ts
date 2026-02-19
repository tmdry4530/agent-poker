import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createInitialState,
  createSeededRng,
  type GameEvent,
  type GameState,
  type PlayerSetup,
} from '@agent-poker/poker-engine';
import { MemoryHandHistoryStore } from '../memory-store.js';
import { replayHand } from '../replay.js';

function makeHU(handId: string, rngSeed: number) {
  const rng = createSeededRng(rngSeed);
  const players: PlayerSetup[] = [
    { id: 'alice', seatIndex: 0, chips: 100 },
    { id: 'bob', seatIndex: 1, chips: 100 },
  ];
  return createInitialState(handId, players, 0, rng);
}

function getActiveId(state: GameState): string {
  return state.players.find((p) => p.seatIndex === state.activePlayerSeatIndex)!.id;
}

describe('HandHistory - Replay', () => {
  it('should record and replay a complete hand (fold)', async () => {
    const store = new MemoryHandHistoryStore();
    const rngSeed = 12345;

    const { state: state0, events: events0 } = makeHU('hand-001', rngSeed);

    let currentState = state0;
    const allEvents: GameEvent[] = [...events0];

    // Alice (dealer/SB) folds
    const { state: state1, events: events1 } = applyAction(currentState, 'alice', {
      type: 'FOLD',
    });
    currentState = state1;
    allEvents.push(...events1);

    await store.appendEvents('hand-001', allEvents);

    const replayResult = replayHand(allEvents, rngSeed);

    expect(replayResult.valid).toBe(true);
    expect(replayResult.errors).toEqual([]);
    expect(replayResult.finalState.isHandComplete).toBe(true);
    expect(replayResult.finalState.winners).toEqual(['bob']);
  });

  it('should record and replay a complete hand (showdown)', async () => {
    const store = new MemoryHandHistoryStore();
    const rngSeed = 54321;

    const { state: state0, events: events0 } = makeHU('hand-002', rngSeed);

    let currentState = state0;
    const allEvents: GameEvent[] = [...events0];

    // Play through to showdown with checks/calls
    // Alice (dealer/SB) calls
    let result = applyAction(currentState, 'alice', { type: 'CALL' });
    currentState = result.state;
    allEvents.push(...result.events);

    // Bob checks
    result = applyAction(currentState, 'bob', { type: 'CHECK' });
    currentState = result.state;
    allEvents.push(...result.events);

    // Play remaining streets with checks
    while (!currentState.isHandComplete) {
      const activeId = getActiveId(currentState);
      result = applyAction(currentState, activeId, { type: 'CHECK' });
      currentState = result.state;
      allEvents.push(...result.events);
    }

    await store.appendEvents('hand-002', allEvents);

    const replayResult = replayHand(allEvents, rngSeed);

    expect(replayResult.valid).toBe(true);
    expect(replayResult.errors).toEqual([]);
    expect(replayResult.finalState.isHandComplete).toBe(true);
    expect(replayResult.finalState.winners).toBeDefined();
    expect(replayResult.finalState.resultSummary?.potDistribution).toBeDefined();
  });

  it('should detect tampered events (wrong player)', async () => {
    const rngSeed = 99999;

    const { state: state0, events: events0 } = makeHU('hand-003', rngSeed);

    let currentState = state0;
    const allEvents: GameEvent[] = [...events0];

    // Alice (dealer/SB) acts first preflop — she calls
    const { state: state1, events: events1 } = applyAction(currentState, 'alice', {
      type: 'CALL',
    });
    currentState = state1;
    allEvents.push(...events1);

    // Tamper: change playerId from alice to bob
    const tamperedEvents = allEvents.map((e) => {
      if (e.type === 'PLAYER_ACTION' && e.payload.playerId === 'alice') {
        return {
          ...e,
          payload: { ...e.payload, playerId: 'bob' },
        };
      }
      return e;
    });

    const replayResult = replayHand(tamperedEvents, rngSeed);

    expect(replayResult.valid).toBe(false);
    expect(replayResult.errors.length).toBeGreaterThan(0);
  });

  it('should handle empty event list', () => {
    const replayResult = replayHand([], 0);

    expect(replayResult.valid).toBe(false);
    expect(replayResult.errors).toContain('No events to replay');
  });

  it('should handle missing HAND_START event', () => {
    const events: GameEvent[] = [
      {
        type: 'BLINDS_POSTED',
        seq: 0,
        handId: 'hand-x',
        payload: {},
      },
    ];

    const replayResult = replayHand(events, 0);

    expect(replayResult.valid).toBe(false);
    expect(replayResult.errors).toContain('Missing HAND_START event');
  });
});

describe('HandHistory - Multiway Replay', () => {
  function makeMulti(handId: string, rngSeed: number, numPlayers: number) {
    const rng = createSeededRng(rngSeed);
    const players: PlayerSetup[] = [];
    for (let i = 0; i < numPlayers; i++) {
      players.push({ id: `p${i}`, seatIndex: i, chips: 100 });
    }
    return createInitialState(handId, players, 0, rng);
  }

  it('should replay a 3-player hand to showdown', () => {
    const rngSeed = 33333;
    const { state: state0, events: events0 } = makeMulti('multi-3', rngSeed, 3);

    let currentState = state0;
    const allEvents: GameEvent[] = [...events0];
    let moves = 0;

    while (!currentState.isHandComplete && moves < 200) {
      const activeId = getActiveId(currentState);
      let result;
      try {
        result = applyAction(currentState, activeId, { type: 'CHECK' as any });
      } catch {
        result = applyAction(currentState, activeId, { type: 'CALL' as any });
      }
      currentState = result.state;
      allEvents.push(...result.events);
      moves++;
    }

    const replayResult = replayHand(allEvents, rngSeed);
    expect(replayResult.valid).toBe(true);
    expect(replayResult.errors).toEqual([]);
    expect(replayResult.finalState.isHandComplete).toBe(true);
    expect(replayResult.finalState.winners).toBeDefined();
  });

  it('should replay a 6-player hand to showdown', () => {
    const rngSeed = 66666;
    const { state: state0, events: events0 } = makeMulti('multi-6', rngSeed, 6);

    let currentState = state0;
    const allEvents: GameEvent[] = [...events0];
    let moves = 0;

    while (!currentState.isHandComplete && moves < 200) {
      const activeId = getActiveId(currentState);
      let result;
      try {
        result = applyAction(currentState, activeId, { type: 'CHECK' as any });
      } catch {
        result = applyAction(currentState, activeId, { type: 'CALL' as any });
      }
      currentState = result.state;
      allEvents.push(...result.events);
      moves++;
    }

    const replayResult = replayHand(allEvents, rngSeed);
    expect(replayResult.valid).toBe(true);
    expect(replayResult.errors).toEqual([]);
    expect(replayResult.finalState.isHandComplete).toBe(true);
  });

  it('should replay a 4-player hand with folds', () => {
    const rngSeed = 44444;
    const { state: state0, events: events0 } = makeMulti('multi-4-fold', rngSeed, 4);

    let currentState = state0;
    const allEvents: GameEvent[] = [...events0];
    let foldCount = 0;
    let moves = 0;

    while (!currentState.isHandComplete && moves < 200) {
      const activeId = getActiveId(currentState);
      let result;
      // First two players fold, rest play normally
      if (foldCount < 2) {
        result = applyAction(currentState, activeId, { type: 'FOLD' as any });
        foldCount++;
      } else {
        try {
          result = applyAction(currentState, activeId, { type: 'CHECK' as any });
        } catch {
          result = applyAction(currentState, activeId, { type: 'CALL' as any });
        }
      }
      currentState = result.state;
      allEvents.push(...result.events);
      moves++;
    }

    const replayResult = replayHand(allEvents, rngSeed);
    expect(replayResult.valid).toBe(true);
    expect(replayResult.errors).toEqual([]);
    expect(replayResult.finalState.isHandComplete).toBe(true);
  });

  it('should replay with non-contiguous seats', () => {
    const rngSeed = 77777;
    const rng = createSeededRng(rngSeed);
    const players: PlayerSetup[] = [
      { id: 'a', seatIndex: 1, chips: 100 },
      { id: 'b', seatIndex: 3, chips: 100 },
      { id: 'c', seatIndex: 7, chips: 100 },
    ];
    const { state: state0, events: events0 } = createInitialState('nc-replay', players, 1, rng);

    let currentState = state0;
    const allEvents: GameEvent[] = [...events0];
    let moves = 0;

    while (!currentState.isHandComplete && moves < 200) {
      const activeId = getActiveId(currentState);
      let result;
      try {
        result = applyAction(currentState, activeId, { type: 'CHECK' as any });
      } catch {
        result = applyAction(currentState, activeId, { type: 'CALL' as any });
      }
      currentState = result.state;
      allEvents.push(...result.events);
      moves++;
    }

    const replayResult = replayHand(allEvents, rngSeed);
    expect(replayResult.valid).toBe(true);
    expect(replayResult.errors).toEqual([]);
    expect(replayResult.finalState.isHandComplete).toBe(true);
  });
});

describe('MemoryHandHistoryStore', () => {
  it('should store and retrieve events', async () => {
    const store = new MemoryHandHistoryStore();
    const events: GameEvent[] = [
      {
        type: 'HAND_START',
        seq: 0,
        handId: 'hand-1',
        payload: { players: [{ id: 'a', seatIndex: 0, chips: 100 }, { id: 'b', seatIndex: 1, chips: 100 }], dealerSeatIndex: 0, config: {} },
      },
      {
        type: 'HAND_END',
        seq: 1,
        handId: 'hand-1',
        payload: {},
      },
    ];

    await store.appendEvents('hand-1', events);
    const retrieved = await store.getEvents('hand-1');

    expect(retrieved).toEqual(events);
  });

  it('should list all hands', async () => {
    const store = new MemoryHandHistoryStore();

    await store.appendEvents('hand-1', []);
    await store.appendEvents('hand-2', []);
    await store.appendEvents('hand-3', []);

    const hands = await store.listHands();

    expect(hands).toHaveLength(3);
    expect(hands).toContain('hand-1');
    expect(hands).toContain('hand-2');
    expect(hands).toContain('hand-3');
  });

  it('should merge events without duplicates', async () => {
    const store = new MemoryHandHistoryStore();

    const events1: GameEvent[] = [
      { type: 'HAND_START', seq: 0, handId: 'h1', payload: {} },
      { type: 'BLINDS_POSTED', seq: 1, handId: 'h1', payload: {} },
    ];

    const events2: GameEvent[] = [
      { type: 'BLINDS_POSTED', seq: 1, handId: 'h1', payload: {} },
      { type: 'HOLE_CARDS_DEALT', seq: 2, handId: 'h1', payload: {} },
    ];

    await store.appendEvents('h1', events1);
    await store.appendEvents('h1', events2);

    const retrieved = await store.getEvents('h1');

    expect(retrieved).toHaveLength(3);
    expect(retrieved.map((e) => e.seq)).toEqual([0, 1, 2]);
  });
});
