import type { GameEvent, GameState } from '@agent-poker/poker-engine';

/**
 * Interface for storing and retrieving hand history events.
 */
export interface HandHistoryStore {
  /**
   * Append events for a hand. Idempotent if events already exist.
   */
  appendEvents(handId: string, events: GameEvent[]): Promise<void>;

  /**
   * Retrieve all events for a hand in sequential order.
   */
  getEvents(handId: string): Promise<GameEvent[]>;

  /**
   * List all hand IDs stored.
   */
  listHands(): Promise<string[]>;
}

/**
 * Result of replaying a hand from its event log.
 */
export interface ReplayResult {
  /**
   * The final game state after all events are applied.
   */
  finalState: GameState;

  /**
   * Whether the replay succeeded without errors.
   */
  valid: boolean;

  /**
   * List of validation errors (empty if valid).
   */
  errors: string[];
}
