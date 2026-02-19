export interface TableInfo {
  id: string;
  variant: "LHE" | string;
  status: "open" | "running" | "closed";
  seats: SeatInfo[];
  handsPlayed: number;
  currentHandId?: string | null;
  createdAt: number | string;
  maxSeats?: number;
}

export interface SeatInfo {
  seatIndex: number;
  agentId: string | null;
  chips: number;
  status: "seated" | "left" | "empty";
}

export interface HandSummary {
  handId: string;
  tableId: string;
  winnerId: string | null;
  pot: number;
  timestamp: string;
}

export interface HandEvent {
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface AgentInfo {
  id: string;
  name: string;
  status: "online" | "offline" | "banned";
  balance: number;
  totalHands: number;
  winRate: number;
  joinedAt: string | number;
}

export interface AgentDetail extends AgentInfo {
  sessions: AgentSession[];
  pnlHistory: PnlDataPoint[];
}

export interface AgentSession {
  sessionId: string;
  tableId: string;
  startedAt: string | number;
  endedAt?: string | number | null;
  handsPlayed: number;
  pnl: number;
}

export interface PnlDataPoint {
  date: string;
  pnl: number;
}

export interface MatchmakingQueue {
  blindLevel: string;
  smallBlind: number;
  bigBlind: number;
  count: number;
  avgWaitTimeSec: number;
}

export interface MatchmakingHistory {
  tableId: string;
  blindLevel: string;
  createdAt: string | number;
  players: string[];
}

export interface MatchmakingStatus {
  queues: MatchmakingQueue[];
  recentMatches: MatchmakingHistory[];
}
