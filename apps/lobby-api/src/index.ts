import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerRoutes } from './routes.js';

export { registerRoutes } from './routes.js';

const PORT = parseInt(process.env['LOBBY_API_PORT'] ?? '8080', 10);

export async function startLobbyApi(port = PORT, deps?: { gameServer?: any; ledger?: any; identity?: any }) {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true });

  registerRoutes(app, deps ?? {});

  await app.listen({ port, host: '0.0.0.0' });
  console.log(`[lobby-api] HTTP listening on http://localhost:${port}`);
  return app;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1])) {
  (async () => {
    const { GameServerWs } = await import('@agent-poker/game-server');
    const gameServer = new GameServerWs();
    const WS_PORT = parseInt(process.env['GAME_SERVER_PORT'] ?? '8081', 10);
    await gameServer.start(WS_PORT);
    console.log(`[game-server] WebSocket listening on ws://localhost:${WS_PORT}`);
    await startLobbyApi(PORT, { gameServer });
  })().catch(console.error);
}
