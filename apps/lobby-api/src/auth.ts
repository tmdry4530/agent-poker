/**
 * API auth middleware for lobby-api.
 * Supports dual-mode: JWT access tokens and legacy apiKey authentication.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { IdentityProvider } from '@agent-poker/adapters-identity';
import { verifyAccessToken } from './jwt.js';
import { logger } from './logger.js';

const PUBLIC_PATHS = new Set(['/healthz', '/readyz', '/api/auth/register', '/api/auth/login']);

/**
 * Paths that skip auth in development mode.
 * In production, admin routes should be protected by a separate admin auth mechanism.
 */
function isPublicInDev(url: string): boolean {
  if (process.env['NODE_ENV'] === 'production') return false;
  // Allow all read-only API routes for admin-ui in dev
  return url.startsWith('/api/');
}

export function registerAuthHook(app: FastifyInstance, identity: IdentityProvider): void {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (PUBLIC_PATHS.has(request.url) || isPublicInDev(request.url)) {
      return;
    }

    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.status(401).send({ error: 'UNAUTHORIZED' });
      return;
    }

    const token = authHeader.slice(7);
    if (!token) {
      reply.status(401).send({ error: 'UNAUTHORIZED' });
      return;
    }

    try {
      // Dual-mode: JWT tokens start with "eyJ", otherwise treat as legacy apiKey
      if (token.startsWith('eyJ')) {
        // JWT path
        const claims = verifyAccessToken(token);
        if (!claims) {
          reply.status(401).send({ error: 'UNAUTHORIZED' });
          return;
        }
        (request as any).authClaims = claims;
        (request as any).agentAuth = { agentId: claims.sub, displayName: claims.displayName };
      } else {
        // Legacy apiKey path
        const result = await identity.authenticate(token);
        if (!result) {
          reply.status(401).send({ error: 'UNAUTHORIZED' });
          return;
        }
        (request as any).agentAuth = result;
      }
    } catch (err) {
      logger.error({ err }, 'Auth middleware error');
      reply.status(401).send({ error: 'UNAUTHORIZED' });
    }
  });
}

/**
 * Fastify preHandler that enforces a minimum role.
 * Attach to routes that require a specific role (e.g., 'agent').
 * Requests authenticated via legacy apiKey (no authClaims) are treated as 'agent' role.
 */
export function requireRole(role: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const claims = (request as any).authClaims;
    // Legacy apiKey auth has no claims — treat as 'agent' role
    const actualRole: string = claims?.role ?? 'agent';
    if (actualRole !== role) {
      reply.status(403).send({ error: 'FORBIDDEN', message: `Requires role: ${role}` });
    }
  };
}
