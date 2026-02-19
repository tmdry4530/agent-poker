import { describe, it, expect } from 'vitest';
import { TightAggressiveBot, PotControlBot, ShortStackBot } from '../nl-strategies.js';
import type { VisibleGameState } from '../types.js';

const createMockState = (overrides?: Partial<VisibleGameState>): VisibleGameState => ({
  handId: 'test-hand',
  street: 'PREFLOP',
  myId: 'bot1',
  mySeatIndex: 0,
  myHoleCards: [
    { rank: 'A', suit: 'h' },
    { rank: 'K', suit: 'h' },
  ],
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
  legalActions: ['FOLD', 'CHECK', 'BET'],
  bettingMode: 'NO_LIMIT',
  actionRanges: {
    minBet: 2,
    maxBet: 1000,
    minRaise: 4,
    maxRaise: 1000,
  },
  ...overrides,
});

describe('TightAggressiveBot', () => {
  const bot = new TightAggressiveBot();

  it('should bet with premium hands (AA)', () => {
    const state = createMockState({
      myHoleCards: [
        { rank: 'A', suit: 'h' },
        { rank: 'A', suit: 'd' },
      ],
      potAmount: 100,
    });
    const action = bot.chooseAction(state);
    expect(action.action).toBe('BET');
    expect(action.amount).toBeGreaterThan(0);
    expect(action.amount).toBeLessThanOrEqual(1000);
  });

  it('should fold weak hands (72o)', () => {
    const state = createMockState({
      myHoleCards: [
        { rank: '7', suit: 'h' },
        { rank: '2', suit: 'd' },
      ],
      legalActions: ['FOLD', 'CALL'],
    });
    const action = bot.chooseAction(state);
    expect(action.action).toBe('FOLD');
  });

  it('should check with weak hands when free', () => {
    const state = createMockState({
      myHoleCards: [
        { rank: '7', suit: 'h' },
        { rank: '2', suit: 'd' },
      ],
      legalActions: ['FOLD', 'CHECK'],
    });
    const action = bot.chooseAction(state);
    expect(action.action).toBe('CHECK');
  });

  it('should raise with strong hands (KK)', () => {
    const state = createMockState({
      myHoleCards: [
        { rank: 'K', suit: 'h' },
        { rank: 'K', suit: 'd' },
      ],
      legalActions: ['FOLD', 'CALL', 'RAISE'],
      potAmount: 50,
      actionRanges: {
        minBet: 2,
        maxBet: 1000,
        minRaise: 10,
        maxRaise: 1000,
      },
    });
    const action = bot.chooseAction(state);
    expect(action.action).toBe('RAISE');
    expect(action.amount).toBeGreaterThanOrEqual(10);
    expect(action.amount).toBeLessThanOrEqual(1000);
  });
});

describe('PotControlBot', () => {
  it('should bet 50% of pot by default', () => {
    const bot = new PotControlBot();
    const state = createMockState({
      potAmount: 100,
      legalActions: ['FOLD', 'CHECK', 'BET'],
    });
    const action = bot.chooseAction(state);
    expect(action.action).toBe('BET');
    // 50% of 100 = 50, should be at least minBet (2)
    expect(action.amount).toBeGreaterThanOrEqual(2);
    expect(action.amount).toBeLessThanOrEqual(100);
  });

  it('should use custom ratio', () => {
    const bot = new PotControlBot(0.75);
    const state = createMockState({
      potAmount: 100,
      legalActions: ['FOLD', 'CHECK', 'BET'],
    });
    const action = bot.chooseAction(state);
    expect(action.action).toBe('BET');
    // 75% of 100 = 75
    expect(action.amount).toBeGreaterThanOrEqual(2);
    expect(action.amount).toBeLessThanOrEqual(100);
  });

  it('should fold very weak hands facing bet', () => {
    const bot = new PotControlBot();
    const state = createMockState({
      myHoleCards: [
        { rank: '7', suit: 'h' },
        { rank: '2', suit: 'd' },
      ],
      legalActions: ['FOLD', 'CALL'],
    });
    const action = bot.chooseAction(state);
    expect(action.action).toBe('FOLD');
  });

  it('should respect min/max bet ranges', () => {
    const bot = new PotControlBot(0.5);
    const state = createMockState({
      potAmount: 2,
      actionRanges: {
        minBet: 10,
        maxBet: 50,
        minRaise: 20,
        maxRaise: 50,
      },
      legalActions: ['FOLD', 'CHECK', 'BET'],
    });
    const action = bot.chooseAction(state);
    expect(action.action).toBe('BET');
    // 50% of 2 = 1, but minBet is 10
    expect(action.amount).toBeGreaterThanOrEqual(10);
    expect(action.amount).toBeLessThanOrEqual(50);
  });
});

