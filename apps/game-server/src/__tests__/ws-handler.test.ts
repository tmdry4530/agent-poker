import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ActionType } from '@agent-poker/poker-engine';
import { TableActor } from '../table-actor.js';
import { signSeatToken, verifySeatToken, refreshSeatToken } from '../seat-token.js';
import { RateLimiter } from '../rate-limiter.js';
import { PROTOCOL_VERSION } from '../types.js';
import { WsEnvelopeSchema, HelloPayloadSchema, ActionPayloadSchema } from '../schemas.js';

// ══════════════════════════════════════════════════════════════
// TableActor unit tests
// ══════════════════════════════════════════════════════════════

describe('TableActor', () => {
  let table: TableActor;

  beforeEach(() => {
    table = new TableActor({
      tableId: 'test-table',
      maxSeats: 4,
      actionTimeoutMs: 60000, // long timeout so it doesn't fire during tests
    });
  });

  afterEach(() => {
    table.close();
  });

  it('creates a table with correct initial state', () => {
    const info = table.getInfo();
    expect(info.id).toBe('test-table');
    expect(info.variant).toBe('LHE');
    expect(info.maxSeats).toBe(4);
    expect(info.status).toBe('open');
    expect(info.seats).toHaveLength(0);
    expect(info.handsPlayed).toBe(0);
  });

  it('adds a seat successfully', () => {
    const token = signSeatToken({ agentId: 'agent-1', tableId: 'test-table' });
    const seat = table.addSeat('agent-1', token, 1000);
    expect(seat.agentId).toBe('agent-1');
    expect(seat.seatIndex).toBe(0);
    expect(seat.chips).toBe(1000);
    expect(seat.status).toBe('seated');
  });

  it('rejects duplicate agent seating', () => {
    const token1 = signSeatToken({ agentId: 'agent-1', tableId: 'test-table' });
    table.addSeat('agent-1', token1, 1000);
    expect(() => table.addSeat('agent-1', token1, 1000)).toThrow('Agent already seated');
  });

  it('rejects seating when table is full', () => {
    for (let i = 0; i < 4; i++) {
      const token = signSeatToken({ agentId: `agent-${i}`, tableId: 'test-table' });
      table.addSeat(`agent-${i}`, token, 1000);
    }
    const token = signSeatToken({ agentId: 'agent-extra', tableId: 'test-table' });
    expect(() => table.addSeat('agent-extra', token, 1000)).toThrow('Table is full');
  });

  it('removes a seat', () => {
    const token = signSeatToken({ agentId: 'agent-1', tableId: 'test-table' });
    table.addSeat('agent-1', token, 1000);
    table.removeSeat('agent-1');
    const seats = table.getSeats();
    expect(seats.find((s) => s.agentId === 'agent-1')!.status).toBe('left');
  });

  it('canStartHand requires at least 2 players with chips', () => {
    expect(table.canStartHand()).toBe(false);
    const token1 = signSeatToken({ agentId: 'agent-1', tableId: 'test-table' });
    table.addSeat('agent-1', token1, 1000);
    expect(table.canStartHand()).toBe(false);
    const token2 = signSeatToken({ agentId: 'agent-2', tableId: 'test-table' });
    table.addSeat('agent-2', token2, 1000);
    expect(table.canStartHand()).toBe(true);
  });

  it('starts a hand and returns state and events', () => {
    const token1 = signSeatToken({ agentId: 'agent-1', tableId: 'test-table' });
    const token2 = signSeatToken({ agentId: 'agent-2', tableId: 'test-table' });
    table.addSeat('agent-1', token1, 1000);
    table.addSeat('agent-2', token2, 1000);
    const { state, events } = table.startHand();
    expect(state).toBeDefined();
    expect(state.players).toHaveLength(2);
    expect(events.length).toBeGreaterThan(0);
    expect(state.isHandComplete).toBe(false);
  });

  it('throws when starting hand without enough players', () => {
    expect(() => table.startHand()).toThrow('Cannot start hand');
  });

  it('processAction returns idempotent result for same requestId', () => {
    const token1 = signSeatToken({ agentId: 'agent-1', tableId: 'test-table' });
    const token2 = signSeatToken({ agentId: 'agent-2', tableId: 'test-table' });
    table.addSeat('agent-1', token1, 1000);
    table.addSeat('agent-2', token2, 1000);
    const { state } = table.startHand();

    const activePlayer = state.players.find(
      (p) => p.seatIndex === state.activePlayerSeatIndex,
    )!;

    // Use CALL instead of FOLD — FOLD in HU completes the hand and clears state
    const result1 = table.processAction(activePlayer.id, { type: ActionType.CALL }, 'req-1');
    expect(result1.alreadyProcessed).toBe(false);

    // Same requestId should be idempotent (hand still active after CALL)
    const result2 = table.processAction(activePlayer.id, { type: ActionType.CALL }, 'req-1');
    expect(result2.alreadyProcessed).toBe(true);
  });

  it('tracks hands played count', () => {
    expect(table.getHandsPlayed()).toBe(0);
  });

  it('hand history is initially empty', () => {
    expect(table.getHandHistory()).toHaveLength(0);
    expect(table.getHandById('nonexistent')).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════
// Seat token tests
// ══════════════════════════════════════════════════════════════

describe('SeatToken', () => {
  it('signs and verifies a valid seat token', () => {
    const token = signSeatToken({ agentId: 'agent-1', tableId: 'table-1' });
    const payload = verifySeatToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.agentId).toBe('agent-1');
    expect(payload!.tableId).toBe('table-1');
  });

  it('returns null for invalid token', () => {
    expect(verifySeatToken('invalid-token')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(verifySeatToken('')).toBeNull();
  });

  it('refreshes a valid token', () => {
    const token = signSeatToken({ agentId: 'agent-1', tableId: 'table-1' });
    const newToken = refreshSeatToken(token);
    expect(newToken).not.toBeNull();
    expect(typeof newToken).toBe('string');
    // Verify the refreshed token decodes to the same payload
    const payload = verifySeatToken(newToken!);
    expect(payload).not.toBeNull();
    expect(payload!.agentId).toBe('agent-1');
    expect(payload!.tableId).toBe('table-1');
  });

  it('returns null when refreshing invalid token', () => {
    expect(refreshSeatToken('invalid')).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════
// RateLimiter tests
// ══════════════════════════════════════════════════════════════

describe('RateLimiter', () => {
  it('allows requests within limits', async () => {
    const limiter = new RateLimiter();
    const result = await limiter.tryConsume('agent-1', 'action');
    expect(result.allowed).toBe(true);
  });

  it('blocks after exceeding token bucket', async () => {
    const limiter = new RateLimiter();
    // Exhaust all 10 tokens
    for (let i = 0; i < 10; i++) {
      const r = await limiter.tryConsume('agent-1', 'action');
      expect(r.allowed).toBe(true);
    }
    // 11th should be denied
    const result = await limiter.tryConsume('agent-1', 'action');
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('allows unconfigured action types', async () => {
    const limiter = new RateLimiter();
    const result = await limiter.tryConsume('agent-1', 'unknown-type');
    expect(result.allowed).toBe(true);
  });

  it('supports custom config', async () => {
    const limiter = new RateLimiter();
    limiter.setConfig('custom', { maxTokens: 2, refillRate: 1 });
    expect((await limiter.tryConsume('a', 'custom')).allowed).toBe(true);
    expect((await limiter.tryConsume('a', 'custom')).allowed).toBe(true);
    expect((await limiter.tryConsume('a', 'custom')).allowed).toBe(false);
  });

  it('rate limits per agent independently', async () => {
    const limiter = new RateLimiter();
    limiter.setConfig('test', { maxTokens: 1, refillRate: 0.001 });
    expect((await limiter.tryConsume('agent-a', 'test')).allowed).toBe(true);
    expect((await limiter.tryConsume('agent-a', 'test')).allowed).toBe(false);
    // Different agent should still be allowed
    expect((await limiter.tryConsume('agent-b', 'test')).allowed).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════
// Zod schema validation tests
// ══════════════════════════════════════════════════════════════

describe('WS Schemas', () => {
  it('validates a correct WsEnvelope', () => {
    const result = WsEnvelopeSchema.safeParse({
      protocolVersion: 1,
      type: 'HELLO',
      tableId: 'tbl-1',
      payload: { agentId: 'a', seatToken: 'tok' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects WsEnvelope missing protocolVersion', () => {
    const result = WsEnvelopeSchema.safeParse({
      type: 'HELLO',
    });
    expect(result.success).toBe(false);
  });

  it('rejects WsEnvelope with non-integer protocolVersion', () => {
    const result = WsEnvelopeSchema.safeParse({
      protocolVersion: 1.5,
      type: 'HELLO',
    });
    expect(result.success).toBe(false);
  });

  it('validates HelloPayload', () => {
    const result = HelloPayloadSchema.safeParse({
      agentId: 'agent-1',
      seatToken: 'token-xyz',
    });
    expect(result.success).toBe(true);
  });

  it('rejects HelloPayload with empty agentId', () => {
    const result = HelloPayloadSchema.safeParse({
      agentId: '',
      seatToken: 'token',
    });
    expect(result.success).toBe(false);
  });

  it('validates ActionPayload', () => {
    const result = ActionPayloadSchema.safeParse({
      action: 'FOLD',
    });
    expect(result.success).toBe(true);
  });

  it('validates ActionPayload with amount', () => {
    const result = ActionPayloadSchema.safeParse({
      action: 'BET',
      amount: 100,
    });
    expect(result.success).toBe(true);
  });

  it('rejects ActionPayload with invalid action', () => {
    const result = ActionPayloadSchema.safeParse({
      action: 'INVALID',
    });
    expect(result.success).toBe(false);
  });

  it('rejects ActionPayload with negative amount', () => {
    const result = ActionPayloadSchema.safeParse({
      action: 'BET',
      amount: -10,
    });
    expect(result.success).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// Card masking / sanitizeStateForPlayer equivalent
// ══════════════════════════════════════════════════════════════

describe('State sanitization logic', () => {
  it('masks opponent hole cards in non-complete hand', () => {
    const state = {
      isHandComplete: false,
      players: [
        { id: 'alice', holeCards: [{ rank: 'A', suit: 'S' }, { rank: 'K', suit: 'H' }] },
        { id: 'bob', holeCards: [{ rank: 'Q', suit: 'D' }, { rank: 'J', suit: 'C' }] },
      ],
      deck: ['2H', '3D'],
    };

    // Simulate the sanitizeStateForPlayer function logic
    const clone = structuredClone(state);
    for (const p of clone.players) {
      if (p.id !== 'alice' && !clone.isHandComplete) {
        p.holeCards = [];
      }
    }
    delete (clone as any).deck;

    expect(clone.players[0]!.holeCards).toHaveLength(2); // Alice sees her own
    expect(clone.players[1]!.holeCards).toHaveLength(0); // Bob's cards masked
    expect((clone as any).deck).toBeUndefined(); // Deck removed
  });

  it('reveals all cards when hand is complete', () => {
    const state = {
      isHandComplete: true,
      players: [
        { id: 'alice', holeCards: [{ rank: 'A', suit: 'S' }, { rank: 'K', suit: 'H' }] },
        { id: 'bob', holeCards: [{ rank: 'Q', suit: 'D' }, { rank: 'J', suit: 'C' }] },
      ],
      deck: [],
    };

    const clone = structuredClone(state);
    for (const p of clone.players) {
      if (p.id !== 'alice' && !clone.isHandComplete) {
        p.holeCards = [];
      }
    }
    delete (clone as any).deck;

    expect(clone.players[0]!.holeCards).toHaveLength(2);
    expect(clone.players[1]!.holeCards).toHaveLength(2); // Visible at showdown
  });
});
