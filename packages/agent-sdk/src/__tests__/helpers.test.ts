import { describe, it, expect } from 'vitest';
import {
  getMinBet,
  getMaxBet,
  getMinRaise,
  getMaxRaise,
  getCallAmount,
  isNoLimit,
  isPotLimit,
  isLimit,
} from '../helpers.js';
import type { VisibleGameState } from '../types.js';

const createMockState = (overrides?: Partial<VisibleGameState>): VisibleGameState => ({
  handId: 'test-hand',
  street: 'PREFLOP',
  myId: 'bot1',
  mySeatIndex: 0,
  myHoleCards: [],
  myChips: 1000,
  myCurrentBet: 0,
  opponents: [
    { id: 'p2', seatIndex: 1, chips: 1000, currentBet: 0, hasFolded: false, isAllIn: false },
  ],
  numPlayers: 2,
  dealerSeatIndex: 1,
  communityCards: [],
  pots: [{ amount: 0, eligible: ['bot1', 'p2'] }],
  potAmount: 0,
  isMyTurn: true,
  legalActions: ['FOLD', 'CHECK'],
  ...overrides,
});

describe('helpers', () => {
  describe('getMinBet', () => {
    it('should return minBet from actionRanges', () => {
      const state = createMockState({
        actionRanges: { minBet: 10, maxBet: 100, minRaise: 20, maxRaise: 100 },
      });
      expect(getMinBet(state)).toBe(10);
    });

    it('should return 0 if no actionRanges', () => {
      const state = createMockState();
      expect(getMinBet(state)).toBe(0);
    });
  });

  describe('getMaxBet', () => {
    it('should return maxBet from actionRanges', () => {
      const state = createMockState({
        actionRanges: { minBet: 10, maxBet: 500, minRaise: 20, maxRaise: 500 },
      });
      expect(getMaxBet(state)).toBe(500);
    });

    it('should return myChips if no actionRanges', () => {
      const state = createMockState({ myChips: 1000 });
      expect(getMaxBet(state)).toBe(1000);
    });
  });

  describe('getMinRaise', () => {
    it('should return minRaise from actionRanges', () => {
      const state = createMockState({
        actionRanges: { minBet: 10, maxBet: 100, minRaise: 30, maxRaise: 100 },
      });
      expect(getMinRaise(state)).toBe(30);
    });

    it('should return 0 if no actionRanges', () => {
      const state = createMockState();
      expect(getMinRaise(state)).toBe(0);
    });
  });

  describe('getMaxRaise', () => {
    it('should return maxRaise from actionRanges', () => {
      const state = createMockState({
        actionRanges: { minBet: 10, maxBet: 100, minRaise: 20, maxRaise: 200 },
      });
      expect(getMaxRaise(state)).toBe(200);
    });

    it('should return myChips if no actionRanges', () => {
      const state = createMockState({ myChips: 1000 });
      expect(getMaxRaise(state)).toBe(1000);
    });
  });

  describe('getCallAmount', () => {
    it('should return 0 when no bet to call', () => {
      const state = createMockState({
        myCurrentBet: 0,
        opponents: [
          { id: 'p2', seatIndex: 1, chips: 1000, currentBet: 0, hasFolded: false, isAllIn: false },
        ],
      });
      expect(getCallAmount(state)).toBe(0);
    });

    it('should return call amount when facing a bet', () => {
      const state = createMockState({
        myCurrentBet: 10,
        opponents: [
          { id: 'p2', seatIndex: 1, chips: 1000, currentBet: 50, hasFolded: false, isAllIn: false },
        ],
      });
      expect(getCallAmount(state)).toBe(40); // 50 - 10
    });

    it('should handle multiple opponents', () => {
      const state = createMockState({
        myCurrentBet: 10,
        opponents: [
          { id: 'p2', seatIndex: 1, chips: 1000, currentBet: 30, hasFolded: false, isAllIn: false },
          { id: 'p3', seatIndex: 2, chips: 1000, currentBet: 50, hasFolded: false, isAllIn: false },
          { id: 'p4', seatIndex: 3, chips: 1000, currentBet: 20, hasFolded: false, isAllIn: false },
        ],
      });
      expect(getCallAmount(state)).toBe(40); // max(30, 50, 20) - 10 = 40
    });

    it('should never return negative', () => {
      const state = createMockState({
        myCurrentBet: 100,
        opponents: [
          { id: 'p2', seatIndex: 1, chips: 1000, currentBet: 50, hasFolded: false, isAllIn: false },
        ],
      });
      expect(getCallAmount(state)).toBe(0);
    });
  });

  describe('betting mode checks', () => {
    it('isNoLimit should detect NO_LIMIT mode', () => {
      const state = createMockState({ bettingMode: 'NO_LIMIT' });
      expect(isNoLimit(state)).toBe(true);
      expect(isPotLimit(state)).toBe(false);
      expect(isLimit(state)).toBe(false);
    });

    it('isPotLimit should detect POT_LIMIT mode', () => {
      const state = createMockState({ bettingMode: 'POT_LIMIT' });
      expect(isPotLimit(state)).toBe(true);
      expect(isNoLimit(state)).toBe(false);
      expect(isLimit(state)).toBe(false);
    });

    it('isLimit should detect LIMIT mode', () => {
      const state = createMockState({ bettingMode: 'LIMIT' });
      expect(isLimit(state)).toBe(true);
      expect(isNoLimit(state)).toBe(false);
      expect(isPotLimit(state)).toBe(false);
    });

    it('isLimit should default to true when no bettingMode', () => {
      const state = createMockState();
      expect(isLimit(state)).toBe(true);
    });
  });
});
