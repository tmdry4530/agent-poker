import { createDeck, dealCards, shuffleDeck } from './deck.js';
import { compareHands, evaluateBestHand } from './evaluate.js';
import {
  getBlindSeats,
  getFirstToActPostflop,
  getFirstToActPreflop,
  getNextActiveSeat,
} from './positions.js';
import { calculateSidePots } from './side-pots.js';
import {
  type ActionType,
  DEFAULT_CONFIG,
  type GameConfig,
  type GameEvent,
  GameEventType,
  type GameState,
  type HandResult,
  type PlayerAction,
  type PlayerSetup,
  type PlayerState,
  PokerError,
  PokerErrorCode,
  type Pot,
  type RngFn,
  Street,
} from './types.js';

// ── Helpers ──────────────────────────────────────────────────

function getPlayerBySeat(state: GameState, seatIndex: number): PlayerState | undefined {
  return state.players.find((p) => p.seatIndex === seatIndex);
}

function getActivePlayer(state: GameState): PlayerState {
  const p = getPlayerBySeat(state, state.activePlayerSeatIndex);
  if (!p) throw new PokerError(PokerErrorCode.INVALID_ACTION, 'No active player found');
  return p;
}

function activeSeatIndices(state: GameState): number[] {
  return state.players.map((p) => p.seatIndex);
}

function foldedSeats(state: GameState): Set<number> {
  return new Set(state.players.filter((p) => p.hasFolded).map((p) => p.seatIndex));
}

function allInSeats(state: GameState): Set<number> {
  return new Set(state.players.filter((p) => p.isAllIn).map((p) => p.seatIndex));
}

function nonFoldedPlayers(state: GameState): PlayerState[] {
  return state.players.filter((p) => !p.hasFolded);
}

function maxCurrentBet(state: GameState): number {
  return Math.max(...state.players.map((p) => p.currentBet));
}

// ── Factory ─────────────────────────────────────────────────

export function createInitialState(
  handId: string,
  players: PlayerSetup[],
  dealerSeatIndex: number,
  rng: RngFn,
  config: GameConfig = DEFAULT_CONFIG,
): { state: GameState; events: GameEvent[] } {
  const n = players.length;
  if (n < 2 || n > 8) throw new Error(`Need 2-8 players, got ${n}`);

  const deck = shuffleDeck(createDeck(), rng);
  const events: GameEvent[] = [];

  // Deal hole cards for each player
  const holeCardsMap: Record<string, ReturnType<typeof dealCards>> = {};
  for (const p of players) {
    holeCardsMap[p.id] = dealCards(deck, 2);
  }

  // Determine blind seats
  const seatIndices = players.map((p) => p.seatIndex);
  const { sbSeat, bbSeat } = getBlindSeats(seatIndices, dealerSeatIndex);

  // Build player states
  const playerStates: PlayerState[] = players.map((p) => {
    let blindAmount = 0;
    if (p.seatIndex === sbSeat) {
      blindAmount = Math.min(config.smallBlind, p.chips);
    } else if (p.seatIndex === bbSeat) {
      blindAmount = Math.min(config.bigBlind, p.chips);
    }

    return {
      id: p.id,
      seatIndex: p.seatIndex,
      chips: p.chips - blindAmount,
      holeCards: holeCardsMap[p.id]!,
      currentBet: blindAmount,
      totalBetThisHand: blindAmount,
      hasFolded: false,
      hasActed: false,
      isAllIn: p.chips - blindAmount === 0 && blindAmount > 0,
    };
  });

  const sbPlayer = playerStates.find((p) => p.seatIndex === sbSeat)!;
  const bbPlayer = playerStates.find((p) => p.seatIndex === bbSeat)!;
  const potAmount = playerStates.reduce((sum, p) => sum + p.currentBet, 0);

  // First to act preflop
  const firstToAct = getFirstToActPreflop(seatIndices, dealerSeatIndex);

  const state: GameState = {
    handId,
    config,
    street: Street.PREFLOP,
    players: playerStates,
    dealerSeatIndex,
    activePlayerSeatIndex: firstToAct,
    communityCards: [],
    deck,
    pots: [{ amount: potAmount, eligible: players.map((p) => p.id) }],
    betsThisStreet: 1, // BB counts as the opening bet
    isHandComplete: false,
  };

  // Events
  events.push({
    type: GameEventType.HAND_START,
    seq: 0,
    handId,
    payload: {
      players: players.map((p) => ({ id: p.id, seatIndex: p.seatIndex, chips: p.chips })),
      dealerSeatIndex,
      config,
    },
  });
  events.push({
    type: GameEventType.BLINDS_POSTED,
    seq: 1,
    handId,
    payload: {
      smallBlind: { playerId: sbPlayer.id, amount: sbPlayer.currentBet },
      bigBlind: { playerId: bbPlayer.id, amount: bbPlayer.currentBet },
    },
  });

  const holeCardsPayload: Record<string, any> = {};
  for (const p of players) {
    holeCardsPayload[p.id] = holeCardsMap[p.id];
  }
  events.push({
    type: GameEventType.HOLE_CARDS_DEALT,
    seq: 2,
    handId,
    payload: holeCardsPayload,
  });

  return { state, events };
}

