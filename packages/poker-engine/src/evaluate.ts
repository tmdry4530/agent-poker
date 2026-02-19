import { type Card, type HandEvaluation, HandRankType, type Rank, RANKS } from './types.js';

const RANK_VALUE: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

function rankValue(r: Rank): number {
  return RANK_VALUE[r];
}

/** Evaluate exactly 5 cards. */
function evaluate5(cards: Card[]): HandEvaluation {
  const sorted = [...cards].sort((a, b) => rankValue(b.rank) - rankValue(a.rank));
  const values = sorted.map((c) => rankValue(c.rank));
  const suits = sorted.map((c) => c.suit);

  const isFlush = suits.every((s) => s === suits[0]);

  // Check straight (including A-low: A2345)
  let isStraight = false;
  let straightHigh = 0;
  // Normal straight check
  if (values[0]! - values[4]! === 4 && new Set(values).size === 5) {
    isStraight = true;
    straightHigh = values[0]!;
  }
  // Wheel: A-2-3-4-5
  if (!isStraight && values[0] === 14 && values[1] === 5 && values[2] === 4 && values[3] === 3 && values[4] === 2) {
    isStraight = true;
    straightHigh = 5; // 5-high straight
  }

  // Count ranks
  const rankCounts = new Map<number, number>();
  for (const v of values) {
    rankCounts.set(v, (rankCounts.get(v) ?? 0) + 1);
  }
  const counts = [...rankCounts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  if (isStraight && isFlush) {
    return { rank: HandRankType.STRAIGHT_FLUSH, values: [straightHigh], description: `Straight Flush, ${rankName(straightHigh)} high`, bestCards: sorted };
  }
  if (counts[0]![1] === 4) {
    return { rank: HandRankType.FOUR_OF_A_KIND, values: [counts[0]![0], counts[1]![0]], description: `Four of a Kind, ${rankName(counts[0]![0])}s`, bestCards: sorted };
  }
  if (counts[0]![1] === 3 && counts[1]![1] === 2) {
    return { rank: HandRankType.FULL_HOUSE, values: [counts[0]![0], counts[1]![0]], description: `Full House, ${rankName(counts[0]![0])}s full of ${rankName(counts[1]![0])}s`, bestCards: sorted };
  }
  if (isFlush) {
    return { rank: HandRankType.FLUSH, values, description: `Flush, ${rankName(values[0]!)} high`, bestCards: sorted };
  }
  if (isStraight) {
    return { rank: HandRankType.STRAIGHT, values: [straightHigh], description: `Straight, ${rankName(straightHigh)} high`, bestCards: sorted };
  }
  if (counts[0]![1] === 3) {
    const kickers = counts.filter((c) => c[1] === 1).map((c) => c[0]).sort((a, b) => b - a);
    return { rank: HandRankType.THREE_OF_A_KIND, values: [counts[0]![0], ...kickers], description: `Three of a Kind, ${rankName(counts[0]![0])}s`, bestCards: sorted };
  }
  if (counts[0]![1] === 2 && counts[1]![1] === 2) {
    const pairs = counts.filter((c) => c[1] === 2).map((c) => c[0]).sort((a, b) => b - a);
    const kicker = counts.find((c) => c[1] === 1)![0];
    return { rank: HandRankType.TWO_PAIR, values: [...pairs, kicker], description: `Two Pair, ${rankName(pairs[0]!)}s and ${rankName(pairs[1]!)}s`, bestCards: sorted };
  }
  if (counts[0]![1] === 2) {
    const kickers = counts.filter((c) => c[1] === 1).map((c) => c[0]).sort((a, b) => b - a);
    return { rank: HandRankType.PAIR, values: [counts[0]![0], ...kickers], description: `Pair of ${rankName(counts[0]![0])}s`, bestCards: sorted };
  }
  return { rank: HandRankType.HIGH_CARD, values, description: `High Card, ${rankName(values[0]!)}`, bestCards: sorted };
}

function rankName(v: number): string {
  const names: Record<number, string> = { 14: 'Ace', 13: 'King', 12: 'Queen', 11: 'Jack', 10: 'Ten', 9: 'Nine', 8: 'Eight', 7: 'Seven', 6: 'Six', 5: 'Five', 4: 'Four', 3: 'Three', 2: 'Two' };
  return names[v] ?? String(v);
}

/** Evaluate the best 5-card hand from 7 cards (2 hole + 5 community). */
export function evaluateBestHand(holeCards: Card[], communityCards: Card[]): HandEvaluation {
  const cards = [...holeCards, ...communityCards];
  const n = cards.length;
  let best: HandEvaluation | null = null;

  // Iterative C(n, 5) — 5 nested loops avoid recursive allocation overhead
  for (let a = 0; a < n - 4; a++) {
    for (let b = a + 1; b < n - 3; b++) {
      for (let c = b + 1; c < n - 2; c++) {
        for (let d = c + 1; d < n - 1; d++) {
          for (let e = d + 1; e < n; e++) {
            const evaluation = evaluate5([cards[a]!, cards[b]!, cards[c]!, cards[d]!, cards[e]!]);
            if (!best || compareHands(evaluation, best) > 0) {
              best = evaluation;
            }
          }
        }
      }
    }
  }

  return best!;
}

/**
 * Compare two hand evaluations.
 * Returns positive if a > b, negative if a < b, 0 if tie.
 */
export function compareHands(a: HandEvaluation, b: HandEvaluation): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.max(a.values.length, b.values.length); i++) {
    const av = a.values[i] ?? 0;
    const bv = b.values[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}
