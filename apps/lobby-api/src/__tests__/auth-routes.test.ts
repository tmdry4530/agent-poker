import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { MemoryIdentityProvider } from '@agent-poker/adapters-identity';
import { registerAuthRoutes } from '../auth-routes.js';
import { verifyAccessToken } from '../jwt.js';

describe('Auth Routes', () => {
  let app: FastifyInstance;
  let identity: MemoryIdentityProvider;

  beforeAll(async () => {
    identity = new MemoryIdentityProvider();
    app = Fastify({ logger: false });
    registerAuthRoutes(app, identity);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('registers a new agent', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { displayName: 'RegisterBot' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.agent_id).toBeDefined();
      expect(body.secret).toBeDefined();
      expect(body.displayName).toBe('RegisterBot');
    });

    it('rejects empty displayName', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { displayName: '' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects missing displayName', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    let agentId: string;
    let secret: string;

    beforeAll(async () => {
      // Register an agent to log in with
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { displayName: 'LoginBot' },
      });
      const body = res.json();
      agentId = body.agent_id;
      secret = body.secret;
    });

    it('logs in with valid credentials and returns JWT', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { agent_id: agentId, secret },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.access_token).toBeDefined();
      expect(body.agent_id).toBe(agentId);
      expect(body.role).toBe('agent');
      expect(body.expires_in).toBe(86400);

      // Verify the token is valid
      const claims = verifyAccessToken(body.access_token);
      expect(claims).not.toBeNull();
      expect(claims!.sub).toBe(agentId);
      expect(claims!.role).toBe('agent');
    });

    it('returns spectator role for human client_type', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { agent_id: agentId, secret, client_type: 'human' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.role).toBe('spectator');
      expect(body.expires_in).toBe(14400);
    });

    it('rejects wrong secret', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { agent_id: agentId, secret: 'wrong-secret' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects wrong agent_id with valid secret', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { agent_id: 'wrong-agent-id', secret },
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects missing fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { agent_id: agentId },
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