// ── Legal actions ───────────────────────────────────────────

export function getLegalActions(state: GameState): ActionType[] {
  if (state.isHandComplete) return [];
  const player = getActivePlayer(state);
  const actions: ActionType[] = [];

  // Can always fold
  actions.push('FOLD' as ActionType);

  const highestBet = maxCurrentBet(state);
  const toCall = highestBet - player.currentBet;

  if (toCall === 0) {
    actions.push('CHECK' as ActionType);
    if (state.betsThisStreet < state.config.maxRaisesPerStreet && player.chips > 0) {
      actions.push('BET' as ActionType);
    }
  } else {
    actions.push('CALL' as ActionType);
    if (state.betsThisStreet < state.config.maxRaisesPerStreet && player.chips > toCall) {
      actions.push('RAISE' as ActionType);
    }
  }

  return actions;
}

// ── Apply action ────────────────────────────────────────────

export function applyAction(
  state: GameState,
  playerId: string,
  action: PlayerAction,
): { state: GameState; events: GameEvent[] } {
  if (state.isHandComplete) {
    throw new PokerError(PokerErrorCode.HAND_ALREADY_COMPLETE, 'Hand is already complete');
  }

  const activePlayer = getActivePlayer(state);
  if (activePlayer.id !== playerId) {
    throw new PokerError(
      PokerErrorCode.NOT_YOUR_TURN,
      `Not ${playerId}'s turn; active player is ${activePlayer.id}`,
    );
  }

  const legalActions = getLegalActions(state);
  if (!legalActions.includes(action.type)) {
    throw new PokerError(
      PokerErrorCode.INVALID_ACTION,
      `Action ${action.type} is not legal. Legal: ${legalActions.join(', ')}`,
    );
  }

  // Deep clone state
  const newState: GameState = JSON.parse(JSON.stringify(state));
  const events: GameEvent[] = [];
  const player = newState.players.find((p) => p.id === playerId)!;
  const highestBet = maxCurrentBet(newState);
  const betSize =
    newState.street === Street.PREFLOP || newState.street === Street.FLOP
      ? newState.config.smallBet
      : newState.config.bigBet;

  switch (action.type) {
    case 'FOLD' as ActionType: {
      player.hasFolded = true;
      events.push({
        type: GameEventType.PLAYER_ACTION,
        seq: 0,
        handId: newState.handId,
        payload: { playerId, action: 'FOLD' },
      });

      // Check if only one non-folded player remains
      const remaining = nonFoldedPlayers(newState);
      if (remaining.length === 1) {
        finishHand(newState, events);
      }
      break;
    }
    case 'CHECK' as ActionType: {
      player.hasActed = true;
      events.push({
        type: GameEventType.PLAYER_ACTION,
        seq: 0,
        handId: newState.handId,
        payload: { playerId, action: 'CHECK' },
      });
      break;
    }
    case 'CALL' as ActionType: {
      const toCall = Math.min(highestBet - player.currentBet, player.chips);
      player.chips -= toCall;
      player.currentBet += toCall;
      player.totalBetThisHand += toCall;
      player.hasActed = true;
      if (player.chips === 0) player.isAllIn = true;
      newState.pots[0]!.amount += toCall;
      events.push({
        type: GameEventType.PLAYER_ACTION,
        seq: 0,
        handId: newState.handId,
        payload: { playerId, action: 'CALL', amount: toCall },
      });
      break;
    }
    case 'BET' as ActionType: {
      const amount = Math.min(betSize, player.chips);
      player.chips -= amount;
      player.currentBet += amount;
      player.totalBetThisHand += amount;
      player.hasActed = true;
      if (player.chips === 0) player.isAllIn = true;
      newState.pots[0]!.amount += amount;
      newState.betsThisStreet += 1;
      events.push({
        type: GameEventType.PLAYER_ACTION,
        seq: 0,
        handId: newState.handId,
        payload: { playerId, action: 'BET', amount },
      });
      // Reset hasActed for all other non-folded, non-allin players
      for (const p of newState.players) {
        if (p.id !== playerId && !p.hasFolded && !p.isAllIn) {
          p.hasActed = false;
        }
      }
      break;
    }
    case 'RAISE' as ActionType: {
      if (newState.betsThisStreet >= newState.config.maxRaisesPerStreet) {
        throw new PokerError(PokerErrorCode.RAISE_CAP_REACHED, 'Raise cap reached');
      }
      const toCall = highestBet - player.currentBet;
      const raiseTotal = toCall + betSize;
      const amount = Math.min(raiseTotal, player.chips);
      player.chips -= amount;
      player.currentBet += amount;
      player.totalBetThisHand += amount;
      player.hasActed = true;
      if (player.chips === 0) player.isAllIn = true;
      newState.pots[0]!.amount += amount;
      newState.betsThisStreet += 1;
      events.push({
        type: GameEventType.PLAYER_ACTION,
        seq: 0,
        handId: newState.handId,
        payload: { playerId, action: 'RAISE', amount },
      });
      // Reset hasActed for all other non-folded, non-allin players
      for (const p of newState.players) {
        if (p.id !== playerId && !p.hasFolded && !p.isAllIn) {
          p.hasActed = false;
        }
      }
      break;
    }
  }

  // Check if street is over or hand needs to advance
  if (!newState.isHandComplete) {
    if (allPlayersActedAndMatched(newState)) {
      advanceStreet(newState, events);
    } else {
      // Move to next active player
      const nextSeat = getNextActiveSeat(
        activeSeatIndices(newState),
        player.seatIndex,
        foldedSeats(newState),
        allInSeats(newState),
      );
      if (nextSeat === -1) {
        // No one can act — advance street or finish
        advanceStreet(newState, events);
      } else {
        newState.activePlayerSeatIndex = nextSeat;
      }
    }
  }

  // Assign sequential seq numbers
  events.forEach((e, i) => {
    e.seq = i;
  });

  return { state: newState, events };
}

