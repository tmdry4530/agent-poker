// ── WS Protocol message types (MVP1) ────────────────────────

export const PROTOCOL_VERSION = 1;

export type ClientMessageType = 'HELLO' | 'ACTION' | 'PING' | 'REFRESH_TOKEN';
export type ServerMessageType = 'WELCOME' | 'STATE' | 'ACK' | 'ERROR' | 'PONG' | 'HAND_COMPLETE' | 'TOKEN_REFRESHED' | 'SHUTDOWN';

export interface WsEnvelope {
  protocolVersion: number;
  type: ClientMessageType | ServerMessageType;
  requestId?: string;
  tableId?: string;
  seatToken?: string;
  seq?: number;
  payload?: Record<string, unknown>;
}

export interface HelloMessage extends WsEnvelope {
  type: 'HELLO';
  payload: {
    agentId: string;
    seatToken: string;
    lastSeenEventId?: number;
  };
}

export interface ActionMessage extends WsEnvelope {
  type: 'ACTION';
  requestId: string;
  payload: {
    action: string; // FOLD, CHECK, CALL, BET, RAISE
    amount?: number;
  };
}

export interface WelcomeMessage extends WsEnvelope {
  type: 'WELCOME';
  payload: {
    tableId: string;
    seatIndex: number;
    agentId: string;
    state?: Record<string, unknown>;
    positions?: Array<{ seatIndex: number; position: string }>;
  };
}

export interface StateMessage extends WsEnvelope {
  type: 'STATE';
  payload: Record<string, unknown> & {
    positions?: Array<{ seatIndex: number; position: string }>;
  };
}

export interface AckMessage extends WsEnvelope {
  type: 'ACK';
  requestId: string;
  payload: Record<string, unknown>;
}

export interface ErrorMessage extends WsEnvelope {
  type: 'ERROR';
  payload: {
    code: string;
    message: string;
    requestId?: string;
  };
}

// ── Table / Seat types ──────────────────────────────────────

export interface SeatInfo {
  seatIndex: number;
  agentId: string;
  seatToken: string;
  buyInAmount: number;
  chips: number;
  status: 'seated' | 'left';
}

export interface TableInfo {
  id: string;
  variant: 'LIMIT' | 'NL' | 'PL';
  maxSeats: number;
  status: 'open' | 'running' | 'closed';
  seats: SeatInfo[];
  currentHandId?: string;
  handsPlayed: number;
  createdAt: number;
}
