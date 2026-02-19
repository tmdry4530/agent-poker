import { type GameState, type GameEvent, type PlayerAction } from '@agent-poker/poker-engine';
import type { SeatInfo, TableInfo } from './types.js';
export interface TableActorOptions {
    tableId: string;
    maxSeats?: number;
    actionTimeoutMs?: number;
    onEvent?: (tableId: string, event: GameEvent) => void;
    onHandComplete?: (tableId: string, handId: string, events: GameEvent[], state: GameState) => void;
    onStateUpdate?: (tableId: string, state: GameState) => void;
}
export declare class TableActor {
    readonly tableId: string;
    readonly maxSeats: number;
    private seats;
    private currentState;
    private handEvents;
    private handsPlayed;
    private dealerSeatIndex;
    private status;
    private actionTimeoutMs;
    private actionTimer;
    private requestIdCache;
    private seqPerSeat;
    private rngCounter;
    private options;
    private handHistory;
    constructor(options: TableActorOptions);
    getInfo(): TableInfo;
    getState(): GameState | null;
    getSeats(): SeatInfo[];
    addSeat(agentId: string, seatToken: string, buyInAmount: number): SeatInfo;
    removeSeat(agentId: string): void;
    canStartHand(): boolean;
    startHand(): {
        state: GameState;
        events: GameEvent[];
    };
    processAction(agentId: string, action: PlayerAction, requestId?: string, seq?: number): {
        state: GameState;
        events: GameEvent[];
        alreadyProcessed: boolean;
    };
    private completeHand;
    private startActionTimer;
    private resetActionTimer;
    private clearActionTimer;
    private handleTimeout;
    getHandsPlayed(): number;
    getHandHistory(): any[];
    getHandById(handId: string): any;
    close(): void;
}
