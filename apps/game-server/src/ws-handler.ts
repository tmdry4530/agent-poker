import { WebSocketServer, WebSocket } from 'ws';
import { ActionType, type PlayerAction, PokerError } from '@agent-poker/poker-engine';
import { TableActor } from './table-actor.js';
import { PROTOCOL_VERSION, type WsEnvelope } from './types.js';
import { logger } from './logger.js';
import { EventRingBuffer } from './event-ring-buffer.js';
import { RateLimiter } from './rate-limiter.js';

interface ConnectedClient {
  ws: WebSocket;
  agentId: string;
  tableId: string;
  seatToken: string;
  lastSeenEventId?: number;
}

export class GameServerWs {
  private wss: WebSocketServer | null = null;
  private tables = new Map<string, TableActor>();
  private clients = new Map<WebSocket, ConnectedClient>();
  private agentToWs = new Map<string, WebSocket>(); // agentId -> ws (latest)
  private agentToTables = new Map<string, Set<string>>(); // agentId -> Set<tableId> (multi-table support)
  private eventBuffers = new Map<string, EventRingBuffer>(); // tableId -> buffer
  private rateLimiter = new RateLimiter();
  private disconnectGraceMs: number;

  constructor() {
    this.disconnectGraceMs = parseInt(process.env['DISCONNECT_GRACE_MS'] ?? '60000', 10);
  }

  /**
   * Get all table IDs that an agent is seated at.
   */
  getAgentTables(agentId: string): string[] {
    return Array.from(this.agentToTables.get(agentId) ?? []);
  }

  getTable(tableId: string): TableActor | undefined {
    return this.tables.get(tableId);
  }

  registerTable(table: TableActor): void {
    this.tables.set(table.tableId, table);
    // Create event buffer for this table
    if (!this.eventBuffers.has(table.tableId)) {
      this.eventBuffers.set(table.tableId, new EventRingBuffer());
    }
  }

  getAllTables(): TableActor[] {
    return [...this.tables.values()];
  }

  start(port: number): Promise<void> {
    return new Promise((resolve) => {
      this.wss = new WebSocketServer({ port });
      this.wss.on('connection', (ws) => this.handleConnection(ws));
      this.wss.on('listening', () => resolve());
    });
  }

  stop(): void {
    for (const [, table] of this.tables) {
      table.close();
    }
    this.wss?.close();
  }