// ── Street management ───────────────────────────────────────

function allPlayersActedAndMatched(state: GameState): boolean {
  const hb = maxCurrentBet(state);
  for (const p of state.players) {
    if (p.hasFolded || p.isAllIn) continue;
    if (!p.hasActed) return false;
    if (p.currentBet !== hb) return false;
  }
  return true;
}

function advanceStreet(state: GameState, events: GameEvent[]): void {
  const nextStreet = getNextStreet(state.street);
  const nonFolded = nonFoldedPlayers(state);

  // If only one player remains (everyone else folded), finish
  if (nonFolded.length === 1) {
    finishHand(state, events);
    return;
  }

  // If all non-folded players are all-in (or only one non-allin left), run out community cards
  const canAct = nonFolded.filter((p) => !p.isAllIn);
  if (canAct.length <= 1 || nextStreet === null) {
    // Deal remaining community cards and go to showdown
    if (state.street !== Street.RIVER) {
      dealRemainingCommunity(state, events);
    }
    finishHand(state, events);
    return;
  }

  // Deal community cards for the new street
  state.street = nextStreet;
  state.betsThisStreet = 0;
  for (const p of state.players) {
    p.currentBet = 0;
    p.hasActed = false;
  }

  if (nextStreet === Street.FLOP) {
    const cards = dealCards(state.deck, 3);
    state.communityCards.push(...cards);
    events.push({
      type: GameEventType.COMMUNITY_CARDS_DEALT,
      seq: 0,
      handId: state.handId,
      payload: { street: 'FLOP', cards },
    });
  } else if (nextStreet === Street.TURN || nextStreet === Street.RIVER) {
    const cards = dealCards(state.deck, 1);
    state.communityCards.push(...cards);
    events.push({
      type: GameEventType.COMMUNITY_CARDS_DEALT,
      seq: 0,
      handId: state.handId,
      payload: { street: nextStreet, cards },
    });
  } else if (nextStreet === Street.SHOWDOWN) {
    finishHand(state, events);
    return;
  }

  events.push({
    type: GameEventType.STREET_CHANGED,
    seq: 0,
    handId: state.handId,
    payload: { street: nextStreet },
  });

  // Post-flop: first to act is first non-folded/non-allin left of dealer
  const seats = activeSeatIndices(state);
  const firstSeat = getFirstToActPostflop(
    seats,
    state.dealerSeatIndex,
    foldedSeats(state),
    allInSeats(state),
  );

  if (firstSeat === -1) {
    // Everyone is all-in or folded — deal remaining and finish
    dealRemainingCommunity(state, events);
    finishHand(state, events);
  } else {
    state.activePlayerSeatIndex = firstSeat;
  }
}

