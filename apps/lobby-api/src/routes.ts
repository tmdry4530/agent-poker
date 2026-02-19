import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { signSeatToken } from '@agent-poker/game-server';
import { logger } from './logger.js';
import { MatchmakingQueue, BLIND_CONFIGS, type BlindLevel } from './matchmaking.js';
import {
  CreateTableBodySchema,
  JoinTableBodySchema,
  MatchmakingQueueBodySchema,
  CreateAgentBodySchema,
  formatZodError,
} from './schemas.js';
import {
  ChipDumpDetector,
  WinRateAnomalyDetector,
  analyzeAgentPair,
} from '@agent-poker/anti-collusion';

interface Deps {
  gameServer?: any;
  ledger?: any;
  identity?: any;
}

const startTime = Date.now();
let handCountSinceStart = 0;
let matchmakingQueue: MatchmakingQueue;

// Anti-collusion detectors (singleton, shared across routes)
const chipDumpDetector = new ChipDumpDetector();
const winRateDetector = new WinRateAnomalyDetector();

export function registerRoutes(app: FastifyInstance, deps: Deps): void {
  // Initialize matchmaking queue with match callback
  matchmakingQueue = new MatchmakingQueue(2, async (entries) => {
    const server = deps.gameServer;
    if (!server) {
      logger.error('Cannot create match: game server not available');
      return;
    }

    const { TableActor } = await import('@agent-poker/game-server');
    const tableId = `tbl_${crypto.randomUUID().slice(0, 8)}`;
    const blindConfig = BLIND_CONFIGS[entries[0]!.blindLevel];

    const table = new TableActor({
      tableId,
      maxSeats: 8,
      onHandComplete: (_tid, handId, events, state) => {
        handCountSinceStart++;
        logger.info({ handId, winners: state.winners }, 'Hand complete');
      },
    });

    server.registerTable(table);

    logger.info(
      { tableId, players: entries.map((e) => e.agentId), blindLevel: entries[0]!.blindLevel },
      'Auto-created table for matched players',
    );

    // Notify matched agents via WS (if connected)
    for (const entry of entries) {
      server.sendToAgent(entry.agentId, {
        protocolVersion: 1,
        type: 'MATCH_FOUND',
        payload: {
          tableId,
          blindLevel: entry.blindLevel,
          smallBlind: blindConfig.smallBlind,
          bigBlind: blindConfig.bigBlind,
        },
      });
    }
  });

  // Liveness probe
  app.get('/healthz', async () => ({ status: 'ok' }));

  // Readiness probe
  app.get('/readyz', async (_, reply) => {
    const server = deps.gameServer;
    if (!server) {
      return reply.status(503).send({ status: 'not_ready', reason: 'Game server not initialized' });
    }
    return { status: 'ready' };
  });

  // Stats endpoint
  app.get('/api/stats', async (_, reply) => {
    const server = deps.gameServer;
    if (!server) {
      return reply.status(503).send({ error: 'Game server not available' });
    }

    const tables = server.getAllTables();
    const activeTables = tables.filter((t: any) => t.getInfo().status === 'running').length;
    const totalTables = tables.length;

    // Count connected agents (unique)
    const connectedAgents = new Set<string>();
    for (const table of tables) {
      const seats = table.getSeats();
      for (const seat of seats) {
        if (seat.status === 'seated') {
          connectedAgents.add(seat.agentId);
        }
      }
    }

    const uptimeMs = Date.now() - startTime;
    const uptimeSec = Math.floor(uptimeMs / 1000);
    const handsPerMinute = uptimeMs > 0 ? (handCountSinceStart / (uptimeMs / 60000)).toFixed(2) : '0.00';

    return {
      activeTables,
      totalTables,
      connectedAgents: connectedAgents.size,
      handsPerMinute: parseFloat(handsPerMinute),
      uptime: uptimeSec,
      totalHandsPlayed: handCountSinceStart,
    };
  });

  // Legacy health endpoint (deprecated, use /healthz)
  app.get('/health', async () => ({ status: 'ok' }));

  // ── Tables ──────────────────────────────────────────────

  app.get('/api/tables', async () => {
    const server = deps.gameServer;
    if (!server) return { tables: [] };
    const tables = server.getAllTables().map((t: any) => t.getInfo());
    return { tables };
  });

  app.get<{ Params: { id: string } }>('/api/tables/:id', async (req, reply) => {
    const server = deps.gameServer;
    if (!server) return reply.status(404).send({ error: 'No game server' });
    const table = server.getTable(req.params.id);
    if (!table) return reply.status(404).send({ error: 'Table not found' });
    return table.getInfo();
  });

  app.post<{ Body: { variant?: string; maxSeats?: number } }>('/api/tables', async (req, reply) => {
    const parseResult = CreateTableBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send(formatZodError(parseResult.error));
    }
    const body = parseResult.data;

    const server = deps.gameServer;
    if (!server) throw new Error('No game server');
    const { TableActor } = await import('@agent-poker/game-server');
    const tableId = `tbl_${crypto.randomUUID().slice(0, 8)}`;
    const maxSeats = body.maxSeats ?? 8;
    const table = new TableActor({
      tableId,
      maxSeats,
      onHandComplete: (_tid, handId, events, state) => {
        handCountSinceStart++;
        logger.info({ handId, winners: state.winners }, 'Hand complete');
      },
    });
    server.registerTable(table);
    return { tableId, status: 'open', maxSeats };
  });

  // ── Join table ────────────────────────────────────────

  app.post<{ Params: { id: string }; Body: { agentId: string; buyIn: number } }>(
    '/api/tables/:id/join',
    async (req, reply) => {
      const parseResult = JoinTableBodySchema.safeParse(req.body);
      if (!parseResult.success) {
        return reply.status(400).send(formatZodError(parseResult.error));
      }
      const body = parseResult.data;

      const server = deps.gameServer;
      if (!server) return reply.status(500).send({ error: 'No game server' });
      const table = server.getTable(req.params.id);
      if (!table) return reply.status(404).send({ error: 'Table not found' });

      try {
        const seatToken = signSeatToken({ agentId: body.agentId, tableId: req.params.id });
        const seat = table.addSeat(body.agentId, seatToken, body.buyIn);
        return { seatToken, seatIndex: seat.seatIndex, tableId: req.params.id };
      } catch (err) {
        return reply.status(400).send({ error: (err as Error).message });
      }
    },
  );

  // ── Hands / Events (admin) ────────────────────────────

  app.get<{ Params: { id: string } }>('/api/tables/:id/hands', async (req, reply) => {
    const server = deps.gameServer;
    if (!server) return reply.status(404).send({ error: 'No game server' });
    const table = server.getTable(req.params.id);
    if (!table) return reply.status(404).send({ error: 'Table not found' });
    const history = table.getHandHistory();
    return {
      hands: history.map((h: any) => ({
        handId: h.handId,
        winners: h.winners,
        potTotal: h.potTotal,
        players: h.players,
        communityCards: h.communityCards,
        completedAt: h.completedAt,
      })),
    };
  });

  app.get<{ Params: { id: string; handId: string } }>(
    '/api/tables/:id/hands/:handId',
    async (req, reply) => {
      const server = deps.gameServer;
      if (!server) return reply.status(404).send({ error: 'No game server' });
      const table = server.getTable(req.params.id);
      if (!table) return reply.status(404).send({ error: 'Table not found' });
      const hand = table.getHandById(req.params.handId);
      if (!hand) return reply.status(404).send({ error: 'Hand not found' });
      return hand;
    },
  );

  app.get<{ Params: { id: string } }>('/api/tables/:id/state', async (req, reply) => {
    const server = deps.gameServer;
    if (!server) return reply.status(404).send({ error: 'No game server' });
    const table = server.getTable(req.params.id);
    if (!table) return reply.status(404).send({ error: 'Table not found' });
    const state = table.getState();
    if (!state) return { state: null };
    return {
      state: {
        handId: state.handId,
        street: state.street,
        communityCards: (state.communityCards ?? []).map((c: any) => ({ rank: c.rank, suit: c.suit })),
        potAmount: state.pots?.reduce((s: number, p: any) => s + p.amount, 0) ?? 0,
        activePlayerSeatIndex: state.activePlayerSeatIndex,
        isHandComplete: state.isHandComplete,
        players: state.players.map((p: any) => ({
          id: p.id,
          chips: p.chips,
          currentBet: p.currentBet,
          hasFolded: p.hasFolded,
          isAllIn: p.isAllIn,
          holeCards: (p.holeCards ?? []).map((c: any) => ({ rank: c.rank, suit: c.suit })),
        })),
        winners: state.winners ?? [],
      },
    };
  });

  // ── Matchmaking ─────────────────────────────────────

  app.post<{ Body: { agentId: string; variant?: string; blindLevel?: BlindLevel } }>(
    '/api/matchmaking/queue',
    async (req, reply) => {
      const parseResult = MatchmakingQueueBodySchema.safeParse(req.body);
      if (!parseResult.success) {
        return reply.status(400).send(formatZodError(parseResult.error));
      }
      const body = parseResult.data;

      const variant = body.variant ?? 'LHE';
      const blindLevel = body.blindLevel ?? 'low';

      try {
        matchmakingQueue.enqueue(body.agentId, variant, blindLevel);
        return { status: 'queued', agentId: body.agentId, variant, blindLevel };
      } catch (err) {
        return reply.status(400).send({ error: (err as Error).message });
      }
    },
  );

  app.get<{ Params: { agentId: string } }>('/api/matchmaking/status/:agentId', async (req, reply) => {
    const status = matchmakingQueue.getStatus(req.params.agentId);
    if (!status) {
      return reply.status(404).send({ error: 'Agent not in queue' });
    }
    return status;
  });

  app.delete<{ Params: { agentId: string } }>('/api/matchmaking/queue/:agentId', async (req, reply) => {
    const removed = matchmakingQueue.dequeue(req.params.agentId);
    if (!removed) {
      return reply.status(404).send({ error: 'Agent not in queue' });
    }
    return { status: 'removed', agentId: req.params.agentId };
  });

  // ── Agents (simplified for MVP1) ─────────────────────

  app.post<{ Body: { displayName: string } }>('/api/agents', async (req, reply) => {
    const parseResult = CreateAgentBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send(formatZodError(parseResult.error));
    }
    const body = parseResult.data;

    const agentId = `agent_${crypto.randomUUID().slice(0, 8)}`;
    const apiKey = `ak_${crypto.randomBytes(16).toString('hex')}`;
    return { agentId, apiKey, displayName: body.displayName };
  });

  // ── Admin: Collusion Report ─────────────────────────────

  app.get<{ Querystring: { agentA?: string; agentB?: string } }>(
    '/api/admin/collusion-report',
    async (req, reply) => {
      const query = req.query as { agentA?: string; agentB?: string };

      // If specific pair requested, analyze that pair
      if (query.agentA && query.agentB) {
        const report = analyzeAgentPair(chipDumpDetector, winRateDetector, query.agentA, query.agentB);
        return { reports: [report] };
      }

      // Otherwise, get all known agents from tables and analyze all pairs
      const server = deps.gameServer;
      if (!server) {
        return { reports: [] };
      }

      const agentIds = new Set<string>();
      const tables = server.getAllTables();
      for (const table of tables) {
        const seats = table.getSeats();
        for (const seat of seats) {
          if (seat.status === 'seated') {
            agentIds.add(seat.agentId);
          }
        }
      }

      const agents = Array.from(agentIds);
      const reports = [];
      for (let i = 0; i < agents.length; i++) {
        for (let j = i + 1; j < agents.length; j++) {
          const report = analyzeAgentPair(chipDumpDetector, winRateDetector, agents[i]!, agents[j]!);
          if (report.riskScore > 0 || report.handsAnalyzed > 0) {
            reports.push(report);
          }
        }
      }

      return { reports };
    },
  );
}
