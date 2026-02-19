import {
  createInitialState,
  applyAction,
  getLegalActions,
  createSeededRng,
  advanceDealer,
  type GameState,
  type GameEvent,
  type PlayerAction,
  type PlayerSetup,
  ActionType,
  PokerError,
  DEFAULT_CONFIG,
} from '@agent-poker/poker-engine';
import type { SeatInfo, TableInfo } from './types.js';

export interface TableActorOptions {
  tableId: string;
  maxSeats?: number;
  actionTimeoutMs?: number;
  onEvent?: (tableId: string, event: GameEvent) => void;
  onHandComplete?: (tableId: string, handId: string, events: GameEvent[], state: GameState) => void;
  onStateUpdate?: (tableId: string, state: GameState) => void;
}

export class TableActor {
  readonly tableId: string;
  readonly maxSeats: number;
  private seats: SeatInfo[] = [];
  private currentState: GameState | null = null;
  private handEvents: GameEvent[] = [];
  private handsPlayed = 0;
  private dealerSeatIndex = -1; // will be set on first hand
  private status: 'open' | 'running' | 'closed' = 'open';
  private actionTimeoutMs: number;
  private actionTimer: ReturnType<typeof setTimeout> | null = null;
  private requestIdCache = new Map<string, Record<string, unknown>>(); // idempotency
  private seqPerSeat = new Map<string, number>(); // replay protection
  private rngCounter = 0;
  private options: TableActorOptions;
  private handHistory: Array<{
    handId: string;
    events: GameEvent[];
    players: Array<{ id: string; chips: number; holeCards: Array<{ rank: string; suit: string }> }>;
    communityCards: Array<{ rank: string; suit: string }>;
    winners: string[];
    potTotal: number;
    completedAt: number;
  }> = [];

  constructor(options: TableActorOptions) {
    this.tableId = options.tableId;
    this.maxSeats = options.maxSeats ?? 8;
    this.actionTimeoutMs = options.actionTimeoutMs ?? 5000;
    this.options = options;
  }

  getInfo(): TableInfo {
    return {
      id: this.tableId,
      variant: 'LHE',
      maxSeats: this.maxSeats,
      status: this.status,
      seats: [...this.seats],
      ...(this.currentState ? { currentHandId: this.currentState.handId } : {}),
      handsPlayed: this.handsPlayed,
      createdAt: Date.now(),
    };
  }

  getState(): GameState | null {
    return this.currentState;
  }

  getSeats(): SeatInfo[] {
    return [...this.seats];
  }

  // ── Seat management ─────────────────────────────────────

  addSeat(agentId: string, seatToken: string, buyInAmount: number): SeatInfo {
    if (this.seats.filter((s) => s.status === 'seated').length >= this.maxSeats) {
      throw new Error('Table is full');
    }
    if (this.seats.some((s) => s.agentId === agentId && s.status === 'seated')) {
      throw new Error('Agent already seated');
    }

    // Find first available seat index
    const taken = new Set(this.seats.filter((s) => s.status === 'seated').map((s) => s.seatIndex));
    let seatIndex = 0;
    while (taken.has(seatIndex)) seatIndex++;

    const seat: SeatInfo = {
      seatIndex,
      agentId,
      seatToken,
      buyInAmount,
      chips: buyInAmount,
      status: 'seated',
    };
    this.seats.push(seat);
    return seat;
  }

  removeSeat(agentId: string): void {
    const seat = this.seats.find((s) => s.agentId === agentId && s.status === 'seated');
    if (seat) {
      seat.status = 'left';
    }
  }

  // ── Hand lifecycle ──────────────────────────────────────

  canStartHand(): boolean {
    return this.seats.filter((s) => s.status === 'seated' && s.chips > 0).length >= 2;
  }

  startHand(): { state: GameState; events: GameEvent[] } {
    if (!this.canStartHand()) {
      throw new Error('Cannot start hand: need at least 2 seated players with chips');
    }

    const activePlayers = this.seats.filter((s) => s.status === 'seated' && s.chips > 0);

    // Initialize dealer on first hand
    if (this.dealerSeatIndex === -1) {
      this.dealerSeatIndex = activePlayers[0]!.seatIndex;
    }

    // Build PlayerSetup array
    const playerSetups: PlayerSetup[] = activePlayers.map((s) => ({
      id: s.agentId,
      seatIndex: s.seatIndex,
      chips: s.chips,
    }));

    this.rngCounter++;
    const seed = hashSeed(`${this.tableId}:${this.handsPlayed}:${this.rngCounter}`);
    const rng = createSeededRng(seed);
    const handId = `${this.tableId}:hand:${this.handsPlayed + 1}`;

    const { state, events } = createInitialState(
      handId,
      playerSetups,
      this.dealerSeatIndex,
      rng,
      DEFAULT_CONFIG,
    );

    this.currentState = state;
    this.handEvents = [...events];
    this.status = 'running';
    this.requestIdCache.clear();

    // Emit events
    for (const ev of events) {
      this.options.onEvent?.(this.tableId, ev);
    }
    this.options.onStateUpdate?.(this.tableId, state);

    this.startActionTimer();
    return { state, events };
  }

