export interface TableInfo {
  id: string;
  variant: string;
  status: "open" | "running" | "closed";
  seats: SeatInfo[];
  handsPlayed: number;
  currentHandId?: string | null;
  createdAt: number | string;
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
