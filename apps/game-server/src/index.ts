import { GameServerWs } from './ws-handler.js';
import { TableActor } from './table-actor.js';

export { GameServerWs } from './ws-handler.js';
export { TableActor } from './table-actor.js';
export type { TableActorOptions } from './table-actor.js';
export type { TableInfo, SeatInfo, WsEnvelope } from './types.js';
export { PROTOCOL_VERSION } from './types.js';

// Standalone startup
const WS_PORT = parseInt(process.env['GAME_SERVER_PORT'] ?? '8081', 10);

export async function startServer(port = WS_PORT): Promise<GameServerWs> {
  const server = new GameServerWs();
  await server.start(port);
  console.log(`[game-server] WebSocket listening on ws://localhost:${port}`);
  return server;
}

// Direct execution
if (process.argv[1] && import.meta.url.endsWith(process.argv[1])) {
  startServer().catch(console.error);
}
