import { describe, it, expect } from 'vitest';
import { CallingStation, RandomBot, AggressiveBot } from '../strategies.js';

describe('CallingStation', () => {
  const strategy = new CallingStation();

  it('should check when available (multi-player)', () => {
    const result = strategy.chooseAction({
      handId: 'h1', street: 'PREFLOP', myId: 'a1', mySeatIndex: 0,
      myHoleCards: [], myChips: 100, myCurrentBet: 0,
      opponents: [
        { id: 'a2', seatIndex: 1, chips: 100, currentBet: 0, hasFolded: false, isAllIn: false },
        { id: 'a3', seatIndex: 2, chips: 100, currentBet: 0, hasFolded: false, isAllIn: false },
      ],
      numPlayers: 3,
      dealerSeatIndex: 2,
      communityCards: [],
      pots: [{ amount: 0, eligible: ['a1', 'a2', 'a3'] }],
      potAmount: 0,
      isMyTurn: true,
      legalActions: ['FOLD', 'CHECK', 'BET'],
    });
    expect(result.action).toBe('CHECK');
  });

  it('should call when facing a bet (multi-player)', () => {
    const result = strategy.chooseAction({
      handId: 'h1', street: 'PREFLOP', myId: 'a1', mySeatIndex: 0,
      myHoleCards: [], myChips: 100, myCurrentBet: 0,
      opponents: [
        { id: 'a2', seatIndex: 1, chips: 98, currentBet: 2, hasFolded: false, isAllIn: false },
        { id: 'a3', seatIndex: 2, chips: 100, currentBet: 0, hasFolded: true, isAllIn: false },
      ],
      numPlayers: 3,
      dealerSeatIndex: 2,
      communityCards: [],
      pots: [{ amount: 2, eligible: ['a1', 'a2'] }],
      potAmount: 2,
      isMyTurn: true,
      legalActions: ['FOLD', 'CALL', 'RAISE'],
    });
    expect(result.action).toBe('CALL');
  });

  it('should fold as last resort', () => {
    const result = strategy.chooseAction({
      handId: 'h1', street: 'PREFLOP', myId: 'a1', mySeatIndex: 0,
      myHoleCards: [], myChips: 0, myCurrentBet: 0,
      opponents: [
        { id: 'a2', seatIndex: 1, chips: 98, currentBet: 2, hasFolded: false, isAllIn: false },
      ],
      numPlayers: 2,
      dealerSeatIndex: 1,
      communityCards: [],
      pots: [{ amount: 2, eligible: ['a1', 'a2'] }],
      potAmount: 2,
      isMyTurn: true,
      legalActions: ['FOLD'],
    });
    expect(result.action).toBe('FOLD');
  });
});

describe('RandomBot', () => {
  it('should return a legal action (multi-player)', () => {
    const bot = new RandomBot();
    const result = bot.chooseAction({
      handId: 'h1', street: 'PREFLOP', myId: 'a1', mySeatIndex: 0,
      myHoleCards: [], myChips: 100, myCurrentBet: 0,
      opponents: [
        { id: 'a2', seatIndex: 1, chips: 100, currentBet: 0, hasFolded: false, isAllIn: false },
        { id: 'a3', seatIndex: 2, chips: 100, currentBet: 0, hasFolded: false, isAllIn: false },
        { id: 'a4', seatIndex: 3, chips: 100, currentBet: 0, hasFolded: false, isAllIn: false },
      ],
      numPlayers: 4,
      dealerSeatIndex: 3,
      communityCards: [],
      pots: [{ amount: 0, eligible: ['a1', 'a2', 'a3', 'a4'] }],
      potAmount: 0,
      isMyTurn: true,
      legalActions: ['FOLD', 'CHECK', 'BET'],
    });
    expect(['FOLD', 'CHECK', 'BET']).toContain(result.action);
  });
});

describe('AggressiveBot', () => {
  it('should bet or raise when possible (multi-player)', () => {
    const bot = new AggressiveBot();
    const result = bot.chooseAction({
      handId: 'h1', street: 'PREFLOP', myId: 'a1', mySeatIndex: 0,
      myHoleCards: [], myChips: 100, myCurrentBet: 0,
      opponents: [
        { id: 'a2', seatIndex: 1, chips: 100, currentBet: 0, hasFolded: false, isAllIn: false },
        { id: 'a3', seatIndex: 2, chips: 100, currentBet: 0, hasFolded: false, isAllIn: false },
      ],
      numPlayers: 3,
      dealerSeatIndex: 2,
      communityCards: [],
      pots: [{ amount: 0, eligible: ['a1', 'a2', 'a3'] }],
      potAmount: 0,
      isMyTurn: true,
      legalActions: ['FOLD', 'CHECK', 'BET'],
    });
    expect(result.action).toBe('BET');
  });

  it('should raise when facing a bet (multi-player)', () => {
    const bot = new AggressiveBot();
    const result = bot.chooseAction({
      handId: 'h1', street: 'PREFLOP', myId: 'a1', mySeatIndex: 0,
      myHoleCards: [], myChips: 100, myCurrentBet: 0,
      opponents: [
        { id: 'a2', seatIndex: 1, chips: 98, currentBet: 2, hasFolded: false, isAllIn: false },
        { id: 'a3', seatIndex: 2, chips: 100, currentBet: 0, hasFolded: true, isAllIn: false },
      ],
      numPlayers: 3,
      dealerSeatIndex: 2,
      communityCards: [],
      pots: [{ amount: 2, eligible: ['a1', 'a2'] }],
      potAmount: 2,
      isMyTurn: true,
      legalActions: ['FOLD', 'CALL', 'RAISE'],
    });
    expect(result.action).toBe('RAISE');
  });
});