function dealRemainingCommunity(state: GameState, events: GameEvent[]): void {
  while (state.communityCards.length < 5) {
    const count = state.communityCards.length === 0 ? 3 : 1;
    const cards = dealCards(state.deck, count);
    state.communityCards.push(...cards);
    const streetName =
      state.communityCards.length <= 3
        ? 'FLOP'
        : state.communityCards.length === 4
          ? 'TURN'
          : 'RIVER';
    events.push({
      type: GameEventType.COMMUNITY_CARDS_DEALT,
      seq: 0,
      handId: state.handId,
      payload: { street: streetName, cards },
    });
  }
}

function getNextStreet(current: Street): Street | null {
  switch (current) {
    case Street.PREFLOP:
      return Street.FLOP;
    case Street.FLOP:
      return Street.TURN;
    case Street.TURN:
      return Street.RIVER;
    case Street.RIVER:
      return Street.SHOWDOWN;
    case Street.SHOWDOWN:
      return null;
  }
}

// ── Finish hand ─────────────────────────────────────────────

function finishHand(state: GameState, events: GameEvent[]): void {
  state.isHandComplete = true;

  const nonFolded = nonFoldedPlayers(state);

  // ── Fold win: only one player left ──
  if (nonFolded.length === 1) {
    const winner = nonFolded[0]!;
    const totalPot = state.pots.reduce((sum, p) => sum + p.amount, 0);

    winner.chips += totalPot;
    state.winners = [winner.id];
    state.resultSummary = {
      winners: [winner.id],
      potDistribution: [{ playerId: winner.id, amount: totalPot }],
    };

    for (const pot of state.pots) pot.amount = 0;

    events.push({
      type: GameEventType.POT_DISTRIBUTED,
      seq: 0,
      handId: state.handId,
      payload: { distributions: state.resultSummary.potDistribution, reason: 'fold' },
    });
    events.push({
      type: GameEventType.HAND_END,
      seq: 0,
      handId: state.handId,
      payload: { result: state.resultSummary },
    });
    return;
  }

  // ── Showdown ──
  state.street = Street.SHOWDOWN;

  // Calculate side pots
  const sidePots = calculateSidePots(state.players);

  // Evaluate hands
  const handEvals = new Map<string, ReturnType<typeof evaluateBestHand>>();
  for (const p of nonFolded) {
    handEvals.set(p.id, evaluateBestHand(p.holeCards, state.communityCards));
  }

  // Showdown event
  events.push({
    type: GameEventType.SHOWDOWN,
    seq: 0,
    handId: state.handId,
    payload: {
      players: nonFolded.map((p) => {
        const ev = handEvals.get(p.id)!;
        return {
          playerId: p.id,
          holeCards: p.holeCards,
          handRank: ev.rank,
          description: ev.description,
        };
      }),
    },
  });

  // Distribute each pot
  const allWinners = new Set<string>();
  const distributions: Array<{ playerId: string; amount: number; potIndex?: number }> = [];
  const handRankings: Array<{ playerId: string; handRank: any; description: string }> = [];

  for (const p of nonFolded) {
    const ev = handEvals.get(p.id)!;
    handRankings.push({ playerId: p.id, handRank: ev.rank, description: ev.description });
  }

  for (let potIdx = 0; potIdx < sidePots.length; potIdx++) {
    const pot = sidePots[potIdx]!;
    if (pot.amount === 0) continue;

    // Find eligible non-folded players for this pot
    const eligiblePlayers = pot.eligible.filter((id) => {
      const p = state.players.find((pl) => pl.id === id);
      return p && !p.hasFolded;
    });

    if (eligiblePlayers.length === 0) continue;

    if (eligiblePlayers.length === 1) {
      // Only one eligible — they win the pot
      const winnerId = eligiblePlayers[0]!;
      const player = state.players.find((p) => p.id === winnerId)!;
      player.chips += pot.amount;
      allWinners.add(winnerId);
      distributions.push({ playerId: winnerId, amount: pot.amount, potIndex: potIdx });
      continue;
    }

    // Compare hands among eligible players
    const sorted = [...eligiblePlayers].sort((a, b) => {
      const ea = handEvals.get(a)!;
      const eb = handEvals.get(b)!;
      return compareHands(eb, ea); // descending: best hand first
    });

    // Find all players tied with the best hand
    const bestEval = handEvals.get(sorted[0]!)!;
    const potWinners = sorted.filter((id) => {
      const ev = handEvals.get(id)!;
      return compareHands(ev, bestEval) === 0;
    });

    // Split pot among winners
    const share = Math.floor(pot.amount / potWinners.length);
    let remainder = pot.amount - share * potWinners.length;

    // Remainder goes to player closest to dealer's left (clockwise)
    const seatOrder = state.players.map((p) => p.seatIndex).sort((a, b) => a - b);
    const dealerPos = seatOrder.indexOf(state.dealerSeatIndex);
    const clockwiseSeats: number[] = [];
    for (let i = 1; i <= seatOrder.length; i++) {
      clockwiseSeats.push(seatOrder[(dealerPos + i) % seatOrder.length]!);
    }

    for (const winnerId of potWinners) {
      allWinners.add(winnerId);
      const player = state.players.find((p) => p.id === winnerId)!;
      let extra = 0;
      if (remainder > 0) {
        // Check if this winner is earliest in clockwise order
        const winnerSeats = potWinners.map(
          (wid) => state.players.find((p) => p.id === wid)!.seatIndex,
        );
        const earliestSeat = clockwiseSeats.find((s) => winnerSeats.includes(s));
        if (player.seatIndex === earliestSeat) {
          extra = remainder;
          remainder = 0;
        }
      }
      const total = share + extra;
      player.chips += total;
      distributions.push({ playerId: winnerId, amount: total, potIndex: potIdx });
    }
  }

  state.winners = [...allWinners];
  state.resultSummary = { winners: [...allWinners], potDistribution: distributions, handRankings };

  // Zero out pots
  for (const pot of state.pots) pot.amount = 0;

  events.push({
    type: GameEventType.POT_DISTRIBUTED,
    seq: 0,
    handId: state.handId,
    payload: { distributions, reason: 'showdown' },
  });
  events.push({
    type: GameEventType.HAND_END,
    seq: 0,
    handId: state.handId,
    payload: { result: state.resultSummary },
  });
}
