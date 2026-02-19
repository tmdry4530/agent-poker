import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerRoutes } from './routes.js';
import { logger } from './logger.js';

export { registerRoutes } from './routes.js';

const PORT = parseInt(process.env['LOBBY_API_PORT'] ?? '8080', 10);

export async function startLobbyApi(port = PORT, deps?: { gameServer?: any; ledger?: any; identity?: any }) {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true });

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
    await startLobbyApi(PORT, { gameServer, ledger, identity });
  })().catch((err) => {
    logger.error({ err }, 'Failed to start lobby API');
    process.exit(1);
  });
}
