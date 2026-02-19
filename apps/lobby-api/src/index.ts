import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerRoutes } from './routes.js';
import { registerAuthHook } from './auth.js';
import { logger } from './logger.js';
import type { IdentityProvider } from './adapters.js';

export { registerRoutes } from './routes.js';
export { registerAuthHook } from './auth.js';

const PORT = parseInt(process.env['LOBBY_API_PORT'] ?? '8080', 10);

function getCorsOrigins(): string[] | boolean {
  const env = process.env['NODE_ENV'];
  const corsOrigins = process.env['CORS_ORIGINS'];

  if (env === 'production') {
    if (!corsOrigins) {
      throw new Error('CORS_ORIGINS must be set in production. Example: CORS_ORIGINS=https://example.com,https://admin.example.com');
    }
    return corsOrigins.split(',').map((o) => o.trim());
  }

  // Development: use CORS_ORIGINS if set, otherwise default to localhost:3000
  if (corsOrigins) {
    return corsOrigins.split(',').map((o) => o.trim());
  }
  return ['http://localhost:3000'];
}

export async function startLobbyApi(port = PORT, deps?: { gameServer?: any; ledger?: any; identity?: any }) {
  const app = Fastify({ logger: false });

  const origins = getCorsOrigins();
  await app.register(cors, { origin: origins });

  // Register auth middleware if identity provider is available
  if (deps?.identity) {
    registerAuthHook(app, deps.identity as IdentityProvider);
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

if (process.argv[1] && import.meta.url.endsWith(process.argv[1])) {
  (async () => {
    const { createLedger, createIdentityProvider } = await import('./adapters.js');
    const { GameServerWs } = await import('@agent-poker/game-server');

    // Initialize adapters
    const ledger = await createLedger();
    const identity = await createIdentityProvider();

    // Initialize game server
    const gameServer = new GameServerWs();
    const WS_PORT = parseInt(process.env['GAME_SERVER_PORT'] ?? '8081', 10);
    await gameServer.start(WS_PORT);
    logger.info({ port: WS_PORT }, 'WebSocket server started');

    // Start lobby API with all dependencies
    const app = await startLobbyApi(PORT, { gameServer, ledger, identity });

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
