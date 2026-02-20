import WebSocket from 'ws';
import crypto from 'node:crypto';
import type { AgentConfig, AgentStrategy, OpponentInfo, VisibleGameState } from './types.js';

const PROTOCOL_VERSION = 1;

export class AgentClient {
  private ws: WebSocket | null = null;
  private config: AgentConfig;
  private strategy: AgentStrategy;
  private seq = 0;
  private connected = false;
  private onHandComplete: ((result: any) => void) | null = null;
  private onError: ((err: string) => void) | null = null;
  private onDisconnect: (() => void) | null = null;

  constructor(config: AgentConfig, strategy: AgentStrategy) {
    this.config = config;
    this.strategy = strategy;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.config.serverUrl);

      this.ws.on('open', () => {
        this.sendHello();
      });

      this.ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        this.handleMessage(msg, resolve);
      });

      this.ws.on('error', (err) => {
        reject(err);
      });

      this.ws.on('close', () => {
        this.connected = false;
        this.onDisconnect?.();
      });
    });
  }

  private sendHello(): void {
    this.send({
      protocolVersion: PROTOCOL_VERSION,
      type: 'HELLO',
      tableId: this.config.tableId,
      payload: {
        agentId: this.config.agentId,
        seatToken: this.config.seatToken,
      },
    });
  }

  private handleMessage(msg: any, onWelcome?: (value: void) => void): void {
    switch (msg.type) {
      case 'WELCOME':
        this.connected = true;
        onWelcome?.();
        break;
      case 'STATE':
        this.handleState(msg.payload);
        break;
      case 'HAND_COMPLETE':
        this.onHandComplete?.(msg.payload);
        break;
      case 'ERROR':
        this.onError?.(msg.payload?.message ?? 'Unknown error');
        break;
      case 'ACK':
        // Action acknowledged
        break;
      case 'PONG':
        break;
    }
  }

  private handleState(state: any): void {
    if (!state) return;

    const myPlayer = state.players?.find((p: any) => p.id === this.config.agentId);
    if (!myPlayer) return;

    const isMyTurn =
      state.activePlayerSeatIndex === myPlayer.seatIndex && !state.isHandComplete;
    if (!isMyTurn) return;

    // Build opponents list
    const opponents: OpponentInfo[] = (state.players ?? [])
      .filter((p: any) => p.id !== this.config.agentId)
      .map((p: any) => ({
        id: p.id,
        seatIndex: p.seatIndex,
        chips: p.chips ?? 0,
        currentBet: p.currentBet ?? 0,
        hasFolded: p.hasFolded ?? false,
        isAllIn: p.isAllIn ?? false,
        position: p.position,
      }));

    const pots = state.pots ?? [{ amount: 0, eligible: [] }];
    const potAmount = pots.reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0);

    // Build position mapping
    const positions: Record<number, string> = {};
    (state.players ?? []).forEach((p: any) => {
      if (p.position) {
        positions[p.seatIndex] = p.position;
      }
    });

    // HU backward-compat
    const firstOpponent = opponents[0];

    // Build visible state
    const visibleState: VisibleGameState = {
      handId: state.handId ?? '',
      street: state.street ?? '',
      myId: this.config.agentId,
      mySeatIndex: myPlayer.seatIndex,
      myHoleCards: myPlayer.holeCards ?? [],
      myChips: myPlayer.chips ?? 0,
      myCurrentBet: myPlayer.currentBet ?? 0,
      opponents,
      numPlayers: state.players?.length ?? 0,
      dealerSeatIndex: state.dealerSeatIndex ?? 0,
      communityCards: state.communityCards ?? [],
      pots,
      potAmount,
      isMyTurn: true,
      legalActions: this.inferLegalActions(myPlayer, state),
      bettingMode: state.config?.bettingMode,
      actionRanges: state.actionRanges,
      myPosition: state.myPosition ?? myPlayer.position,
      positions: Object.keys(positions).length > 0 ? positions : undefined,
      // HU backward-compat (deprecated)
      opponentId: firstOpponent?.id,
      opponentChips: firstOpponent?.chips,
      opponentCurrentBet: firstOpponent?.currentBet,
    };

    const chosen = this.strategy.chooseAction(visibleState);
    this.sendAction(chosen.action, chosen.amount);
  }

  private inferLegalActions(me: any, state: any): string[] {
    const actions: string[] = ['FOLD'];
    const maxBet = Math.max(
      ...(state.players ?? []).map((p: any) => p.currentBet ?? 0),
    );
    const toCall = maxBet - (me.currentBet ?? 0);
    if (toCall <= 0) {
      actions.push('CHECK');
      if (me.chips > 0) actions.push('BET');
    } else {
      actions.push('CALL');
      if (me.chips > toCall) actions.push('RAISE');
    }
    return actions;
  }

  private sendAction(action: string, amount?: number): void {
    this.seq++;
    this.send({
      protocolVersion: PROTOCOL_VERSION,
      type: 'ACTION',
      requestId: crypto.randomUUID(),
      seq: this.seq,
      payload: { action, amount },
    });
  }

  private send(msg: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  onComplete(handler: (result: any) => void): void {
    this.onHandComplete = handler;
  }

  onErrorHandler(handler: (err: string) => void): void {
    this.onError = handler;
  }

  onClose(handler: () => void): void {
    this.onDisconnect = handler;
  }

  disconnect(): void {
    this.ws?.close();
  }

  isConnected(): boolean {
    return this.connected;
  }
}
