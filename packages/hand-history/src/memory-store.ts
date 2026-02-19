import type { GameEvent } from '@agent-poker/poker-engine';
import type { HandHistoryStore } from './types.js';

/**
 * In-memory implementation of HandHistoryStore.
 * Used for testing and development.
 */
export class MemoryHandHistoryStore implements HandHistoryStore {
  private hands = new Map<string, GameEvent[]>();

  async appendEvents(handId: string, events: GameEvent[]): Promise<void> {
    const existing = this.hands.get(handId) ?? [];

    // Merge events, avoiding duplicates by seq number
    const existingSeqs = new Set(existing.map((e) => e.seq));
    const newEvents = events.filter((e) => !existingSeqs.has(e.seq));

    const merged = [...existing, ...newEvents].sort((a, b) => a.seq - b.seq);
    this.hands.set(handId, merged);
  }

  async getEvents(handId: string): Promise<GameEvent[]> {
    return this.hands.get(handId) ?? [];
  }

  async listHands(): Promise<string[]> {
    return Array.from(this.hands.keys());
  }
}
