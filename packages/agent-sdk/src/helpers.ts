import type { VisibleGameState } from './types.js';

/**
 * Get minimum bet amount for the current state.
 * For LIMIT mode, returns fixed bet size.
 * For NL/PL mode, returns minBet from actionRanges.
 */
export function getMinBet(state: VisibleGameState): number {
  if (state.actionRanges) {
    return state.actionRanges.minBet;
  }
  // Fallback for LIMIT mode: use big blind as minimum
  return 0;
}

/**
 * Get maximum bet amount for the current state.
 * For LIMIT mode, returns fixed bet size.
 * For NL mode, returns all remaining chips.
 * For PL mode, returns pot-sized bet.
 */
export function getMaxBet(state: VisibleGameState): number {
  if (state.actionRanges) {
    return state.actionRanges.maxBet;
  }
  // Fallback: all chips
  return state.myChips;
}

/**
 * Get minimum raise amount for the current state.
 * For LIMIT mode, returns fixed raise size.
 * For NL mode, returns minimum raise (call + last raise increment or big blind).
 * For PL mode, returns call + minimum raise increment.
 */
export function getMinRaise(state: VisibleGameState): number {
  if (state.actionRanges) {
    return state.actionRanges.minRaise;
  }
  // Fallback
  return 0;
}

/**
 * Get maximum raise amount for the current state.
 * For LIMIT mode, returns fixed raise size.
 * For NL mode, returns all remaining chips.
 * For PL mode, returns call + pot size.
 */
export function getMaxRaise(state: VisibleGameState): number {
  if (state.actionRanges) {
    return state.actionRanges.maxRaise;
  }
  // Fallback: all chips
  return state.myChips;
}

/**
 * Calculate the amount needed to call the current bet.
 */
export function getCallAmount(state: VisibleGameState): number {
  const maxOpponentBet = Math.max(
    0,
    ...state.opponents.map((o) => o.currentBet)
  );
  return Math.max(0, maxOpponentBet - state.myCurrentBet);
}

/**
 * Check if the state is in No-Limit mode.
 */
export function isNoLimit(state: VisibleGameState): boolean {
  return state.bettingMode === 'NO_LIMIT';
}

/**
 * Check if the state is in Pot-Limit mode.
 */
export function isPotLimit(state: VisibleGameState): boolean {
  return state.bettingMode === 'POT_LIMIT';
}

/**
 * Check if the state is in Limit mode.
 */
export function isLimit(state: VisibleGameState): boolean {
  return state.bettingMode === 'LIMIT' || !state.bettingMode;
}