  private handleConnection(ws: WebSocket): void {
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as WsEnvelope;
        void this.handleMessage(ws, msg);
      } catch (err) {
        this.sendError(ws, 'INTERNAL', 'Invalid JSON');
      }
    });

    ws.on('close', () => {
      const client = this.clients.get(ws);
      if (client) {
        // Remove from agent → tables mapping
        const tables = this.agentToTables.get(client.agentId);
        if (tables) {
          tables.delete(client.tableId);
          if (tables.size === 0) {
            this.agentToTables.delete(client.agentId);
            this.agentToWs.delete(client.agentId);
          }
        }
        this.clients.delete(ws);
        logger.info({ agentId: client.agentId, tableId: client.tableId }, 'Client disconnected');
      }
    });
  }

  private async handleMessage(ws: WebSocket, msg: WsEnvelope): Promise<void> {
    if (msg.protocolVersion !== PROTOCOL_VERSION) {
      this.sendError(ws, 'PROTOCOL_MISMATCH', `Expected protocol version ${PROTOCOL_VERSION}`);
      return;
    }

    switch (msg.type) {
      case 'HELLO':
        await this.handleHello(ws, msg);
        break;
      case 'ACTION':
        await this.handleAction(ws, msg);
        break;
      case 'PING':
        this.send(ws, { protocolVersion: PROTOCOL_VERSION, type: 'PONG', payload: {} });
        break;
      default:
        this.sendError(ws, 'UNKNOWN_MESSAGE_TYPE', `Unknown type: ${msg.type}`);
    }
  }

  private async handleHello(ws: WebSocket, msg: WsEnvelope): Promise<void> {
    const payload = msg.payload as { agentId?: string; seatToken?: string; lastSeenEventId?: number } | undefined;
    if (!payload?.agentId || !payload?.seatToken) {
      this.sendError(ws, 'AUTH_FAILED', 'Missing agentId or seatToken');
      return;
    }

    const tableId = msg.tableId;
    if (!tableId) {
      this.sendError(ws, 'INVALID_ACTION', 'Missing tableId');
      return;
    }

    const table = this.tables.get(tableId);
    if (!table) {
      this.sendError(ws, 'INVALID_ACTION', `Table ${tableId} not found`);
      return;
    }

    // Verify seat token
    const seats = table.getSeats();
    const seat = seats.find((s) => s.agentId === payload.agentId && s.seatToken === payload.seatToken);
    if (!seat) {
      this.sendError(ws, 'AUTH_FAILED', 'Invalid seatToken for this agent');
      return;
    }

    // Register connection
    const client: ConnectedClient = {
      ws,
      agentId: payload.agentId,
      tableId,
      seatToken: payload.seatToken,
      ...(payload.lastSeenEventId !== undefined ? { lastSeenEventId: payload.lastSeenEventId } : {}),
    };
    this.clients.set(ws, client);
    this.agentToWs.set(payload.agentId, ws);

    // Track agent → tables mapping (multi-table support)
    if (!this.agentToTables.has(payload.agentId)) {
      this.agentToTables.set(payload.agentId, new Set());
    }
    this.agentToTables.get(payload.agentId)!.add(tableId);

    // Check if this is a reconnection with delta sync
    const eventBuffer = this.eventBuffers.get(tableId);
    let deltaEvents: any[] | null = null;
    let fullResync = false;

    if (payload.lastSeenEventId !== undefined && eventBuffer) {
      deltaEvents = eventBuffer.getEventsSince(payload.lastSeenEventId);
      if (deltaEvents === null) {
        // lastSeenEventId too old, fall back to full snapshot
        fullResync = true;
        logger.warn(
          { agentId: payload.agentId, tableId, lastSeenEventId: payload.lastSeenEventId },
          'Event buffer overflow, sending full resync',
        );
      } else {
        logger.info(
          { agentId: payload.agentId, tableId, deltaCount: deltaEvents.length },
          'Sending delta events for reconnection',
        );
      }
    }

    // Send WELCOME
    const state = table.getState();
    this.send(ws, {
      protocolVersion: PROTOCOL_VERSION,
      type: 'WELCOME',
      payload: {
        tableId,
        seatIndex: seat.seatIndex,
        agentId: payload.agentId,
        state: state ? sanitizeStateForPlayer(state, payload.agentId) : undefined,
        ...(deltaEvents && deltaEvents.length > 0 ? { deltaEvents } : {}),
        ...(fullResync ? { fullResync: true } : {}),
        latestEventId: eventBuffer?.getLatestEventId() ?? 0,
      },
    });
  }

  private async handleAction(ws: WebSocket, msg: WsEnvelope): Promise<void> {
    const client = this.clients.get(ws);
    if (!client) {
      this.sendError(ws, 'AUTH_FAILED', 'Not authenticated. Send HELLO first.');
      return;
    }

    // Rate limiting for actions
    const rateCheck = await this.rateLimiter.tryConsume(client.agentId, 'action');
    if (!rateCheck.allowed) {
      logger.warn({ agentId: client.agentId, retryAfterMs: rateCheck.retryAfterMs }, 'Rate limit exceeded');
      this.send(ws, {
        protocolVersion: PROTOCOL_VERSION,
        type: 'ERROR',
        payload: {
          code: 'RATE_LIMITED',
          message: 'Too many actions',
          retryAfterMs: rateCheck.retryAfterMs,
          requestId: msg.requestId,
        },
      });
      return;
    }

    const table = this.tables.get(client.tableId);
    if (!table) {
      this.sendError(ws, 'INTERNAL', 'Table not found');
      return;
    }

    const actionPayload = msg.payload as { action?: string; amount?: number } | undefined;
    if (!actionPayload?.action) {
      this.sendError(ws, 'INVALID_ACTION', 'Missing action in payload', msg.requestId);
      return;
    }

    const actionMap: Record<string, ActionType> = {
      FOLD: ActionType.FOLD,
      CHECK: ActionType.CHECK,
      CALL: ActionType.CALL,
      BET: ActionType.BET,
      RAISE: ActionType.RAISE,
    };

    const actionType = actionMap[actionPayload.action];
    if (!actionType) {
      this.sendError(ws, 'INVALID_ACTION', `Unknown action: ${actionPayload.action}`, msg.requestId);
      return;
    }

    const playerAction: PlayerAction = {
      type: actionType,
      ...(actionPayload.amount !== undefined ? { amount: actionPayload.amount } : {}),
    };

    try {
      const { state, events, alreadyProcessed } = table.processAction(
        client.agentId,
        playerAction,
        msg.requestId,
        msg.seq,
      );

      // ACK to the acting player
      this.send(ws, {
        protocolVersion: PROTOCOL_VERSION,
        type: 'ACK',
        ...(msg.requestId ? { requestId: msg.requestId } : {}),
        payload: { alreadyProcessed },
      });

      // Broadcast state to all connected clients at this table
      this.broadcastState(client.tableId, state);

      // If hand complete, notify
      if (state.isHandComplete) {
        this.broadcastToTable(client.tableId, {
          protocolVersion: PROTOCOL_VERSION,
          type: 'HAND_COMPLETE',
          payload: {
            handId: state.handId,
            winners: state.winners,
            result: state.resultSummary,
          },
        });
      }
    } catch (err) {
      if (err instanceof PokerError) {
        this.sendError(ws, err.code, err.message, msg.requestId);
      } else {
        this.sendError(ws, 'INTERNAL', (err as Error).message, msg.requestId);
      }
    }
  }

  broadcastState(tableId: string, state: any): void {
    for (const [, client] of this.clients) {
      if (client.tableId === tableId) {
        const sanitized = sanitizeStateForPlayer(state, client.agentId);
        this.send(client.ws, {
          protocolVersion: PROTOCOL_VERSION,
          type: 'STATE',
          payload: sanitized,
        });
      }
    }
  }

  broadcastToTable(tableId: string, msg: WsEnvelope): void {
    for (const [, client] of this.clients) {
      if (client.tableId === tableId) {
        this.send(client.ws, msg);
      }
    }
  }

  sendToAgent(agentId: string, msg: WsEnvelope): void {
    const ws = this.agentToWs.get(agentId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      this.send(ws, msg);
    }
  }

  private send(ws: WebSocket, msg: WsEnvelope): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private sendError(ws: WebSocket, code: string, message: string, requestId?: string): void {
    this.send(ws, {
      protocolVersion: PROTOCOL_VERSION,
      type: 'ERROR',
      payload: { code, message, requestId },
    });
  }
}

/** Remove opponent's hole cards from state sent to a player. */
function sanitizeStateForPlayer(state: any, agentId: string): Record<string, unknown> {
  const clone = structuredClone(state);
  if (clone.players) {
    for (const p of clone.players) {
      if (p.id !== agentId && !clone.isHandComplete) {
        p.holeCards = [];
      }
    }
  }
  // Remove deck from client view
  delete clone.deck;
  return clone;
}
