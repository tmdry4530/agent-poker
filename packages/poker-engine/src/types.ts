// ── Card types ──────────────────────────────────────────────
export const SUITS = ['h', 'd', 'c', 's'] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;
export type Rank = (typeof RANKS)[number];

export interface Card {
  rank: Rank;
  suit: Suit;
}

// ── Street ──────────────────────────────────────────────────
export enum Street {
  PREFLOP = 'PREFLOP',
  FLOP = 'FLOP',
  TURN = 'TURN',
  RIVER = 'RIVER',
  SHOWDOWN = 'SHOWDOWN',
}

// ── Actions ─────────────────────────────────────────────────
export enum ActionType {
  FOLD = 'FOLD',
  CHECK = 'CHECK',
  CALL = 'CALL',
  BET = 'BET',
  RAISE = 'RAISE',
}

export interface PlayerAction {
  type: ActionType;
  amount?: number; // only for BET/RAISE in limit: fixed size
}

// ── Player / Seat ───────────────────────────────────────────
export interface PlayerState {
  id: string;
  seatIndex: number; // 0-5
  chips: number;
  holeCards: Card[];
  currentBet: number; // amount bet in current street
  totalBetThisHand: number;
  hasFolded: boolean;
  hasActed: boolean; // acted this street?
  isAllIn: boolean;
}

export interface PlayerSetup {
  id: string;
  seatIndex: number;
  chips: number;
}

// ── Pot ─────────────────────────────────────────────────────
export interface Pot {
  amount: number;
  eligible: string[]; // player ids
}

// ── Betting mode ────────────────────────────────────────────
export enum BettingMode {
  LIMIT = 'LIMIT',
  NO_LIMIT = 'NO_LIMIT',
  POT_LIMIT = 'POT_LIMIT',
}

// ── Game config ─────────────────────────────────────────────
export interface GameConfig {
  bettingMode: BettingMode;
  smallBlind: number;
  bigBlind: number;
  /** Fixed-limit only: small bet = big blind, big bet = 2x big blind */
  smallBet: number;
  bigBet: number;
  ante: number;
  maxRaisesPerStreet: number; // typically 4 for limit, 0 = unlimited (NL/PL)
  maxPlayers: number; // 2-6, default 6
}

export const DEFAULT_CONFIG: GameConfig = {
  bettingMode: BettingMode.LIMIT,
  smallBlind: 1,
  bigBlind: 2,
  smallBet: 2,
  bigBet: 4,
  ante: 0,
  maxRaisesPerStreet: 4,
  maxPlayers: 6,
};

export const DEFAULT_NL_CONFIG: GameConfig = {
  bettingMode: BettingMode.NO_LIMIT,
  smallBlind: 1,
  bigBlind: 2,
  smallBet: 0,
  bigBet: 0,
  ante: 0,
  maxRaisesPerStreet: 0, // unlimited
  maxPlayers: 6,
};

export const DEFAULT_PL_CONFIG: GameConfig = {
  bettingMode: BettingMode.POT_LIMIT,
  smallBlind: 1,
  bigBlind: 2,
  smallBet: 0,
  bigBet: 0,
  ante: 0,
  maxRaisesPerStreet: 0, // unlimited
  maxPlayers: 6,
};

// ── Game state ──────────────────────────────────────────────
export interface GameState {
  handId: string;
  config: GameConfig;
  street: Street;
  players: PlayerState[]; // 2-6 players
  dealerSeatIndex: number; // seat index of dealer button
  activePlayerSeatIndex: number; // seat index of whose turn
  communityCards: Card[];
  deck: Card[]; // remaining deck (cards dealt are removed)
  pots: Pot[];
  betsThisStreet: number; // how many bets/raises this street (for cap)
  lastRaiseSize: number; // NL/PL: size of the last raise increment (for min-raise)
  isHandComplete: boolean;
  winners?: string[];
  resultSummary?: HandResult;
}

// ── Hand result ─────────────────────────────────────────────
export interface HandResult {
  winners: string[];
  potDistribution: Array<{ playerId: string; amount: number; potIndex?: number }>;
  handRankings?: Array<{ playerId: string; handRank: HandRankType; description: string }>;
}

// ── Hand ranking ────────────────────────────────────────────
export enum HandRankType {
  HIGH_CARD = 0,
  PAIR = 1,
  TWO_PAIR = 2,
  THREE_OF_A_KIND = 3,
  STRAIGHT = 4,
  FLUSH = 5,
  FULL_HOUSE = 6,
  FOUR_OF_A_KIND = 7,
  STRAIGHT_FLUSH = 8,
}

export interface HandEvaluation {
  rank: HandRankType;
  /** Tiebreaker values (descending priority) */
  values: number[];
  description: string;
  bestCards: Card[];
}

// ── Events ──────────────────────────────────────────────────
export enum GameEventType {
  HAND_START = 'HAND_START',
  ANTES_POSTED = 'ANTES_POSTED',
  BLINDS_POSTED = 'BLINDS_POSTED',
  HOLE_CARDS_DEALT = 'HOLE_CARDS_DEALT',
  COMMUNITY_CARDS_DEALT = 'COMMUNITY_CARDS_DEALT',
  PLAYER_ACTION = 'PLAYER_ACTION',
  STREET_CHANGED = 'STREET_CHANGED',
  SHOWDOWN = 'SHOWDOWN',
  POT_DISTRIBUTED = 'POT_DISTRIBUTED',
  HAND_END = 'HAND_END',
}

export interface GameEvent {
  type: GameEventType;
  seq: number;
  handId: string;
  timestamp?: number;
  payload: Record<string, unknown>;
}

// ── Errors ──────────────────────────────────────────────────
export enum PokerErrorCode {
  NOT_YOUR_TURN = 'NOT_YOUR_TURN',
  INVALID_ACTION = 'INVALID_ACTION',
  HAND_ALREADY_COMPLETE = 'HAND_ALREADY_COMPLETE',
  RAISE_CAP_REACHED = 'RAISE_CAP_REACHED',
  INSUFFICIENT_CHIPS = 'INSUFFICIENT_CHIPS',
}

export class PokerError extends Error {
  constructor(
    public readonly code: PokerErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PokerError';
  }
}

// ── RNG interface (injected for determinism) ────────────────
export type RngFn = () => number; // returns [0, 1)
