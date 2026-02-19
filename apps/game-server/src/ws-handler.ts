import { WebSocketServer, WebSocket } from 'ws';
import { ActionType, type PlayerAction, PokerError } from '@agent-poker/poker-engine';
import { TableActor } from './table-actor.js';
import { PROTOCOL_VERSION, type WsEnvelope } from './types.js';
import { logger } from './logger.js';
import { EventRingBuffer } from './event-ring-buffer.js';
import { RateLimiter } from './rate-limiter.js';
import { verifySeatToken, refreshSeatToken } from './seat-token.js';
import { WsEnvelopeSchema, HelloPayloadSchema, ActionPayloadSchema } from './schemas.js';

interface ConnectedClient {
  ws: WebSocket;
  agentId: string;
  tableId: string;
  seatToken: string;
  lastSeenEventId?: number;
}

// ── Connection limits ──────────────────────────────────────
const MAX_CONNECTIONS_PER_AGENT = 10;
const MAX_TABLES_PER_AGENT = 8;
const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 10_000;

export class GameServerWs {
  private wss: WebSocketServer | null = null;
  private tables = new Map<string, TableActor>();
  private clients = new Map<WebSocket, ConnectedClient>();
  private agentToWs = new Map<string, WebSocket>(); // agentId -> ws (latest)
  private agentToTables = new Map<string, Set<string>>(); // agentId -> Set<tableId> (multi-table support)
  private agentConnectionCount = new Map<string, number>(); // agentId -> active WS count
  private eventBuffers = new Map<string, EventRingBuffer>(); // tableId -> buffer
  private rateLimiter = new RateLimiter();
  private disconnectGraceMs: number;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pongReceived = new WeakSet<WebSocket>();

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
    const allowedOrigins = this.getAllowedOrigins();

    return new Promise((resolve) => {
      this.wss = new WebSocketServer({
        port,
        verifyClient: allowedOrigins
          ? (info, cb) => {
              const origin = info.origin ?? info.req.headers['origin'];
              if (!origin || allowedOrigins.includes(origin)) {
                cb(true);
              } else {
                logger.warn({ origin }, 'WS connection rejected: origin not allowed');
                cb(false, 403, 'Origin not allowed');
              }
            }
          : undefined,
      });
      this.wss.on('connection', (ws) => this.handleConnection(ws));
      this.wss.on('listening', () => {
        this.startHeartbeat();
        resolve();
      });
    });
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      for (const [ws, client] of this.clients) {
        if (!this.pongReceived.has(ws)) {
          // No pong received since last ping — terminate
          logger.warn({ agentId: client.agentId, tableId: client.tableId }, 'Heartbeat timeout, disconnecting');
          ws.terminate();
          continue;
        }
        // Mark as not-yet-ponged and send ping
        this.pongReceived.delete(ws);
        ws.ping();
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private getAllowedOrigins(): string[] | null {
    const corsOrigins = process.env['CORS_ORIGINS'];
    if (corsOrigins) {
      return corsOrigins.split(',').map((o) => o.trim());
    }
    if (process.env['NODE_ENV'] === 'production') {
      // In production without CORS_ORIGINS, reject all browser origins
      return [];
    }
    // Development: allow all origins (agents connect directly, no browser origin)
    return null;
  }

  stop(): void {
    this.stopHeartbeat();
    for (const [, table] of this.tables) {
      table.close();
    }
    this.wss?.close();
  }

  /**
   * Graceful shutdown: notify all connected agents, wait for clean disconnect,
   * then force-close remaining connections and shut down the server.
   */
  async gracefulStop(graceMs = 5000): Promise<void> {
    logger.info('Graceful shutdown initiated');
    this.stopHeartbeat();

    // 1. Send SHUTDOWN to all connected clients
    for (const [ws, client] of this.clients) {
      this.send(ws, {
        protocolVersion: PROTOCOL_VERSION,
        type: 'SHUTDOWN' as any,
        payload: { reason: 'Server shutting down', graceMs },
      });
    }

    // 2. Stop accepting new connections
    if (this.wss) {
      this.wss.removeAllListeners('connection');
    }

    // 3. Wait for clients to disconnect gracefully
    const deadline = Date.now() + graceMs;
    while (this.clients.size > 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 200));
    }

    // 4. Force close remaining connections
    const remaining = this.clients.size;
    if (remaining > 0) {
      logger.warn({ remaining }, 'Force-closing remaining connections');
      for (const [ws] of this.clients) {
        ws.terminate();
      }
    }

