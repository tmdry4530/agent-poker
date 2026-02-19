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
