import Anthropic from '@anthropic-ai/sdk';
import WebSocket from 'ws';
import { BOT_CONFIG } from './bot-config.js';
import { logger } from './logger.js';

interface CardInfo {
  rank: string;
  suit: string;
}

interface BotGameState {
  handId: string;
  street: string;
  communityCards: CardInfo[];
  potAmount: number;
  holeCards: CardInfo[];
  chips: number;
  currentBet: number;
  highestBet: number;
  isActive: boolean;
  legalActions: string[];
  minRaise: number;
  maxRaise: number;
}

const SUIT_NAMES: Record<string, string> = { h: 'hearts', d: 'diamonds', c: 'clubs', s: 'spades' };

function formatCard(c: CardInfo): string {
  return `${c.rank}${c.suit}`;
}

function formatCards(cards: CardInfo[]): string {
  return cards.map(formatCard).join(' ');
}

/**
 * AI bot player that connects to the game server via WebSocket
 * and uses Claude Haiku to make poker decisions.
 */
export class BotPlayer {
  readonly agentId: string;
  private tableId: string;
  private seatToken: string;
  private ws: WebSocket | null = null;
  private anthropic: Anthropic | null = null;
  private currentState: BotGameState | null = null;
  private seatIndex = -1;
  private destroyed = false;

  constructor(agentId: string, tableId: string, seatToken: string) {
    this.agentId = agentId;
    this.tableId = tableId;
    this.seatToken = seatToken;

    if (BOT_CONFIG.apiKey) {
      this.anthropic = new Anthropic({ apiKey: BOT_CONFIG.apiKey });
    }
  }

