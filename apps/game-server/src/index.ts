import { GameServerWs } from './ws-handler.js';
import { TableActor } from './table-actor.js';
import { logger } from './logger.js';

export { GameServerWs } from './ws-handler.js';
export { TableActor } from './table-actor.js';
export type { TableActorOptions } from './table-actor.js';
export type { TableInfo, SeatInfo, WsEnvelope } from './types.js';
export { PROTOCOL_VERSION } from './types.js';
export { signSeatToken, verifySeatToken, refreshSeatToken } from './seat-token.js';
export type { SeatTokenPayload } from './seat-token.js';

// Standalone startup
const WS_PORT = parseInt(process.env['GAME_SERVER_PORT'] ?? '8081', 10);

export async function startServer(port = WS_PORT): Promise<GameServerWs> {
  const server = new GameServerWs();
  await server.start(port);
  logger.info({ port }, 'WebSocket server started');
  return server;
}

// Direct execution
if (process.argv[1] && import.meta.url.endsWith(process.argv[1])) {
  startServer()
    .then((server) => {
      const shutdown = async (signal: string) => {
        logger.info({ signal }, 'Received signal, starting graceful shutdown');
        await server.gracefulStop(5000);
        process.exit(0);
      };
      process.on('SIGTERM', () => void shutdown('SIGTERM'));
      process.on('SIGINT', () => void shutdown('SIGINT'));

      // Global error handlers — log and keep server running
      process.on('uncaughtException', (err) => {
        logger.error({ err }, 'Uncaught exception (server remains running)');
      });
      process.on('unhandledRejection', (reason) => {
        logger.error({ reason }, 'Unhandled rejection (server remains running)');
      });
    })
    .catch((err) => {
      logger.error({ err }, 'Failed to start server');
      process.exit(1);
    });
}
