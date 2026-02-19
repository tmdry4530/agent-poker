import { describe, it, expect } from 'vitest';
import { CallingStation, RandomBot, AggressiveBot } from '../strategies.js';

describe('CallingStation', () => {
  const strategy = new CallingStation();

  it('should check when available', () => {
    const result = strategy.chooseAction({
      handId: 'h1', street: 'PREFLOP', myId: 'a1', mySeatIndex: 0,
      myHoleCards: [], myChips: 100, myCurrentBet: 0,
      opponentId: 'a2', opponentChips: 100, opponentCurrentBet: 0,
      communityCards: [], potAmount: 0, isMyTurn: true,
      legalActions: ['FOLD', 'CHECK', 'BET'],
    });
    expect(result.action).toBe('CHECK');
  });

  it('should call when facing a bet', () => {
    const result = strategy.chooseAction({
      handId: 'h1', street: 'PREFLOP', myId: 'a1', mySeatIndex: 0,
      myHoleCards: [], myChips: 100, myCurrentBet: 0,
      opponentId: 'a2', opponentChips: 100, opponentCurrentBet: 2,
      communityCards: [], potAmount: 2, isMyTurn: true,
      legalActions: ['FOLD', 'CALL', 'RAISE'],
    });
    expect(result.action).toBe('CALL');
  });

  it('should fold as last resort', () => {
    const result = strategy.chooseAction({
      handId: 'h1', street: 'PREFLOP', myId: 'a1', mySeatIndex: 0,
      myHoleCards: [], myChips: 0, myCurrentBet: 0,
      opponentId: 'a2', opponentChips: 100, opponentCurrentBet: 2,
      communityCards: [], potAmount: 2, isMyTurn: true,
      legalActions: ['FOLD'],
    });
    expect(result.action).toBe('FOLD');
  });
});

describe('RandomBot', () => {
  it('should return a legal action', () => {
    const bot = new RandomBot();
    const result = bot.chooseAction({
      handId: 'h1', street: 'PREFLOP', myId: 'a1', mySeatIndex: 0,
      myHoleCards: [], myChips: 100, myCurrentBet: 0,
      opponentId: 'a2', opponentChips: 100, opponentCurrentBet: 0,
      communityCards: [], potAmount: 0, isMyTurn: true,
      legalActions: ['FOLD', 'CHECK', 'BET'],
    });
    expect(['FOLD', 'CHECK', 'BET']).toContain(result.action);
  });
});

describe('AggressiveBot', () => {
  it('should bet or raise when possible', () => {
    const bot = new AggressiveBot();
    const result = bot.chooseAction({
      handId: 'h1', street: 'PREFLOP', myId: 'a1', mySeatIndex: 0,
      myHoleCards: [], myChips: 100, myCurrentBet: 0,
      opponentId: 'a2', opponentChips: 100, opponentCurrentBet: 0,
      communityCards: [], potAmount: 0, isMyTurn: true,
      legalActions: ['FOLD', 'CHECK', 'BET'],
    });
    expect(result.action).toBe('BET');
  });

  it('should raise when facing a bet', () => {
    const bot = new AggressiveBot();
    const result = bot.chooseAction({
      handId: 'h1', street: 'PREFLOP', myId: 'a1', mySeatIndex: 0,
      myHoleCards: [], myChips: 100, myCurrentBet: 0,
      opponentId: 'a2', opponentChips: 100, opponentCurrentBet: 2,
      communityCards: [], potAmount: 2, isMyTurn: true,
      legalActions: ['FOLD', 'CALL', 'RAISE'],
    });
    expect(result.action).toBe('RAISE');
  });
});
