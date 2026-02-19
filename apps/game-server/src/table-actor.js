import { createInitialState, applyAction, getLegalActions, createSeededRng, ActionType, PokerError, DEFAULT_CONFIG, } from '@agent-poker/poker-engine';
export class TableActor {
    tableId;
    seats = [];
    currentState = null;
    handEvents = [];
    handsPlayed = 0;
    dealerIndex = 0;
    status = 'open';
    actionTimeoutMs;
    actionTimer = null;
    requestIdCache = new Map(); // idempotency
    seqPerSeat = new Map(); // replay protection
    rngCounter = 0;
    options;
    constructor(options) {
        this.tableId = options.tableId;
        this.actionTimeoutMs = options.actionTimeoutMs ?? 5000;
        this.options = options;
    }
    getInfo() {
        return {
            id: this.tableId,
            variant: 'HU_LHE',
            status: this.status,
            seats: [...this.seats],
            currentHandId: this.currentState?.handId,
            handsPlayed: this.handsPlayed,
            createdAt: Date.now(),
        };
    }
    getState() {
        return this.currentState;
    }
    getSeats() {
        return [...this.seats];
    }
    // ── Seat management ─────────────────────────────────────
    addSeat(agentId, seatToken, buyInAmount) {
        if (this.seats.filter((s) => s.status === 'seated').length >= 2) {
            throw new Error('Table is full');
        }
        if (this.seats.some((s) => s.agentId === agentId && s.status === 'seated')) {
            throw new Error('Agent already seated');
        }
        const seatIndex = this.seats.filter((s) => s.status === 'seated').length;
        const seat = {
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
    removeSeat(agentId) {
        const seat = this.seats.find((s) => s.agentId === agentId && s.status === 'seated');
        if (seat) {
            seat.status = 'left';
        }
    }
    // ── Hand lifecycle ──────────────────────────────────────
    canStartHand() {
        return this.seats.filter((s) => s.status === 'seated' && s.chips > 0).length === 2;
    }
    startHand() {
        if (!this.canStartHand()) {
            throw new Error('Cannot start hand: need exactly 2 seated players with chips');
        }
        const activePlayers = this.seats.filter((s) => s.status === 'seated' && s.chips > 0);
        const p0 = activePlayers[0];
        const p1 = activePlayers[1];
        this.rngCounter++;
        const seed = hashSeed(`${this.tableId}:${this.handsPlayed}:${this.rngCounter}`);
        const rng = createSeededRng(seed);
        const handId = `${this.tableId}:hand:${this.handsPlayed + 1}`;
        const { state, events } = createInitialState(handId, p0.agentId, p1.agentId, p0.chips, p1.chips, this.dealerIndex, rng, DEFAULT_CONFIG);
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
    processAction(agentId, action, requestId, seq) {
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
                throw new PokerError('REPLAY_DETECTED', `Seq ${seq} <= last ${lastSeq}`);
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
        }
        else {
            this.resetActionTimer();
        }
        return { state: newState, events, alreadyProcessed: false };
    }
    completeHand(state) {
        this.handsPlayed++;
        // Update seat chips
        for (const player of state.players) {
            const seat = this.seats.find((s) => s.agentId === player.id);
            if (seat) {
                seat.chips = player.chips;
            }
        }
        // Alternate dealer
        this.dealerIndex = 1 - this.dealerIndex;
        this.options.onHandComplete?.(this.tableId, state.handId, this.handEvents, state);
        this.currentState = null;
        this.handEvents = [];
    }
    // ── Timeout handling ────────────────────────────────────
    startActionTimer() {
        this.clearActionTimer();
        this.actionTimer = setTimeout(() => this.handleTimeout(), this.actionTimeoutMs);
    }
    resetActionTimer() {
        this.startActionTimer();
    }
    clearActionTimer() {
        if (this.actionTimer) {
            clearTimeout(this.actionTimer);
            this.actionTimer = null;
        }
    }
    handleTimeout() {
        if (!this.currentState || this.currentState.isHandComplete)
            return;
        const activePlayer = this.currentState.players[this.currentState.activePlayerIndex];
        const legal = getLegalActions(this.currentState);
        // Timeout = fold (or check if available)
        const action = legal.includes(ActionType.CHECK)
            ? { type: ActionType.CHECK }
            : { type: ActionType.FOLD };
        this.processAction(activePlayer.id, action, `timeout:${Date.now()}`);
    }
    getHandsPlayed() {
        return this.handsPlayed;
    }
    close() {
        this.clearActionTimer();
        this.status = 'closed';
    }
}
function hashSeed(input) {
    let h = 0;
    for (let i = 0; i < input.length; i++) {
        h = ((h << 5) - h + input.charCodeAt(i)) | 0;
    }
    return h >>> 0;
}
//# sourceMappingURL=table-actor.js.map