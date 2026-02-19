import { type Card, RANKS, SUITS, type RngFn } from './types.js';

/** Build a fresh 52-card deck in canonical order. */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/**
 * Fisher-Yates shuffle using injected RNG for determinism.
 * Returns a new array (does not mutate input).
 */
export function shuffleDeck(deck: Card[], rng: RngFn): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i]!, shuffled[j]!] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

/** Deal `count` cards from the top of the deck. Mutates deck (pops from end). */
export function dealCards(deck: Card[], count: number): Card[] {
  const cards: Card[] = [];
  for (let i = 0; i < count; i++) {
    const card = deck.pop();
    if (!card) throw new Error('Deck exhausted');
    cards.push(card);
  }
  return cards;
}

/** Deterministic seeded RNG (mulberry32). */
export function createSeededRng(seed: number): RngFn {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
