import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerRoutes } from '../routes.js';
import {
  CreateTableBodySchema,
  JoinTableBodySchema,
  MatchmakingQueueBodySchema,
  CreateAgentBodySchema,
  formatZodError,
} from '../schemas.js';

// ══════════════════════════════════════════════════════════════
// Lobby API route tests (light-my-request style via Fastify inject)
// ══════════════════════════════════════════════════════════════

describe('Lobby API Routes', () => {
  let app: FastifyInstance;
  let mockGameServer: any;

  beforeAll(async () => {
    // Mock game server with required methods
    const tables = new Map<string, any>();
    mockGameServer = {
      getAllTables: () => [...tables.values()],
      getTable: (id: string) => tables.get(id),
      registerTable: (table: any) => tables.set(table.tableId, table),
      sendToAgent: () => {},
      _tables: tables,
    };

    app = Fastify({ logger: false });
    registerRoutes(app, { gameServer: mockGameServer });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Health endpoints ─────────────────────────────────────

  describe('Health endpoints', () => {
    it('GET /healthz returns ok', async () => {
      const res = await app.inject({ method: 'GET', url: '/healthz' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: 'ok' });
    });

    it('GET /readyz returns ready when game server is available', async () => {
      const res = await app.inject({ method: 'GET', url: '/readyz' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: 'ready' });
    });

    it('GET /health (legacy) returns ok', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: 'ok' });
    });
  });

  // ── Stats endpoint ───────────────────────────────────────

  describe('GET /api/stats', () => {
    it('returns stats with numeric fields', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/stats' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(typeof body.activeTables).toBe('number');
      expect(typeof body.totalTables).toBe('number');
      expect(typeof body.connectedAgents).toBe('number');
      expect(typeof body.handsPerMinute).toBe('number');
      expect(typeof body.uptime).toBe('number');
      expect(typeof body.totalHandsPlayed).toBe('number');
    });
  });

  // ── Tables CRUD ──────────────────────────────────────────

  describe('Tables', () => {
    it('GET /api/tables returns empty list initially', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/tables' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.tables).toBeDefined();
      expect(Array.isArray(body.tables)).toBe(true);
    });

    it('POST /api/tables creates a table', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tables',
        payload: { maxSeats: 4 },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.tableId).toBeDefined();
      expect(body.status).toBe('open');
      expect(body.maxSeats).toBe(4);
    });

    it('POST /api/tables with defaults', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tables',
        payload: {},
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.maxSeats).toBe(6); // default
    });

    it('POST /api/tables rejects invalid maxSeats', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tables',
        payload: { maxSeats: 100 },
      });
      expect(res.statusCode).toBe(400);
    });

    it('GET /api/tables/:id returns 404 for nonexistent table', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/tables/nonexistent' });
      expect(res.statusCode).toBe(404);
    });

    it('GET /api/tables/:id returns table info', async () => {
      // Create a table first
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/tables',
        payload: {},
      });
      const { tableId } = createRes.json();

      const res = await app.inject({ method: 'GET', url: `/api/tables/${tableId}` });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.id).toBe(tableId);
    });
  });

  // ── Join table ───────────────────────────────────────────

  describe('POST /api/tables/:id/join', () => {
    it('joins an existing table', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/tables',
        payload: { maxSeats: 4 },
      });
      const { tableId } = createRes.json();

      const res = await app.inject({
        method: 'POST',
        url: `/api/tables/${tableId}/join`,
        payload: { agentId: 'agent-join-1', buyIn: 1000 },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.seatToken).toBeDefined();
      expect(body.tableId).toBe(tableId);
      expect(typeof body.seatIndex).toBe('number');
    });

    it('returns 404 for nonexistent table', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tables/nonexistent/join',
        payload: { agentId: 'agent-1', buyIn: 1000 },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 400 for invalid body', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/tables',
        payload: {},
      });
      const { tableId } = createRes.json();

      const res = await app.inject({
        method: 'POST',
        url: `/api/tables/${tableId}/join`,
        payload: { agentId: '', buyIn: -1 },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // ── Hands / Events ──────────────────────────────────────

  describe('Hands endpoints', () => {
    it('GET /api/tables/:id/hands returns 404 for nonexistent table', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/tables/nonexistent/hands' });
      expect(res.statusCode).toBe(404);
    });

    it('GET /api/tables/:id/hands/:handId returns 404 for nonexistent hand', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/tables',
        payload: {},
      });
      const { tableId } = createRes.json();

      const res = await app.inject({
        method: 'GET',
        url: `/api/tables/${tableId}/hands/nonexistent`,
      });
      expect(res.statusCode).toBe(404);
    });

    it('GET /api/tables/:id/state returns null state for table without active hand', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/tables',
        payload: {},
      });
      const { tableId } = createRes.json();

      const res = await app.inject({ method: 'GET', url: `/api/tables/${tableId}/state` });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ state: null });
    });
  });

  // ── Matchmaking ──────────────────────────────────────────

  describe('Matchmaking', () => {
    it('POST /api/matchmaking/queue enqueues an agent', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/matchmaking/queue',
        // Each test uses a unique blindLevel to avoid auto-matching across tests
        payload: { agentId: 'mm-agent-1', blindLevel: 'low' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('queued');
      expect(body.agentId).toBe('mm-agent-1');
    });

    it('POST /api/matchmaking/queue rejects duplicate enqueue', async () => {
      // Use 'high' blind level with only 1 agent so auto-match doesn't fire
      await app.inject({
        method: 'POST',
        url: '/api/matchmaking/queue',
        payload: { agentId: 'mm-dup-solo', blindLevel: 'high' },
      });
      // Second enqueue of the same agent (still in queue since no match partner)
      const res = await app.inject({
        method: 'POST',
        url: '/api/matchmaking/queue',
        payload: { agentId: 'mm-dup-solo', blindLevel: 'high' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('GET /api/matchmaking/status/:agentId returns status', async () => {
      // Use 'micro' blind level with only 1 agent so it stays in queue
      await app.inject({
        method: 'POST',
        url: '/api/matchmaking/queue',
        payload: { agentId: 'mm-status-solo', blindLevel: 'micro' },
      });
      const res = await app.inject({
        method: 'GET',
        url: '/api/matchmaking/status/mm-status-solo',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.position).toBeGreaterThan(0);
    });

    it('GET /api/matchmaking/status/:agentId returns 404 for unknown agent', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/matchmaking/status/unknown-agent',
      });
      expect(res.statusCode).toBe(404);
    });

    it('DELETE /api/matchmaking/queue/:agentId removes agent', async () => {
      // Use 'mid' blind level so this agent won't match with others using different levels
      await app.inject({
        method: 'POST',
        url: '/api/matchmaking/queue',
        payload: { agentId: 'mm-del-agent', blindLevel: 'mid' },
      });
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/matchmaking/queue/mm-del-agent',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('removed');
    });

    it('DELETE /api/matchmaking/queue/:agentId returns 404 for unknown agent', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/matchmaking/queue/unknown',
      });
      expect(res.statusCode).toBe(404);
    });

    it('POST /api/matchmaking/queue rejects invalid body', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/matchmaking/queue',
        payload: { agentId: '' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // ── Agents ───────────────────────────────────────────────

  describe('POST /api/agents', () => {
    it('creates an agent with displayName', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/agents',
        payload: { displayName: 'TestBot' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.agentId).toBeDefined();
      expect(body.apiKey).toBeDefined();
      expect(body.displayName).toBe('TestBot');
    });

    it('rejects empty displayName', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/agents',
        payload: { displayName: '' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // ── Collusion report ─────────────────────────────────────

  describe('GET /api/admin/collusion-report', () => {
    it('returns empty reports when no agents', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/collusion-report',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.reports).toBeDefined();
      expect(Array.isArray(body.reports)).toBe(true);
    });

    it('returns report for specific agent pair', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/collusion-report?agentA=a&agentB=b',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.reports).toHaveLength(1);
      expect(body.reports[0].agentA).toBe('a');
      expect(body.reports[0].agentB).toBe('b');
    });
  });
});

// ══════════════════════════════════════════════════════════════
// Schema validation tests
// ══════════════════════════════════════════════════════════════

describe('Lobby API Schemas', () => {
  describe('CreateTableBodySchema', () => {
    it('accepts valid body', () => {
      expect(CreateTableBodySchema.safeParse({ maxSeats: 4 }).success).toBe(true);
    });

    it('accepts empty body', () => {
      expect(CreateTableBodySchema.safeParse({}).success).toBe(true);
    });

    it('rejects maxSeats < 2', () => {
      expect(CreateTableBodySchema.safeParse({ maxSeats: 1 }).success).toBe(false);
    });

    it('rejects maxSeats > 10', () => {
      expect(CreateTableBodySchema.safeParse({ maxSeats: 11 }).success).toBe(false);
    });
  });

  describe('JoinTableBodySchema', () => {
    it('accepts valid body', () => {
      expect(JoinTableBodySchema.safeParse({ agentId: 'a', buyIn: 1000 }).success).toBe(true);
    });

    it('rejects missing agentId', () => {
      expect(JoinTableBodySchema.safeParse({ buyIn: 1000 }).success).toBe(false);
    });

    it('rejects zero buyIn', () => {
      expect(JoinTableBodySchema.safeParse({ agentId: 'a', buyIn: 0 }).success).toBe(false);
    });

    it('rejects negative buyIn', () => {
      expect(JoinTableBodySchema.safeParse({ agentId: 'a', buyIn: -100 }).success).toBe(false);
    });
  });

  describe('MatchmakingQueueBodySchema', () => {
    it('accepts valid body', () => {
      expect(MatchmakingQueueBodySchema.safeParse({ agentId: 'a' }).success).toBe(true);
    });

    it('accepts with blind level', () => {
      expect(MatchmakingQueueBodySchema.safeParse({ agentId: 'a', blindLevel: 'high' }).success).toBe(true);
    });

    it('rejects invalid blind level', () => {
      expect(MatchmakingQueueBodySchema.safeParse({ agentId: 'a', blindLevel: 'ultra' }).success).toBe(false);
    });
  });

  describe('CreateAgentBodySchema', () => {
    it('accepts valid body', () => {
      expect(CreateAgentBodySchema.safeParse({ displayName: 'Bot' }).success).toBe(true);
    });

    it('rejects empty displayName', () => {
      expect(CreateAgentBodySchema.safeParse({ displayName: '' }).success).toBe(false);
    });
  });

  describe('formatZodError', () => {
    it('returns structured error', () => {
      const result = JoinTableBodySchema.safeParse({});
      if (!result.success) {
        const formatted = formatZodError(result.error);
        expect(formatted.error).toBe('VALIDATION_ERROR');
        expect(Array.isArray(formatted.details)).toBe(true);
      }
    });
  });
});

// ══════════════════════════════════════════════════════════════
// Readiness without game server
// ══════════════════════════════════════════════════════════════

describe('Lobby API without game server', () => {
  let bareApp: FastifyInstance;

  beforeAll(async () => {
    bareApp = Fastify({ logger: false });
    registerRoutes(bareApp, {});
    await bareApp.ready();
  });

  afterAll(async () => {
    await bareApp.close();
  });

  it('GET /readyz returns 503 without game server', async () => {
    const res = await bareApp.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(503);
  });

  it('GET /api/tables returns empty without game server', async () => {
    const res = await bareApp.inject({ method: 'GET', url: '/api/tables' });
    expect(res.statusCode).toBe(200);
    expect(res.json().tables).toEqual([]);
  });

  it('GET /api/stats returns 503 without game server', async () => {
    const res = await bareApp.inject({ method: 'GET', url: '/api/stats' });
    expect(res.statusCode).toBe(503);
  });
});