  // ── Action processing ───────────────────────────────────

  processAction(
    agentId: string,
    action: PlayerAction,
    requestId?: string,
    seq?: number,
  ): { state: GameState; events: GameEvent[]; alreadyProcessed: boolean } {
    if (!this.currentState) {
      throw new Error('No active hand');
    }

    // Idempotency check
    if (requestId && this.requestIdCache.has(requestId)) {
      return { state: this.currentState, events: [], alreadyProcessed: true };
    }

    // Seq replay protection
    if (seq !== undefined) {
      const lastSeq = this.seqPerSeat.get(agentId) ?? -1;
      if (seq <= lastSeq) {
        throw new PokerError('REPLAY_DETECTED' as any, `Seq ${seq} <= last ${lastSeq}`);
      }
      this.seqPerSeat.set(agentId, seq);
    }

    const { state: newState, events } = applyAction(this.currentState, agentId, action);
    this.currentState = newState;
    this.handEvents.push(...events);

    // Cache requestId
    if (requestId) {
      this.requestIdCache.set(requestId, { action: action.type, events: events.length });
    }

    // Emit events
    for (const ev of events) {
      this.options.onEvent?.(this.tableId, ev);
    }
    this.options.onStateUpdate?.(this.tableId, newState);

    // Check hand completion
    if (newState.isHandComplete) {
      this.clearActionTimer();
      this.completeHand(newState);
    } else {
      this.resetActionTimer();
    }

    return { state: newState, events, alreadyProcessed: false };
  }

  private completeHand(state: GameState): void {
    this.handsPlayed++;

    // Update seat chips
    for (const player of state.players) {
      const seat = this.seats.find((s) => s.agentId === player.id);
      if (seat) {
        seat.chips = player.chips;
      }
    }

    // Advance dealer
    const activeSeats = this.seats
      .filter((s) => s.status === 'seated' && s.chips > 0)
      .map((s) => s.seatIndex);
    if (activeSeats.length >= 2) {
      this.dealerSeatIndex = advanceDealer(activeSeats, this.dealerSeatIndex);
    }

    this.options.onHandComplete?.(this.tableId, state.handId, this.handEvents, state);

    // Store hand history
    this.handHistory.push({
      handId: state.handId,
      events: [...this.handEvents],
      players: state.players.map((p) => ({
        id: p.id,
        chips: p.chips,
        holeCards: (p.holeCards ?? []).map((c) => ({ rank: c.rank, suit: c.suit })),
      })),
      communityCards: (state.communityCards ?? []).map((c) => ({ rank: c.rank, suit: c.suit })),
      winners: state.winners ?? [],
      potTotal: state.pots?.reduce((s: number, p: any) => s + p.amount, 0) ?? 0,
      completedAt: Date.now(),
    });

    this.currentState = null;
    this.handEvents = [];
  }

  // ── Timeout handling ────────────────────────────────────

  private startActionTimer(): void {
    this.clearActionTimer();
    this.actionTimer = setTimeout(() => this.handleTimeout(), this.actionTimeoutMs);
  }

  private resetActionTimer(): void {
    this.startActionTimer();
  }

  private clearActionTimer(): void {
    if (this.actionTimer) {
      clearTimeout(this.actionTimer);
      this.actionTimer = null;
    }
  }

  private handleTimeout(): void {
    if (!this.currentState || this.currentState.isHandComplete) return;

    const activePlayer = this.currentState.players.find(
      (p) => p.seatIndex === this.currentState!.activePlayerSeatIndex,
    );
    if (!activePlayer) return;

    const legal = getLegalActions(this.currentState);

    // Timeout = fold (or check if available)
    const action: PlayerAction = legal.includes(ActionType.CHECK)
      ? { type: ActionType.CHECK }
      : { type: ActionType.FOLD };

    this.processAction(activePlayer.id, action, `timeout:${Date.now()}`);
  }

  getHandsPlayed(): number {
    return this.handsPlayed;
  }

  getHandHistory() {
    return this.handHistory;
  }

  getHandById(handId: string) {
    return this.handHistory.find((h) => h.handId === handId) ?? null;
  }

  close(): void {
    this.clearActionTimer();
    this.status = 'closed';
  }
}

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}
