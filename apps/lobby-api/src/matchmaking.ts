import { logger } from './logger.js';

export type BlindLevel = 'micro' | 'low' | 'mid' | 'high';

export const BLIND_CONFIGS: Record<BlindLevel, { smallBlind: number; bigBlind: number }> = {
  micro: { smallBlind: 1, bigBlind: 2 },
  low: { smallBlind: 5, bigBlind: 10 },
  mid: { smallBlind: 25, bigBlind: 50 },
  high: { smallBlind: 100, bigBlind: 200 },
};

interface QueueEntry {
  agentId: string;
  variant: string;
  blindLevel: BlindLevel;
  maxSeats: number;
  enqueuedAt: number;
}

export class MatchmakingQueue {
  private queue: QueueEntry[] = [];
  private minPlayers: number;
  private onMatchFound: ((entries: QueueEntry[]) => void) | undefined;
  private botFillTimeoutMs: number;
  private botFillTimer: ReturnType<typeof setInterval> | null = null;

  constructor(minPlayers = 2, onMatchFound?: (entries: QueueEntry[]) => void, botFillTimeoutMs = 0) {
    this.minPlayers = minPlayers;
    this.onMatchFound = onMatchFound;
    this.botFillTimeoutMs = botFillTimeoutMs;

    // If bot fill timeout is set, periodically check for stale entries
    if (this.botFillTimeoutMs > 0) {
      this.botFillTimer = setInterval(() => this.tryForcedMatch(), 10000);
    }
  }

  /**
   * Add an agent to the matchmaking queue.
   */
  enqueue(agentId: string, variant: string, blindLevel: BlindLevel, maxSeats = 6): void {
    // Check if already in queue
    if (this.queue.some((e) => e.agentId === agentId)) {
      throw new Error('Agent already in queue');
    }

    const entry: QueueEntry = {
      agentId,
      variant,
      blindLevel,
      maxSeats,
      enqueuedAt: Date.now(),
    };

    this.queue.push(entry);
    logger.info({ agentId, variant, blindLevel, maxSeats, queueSize: this.queue.length }, 'Agent joined matchmaking queue');

    // Try to match
    this.tryMatch();
  }

  /**
   * Remove an agent from the queue.
   */
  dequeue(agentId: string): boolean {
    const index = this.queue.findIndex((e) => e.agentId === agentId);
    if (index === -1) {
      return false;
    }

    this.queue.splice(index, 1);
    logger.info({ agentId, queueSize: this.queue.length }, 'Agent left matchmaking queue');
    return true;
  }

  /**
   * Get the queue position for an agent.
   */
  getStatus(agentId: string): { position: number; estimatedWaitMs: number } | null {
    const index = this.queue.findIndex((e) => e.agentId === agentId);
    if (index === -1) {
      return null;
    }

    const entry = this.queue[index]!;
    const waitMs = Date.now() - entry.enqueuedAt;

    // Rough estimate: assume 1 match every 30 seconds
    const estimatedWaitMs = Math.max(0, (index + 1 - this.minPlayers) * 30000 - waitMs);

    return {
      position: index + 1,
      estimatedWaitMs,
    };
  }

  /**
   * Try to form a match from the current queue.
   */
  private tryMatch(): void {
    if (this.queue.length < this.minPlayers) {
      return;
    }

    // Group by variant + blindLevel + maxSeats
    const groups = new Map<string, QueueEntry[]>();

    for (const entry of this.queue) {
      const key = `${entry.variant}:${entry.blindLevel}:${entry.maxSeats}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(entry);
    }

    // Find first group with enough players
    for (const [key, entries] of groups) {
      if (entries.length >= this.minPlayers) {
        const matched = entries.slice(0, this.minPlayers);

        // Remove matched players from queue
        for (const m of matched) {
          this.dequeue(m.agentId);
        }

        logger.info({ key, matchedPlayers: matched.map((e) => e.agentId) }, 'Match found');

        // Notify callback
        this.onMatchFound?.(matched);
        return;
      }
    }
  }

  /**
   * Force-match entries that have waited longer than botFillTimeoutMs.
   * Creates a table with even a single player — bots fill the rest.
   */
  private tryForcedMatch(): void {
    if (this.queue.length === 0) return;

    const now = Date.now();

    // Group by variant + blindLevel + maxSeats
    const groups = new Map<string, QueueEntry[]>();
    for (const entry of this.queue) {
      const key = `${entry.variant}:${entry.blindLevel}:${entry.maxSeats}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(entry);
    }

    for (const [key, entries] of groups) {
      // Check if oldest entry has waited long enough
      const oldest = entries[0]!;
      if (now - oldest.enqueuedAt < this.botFillTimeoutMs) continue;

      // Force match with however many players are available (even 1)
      const matched = entries.slice(0, oldest.maxSeats);
      for (const m of matched) {
        this.dequeue(m.agentId);
      }

      logger.info(
        { key, matchedPlayers: matched.map((e) => e.agentId), forced: true },
        'Forced match (bot fill timeout)',
      );

      this.onMatchFound?.(matched);
    }
  }

  /**
   * Get all entries in the queue.
   */
  getAll(): QueueEntry[] {
    return [...this.queue];
  }

  /**
   * Clean up timers.
   */
  destroy(): void {
    if (this.botFillTimer) {
      clearInterval(this.botFillTimer);
      this.botFillTimer = null;
    }
  }
}
