import { describe, it, expect } from 'vitest';
import { calculateSidePots } from '../side-pots.js';
import type { PlayerState } from '../types.js';

function makePlayer(overrides: Partial<PlayerState> & { id: string }): PlayerState {
  return {
    seatIndex: 0,
    chips: 0,
    holeCards: [],
    currentBet: 0,
    totalBetThisHand: 0,
    hasFolded: false,
    hasActed: true,
    isAllIn: false,
    ...overrides,
  };
}

describe('calculateSidePots', () => {
  it('single pot when no all-ins', () => {
    const players = [
      makePlayer({ id: 'a', seatIndex: 0, totalBetThisHand: 10, chips: 90 }),
      makePlayer({ id: 'b', seatIndex: 1, totalBetThisHand: 10, chips: 90 }),
      makePlayer({ id: 'c', seatIndex: 2, totalBetThisHand: 10, chips: 90 }),
    ];
    const pots = calculateSidePots(players);
    expect(pots).toHaveLength(1);
    expect(pots[0]!.amount).toBe(30);
    expect(pots[0]!.eligible).toEqual(['a', 'b', 'c']);
  });

  it('main pot + side pot with one short-stack all-in', () => {
    const players = [
      makePlayer({ id: 'a', seatIndex: 0, totalBetThisHand: 5, chips: 0, isAllIn: true }),
      makePlayer({ id: 'b', seatIndex: 1, totalBetThisHand: 10, chips: 90 }),
      makePlayer({ id: 'c', seatIndex: 2, totalBetThisHand: 10, chips: 90 }),
    ];
    const pots = calculateSidePots(players);
    expect(pots).toHaveLength(2);
    // Main pot: 5 * 3 = 15, eligible: a, b, c
    expect(pots[0]!.amount).toBe(15);
    expect(pots[0]!.eligible).toContain('a');
    expect(pots[0]!.eligible).toContain('b');
    expect(pots[0]!.eligible).toContain('c');
    // Side pot: 5 * 2 = 10, eligible: b, c
    expect(pots[1]!.amount).toBe(10);
    expect(pots[1]!.eligible).not.toContain('a');
    expect(pots[1]!.eligible).toContain('b');
    expect(pots[1]!.eligible).toContain('c');
  });

  it('multiple side pots with different all-in levels', () => {
    const players = [
      makePlayer({ id: 'a', seatIndex: 0, totalBetThisHand: 5, chips: 0, isAllIn: true }),
      makePlayer({ id: 'b', seatIndex: 1, totalBetThisHand: 15, chips: 0, isAllIn: true }),
      makePlayer({ id: 'c', seatIndex: 2, totalBetThisHand: 30, chips: 70 }),
    ];
    const pots = calculateSidePots(players);
    expect(pots).toHaveLength(3);
    // Main pot: 5 * 3 = 15 (a, b, c)
    expect(pots[0]!.amount).toBe(15);
    // Side pot 1: 10 * 2 = 20 (b, c)
    expect(pots[1]!.amount).toBe(20);
    expect(pots[1]!.eligible).not.toContain('a');
    // Side pot 2: 15 * 1 = 15 (c only)
    expect(pots[2]!.amount).toBe(15);
    expect(pots[2]!.eligible).toEqual(['c']);
    // Total: 15 + 20 + 15 = 50 = 5 + 15 + 30
    expect(pots.reduce((s, p) => s + p.amount, 0)).toBe(50);
  });

  it('folded player contributes but is not eligible', () => {
    const players = [
      makePlayer({ id: 'a', seatIndex: 0, totalBetThisHand: 5, chips: 0, isAllIn: true }),
      makePlayer({ id: 'b', seatIndex: 1, totalBetThisHand: 10, hasFolded: true }),
      makePlayer({ id: 'c', seatIndex: 2, totalBetThisHand: 10, chips: 90 }),
    ];
    const pots = calculateSidePots(players);
    // Main pot: min(5)*3 = 15, eligible: a, c (not b — folded)
    expect(pots[0]!.eligible).not.toContain('b');
    // Total chips in pots = 25
    expect(pots.reduce((s, p) => s + p.amount, 0)).toBe(25);
  });

  it('two players same all-in amount', () => {
    const players = [
      makePlayer({ id: 'a', seatIndex: 0, totalBetThisHand: 10, chips: 0, isAllIn: true }),
      makePlayer({ id: 'b', seatIndex: 1, totalBetThisHand: 10, chips: 0, isAllIn: true }),
      makePlayer({ id: 'c', seatIndex: 2, totalBetThisHand: 20, chips: 80 }),
    ];
    const pots = calculateSidePots(players);
    // Main pot: 10 * 3 = 30 (a, b, c)
    expect(pots[0]!.amount).toBe(30);
    expect(pots[0]!.eligible).toHaveLength(3);
    // Side pot: 10 * 1 = 10 (c only)
    expect(pots[1]!.amount).toBe(10);
    expect(pots[1]!.eligible).toEqual(['c']);
  });
});
