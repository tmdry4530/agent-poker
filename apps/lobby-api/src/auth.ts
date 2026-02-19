/**
 * API auth middleware for lobby-api.
 * All routes except /healthz and /readyz require Authorization: Bearer <apiKey>.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { IdentityProvider } from './adapters.js';
import { logger } from './logger.js';

const PUBLIC_PATHS = new Set(['/healthz', '/readyz']);

export function registerAuthHook(app: FastifyInstance, identity: IdentityProvider): void {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (PUBLIC_PATHS.has(request.url)) {
      return;
    }

    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.status(401).send({ error: 'UNAUTHORIZED' });
      return;
    }

    const apiKey = authHeader.slice(7);
    if (!apiKey) {
      reply.status(401).send({ error: 'UNAUTHORIZED' });
      return;
    }

    try {
      const result = await identity.authenticate(apiKey);
      if (!result) {
        reply.status(401).send({ error: 'UNAUTHORIZED' });
        return;
      }

      // Attach authenticated agent info to request for downstream handlers
      (request as any).agentAuth = result;
    } catch (err) {
      logger.error({ err }, 'Auth middleware error');
      reply.status(401).send({ error: 'UNAUTHORIZED' });
    }
  });
}
