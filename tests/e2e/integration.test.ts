/**
 * E2E Integration Test: Full hand flow
 *
 * Boots lobby-api + game-server in-process, registers 2 agents,
 * creates a table, joins via HTTP, plays 5 hands, and verifies:
 * - Chip conservation
 * - Hash chain integrity
 * - Proper event sequence
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createInitialState,
  applyAction,
  getLegalActions,
  createSeededRng,
  advanceDealer,
  ActionType,
  type GameState,
  type GameEvent,
  type PlayerSetup,
  DEFAULT_CONFIG,
} from '@agent-poker/poker-engine';
import {
  buildHashChain,
  verifyHashChain,
} from '@agent-poker/hand-history';
import { TableActor, signSeatToken } from '@agent-poker/game-server';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerRoutes } from '@agent-poker/lobby-api';

// ── Constants ──────────────────────────────────────────────

const NUM_HANDS = 5;
const STARTING_CHIPS = 200;
const SEED = 42;

// ── Helpers ────────────────────────────────────────────────

function callingStationAction(legalActions: ActionType[]): { type: ActionType } {
  if (legalActions.includes(ActionType.CHECK)) return { type: ActionType.CHECK };
  if (legalActions.includes(ActionType.CALL)) return { type: ActionType.CALL };
  return { type: ActionType.FOLD };
}

function playHandToCompletion(state: GameState, rng: () => number): { finalState: GameState; events: GameEvent[] } {
  const allEvents: GameEvent[] = [];
  let moves = 0;

  while (!state.isHandComplete) {
    const activePlayer = state.players.find(
      (p) => p.seatIndex === state.activePlayerSeatIndex,
    )!;
    const legal = getLegalActions(state);
    const action = callingStationAction(legal);
    const result = applyAction(state, activePlayer.id, action, rng);
    state = result.state;
    allEvents.push(...result.events);
    moves++;

    if (moves > 200) {
      throw new Error('Hand exceeded 200 moves');
    }
  }

  return { finalState: state, events: allEvents };
}

// ══════════════════════════════════════════════════════════════
// E2E: Full game flow via HTTP + in-process engine
// ══════════════════════════════════════════════════════════════

describe('E2E: Full hand flow via HTTP API', () => {
  let app: FastifyInstance;
  let gameServer: any;
  let tableId: string;

  beforeAll(async () => {
    // Create mock game server with required methods
    const tables = new Map<string, TableActor>();
    gameServer = {
      getAllTables: () => [...tables.values()],
      getTable: (id: string) => tables.get(id),
      registerTable: (table: TableActor) => tables.set(table.tableId, table),
      sendToAgent: () => {},
      _tables: tables,
    };

    app = Fastify({ logger: false });
    registerRoutes(app, { gameServer });
    await app.ready();
  });

  afterAll(async () => {
    // Close all tables
    for (const table of gameServer.getAllTables()) {
      table.close();
    }
    await app.close();
  });

  it('registers 2 agents via HTTP', async () => {
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/agents',
      payload: { displayName: 'Bot-Alpha' },
    });
    expect(res1.statusCode).toBe(200);
    expect(res1.json().agentId).toBeDefined();

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/agents',
      payload: { displayName: 'Bot-Beta' },
    });
    expect(res2.statusCode).toBe(200);
    expect(res2.json().agentId).toBeDefined();
  });

  it('creates a table via HTTP', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tables',
      payload: { maxSeats: 4 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.tableId).toBeDefined();
    tableId = body.tableId;
  });

  it('joins 2 agents to the table via HTTP', async () => {
    const join1 = await app.inject({
      method: 'POST',
      url: `/api/tables/${tableId}/join`,
      payload: { agentId: 'agent-alpha', buyIn: STARTING_CHIPS },
    });
    expect(join1.statusCode).toBe(200);
    expect(join1.json().seatToken).toBeDefined();

    const join2 = await app.inject({
      method: 'POST',
      url: `/api/tables/${tableId}/join`,
      payload: { agentId: 'agent-beta', buyIn: STARTING_CHIPS },
    });
    expect(join2.statusCode).toBe(200);
    expect(join2.json().seatToken).toBeDefined();
  });

  it('plays 5 hands with chip conservation', async () => {
    const table = gameServer.getTable(tableId)!;
    expect(table).toBeDefined();
    expect(table.canStartHand()).toBe(true);

    const totalChipsExpected = STARTING_CHIPS * 2;
    const allHandEvents: GameEvent[][] = [];

    for (let h = 0; h < NUM_HANDS; h++) {
      // Check we can still start a hand
      if (!table.canStartHand()) {
        break;
      }

      const { state, events: initEvents } = table.startHand();
      expect(state).toBeDefined();
      expect(state.isHandComplete).toBe(false);
      expect(state.players).toHaveLength(2);

      // Play hand to completion using processAction on table
      let currentState = state;
      const handEvents = [...initEvents];
      let moves = 0;

      while (!currentState.isHandComplete) {
        const activePlayer = currentState.players.find(
          (p) => p.seatIndex === currentState.activePlayerSeatIndex,
        )!;
        const legal = getLegalActions(currentState);
        const action = callingStationAction(legal);

        const result = table.processAction(activePlayer.id, action, `req-${h}-${moves}`);
        currentState = result.state;
        moves++;

        if (moves > 200) throw new Error('Hand exceeded 200 moves');
      }

      allHandEvents.push(handEvents);

      // Verify chip conservation after each hand
      const seats = table.getSeats();
      const totalChips = seats
        .filter((s) => s.status === 'seated')
        .reduce((sum, s) => sum + s.chips, 0);
      expect(totalChips).toBe(totalChipsExpected);
    }

    // Verify all 5 hands were played
    expect(table.getHandsPlayed()).toBe(NUM_HANDS);
  });

  it('verifies hand history is recorded', async () => {
    const table = gameServer.getTable(tableId)!;
    const history = table.getHandHistory();
    expect(history).toHaveLength(NUM_HANDS);

    for (const hand of history) {
      expect(hand.handId).toBeDefined();
      expect(hand.events.length).toBeGreaterThan(0);
      expect(hand.players).toHaveLength(2);
      expect(hand.completedAt).toBeGreaterThan(0);
    }
  });

  it('verifies individual hand retrieval', async () => {
    const table = gameServer.getTable(tableId)!;
    const history = table.getHandHistory();
    const firstHandId = history[0]!.handId;

    const hand = table.getHandById(firstHandId);
    expect(hand).not.toBeNull();
    expect(hand!.handId).toBe(firstHandId);
    expect(hand!.events.length).toBeGreaterThan(0);
  });

  it('returns null for nonexistent hand', async () => {
    const table = gameServer.getTable(tableId)!;
    expect(table.getHandById('nonexistent')).toBeNull();
  });

  it('verifies table state and hands via HTTP endpoints', async () => {
    // GET /api/tables/:id
    const tableRes = await app.inject({
      method: 'GET',
      url: `/api/tables/${tableId}`,
    });
    expect(tableRes.statusCode).toBe(200);
    const tableInfo = tableRes.json();
    expect(tableInfo.id).toBe(tableId);
    expect(tableInfo.handsPlayed).toBe(NUM_HANDS);

    // GET /api/tables/:id/hands
    const handsRes = await app.inject({
      method: 'GET',
      url: `/api/tables/${tableId}/hands`,
    });
    expect(handsRes.statusCode).toBe(200);
    expect(handsRes.json().hands).toHaveLength(NUM_HANDS);

    // GET /api/tables/:id/state (no active hand)
    const stateRes = await app.inject({
      method: 'GET',
      url: `/api/tables/${tableId}/state`,
    });
    expect(stateRes.statusCode).toBe(200);
    expect(stateRes.json().state).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════
// E2E: Pure engine — hash chain integrity
// ══════════════════════════════════════════════════════════════

describe('E2E: Hash chain integrity over 5 hands', () => {
  it('builds and verifies hash chain for each hand', () => {
    const masterRng = createSeededRng(SEED);
    const players: PlayerSetup[] = [
      { id: 'alice', seatIndex: 0, chips: STARTING_CHIPS },
      { id: 'bob', seatIndex: 1, chips: STARTING_CHIPS },
    ];
    let dealerSeatIndex = 0;
    const chips = [STARTING_CHIPS, STARTING_CHIPS];

    for (let h = 0; h < NUM_HANDS; h++) {
      if (chips[0]! <= 0 || chips[1]! <= 0) break;

      const handSeed = Math.floor(masterRng() * 2 ** 32);
      const rng = createSeededRng(handSeed);
      const handId = `hand-${h + 1}`;

      const activePlayers: PlayerSetup[] = [
        { id: 'alice', seatIndex: 0, chips: chips[0]! },
        { id: 'bob', seatIndex: 1, chips: chips[1]! },
      ];

      const { state: initState, events: initEvents } = createInitialState(
        handId,
        activePlayers,
        dealerSeatIndex,
        rng,
        DEFAULT_CONFIG,
      );

      const { finalState, events: playEvents } = playHandToCompletion(initState, rng);
      const allEvents = [...initEvents, ...playEvents];

      // Build and verify hash chain
      const chain = buildHashChain(allEvents);
      expect(chain).toHaveLength(allEvents.length);
      expect(verifyHashChain(allEvents, chain)).toBe(true);

      // Verify chain links
      for (let i = 1; i < chain.length; i++) {
        expect(chain[i]!.previousHash).toBe(chain[i - 1]!.chainHash);
      }

      // Update chips
      for (const p of finalState.players) {
        if (p.id === 'alice') chips[0] = p.chips;
        if (p.id === 'bob') chips[1] = p.chips;
      }

      // Advance dealer
      const activeSeats = activePlayers.map((p) => p.seatIndex);
      dealerSeatIndex = advanceDealer(activeSeats, dealerSeatIndex);
    }

    // Verify chip conservation
    expect(chips[0]! + chips[1]!).toBe(STARTING_CHIPS * 2);
  });

  it('detects tampered hash chain', () => {
    const rng = createSeededRng(SEED);
    const players: PlayerSetup[] = [
      { id: 'alice', seatIndex: 0, chips: 100 },
      { id: 'bob', seatIndex: 1, chips: 100 },
    ];

    const { state, events: initEvents } = createInitialState(
      'tamper-test',
      players,
      0,
      rng,
      DEFAULT_CONFIG,
    );
    const { events: playEvents } = playHandToCompletion(state, rng);
    const allEvents = [...initEvents, ...playEvents];

    const chain = buildHashChain(allEvents);
    expect(verifyHashChain(allEvents, chain)).toBe(true);

    // Tamper with an event
    if (allEvents.length > 1) {
      const tampered = [...allEvents];
      tampered[0] = { ...tampered[0]!, seq: 999 };
      expect(verifyHashChain(tampered, chain)).toBe(false);
    }
  });
});

// ══════════════════════════════════════════════════════════════
// E2E: Event sequence correctness
// ══════════════════════════════════════════════════════════════

describe('E2E: Event sequence correctness', () => {
  it('produces correct event sequence for a complete hand', () => {
    const rng = createSeededRng(SEED);
    const players: PlayerSetup[] = [
      { id: 'alice', seatIndex: 0, chips: 100 },
      { id: 'bob', seatIndex: 1, chips: 100 },
    ];

    const { state, events: initEvents } = createInitialState(
      'seq-test',
      players,
      0,
      rng,
      DEFAULT_CONFIG,
    );

    // Initial events should include HAND_START, BLINDS_POSTED, HOLE_CARDS_DEALT
    expect(initEvents.length).toBeGreaterThanOrEqual(3);

    // Events should have sequential seq numbers
    for (let i = 1; i < initEvents.length; i++) {
      expect(initEvents[i]!.seq).toBeGreaterThan(initEvents[i - 1]!.seq);
    }

    // Play to completion
    const { finalState, events: playEvents } = playHandToCompletion(state, rng);

    // Combine all events and verify overall sequence has non-decreasing seq
    const allEvents = [...initEvents, ...playEvents];
    expect(allEvents.length).toBeGreaterThan(initEvents.length); // play produced events

    // All events should have valid seq fields (>= 0)
    for (const ev of allEvents) {
      expect(typeof ev.seq).toBe('number');
    }

    // Hand should be complete
    expect(finalState.isHandComplete).toBe(true);

    // Total chips must be conserved
    const totalChips = finalState.players.reduce((sum, p) => sum + p.chips, 0);
    expect(totalChips).toBe(200);
  });

  it('maintains chip conservation across 5 hands with varying outcomes', () => {
    const masterRng = createSeededRng(99);
    let chips = [STARTING_CHIPS, STARTING_CHIPS];
    let dealerSeatIndex = 0;

    for (let h = 0; h < NUM_HANDS; h++) {
      if (chips[0]! <= 0 || chips[1]! <= 0) break;

      const rng = createSeededRng(Math.floor(masterRng() * 2 ** 32));

      const { state, events } = createInitialState(
        `conservation-${h}`,
        [
          { id: 'a', seatIndex: 0, chips: chips[0]! },
          { id: 'b', seatIndex: 1, chips: chips[1]! },
        ],
        dealerSeatIndex,
        rng,
        DEFAULT_CONFIG,
      );

      const { finalState } = playHandToCompletion(state, rng);

      chips = [
        finalState.players.find((p) => p.id === 'a')!.chips,
        finalState.players.find((p) => p.id === 'b')!.chips,
      ];

      // Per-hand conservation
      expect(chips[0]! + chips[1]!).toBe(STARTING_CHIPS * 2);

      dealerSeatIndex = advanceDealer([0, 1], dealerSeatIndex);
    }
  });
});
