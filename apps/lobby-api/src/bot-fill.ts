import { signSeatToken } from '@agent-poker/game-server';
import { persistSeat, ensureAgent } from '@agent-poker/database';
import { BOT_CONFIG } from './bot-config.js';
import { BotPlayer } from './bot-player.js';
import { logger } from './logger.js';
import type { Database } from '@agent-poker/database';

let botCounter = 0;

interface PendingFill {
  tableId: string;
  maxSeats: number;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Manages bot fill timers and bot lifecycle.
 * When a table doesn't reach maxSeats after the configured timeout,
 * remaining seats are filled with AI bot players.
 */
export class BotFillManager {
  private pendingFills = new Map<string, PendingFill>();
  private activeBots = new Map<string, BotPlayer[]>();
  private gameServer: any;
  private db: Database | undefined;

  constructor(gameServer: any, db?: Database) {
    this.gameServer = gameServer;
    this.db = db;
  }

  /**
   * Schedule a bot fill check for a table.
   * Called after a match is created with fewer than maxSeats players.
   */
  scheduleFill(tableId: string, maxSeats: number): void {
    if (!BOT_CONFIG.enabled) return;

    // Cancel any existing timer for this table
    this.cancelFill(tableId);

    const timer = setTimeout(() => {
      this.fillTable(tableId, maxSeats).catch((err) => {
        logger.error({ tableId, err }, 'Bot fill failed');
      });
    }, BOT_CONFIG.timeoutMs);

    this.pendingFills.set(tableId, { tableId, maxSeats, timer });

    logger.info(
      { tableId, maxSeats, timeoutMs: BOT_CONFIG.timeoutMs },
      'Scheduled bot fill check',
    );
  }

  /**
   * Cancel a pending bot fill.
   */
  cancelFill(tableId: string): void {
    const pending = this.pendingFills.get(tableId);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingFills.delete(tableId);
    }
  }

  /**
   * Fill remaining seats on a table with bots.
   */
  private async fillTable(tableId: string, maxSeats: number): Promise<void> {
    this.pendingFills.delete(tableId);

    const table = this.gameServer?.getTable(tableId);
    if (!table) {
      logger.warn({ tableId }, 'Bot fill: table not found');
      return;
    }

    const info = table.getInfo();
    const occupiedSeats = info.seats.filter((s: any) => s.status === 'seated').length;
    const emptySlots = maxSeats - occupiedSeats;

    if (emptySlots <= 0) {
      logger.info({ tableId, occupiedSeats }, 'Bot fill: table already full');
      return;
    }

    if (!BOT_CONFIG.apiKey) {
      logger.warn({ tableId }, 'Bot fill: ANTHROPIC_API_KEY not set, bots will use basic strategy');
    }

    logger.info({ tableId, emptySlots, occupiedSeats, maxSeats }, 'Filling table with bots');

    // Phase 1: Create all seats and persist to DB BEFORE connecting any bot.
    // This ensures the game-server can load all seats from DB on first HELLO.
    const botSeats: Array<{ botId: string; seatToken: string; seatIndex: number }> = [];

    for (let i = 0; i < emptySlots; i++) {
      const botId = `bot-${++botCounter}`;

      try {
        const seatToken = signSeatToken({ agentId: botId, tableId });
        const seat = table.addSeat(botId, seatToken, BOT_CONFIG.defaultBuyIn);

        // Persist to DB (best-effort) — ensureAgent first to satisfy FK
        if (this.db) {
          try {
            await ensureAgent(this.db, { id: botId, displayName: botId });
            await persistSeat(this.db, {
              tableId,
              seatNo: seat.seatIndex,
              agentId: botId,
              seatToken,
              buyInAmount: BOT_CONFIG.defaultBuyIn,
            });
          } catch (err) {
            logger.error({ botId, tableId, err }, 'Failed to persist bot seat to DB');
          }
        }

        botSeats.push({ botId, seatToken, seatIndex: seat.seatIndex });
        logger.info({ botId, tableId, seatIndex: seat.seatIndex }, 'Bot seat created');
      } catch (err) {
        logger.error({ botId, tableId, err }, 'Failed to seat bot');
      }
    }

    // Phase 2: Connect all bots via WS (game-server loads table+seats from DB)
    const bots: BotPlayer[] = [];

    for (const { botId, seatToken, seatIndex } of botSeats) {
      const bot = new BotPlayer(botId, tableId, seatToken);
      try {
        await bot.connect();
        bots.push(bot);
        logger.info({ botId, tableId, seatIndex }, 'Bot connected');
      } catch (err) {
        logger.error({ botId, tableId, err }, 'Bot failed to connect via WS');
        bot.destroy();
      }
    }

    if (bots.length > 0) {
      this.activeBots.set(tableId, [...(this.activeBots.get(tableId) ?? []), ...bots]);
    }
  }

  /**
   * Clean up all bots for a table.
   */
  destroyBots(tableId: string): void {
    const bots = this.activeBots.get(tableId);
    if (bots) {
      for (const bot of bots) {
        bot.destroy();
      }
      this.activeBots.delete(tableId);
      logger.info({ tableId, count: bots.length }, 'Destroyed bots for table');
    }
    this.cancelFill(tableId);
  }

  /**
   * Clean up everything.
   */
  destroyAll(): void {
    for (const [tableId] of this.activeBots) {
      this.destroyBots(tableId);
    }
    for (const [, pending] of this.pendingFills) {
      clearTimeout(pending.timer);
    }
    this.pendingFills.clear();
  }
}
