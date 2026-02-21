import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { MemoryIdentityProvider } from '@agent-poker/adapters-identity';
import { registerAuthHook, requireRole } from '../auth.js';
import { signAccessToken } from '../jwt.js';

describe('Auth Middleware', () => {
  let app: FastifyInstance;
  let identity: MemoryIdentityProvider;
  let testApiKey: string;
  let testAgentId: string;

  beforeAll(async () => {
    // Force non-dev mode so auth is enforced
    process.env['NODE_ENV'] = 'production';
    process.env['AUTH_JWT_SECRET'] = 'test-jwt-secret-for-auth-middleware';

    identity = new MemoryIdentityProvider();
    const reg = await identity.registerAgent('MiddlewareBot');
    testApiKey = reg.apiKey;
    testAgentId = reg.agentId;

    app = Fastify({ logger: false });
    registerAuthHook(app, identity);

    // Test route that requires auth
    app.get('/api/test', async (request) => {
      return { agentAuth: (request as any).agentAuth };
    });

    // Test route with agent role guard
    app.post('/api/test-agent', { preHandler: [requireRole('agent')] }, async (request) => {
      return { ok: true };
    });

    // Public paths
    app.get('/healthz', async () => ({ status: 'ok' }));
    app.post('/api/auth/register', async () => ({ ok: true }));
    app.post('/api/auth/login', async () => ({ ok: true }));

    await app.ready();
  });

  afterAll(async () => {
    delete process.env['NODE_ENV'];
    delete process.env['AUTH_JWT_SECRET'];
    await app.close();
  });

  describe('Public paths', () => {
    it('allows /healthz without auth', async () => {
      const res = await app.inject({ method: 'GET', url: '/healthz' });
      expect(res.statusCode).toBe(200);
    });

    it('allows /api/auth/register without auth', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/auth/register' });
      expect(res.statusCode).toBe(200);
    });

    it('allows /api/auth/login without auth', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/auth/login' });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Missing/invalid auth', () => {
    it('rejects request without Authorization header', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/test' });
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe('UNAUTHORIZED');
    });

    it('rejects request with malformed Authorization header', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/test',
        headers: { authorization: 'Basic abc123' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects request with empty Bearer token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/test',
        headers: { authorization: 'Bearer ' },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('JWT auth', () => {
    it('authenticates with valid JWT token', async () => {
      const token = signAccessToken({ sub: testAgentId, displayName: 'MiddlewareBot', role: 'agent' });
      const res = await app.inject({
        method: 'GET',
        url: '/api/test',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.agentAuth.agentId).toBe(testAgentId);
      expect(body.agentAuth.displayName).toBe('MiddlewareBot');
    });

    it('rejects expired JWT token', async () => {
      // Create a token that's already expired
      const jwt = await import('jsonwebtoken');
      const token = jwt.default.sign(
        { sub: testAgentId, displayName: 'MiddlewareBot', role: 'agent' },
        'test-jwt-secret-for-auth-middleware',
        { expiresIn: -1 },
      );
      const res = await app.inject({
        method: 'GET',
        url: '/api/test',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('Legacy apiKey auth', () => {
    it('authenticates with valid apiKey', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/test',
        headers: { authorization: `Bearer ${testApiKey}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.agentAuth.agentId).toBe(testAgentId);
    });

    it('rejects invalid apiKey', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/test',
        headers: { authorization: 'Bearer ak_invalid_key_12345' },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('Role guard', () => {
    it('allows agent role through requireRole("agent")', async () => {
      const token = signAccessToken({ sub: testAgentId, displayName: 'Bot', role: 'agent' });
      const res = await app.inject({
        method: 'POST',
        url: '/api/test-agent',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
    });

    it('blocks spectator from agent-only route with 403', async () => {
      const token = signAccessToken({ sub: testAgentId, displayName: 'Viewer', role: 'spectator' });
      const res = await app.inject({
        method: 'POST',
        url: '/api/test-agent',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe('FORBIDDEN');
    });

    it('allows legacy apiKey auth (treated as agent role)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/test-agent',
        headers: { authorization: `Bearer ${testApiKey}` },
      });
      expect(res.statusCode).toBe(200);
    });
  });
});
