export interface AgentConfig {
  agentId: string;
  seatToken: string;
  tableId: string;
  serverUrl: string; // ws://localhost:8081
}

export interface AgentStrategy {
  /** Given visible game state, choose an action. */
  chooseAction(state: VisibleGameState): ChosenAction;
}

export interface OpponentInfo {
  id: string;
  seatIndex: number;
  chips: number;
  currentBet: number;
  hasFolded: boolean;
  isAllIn: boolean;
}

export interface VisibleGameState {
  handId: string;
  street: string;
  myId: string;
  mySeatIndex: number;
  myHoleCards: Array<{ rank: string; suit: string }>;
  myChips: number;
  myCurrentBet: number;
  /** All opponents (non-self players) */
  opponents: OpponentInfo[];
  numPlayers: number;
  dealerSeatIndex: number;
  communityCards: Array<{ rank: string; suit: string }>;
  pots: Array<{ amount: number; eligible: string[] }>;
  /** Total pot amount (sum of all pots) */
  potAmount: number;
  isMyTurn: boolean;
  legalActions: string[];
  /** Betting mode: LIMIT, NO_LIMIT, or POT_LIMIT */
  bettingMode?: string;
  /** Action ranges for NL/PL modes */
  actionRanges?: {
    minBet: number;
    maxBet: number;
    minRaise: number;
    maxRaise: number;
  };
  // HU backward-compat (deprecated)
  opponentId?: string | undefined;
  opponentChips?: number | undefined;
  opponentCurrentBet?: number | undefined;
}

export interface ChosenAction {
  action: string; // FOLD, CHECK, CALL, BET, RAISE
  amount?: number;
}
