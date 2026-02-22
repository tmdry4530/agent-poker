import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { registerRoutes } from './routes.js';
import { registerAuthHook } from './auth.js';
import { registerAuthRoutes } from './auth-routes.js';
import { logger } from './logger.js';
import type { IdentityProvider } from '@agent-poker/adapters-identity';

export { registerRoutes } from './routes.js';
export { registerAuthHook } from './auth.js';
export { registerAuthRoutes } from './auth-routes.js';

const PORT = parseInt(process.env['LOBBY_API_PORT'] ?? '8080', 10);

function getCorsOrigins(): string[] | boolean {
  const env = process.env['NODE_ENV'];
  // Support both CORS_ORIGINS and ALLOWED_ORIGINS (ALLOWED_ORIGINS takes precedence)
  const corsOrigins = process.env['ALLOWED_ORIGINS'] ?? process.env['CORS_ORIGINS'];

  if (env === 'production') {
    if (!corsOrigins) {
      throw new Error('CORS_ORIGINS (or ALLOWED_ORIGINS) must be set in production. Example: CORS_ORIGINS=https://example.com,https://admin.example.com');
    }
    const origins = corsOrigins.split(',').map((o) => o.trim());
    if (origins.includes('*')) {
      throw new Error('CORS_ORIGINS must not contain wildcard (*) in production.');
    }
    return origins;
  }

  // Development: use CORS_ORIGINS if set, otherwise default to localhost:3000
  if (corsOrigins) {
    return corsOrigins.split(',').map((o) => o.trim());
  }
  return ['http://localhost:3000'];
}

export async function startLobbyApi(port = PORT, deps?: { gameServer?: any; ledger?: any; identity?: any; db?: any }) {
  const app = Fastify({ logger: false });

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: false, // API server, not serving HTML
  });

  // Rate limiting
  const rateLimitMax = parseInt(process.env['RATE_LIMIT_MAX'] ?? '100', 10);
  const rateLimitWindow = parseInt(process.env['RATE_LIMIT_WINDOW'] ?? '60000', 10);
  await app.register(rateLimit, {
    max: rateLimitMax,
    timeWindow: rateLimitWindow,
    allowList: ['127.0.0.1', '::1'], // Allow localhost (health checks)
  });

  const origins = getCorsOrigins();
  await app.register(cors, { origin: origins });

  // Register auth middleware if identity provider is available
  if (deps?.identity) {
    registerAuthHook(app, deps.identity as IdentityProvider);
    registerAuthRoutes(app, deps.identity as IdentityProvider);
  }

  // Global error handler: return structured errors, never leak stack traces
  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    const statusCode = error.statusCode ?? 500;
    logger.error({ err: error, statusCode }, 'Request error');

    if (statusCode >= 500) {
      return reply.status(statusCode).send({
        error: 'Internal Server Error',
        message: process.env['NODE_ENV'] === 'production'
          ? 'An unexpected error occurred'
          : error.message,
        statusCode,
      });
    }

    return reply.status(statusCode).send({
      error: error.name,
      message: error.message,
      statusCode,
    });
  });

  registerRoutes(app, deps ?? {});

  await app.listen({ port, host: '0.0.0.0' });
  logger.info({ port }, 'Lobby API started');
  return app;
}

function validateEnv(): void {
  const required = ['AUTH_JWT_SECRET', 'SEAT_TOKEN_SECRET', 'DATABASE_URL'];
  if (process.env['NODE_ENV'] === 'production') {
    const missing = required.filter(k => !process.env[k]);
    if (missing.length > 0) {
      throw new Error(`Missing required env vars: ${missing.join(', ')}`);
    }
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1])) {
  (async () => {
    validateEnv();

    const { createLedger, createIdentityProvider } = await import('./adapters.js');
    const { GameServerWs } = await import('@agent-poker/game-server');

    // Initialize adapters
    const ledger = await createLedger();
    const identity = await createIdentityProvider();

    // Initialize database (optional, for cross-process table sharing)
    let db: any = undefined;
    if (process.env['DATABASE_URL']) {
      const { createDatabase } = await import('@agent-poker/database');
      db = createDatabase({ connectionString: process.env['DATABASE_URL'] });
      logger.info('Database connected for table persistence');
    }

    // Initialize game server
    const gameServer = new GameServerWs();
    const WS_PORT = parseInt(process.env['GAME_SERVER_PORT'] ?? '8081', 10);
    await gameServer.start(WS_PORT);
    logger.info({ port: WS_PORT }, 'WebSocket server started');

    // Inject DB into game server for cross-process table loading
    if (db) {
      gameServer.setDatabase(db);
    }

    // Start lobby API with all dependencies
    const app = await startLobbyApi(PORT, { gameServer, ledger, identity, db });

    // Graceful shutdown handler
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Received signal, starting graceful shutdown');
      // 1. Stop accepting new HTTP requests and drain existing connections
      await app.close();
      logger.info('Fastify server closed');
      // 2. Gracefully shut down the game server (notify agents, wait, force close)
      await gameServer.gracefulStop(5000);
      process.exit(0);
    };
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
  })().catch((err) => {
    logger.error({ err }, 'Failed to start lobby API');
    process.exit(1);
  });
}
