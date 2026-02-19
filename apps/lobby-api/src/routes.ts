import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';

interface Deps {
  gameServer?: any;
  ledger?: any;
  identity?: any;
}

export function registerRoutes(app: FastifyInstance, deps: Deps): void {
  // Health check
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

  app.post<{ Body: { variant?: string; maxSeats?: number } }>('/api/tables', async (req) => {
    const server = deps.gameServer;
    if (!server) throw new Error('No game server');
    const { TableActor } = await import('@agent-poker/game-server');
    const body = req.body as { variant?: string; maxSeats?: number } | undefined;
    const tableId = `tbl_${crypto.randomUUID().slice(0, 8)}`;
    const table = new TableActor({
      tableId,
      maxSeats: body?.maxSeats ?? 8,
      onHandComplete: (_tid, handId, events, state) => {
        console.log(`[lobby] Hand ${handId} complete. Winner: ${state.winners?.join(', ')}`);
      },
    });
    server.registerTable(table);
    return { tableId, status: 'open', maxSeats: body?.maxSeats ?? 8 };
  });

  // ── Join table ────────────────────────────────────────

  app.post<{ Params: { id: string }; Body: { agentId: string; buyIn: number } }>(
    '/api/tables/:id/join',
    async (req, reply) => {
      const server = deps.gameServer;
      if (!server) return reply.status(500).send({ error: 'No game server' });
      const table = server.getTable(req.params.id);
      if (!table) return reply.status(404).send({ error: 'Table not found' });

      const body = req.body as { agentId?: string; buyIn?: number } | undefined;
      if (!body?.agentId || !body?.buyIn) {
        return reply.status(400).send({ error: 'Missing agentId or buyIn' });
      }

      try {
        const seatToken = `st_${crypto.randomUUID().slice(0, 12)}`;
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

  // ── Agents (simplified for MVP1) ─────────────────────

  app.post<{ Body: { displayName: string } }>('/api/agents', async (req) => {
    const body = req.body as { displayName?: string } | undefined;
    const displayName = body?.displayName ?? 'unnamed';
    const agentId = `agent_${crypto.randomUUID().slice(0, 8)}`;
    const apiKey = `ak_${crypto.randomBytes(16).toString('hex')}`;
    return { agentId, apiKey, displayName };
  });
}
