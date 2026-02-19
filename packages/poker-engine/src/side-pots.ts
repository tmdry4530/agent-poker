/**
 * Side-pot calculation for multi-way pots.
 *
 * When players go all-in for different amounts, the pot splits into
 * a main pot and one or more side pots. Each pot has a set of eligible
 * players who can win it.
 */

import type { PlayerState, Pot } from './types.js';

/**
 * Calculate main pot and side pots from player bet totals.
 *
 * Algorithm:
 * 1. Sort all-in amounts ascending
 * 2. For each unique all-in level, create a pot with the contribution
 *    from all players up to that level
 * 3. Players who folded contribute but are not eligible
 *
 * @param players - all players in the hand
 * @returns array of pots (main pot first, then side pots)
 */
export function calculateSidePots(players: PlayerState[]): Pot[] {
  // Get all unique all-in contribution levels (totalBetThisHand of all-in players)
  const allInLevels = players
    .filter((p) => p.isAllIn)
    .map((p) => p.totalBetThisHand)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .sort((a, b) => a - b);

  // If no one is all-in, single pot with all non-folded eligible
  if (allInLevels.length === 0) {
    const amount = players.reduce((sum, p) => sum + p.totalBetThisHand, 0);
    const eligible = players.filter((p) => !p.hasFolded).map((p) => p.id);
    return [{ amount, eligible }];
  }

  const pots: Pot[] = [];
  let previousLevel = 0;

  for (const level of allInLevels) {
    if (level <= previousLevel) continue;

    let potAmount = 0;
    const eligible: string[] = [];

    for (const p of players) {
      const contribution = Math.min(p.totalBetThisHand, level) - Math.min(p.totalBetThisHand, previousLevel);
      potAmount += contribution;
      // Eligible if not folded AND contributed to this pot level
      if (!p.hasFolded && p.totalBetThisHand >= level) {
        eligible.push(p.id);
      }
      // Also eligible if all-in at exactly this level
      if (!p.hasFolded && p.isAllIn && p.totalBetThisHand === level) {
        if (!eligible.includes(p.id)) {
          eligible.push(p.id);
        }
      }
    }

    if (potAmount > 0) {
      pots.push({ amount: potAmount, eligible });
    }
    previousLevel = level;
  }

  // Remaining pot above the highest all-in level
  const maxAllIn = allInLevels[allInLevels.length - 1]!;
  let remainingAmount = 0;
  const remainingEligible: string[] = [];

  for (const p of players) {
    const contribution = Math.max(0, p.totalBetThisHand - maxAllIn);
    remainingAmount += contribution;
    if (!p.hasFolded && p.totalBetThisHand > maxAllIn) {
      remainingEligible.push(p.id);
    }
  }

  if (remainingAmount > 0 && remainingEligible.length > 0) {
    pots.push({ amount: remainingAmount, eligible: remainingEligible });
  }

  // If only one player is eligible for a side pot, they get it back immediately
  // (this is handled in finishHand, not here)

  return pots;
}
