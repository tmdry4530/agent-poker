/**
 * Auth routes: register + login endpoints for lobby-api.
 */

import type { FastifyInstance } from 'fastify';
import type { IdentityProvider } from '@agent-poker/adapters-identity';
import { signAccessToken } from './jwt.js';
import { RegisterBodySchema, LoginBodySchema } from './auth-schemas.js';
import { formatZodError } from './schemas.js';
import { logger } from './logger.js';

export function registerAuthRoutes(app: FastifyInstance, identity: IdentityProvider): void {
  /**
   * POST /api/auth/register
   * Register a new agent, returning agentId + apiKey (secret).
   */
  app.post<{ Body: { displayName: string } }>('/api/auth/register', async (req, reply) => {
    const parseResult = RegisterBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send(formatZodError(parseResult.error));
    }
    const { displayName } = parseResult.data;

    try {
      const result = await identity.registerAgent(displayName);
      return {
        agent_id: result.agentId,
        secret: result.apiKey,
        displayName,
      };
    } catch (err) {
      logger.error({ err }, 'Registration failed');
      return reply.status(500).send({ error: 'REGISTRATION_FAILED' });
    }
  });

  /**
   * POST /api/auth/login
   * Authenticate with agentId + secret (apiKey), returns JWT access token.
   */
  app.post<{ Body: { agent_id: string; secret: string; client_type?: string } }>(
    '/api/auth/login',
    async (req, reply) => {
      const parseResult = LoginBodySchema.safeParse(req.body);
      if (!parseResult.success) {
        return reply.status(400).send(formatZodError(parseResult.error));
      }
      const { agent_id, secret, client_type } = parseResult.data;

      try {
        const authResult = await identity.authenticate(secret);
        if (!authResult) {
          return reply.status(401).send({ error: 'INVALID_CREDENTIALS' });
        }

        // Verify the returned agentId matches the claimed agent_id
        if (authResult.agentId !== agent_id) {
          return reply.status(401).send({ error: 'INVALID_CREDENTIALS' });
        }

        const role = client_type === 'human' ? 'spectator' : 'agent';
        const accessToken = signAccessToken({
          sub: authResult.agentId,
          displayName: authResult.displayName,
          role,
        });

        return {
          access_token: accessToken,
          agent_id: authResult.agentId,
          role,
          expires_in: role === 'agent' ? 86400 : 14400,
        };
      } catch (err) {
        logger.error({ err }, 'Login failed');
        return reply.status(500).send({ error: 'LOGIN_FAILED' });
      }
    },
  );
}
