import { describe, it, expect } from 'vitest';
import {
  assignPositions,
  getFirstToActPreflop,
  getFirstToActPostflop,
  getNextActiveSeat,
  advanceDealer,
  getBlindSeats,
} from '../positions.js';

describe('assignPositions', () => {
  it('assigns BTN and BB for HU (2 players)', () => {
    const result = assignPositions([0, 1], 0);
    expect(result).toEqual([
      { seatIndex: 0, position: 'BTN' },
      { seatIndex: 1, position: 'BB' },
    ]);
  });

  it('assigns BTN/SB/BB for 3 players', () => {
    const result = assignPositions([0, 1, 2], 0);
    expect(result).toEqual([
      { seatIndex: 0, position: 'BTN' },
      { seatIndex: 1, position: 'SB' },
      { seatIndex: 2, position: 'BB' },
    ]);
  });

  it('assigns all positions for 6 players', () => {
    const seats = [0, 1, 2, 3, 4, 5];
    const result = assignPositions(seats, 2);
    expect(result[0]).toEqual({ seatIndex: 2, position: 'BTN' });
    expect(result[1]).toEqual({ seatIndex: 3, position: 'SB' });
    expect(result[2]).toEqual({ seatIndex: 4, position: 'BB' });
    expect(result).toHaveLength(6);
  });

  it('handles non-contiguous seats', () => {
    const result = assignPositions([1, 3, 5], 3);
    expect(result[0]!.seatIndex).toBe(3); // BTN
    expect(result[1]!.seatIndex).toBe(5); // SB
    expect(result[2]!.seatIndex).toBe(1); // BB (wraps around)
  });

  it('throws for < 2 players', () => {
    expect(() => assignPositions([0], 0)).toThrow();
  });

  it('throws for > 6 players', () => {
    expect(() => assignPositions([0, 1, 2, 3, 4, 5, 6], 0)).toThrow();
  });
});

describe('getBlindSeats', () => {
  it('HU: BTN=SB, other=BB', () => {
    const { sbSeat, bbSeat } = getBlindSeats([0, 1], 0);
    expect(sbSeat).toBe(0);
    expect(bbSeat).toBe(1);
  });

  it('3+: SB=left of BTN, BB=left of SB', () => {
    const { sbSeat, bbSeat } = getBlindSeats([0, 1, 2], 0);
    expect(sbSeat).toBe(1);
    expect(bbSeat).toBe(2);
  });

  it('wraps around correctly', () => {
    const { sbSeat, bbSeat } = getBlindSeats([0, 1, 2], 2);
    expect(sbSeat).toBe(0); // wraps
    expect(bbSeat).toBe(1);
  });
});

describe('getFirstToActPreflop', () => {
  it('HU: dealer acts first', () => {
    expect(getFirstToActPreflop([0, 1], 0)).toBe(0);
    expect(getFirstToActPreflop([0, 1], 1)).toBe(1);
  });

  it('3 players: UTG (after BB) acts first', () => {
    // BTN=0, SB=1, BB=2, UTG wraps to 0
    expect(getFirstToActPreflop([0, 1, 2], 0)).toBe(0); // UTG = seat after BB
  });

  it('4 players: UTG acts first', () => {
    // BTN=0, SB=1, BB=2, UTG=3
    expect(getFirstToActPreflop([0, 1, 2, 3], 0)).toBe(3);
  });
});

describe('getFirstToActPostflop', () => {
  it('returns first non-folded, non-allin left of dealer', () => {
    const seats = [0, 1, 2, 3];
    const folded = new Set<number>();
    const allIn = new Set<number>();
    // Dealer=0, so first active after dealer is seat 1
    expect(getFirstToActPostflop(seats, 0, folded, allIn)).toBe(1);
  });

  it('skips folded players', () => {
    const seats = [0, 1, 2, 3];
    const folded = new Set([1]);
    const allIn = new Set<number>();
    expect(getFirstToActPostflop(seats, 0, folded, allIn)).toBe(2);
  });

  it('skips all-in players', () => {
    const seats = [0, 1, 2, 3];
    const folded = new Set<number>();
    const allIn = new Set([1, 2]);
    expect(getFirstToActPostflop(seats, 0, folded, allIn)).toBe(3);
  });

  it('returns -1 if no one can act', () => {
    const seats = [0, 1];
    const folded = new Set<number>();
    const allIn = new Set([0, 1]);
    expect(getFirstToActPostflop(seats, 0, folded, allIn)).toBe(-1);
  });
});

describe('getNextActiveSeat', () => {
  it('returns next seat clockwise', () => {
    const seats = [0, 1, 2, 3];
    expect(getNextActiveSeat(seats, 0, new Set(), new Set())).toBe(1);
    expect(getNextActiveSeat(seats, 3, new Set(), new Set())).toBe(0);
  });

  it('skips folded and all-in', () => {
    const seats = [0, 1, 2, 3];
    expect(getNextActiveSeat(seats, 0, new Set([1]), new Set([2]))).toBe(3);
  });

  it('returns -1 if no active player', () => {
    const seats = [0, 1, 2];
    expect(getNextActiveSeat(seats, 0, new Set([1, 2]), new Set())).toBe(-1);
  });
});

describe('advanceDealer', () => {
  it('moves clockwise', () => {
    expect(advanceDealer([0, 1, 2, 3], 0)).toBe(1);
    expect(advanceDealer([0, 1, 2, 3], 3)).toBe(0);
  });

  it('handles non-contiguous seats', () => {
    expect(advanceDealer([1, 3, 5], 1)).toBe(3);
    expect(advanceDealer([1, 3, 5], 5)).toBe(1);
  });

  it('handles dealer not in list', () => {
    expect(advanceDealer([1, 3, 5], 2)).toBe(1); // fallback to first
  });
});