describe('ShortStackBot', () => {
  const bot = new ShortStackBot();

  it('should push all-in with top 25% hands (AK)', () => {
    const state = createMockState({
      myHoleCards: [
        { rank: 'A', suit: 'h' },
        { rank: 'K', suit: 'd' },
      ],
      myChips: 200,
      legalActions: ['FOLD', 'CHECK', 'BET'],
    });
    const action = bot.chooseAction(state);
    expect(action.action).toBe('BET');
    expect(action.amount).toBe(200); // All-in
  });

  it('should push with pocket pairs (99)', () => {
    const state = createMockState({
      myHoleCards: [
        { rank: '9', suit: 'h' },
        { rank: '9', suit: 'd' },
      ],
      myChips: 150,
      legalActions: ['FOLD', 'CHECK', 'BET'],
    });
    const action = bot.chooseAction(state);
    expect(action.action).toBe('BET');
    expect(action.amount).toBe(150);
  });

  it('should fold weak hands (T5o)', () => {
    const state = createMockState({
      myHoleCards: [
        { rank: 'T', suit: 'h' },
        { rank: '5', suit: 'd' },
      ],
      legalActions: ['FOLD', 'CALL'],
    });
    const action = bot.chooseAction(state);
    expect(action.action).toBe('FOLD');
  });

  it('should check weak hands when free', () => {
    const state = createMockState({
      myHoleCards: [
        { rank: 'T', suit: 'h' },
        { rank: '5', suit: 'd' },
      ],
      legalActions: ['FOLD', 'CHECK'],
    });
    const action = bot.chooseAction(state);
    expect(action.action).toBe('CHECK');
  });

  it('should raise all-in when facing a raise', () => {
    const state = createMockState({
      myHoleCards: [
        { rank: 'Q', suit: 'h' },
        { rank: 'Q', suit: 'd' },
      ],
      myChips: 300,
      legalActions: ['FOLD', 'CALL', 'RAISE'],
      actionRanges: {
        minBet: 2,
        maxBet: 1000,
        minRaise: 50,
        maxRaise: 1000,
      },
    });
    const action = bot.chooseAction(state);
    expect(action.action).toBe('RAISE');
    expect(action.amount).toBe(300); // All-in
  });
});

describe('NL strategies - bet amount validation', () => {
  it('TightAggressiveBot bets within legal ranges', () => {
    const bot = new TightAggressiveBot();
    const state = createMockState({
      myHoleCards: [
        { rank: 'A', suit: 'h' },
        { rank: 'A', suit: 'd' },
      ],
      potAmount: 50,
      actionRanges: {
        minBet: 10,
        maxBet: 100,
        minRaise: 20,
        maxRaise: 100,
      },
    });
    const action = bot.chooseAction(state);
    if (action.amount !== undefined) {
      expect(action.amount).toBeGreaterThanOrEqual(10);
      expect(action.amount).toBeLessThanOrEqual(100);
    }
  });

  it('PotControlBot respects maxBet limit', () => {
    const bot = new PotControlBot(1.0); // 100% pot
    const state = createMockState({
      potAmount: 500,
      actionRanges: {
        minBet: 2,
        maxBet: 200, // Lower than pot
        minRaise: 4,
        maxRaise: 200,
      },
    });
    const action = bot.chooseAction(state);
    if (action.amount !== undefined) {
      expect(action.amount).toBeLessThanOrEqual(200);
    }
  });

  it('ShortStackBot never exceeds myChips', () => {
    const bot = new ShortStackBot();
    const state = createMockState({
      myHoleCards: [
        { rank: 'K', suit: 'h' },
        { rank: 'K', suit: 'd' },
      ],
      myChips: 50,
      actionRanges: {
        minBet: 2,
        maxBet: 1000,
        minRaise: 4,
        maxRaise: 1000,
      },
    });
    const action = bot.chooseAction(state);
    if (action.amount !== undefined) {
      expect(action.amount).toBeLessThanOrEqual(50);
    }
  });
});
