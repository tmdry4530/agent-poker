import pino from 'pino';

const options: pino.LoggerOptions =
  process.env['NODE_ENV'] !== 'production'
    ? {
        level: process.env['LOG_LEVEL'] ?? 'info',
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }
    : {
        level: process.env['LOG_LEVEL'] ?? 'info',
        base: { service: 'lobby-api' },
      };

export const logger = pino(options);
