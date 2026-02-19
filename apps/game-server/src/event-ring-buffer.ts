import type { GameEvent } from '@agent-poker/poker-engine';

interface BufferedEvent {
  eventId: number;
  event: GameEvent;
  timestamp: number;
}

export class EventRingBuffer {
  private buffer: BufferedEvent[] = [];
  private nextEventId = 1;
  private readonly maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  /**
   * Add an event to the ring buffer.
   * Returns the assigned eventId.
   */
  push(event: GameEvent): number {
    const eventId = this.nextEventId++;
    this.buffer.push({
      eventId,
      event,
      timestamp: Date.now(),
    });

    // Trim oldest events if we exceed maxSize
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }

    return eventId;
  }

  /**
   * Get all events after the given eventId.
   * Returns null if the requested eventId is too old (already evicted).
   */
  getEventsSince(lastSeenEventId: number): BufferedEvent[] | null {
    if (this.buffer.length === 0) {
      return [];
    }

    const oldestEventId = this.buffer[0]!.eventId;

    // If lastSeenEventId is older than our oldest buffered event, we can't provide delta
    if (lastSeenEventId < oldestEventId) {
      return null;
    }

    return this.buffer.filter((be) => be.eventId > lastSeenEventId);
  }

  /**
   * Get the latest eventId in the buffer.
   */
  getLatestEventId(): number {
    if (this.buffer.length === 0) {
      return 0;
    }
    return this.buffer[this.buffer.length - 1]!.eventId;
  }

  /**
   * Clear all buffered events.
   */
  clear(): void {
    this.buffer = [];
    this.nextEventId = 1;
  }

  /**
   * Get buffer size and stats.
   */
  getStats(): { size: number; oldestEventId: number; latestEventId: number } {
    return {
      size: this.buffer.length,
      oldestEventId: this.buffer[0]?.eventId ?? 0,
      latestEventId: this.getLatestEventId(),
    };
  }
}