  /**
   * Connect to the game server and start playing.
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(BOT_CONFIG.wsUrl);
      this.ws = ws;

      ws.on('open', () => {
        logger.info({ agentId: this.agentId, tableId: this.tableId }, 'Bot connected to game server');
        // Send HELLO
        ws.send(JSON.stringify({
          protocolVersion: 1,
          type: 'HELLO',
          tableId: this.tableId,
          payload: {
            agentId: this.agentId,
            seatToken: this.seatToken,
          },
        }));
        resolve();
      });

      ws.on('message', (data: WebSocket.RawData) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleMessage(msg);
        } catch {
          // ignore parse errors
        }
      });

      ws.on('close', () => {
        logger.info({ agentId: this.agentId }, 'Bot WS disconnected');
        this.ws = null;
      });

      ws.on('error', (err: Error) => {
        logger.error({ agentId: this.agentId, err: err.message }, 'Bot WS error');
        reject(err);
      });

      // Timeout connection attempt
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          reject(new Error('Bot WS connection timeout'));
        }
      }, 10000);
    });
  }

  private handleMessage(msg: any): void {
    if (this.destroyed) return;

    switch (msg.type) {
      case 'WELCOME':
        this.seatIndex = msg.payload.seatIndex;
        logger.info({ agentId: this.agentId, seatIndex: this.seatIndex }, 'Bot received WELCOME');
        break;

      case 'STATE':
        this.processState(msg.payload);
        break;

      case 'HAND_COMPLETE':
        this.currentState = null;
        break;

      case 'PONG':
        break;

      case 'ERROR':
        logger.warn({ agentId: this.agentId, error: msg.payload }, 'Bot received ERROR');
        break;
    }
  }

  private processState(payload: any): void {
    if (this.seatIndex < 0) return;

    const players = payload.players ?? [];
    const me = players[this.seatIndex];
    if (!me) return;

    const isMyTurn = payload.activePlayerIndex === this.seatIndex && !payload.isHandComplete;

    this.currentState = {
      handId: payload.handId ?? '',
      street: payload.street ?? 'Preflop',
      communityCards: payload.communityCards ?? [],
      potAmount: payload.potAmount ?? 0,
      holeCards: me.holeCards ?? [],
      chips: me.chips ?? 0,
      currentBet: me.currentBet ?? 0,
      highestBet: Math.max(...players.map((p: any) => p.currentBet ?? 0)),
      isActive: isMyTurn,
      legalActions: payload.legalActions ?? [],
      minRaise: payload.minRaise ?? 0,
      maxRaise: payload.maxRaise ?? me.chips ?? 0,
    };

    if (isMyTurn) {
      this.act().catch((err) => {
        logger.error({ agentId: this.agentId, err }, 'Bot action failed');
      });
    }
  }

  private async act(): Promise<void> {
    if (!this.currentState || !this.ws || this.destroyed) return;

    const state = this.currentState;
    let action: { action: string; amount?: number };

    if (this.anthropic) {
      action = await this.decideWithAI(state);
    } else {
      action = this.decideBasic(state);
    }

    logger.info({ agentId: this.agentId, action, street: state.street }, 'Bot action');

    this.ws.send(JSON.stringify({
      protocolVersion: 1,
      type: 'ACTION',
      tableId: this.tableId,
      payload: action,
    }));
  }

  /**
   * Use Claude Haiku to decide the action.
   */
  private async decideWithAI(state: BotGameState): Promise<{ action: string; amount?: number }> {
    const callAmount = state.highestBet - state.currentBet;
    const canCheck = callAmount === 0;

    const prompt = `You are playing Texas Hold'em poker. Make the best decision.

Your cards: ${formatCards(state.holeCards)}
Community cards: ${state.communityCards.length > 0 ? formatCards(state.communityCards) : 'none (preflop)'}
Street: ${state.street}
Pot: $${state.potAmount}
Your chips: $${state.chips}
${canCheck ? 'You can check (no bet to call).' : `Call amount: $${callAmount}`}
Min raise: $${state.minRaise}, Max raise: $${state.maxRaise}

Respond with EXACTLY one line: FOLD, CHECK, CALL, BET <amount>, or RAISE <amount>`;

    try {
      const response = await this.anthropic!.messages.create({
        model: BOT_CONFIG.model,
        max_tokens: 30,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = (response.content[0] as any)?.text?.trim().toUpperCase() ?? '';
      return this.parseAIResponse(text, state);
    } catch (err) {
      logger.warn({ agentId: this.agentId, err }, 'AI decision failed, using basic strategy');
      return this.decideBasic(state);
    }
  }

  private parseAIResponse(text: string, state: BotGameState): { action: string; amount?: number } {
    const callAmount = state.highestBet - state.currentBet;

    if (text.startsWith('FOLD')) return { action: 'FOLD' };
    if (text.startsWith('CHECK')) return { action: 'CHECK' };
    if (text.startsWith('CALL')) return { action: 'CALL', amount: callAmount };

    const betMatch = text.match(/^BET\s+\$?(\d+)/);
    if (betMatch) {
      const amount = Math.min(parseInt(betMatch[1]!, 10), state.chips);
      return { action: 'BET', amount };
    }

    const raiseMatch = text.match(/^RAISE\s+\$?(\d+)/);
    if (raiseMatch) {
      const amount = Math.min(Math.max(parseInt(raiseMatch[1]!, 10), state.minRaise), state.maxRaise);
      return { action: 'RAISE', amount };
    }

    // Fallback: check or call
    return callAmount === 0 ? { action: 'CHECK' } : { action: 'CALL', amount: callAmount };
  }

  /**
   * Basic strategy fallback (no AI). Check/call with decent hands, fold weak ones.
   */
  private decideBasic(state: BotGameState): { action: string; amount?: number } {
    const callAmount = state.highestBet - state.currentBet;

    // Free to check
    if (callAmount === 0) return { action: 'CHECK' };

    // Cheap call (< 20% of chips)
    if (callAmount < state.chips * 0.2) return { action: 'CALL', amount: callAmount };

    // Medium call with good cards (pair or high cards)
    if (state.holeCards.length === 2) {
      const ranks = state.holeCards.map((c) => c.rank);
      const isPair = ranks[0] === ranks[1];
      const hasAce = ranks.includes('A');
      const hasKing = ranks.includes('K');

      if (isPair || hasAce || hasKing) {
        return { action: 'CALL', amount: callAmount };
      }
    }

    return { action: 'FOLD' };
  }

  /**
   * Disconnect and clean up.
   */
  destroy(): void {
    this.destroyed = true;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    this.ws = null;
    this.anthropic = null;
  }
}
