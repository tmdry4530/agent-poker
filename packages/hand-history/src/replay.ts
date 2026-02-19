import {
  applyAction,
  createInitialState,
  createSeededRng,
  type GameConfig,
  type GameEvent,
  GameEventType,
  type GameState,
  type PlayerAction,
  type PlayerSetup,
  PokerError,
  type RngFn,
} from '@agent-poker/poker-engine';
import type { ReplayResult } from './types.js';

/**
 * Replay a hand from its event log and verify the final state.
 *
 * Supports both V1 (HU: player0Id/player1Id) and V2 (multi: players[]) event formats.
 *
 * @param events - Complete event log for the hand
 * @param rngSeed - Seed for deterministic RNG (must match original hand)
 * @returns ReplayResult with final state and validation status
 */
export function replayHand(events: GameEvent[], rngSeed: number): ReplayResult {
  const errors: string[] = [];

  if (events.length === 0) {
    return {
      finalState: {} as GameState,
      valid: false,
      errors: ['No events to replay'],
    };
  }

  // Extract HAND_START event
  const handStartEvent = events.find((e) => e.type === GameEventType.HAND_START);
  if (!handStartEvent) {
    return {
      finalState: {} as GameState,
      valid: false,
      errors: ['Missing HAND_START event'],
    };
  }

  const payload = handStartEvent.payload as Record<string, any>;

  // Detect V1 vs V2 format
  let playerSetups: PlayerSetup[];
  let dealerSeatIndex: number;
  let config: GameConfig;

  if (payload.players && Array.isArray(payload.players)) {
    // V2 format: { players: PlayerSetup[], dealerSeatIndex, config }
    playerSetups = payload.players as PlayerSetup[];
    dealerSeatIndex = payload.dealerSeatIndex as number;
    config = payload.config as GameConfig;
  } else if (payload.player0Id && payload.player1Id) {
    // V1 format: { player0Id, player1Id, dealerIndex, config }
    config = payload.config as GameConfig;
    const startingChips = config.bigBlind * 100;
    dealerSeatIndex = payload.dealerIndex as number;
    playerSetups = [
      { id: payload.player0Id as string, seatIndex: 0, chips: startingChips },
      { id: payload.player1Id as string, seatIndex: 1, chips: startingChips },
    ];
  } else {
    return {
      finalState: {} as GameState,
      valid: false,
      errors: ['Invalid HAND_START payload: missing required fields'],
    };
  }

  if (!playerSetups.length || dealerSeatIndex === undefined || !config) {
    return {
      finalState: {} as GameState,
      valid: false,
      errors: ['Invalid HAND_START payload: missing required fields'],
    };
  }

  // Create deterministic RNG
  const rng = createSeededRng(rngSeed);

  // Initialize state
  const { state: initialState, events: initEvents } = createInitialState(
    handStartEvent.handId,
    playerSetups,
    dealerSeatIndex,
    rng,
    config,
  );

  let currentState = initialState;

  // Verify initial events match
  if (!verifyEventSequence(initEvents, events.slice(0, initEvents.length))) {
    errors.push('Initial events (HAND_START, BLINDS_POSTED, HOLE_CARDS_DEALT) do not match replay');
  }

  // Replay PLAYER_ACTION events
  const actionEvents = events.filter((e) => e.type === GameEventType.PLAYER_ACTION);

  for (const event of actionEvents) {
    if (currentState.isHandComplete) {
      errors.push(`Received action after hand completion: ${event.type} at seq ${event.seq}`);
      break;
    }

    const { playerId, action: actionType, amount } = event.payload as {
      playerId: string;
      action: string;
      amount?: number;
    };

    const playerAction: PlayerAction = {
      type: actionType as PlayerAction['type'],
      ...(amount !== undefined ? { amount } : {}),
    };

    try {
      const result = applyAction(currentState, playerId, playerAction);
      currentState = result.state;
    } catch (err) {
      if (err instanceof PokerError) {
        errors.push(`Action error at seq ${event.seq}: ${err.message} (${err.code})`);
      } else if (err instanceof Error) {
        errors.push(`Unexpected error at seq ${event.seq}: ${err.message}`);
      } else {
        errors.push(`Unknown error at seq ${event.seq}`);
      }
      break;
    }
  }

  // Verify final state
  const handEndEvent = events.find((e) => e.type === GameEventType.HAND_END);
  if (handEndEvent && currentState.isHandComplete) {
    const { result } = handEndEvent.payload as { result: GameState['resultSummary'] };
    if (!verifyFinalState(currentState, result)) {
      errors.push('Final state does not match HAND_END event');
    }
  } else if (handEndEvent && !currentState.isHandComplete) {
    errors.push('HAND_END event present but replay did not complete hand');
  } else if (!handEndEvent && currentState.isHandComplete) {
    errors.push('Hand completed in replay but no HAND_END event found');
  }

  return {
    finalState: currentState,
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Verify that two event sequences match (ignoring timestamps).
 */
function verifyEventSequence(expected: GameEvent[], actual: GameEvent[]): boolean {
  if (expected.length !== actual.length) return false;

  for (let i = 0; i < expected.length; i++) {
    const e1 = expected[i]!;
    const e2 = actual[i]!;

    if (e1.type !== e2.type || e1.seq !== e2.seq || e1.handId !== e2.handId) {
      return false;
    }

    // Deep compare payloads (ignoring timestamp)
    const p1 = { ...e1.payload };
    const p2 = { ...e2.payload };
    delete p1.timestamp;
    delete p2.timestamp;

    if (JSON.stringify(p1) !== JSON.stringify(p2)) {
      return false;
    }
  }

  return true;
}

/**
 * Verify final state matches the expected result.
 */
function verifyFinalState(
  state: GameState,
  expectedResult?: GameState['resultSummary'],
): boolean {
  if (!expectedResult) return false;
  if (!state.resultSummary) return false;

  // Check winners match
  const winnersMatch =
    JSON.stringify(state.resultSummary.winners.sort()) ===
    JSON.stringify(expectedResult.winners.sort());

  // Check pot distribution matches (compare by playerId and amount, ignoring potIndex)
  const normDist = (d: Array<{ playerId: string; amount: number }>) =>
    JSON.stringify(
      d.map(({ playerId, amount }) => ({ playerId, amount }))
        .sort((a, b) => a.playerId.localeCompare(b.playerId)),
    );

  const distMatch = normDist(state.resultSummary.potDistribution) === normDist(expectedResult.potDistribution);

  return winnersMatch && distMatch;
}