    // 5. Close all tables and the server
    for (const [, table] of this.tables) {
      table.close();
    }
    this.wss?.close();
    logger.info('WebSocket server stopped');
  }

  /**
   * Terminate a single table due to an unhandled error.
   * Notifies all connected clients at the table, closes the table,
   * and removes it from the server — without affecting other tables.
   */
  private terminateTable(tableId: string, reason: string): void {
    logger.warn({ tableId, reason }, 'Terminating table due to error');

    // Notify all clients at this table
    for (const [ws, client] of this.clients) {
      if (client.tableId === tableId) {
        this.sendError(ws, 'TABLE_TERMINATED', `Table terminated: ${reason}`);
      }
    }

    // Close the table actor
    const table = this.tables.get(tableId);
    if (table) {
      table.close();
      this.tables.delete(tableId);
    }

    // Clean up event buffer
    this.eventBuffers.delete(tableId);
  }

  private handleConnection(ws: WebSocket): void {
    const MAX_MESSAGE_SIZE = 16 * 1024; // 16KB

    // Mark as alive for heartbeat (newly connected = alive)
    this.pongReceived.add(ws);
    ws.on('pong', () => {
      this.pongReceived.add(ws);
    });

    ws.on('message', (data) => {
      const raw = data instanceof Buffer ? data : Buffer.from(data as ArrayBuffer);
      if (raw.length > MAX_MESSAGE_SIZE) {
        this.sendError(ws, 'INVALID_ACTION', 'Message too large (max 16KB)');
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        this.sendError(ws, 'INTERNAL', 'Invalid JSON');
        return;
      }

      const result = WsEnvelopeSchema.safeParse(parsed);
      if (!result.success) {
        this.sendError(ws, 'INVALID_ACTION', 'Invalid message format');
        return;
      }

      void this.handleMessage(ws, result.data as WsEnvelope);
    });

    ws.on('close', () => {
      const client = this.clients.get(ws);
      if (client) {
        // Decrement connection count
        const count = this.agentConnectionCount.get(client.agentId) ?? 1;
        if (count <= 1) {
          this.agentConnectionCount.delete(client.agentId);
        } else {
          this.agentConnectionCount.set(client.agentId, count - 1);
        }

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
      case 'REFRESH_TOKEN':
        this.handleRefreshToken(ws, msg);
        break;
      default:
        this.sendError(ws, 'UNKNOWN_MESSAGE_TYPE', `Unknown type: ${msg.type}`);
    }
  }

  private async handleHello(ws: WebSocket, msg: WsEnvelope): Promise<void> {
    const parseResult = HelloPayloadSchema.safeParse(msg.payload);
    if (!parseResult.success) {
      this.sendError(ws, 'AUTH_FAILED', 'Invalid HELLO payload');
      return;
    }
    const payload = parseResult.data;

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

    // Verify JWT seat token (signature + expiry)
    const tokenPayload = verifySeatToken(payload.seatToken);
    if (!tokenPayload) {
      this.sendError(ws, 'AUTH_FAILED', 'Invalid or expired seatToken');
      return;
    }

    // Verify token claims match the request
    if (tokenPayload.agentId !== payload.agentId || tokenPayload.tableId !== tableId) {
      this.sendError(ws, 'AUTH_FAILED', 'seatToken does not match agentId or tableId');
      return;
    }

    // Verify seat exists on the table
    const seats = table.getSeats();
    const seat = seats.find((s) => s.agentId === payload.agentId && s.seatToken === payload.seatToken);
    if (!seat) {
      this.sendError(ws, 'AUTH_FAILED', 'Invalid seatToken for this agent');
      return;
    }

    // Enforce connection limits
    const currentConns = this.agentConnectionCount.get(payload.agentId) ?? 0;
    if (currentConns >= MAX_CONNECTIONS_PER_AGENT) {
      this.sendError(ws, 'CONNECTION_LIMIT', `Max ${MAX_CONNECTIONS_PER_AGENT} connections per agent`);
      return;
    }

    // Enforce table limits
    const currentTables = this.agentToTables.get(payload.agentId);
    const tableCount = currentTables ? currentTables.size : 0;
    const isNewTable = !currentTables || !currentTables.has(tableId);
    if (isNewTable && tableCount >= MAX_TABLES_PER_AGENT) {
      this.sendError(ws, 'TABLE_LIMIT', `Max ${MAX_TABLES_PER_AGENT} tables per agent`);
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
    this.agentConnectionCount.set(payload.agentId, currentConns + 1);

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

    const parseResult = ActionPayloadSchema.safeParse(msg.payload);
    if (!parseResult.success) {
      this.sendError(ws, 'INVALID_ACTION', 'Invalid ACTION payload', msg.requestId);
      return;
    }
    const actionPayload = parseResult.data;

    const actionMap: Record<string, ActionType> = {
      FOLD: ActionType.FOLD,
      CHECK: ActionType.CHECK,
      CALL: ActionType.CALL,
      BET: ActionType.BET,
      RAISE: ActionType.RAISE,
    };

    const actionType = actionMap[actionPayload.action]!;

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
        // Unexpected error: isolate the failure to this table only
        logger.error(
          { err, tableId: client.tableId, agentId: client.agentId },
          'Unhandled error in table-actor, terminating table',
        );
        this.terminateTable(client.tableId, (err as Error).message);
      }
    }
  }

  private handleRefreshToken(ws: WebSocket, msg: WsEnvelope): void {
    const client = this.clients.get(ws);
    if (!client) {
      this.sendError(ws, 'AUTH_FAILED', 'Not authenticated. Send HELLO first.');
      return;
    }

    const newToken = refreshSeatToken(client.seatToken);
    if (!newToken) {
      this.sendError(ws, 'AUTH_FAILED', 'Token refresh failed. Re-join the table.');
      return;
    }

    // Update stored token
    client.seatToken = newToken;

    // Update the seat token on the table actor
    const table = this.tables.get(client.tableId);
    if (table) {
      const seats = table.getSeats();
      const seat = seats.find((s) => s.agentId === client.agentId);
      if (seat) {
        seat.seatToken = newToken;
      }
    }

    this.send(ws, {
      protocolVersion: PROTOCOL_VERSION,
      type: 'TOKEN_REFRESHED',
      payload: { seatToken: newToken },
    });

    logger.info({ agentId: client.agentId, tableId: client.tableId }, 'Seat token refreshed');
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
