import type { AgentStrategy, ChosenAction, VisibleGameState } from './types.js';
import { getMinBet, getMaxBet, getMinRaise, getMaxRaise, getCallAmount } from './helpers.js';

/**
 * Evaluates hand strength based on simplified preflop charts.
 * Returns a tier: 1 (premium), 2 (strong), 3 (playable), 4 (marginal), 5 (weak).
 */
function evaluateHandTier(holeCards: Array<{ rank: string; suit: string }>): number {
  if (holeCards.length !== 2) return 5;

  const [c1, c2] = holeCards;
  if (!c1 || !c2) return 5;

  const r1 = c1.rank;
  const r2 = c2.rank;
  const suited = c1.suit === c2.suit;

  const rankOrder = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
  const val1 = rankOrder.indexOf(r1);
  const val2 = rankOrder.indexOf(r2);

  const high = Math.max(val1, val2);
  const low = Math.min(val1, val2);
  const isPair = val1 === val2;

  // Tier 1: Premium hands (top ~5%)
  if (isPair && high >= 10) return 1; // AA, KK, QQ
  if (high === 12 && low === 11 && suited) return 1; // AKs

  // Tier 2: Strong hands (top ~15%)
  if (isPair && high >= 9) return 2; // JJ, TT
  if (high === 12 && low >= 10) return 2; // AK, AQ, AJ
  if (high === 11 && low === 10 && suited) return 2; // KQs

  // Tier 3: Playable hands (top ~25%)
  if (isPair && high >= 7) return 3; // 99, 88
  if (high === 12 && low >= 8) return 3; // AT, A9
  if (high >= 10 && low >= 9 && suited) return 3; // KJs, QJs, JTs

  // Tier 4: Marginal hands (top ~40%)
  if (isPair) return 4; // Any pocket pair
  if (high >= 11 && low >= 8) return 4; // KT, QT, Q9
  if (suited && high >= 9 && low >= 7) return 4; // Suited connectors/one-gappers

  // Tier 5: Weak hands
  return 5;
}

/**
 * TightAggressiveBot: Plays premium hands aggressively, folds weak hands.
 * - Top 15% preflop: raise/bet big (80-100% pot)
 * - Other hands: fold unless can check
 */
export class TightAggressiveBot implements AgentStrategy {
  chooseAction(state: VisibleGameState): ChosenAction {
    const tier = evaluateHandTier(state.myHoleCards);
    const isStrongHand = tier <= 2; // Top ~15%

    if (!isStrongHand) {
      // Weak hand: check if free, otherwise fold
      if (state.legalActions.includes('CHECK')) {
        return { action: 'CHECK' };
      }
      return { action: 'FOLD' };
    }

    // Strong hand: raise/bet aggressively
    if (state.legalActions.includes('RAISE')) {
      const minRaise = getMinRaise(state);
      const maxRaise = getMaxRaise(state);
      // Raise to 80-100% pot or max
      const potRaise = Math.min(Math.floor(state.potAmount * 0.9), maxRaise);
      const raiseAmount = Math.max(minRaise, potRaise);
      return { action: 'RAISE', amount: raiseAmount };
    }

    if (state.legalActions.includes('BET')) {
      const minBet = getMinBet(state);
      const maxBet = getMaxBet(state);
      // Bet 80-100% pot or max
      const potBet = Math.min(Math.floor(state.potAmount * 0.9), maxBet);
      const betAmount = Math.max(minBet, potBet);
      return { action: 'BET', amount: betAmount };
    }

    if (state.legalActions.includes('CALL')) {
      return { action: 'CALL' };
    }

    if (state.legalActions.includes('CHECK')) {
      return { action: 'CHECK' };
    }

    return { action: 'FOLD' };
  }
}

/**
 * PotControlBot: Bets proportional to pot size.
 * - Default ratio: 50% of pot
 * - Configurable via constructor
 */
export class PotControlBot implements AgentStrategy {
  private ratio: number;

  constructor(ratio: number = 0.5) {
    this.ratio = Math.max(0.1, Math.min(1.0, ratio)); // Clamp to [0.1, 1.0]
  }

  chooseAction(state: VisibleGameState): ChosenAction {
    const tier = evaluateHandTier(state.myHoleCards);

    // Fold very weak hands (tier 5) if facing a bet
    if (tier === 5 && state.legalActions.includes('CALL')) {
      return { action: 'FOLD' };
    }

    if (state.legalActions.includes('RAISE')) {
      const minRaise = getMinRaise(state);
      const maxRaise = getMaxRaise(state);
      const potRaise = Math.min(Math.floor(state.potAmount * this.ratio), maxRaise);
      const raiseAmount = Math.max(minRaise, potRaise);
      return { action: 'RAISE', amount: raiseAmount };
    }

    if (state.legalActions.includes('BET')) {
      const minBet = getMinBet(state);
      const maxBet = getMaxBet(state);
      const potBet = Math.min(Math.floor(state.potAmount * this.ratio), maxBet);
      const betAmount = Math.max(minBet, potBet);
      return { action: 'BET', amount: betAmount };
    }

    if (state.legalActions.includes('CALL')) {
      return { action: 'CALL' };
    }

    if (state.legalActions.includes('CHECK')) {
      return { action: 'CHECK' };
    }

    return { action: 'FOLD' };
  }
}

/**
 * ShortStackBot: Push-or-fold strategy for short stacks.
 * - Top 25% hands: go all-in
 * - Other hands: fold unless can check
 */
export class ShortStackBot implements AgentStrategy {
  chooseAction(state: VisibleGameState): ChosenAction {
    const tier = evaluateHandTier(state.myHoleCards);
    const isPushHand = tier <= 3; // Top ~25%

    if (!isPushHand) {
      // Weak hand: check if free, otherwise fold
      if (state.legalActions.includes('CHECK')) {
        return { action: 'CHECK' };
      }
      return { action: 'FOLD' };
    }

    // Push hand: go all-in
    const allInAmount = state.myChips;

    if (state.legalActions.includes('RAISE')) {
      const maxRaise = getMaxRaise(state);
      return { action: 'RAISE', amount: Math.min(allInAmount, maxRaise) };
    }

    if (state.legalActions.includes('BET')) {
      const maxBet = getMaxBet(state);
      return { action: 'BET', amount: Math.min(allInAmount, maxBet) };
    }

    if (state.legalActions.includes('CALL')) {
      return { action: 'CALL' };
    }

    if (state.legalActions.includes('CHECK')) {
      return { action: 'CHECK' };
    }

    return { action: 'FOLD' };
  }
}
