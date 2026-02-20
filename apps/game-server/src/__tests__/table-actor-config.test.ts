import { describe, it, expect } from 'vitest';
import { TableActor } from '../table-actor.js';
import { BettingMode, DEFAULT_CONFIG, DEFAULT_NL_CONFIG, DEFAULT_PL_CONFIG } from '@agent-poker/poker-engine';

describe('TableActor config pipeline', () => {
  it('should use DEFAULT_CONFIG for LIMIT variant', () => {
    const actor = new TableActor({
      tableId: 'test-limit',
      variant: 'LIMIT',
    });

    expect(actor.variant).toBe('LIMIT');
    expect(actor.config.bettingMode).toBe(BettingMode.LIMIT);
    expect(actor.config).toEqual(DEFAULT_CONFIG);
  });

  it('should use DEFAULT_NL_CONFIG for NL variant', () => {
    const actor = new TableActor({
      tableId: 'test-nl',
      variant: 'NL',
    });

    expect(actor.variant).toBe('NL');
    expect(actor.config.bettingMode).toBe(BettingMode.NO_LIMIT);
    expect(actor.config).toEqual(DEFAULT_NL_CONFIG);
  });

  it('should use DEFAULT_PL_CONFIG for PL variant', () => {
    const actor = new TableActor({
      tableId: 'test-pl',
      variant: 'PL',
    });

    expect(actor.variant).toBe('PL');
    expect(actor.config.bettingMode).toBe(BettingMode.POT_LIMIT);
    expect(actor.config).toEqual(DEFAULT_PL_CONFIG);
  });

  it('should default to LIMIT variant when not specified', () => {
    const actor = new TableActor({
      tableId: 'test-default',
    });

    expect(actor.variant).toBe('LIMIT');
    expect(actor.config).toEqual(DEFAULT_CONFIG);
  });

  it('should use custom config when provided', () => {
    const customConfig = {
      ...DEFAULT_NL_CONFIG,
      smallBlind: 5,
      bigBlind: 10,
    };

    const actor = new TableActor({
      tableId: 'test-custom',
      variant: 'NL',
      config: customConfig,
    });

    expect(actor.config.smallBlind).toBe(5);
    expect(actor.config.bigBlind).toBe(10);
    expect(actor.config.bettingMode).toBe(BettingMode.NO_LIMIT);
  });

  it('should include variant in TableInfo', () => {
    const actor = new TableActor({
      tableId: 'test-info',
      variant: 'NL',
    });

    const info = actor.getInfo();
    expect(info.variant).toBe('NL');
  });

  it('should pass config to createInitialState', () => {
    const actor = new TableActor({
      tableId: 'test-hand',
      variant: 'NL',
      maxSeats: 8,
    });

    // Add 2 players
    actor.addSeat('agent1', 'token1', 1000);
    actor.addSeat('agent2', 'token2', 1000);

    // Start a hand
    const { state } = actor.startHand();

    // Verify the state has the correct config
    expect(state.config.bettingMode).toBe(BettingMode.NO_LIMIT);
    expect(state.config).toEqual(DEFAULT_NL_CONFIG);
  });
});
