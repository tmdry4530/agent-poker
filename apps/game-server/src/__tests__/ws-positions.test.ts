import { describe, it, expect } from 'vitest';
import { TableActor } from '../table-actor.js';
import { assignPositions } from '@agent-poker/poker-engine';
import { signSeatToken } from '../seat-token.js';

describe('Position assignments in WS messages', () => {
  it('should compute positions for 2-player game', () => {
    const table = new TableActor({
      tableId: 'test-2p',
      variant: 'NL',
      maxSeats: 8,
    });

    const agent1Token = signSeatToken({ agentId: 'agent1', tableId: table.tableId });
    const agent2Token = signSeatToken({ agentId: 'agent2', tableId: table.tableId });

    table.addSeat('agent1', agent1Token, 1000);
    table.addSeat('agent2', agent2Token, 1000);

    const { state } = table.startHand();

    const activeSeatIndices = state.players.map((p) => p.seatIndex);
    const positions = assignPositions(activeSeatIndices, state.dealerSeatIndex);

    expect(positions.length).toBe(2);
    expect(positions.map((p) => p.position)).toEqual(['BTN', 'BB']);
  });

  it('should compute positions for 8-player game', () => {
    const table = new TableActor({
      tableId: 'test-8p',
      variant: 'NL',
      maxSeats: 8,
    });

    for (let i = 0; i < 8; i++) {
      const agentId = `agent${i}`;
      const token = signSeatToken({ agentId, tableId: table.tableId });
      table.addSeat(agentId, token, 1000);
    }

    const { state } = table.startHand();

    const activeSeatIndices = state.players.map((p) => p.seatIndex);
    const positions = assignPositions(activeSeatIndices, state.dealerSeatIndex);

    expect(positions.length).toBe(8);
    const posLabels = positions.map((p) => p.position);

    // For 8 players: BTN, SB, BB, UTG, UTG1, MP, HJ, CO
    expect(posLabels).toContain('BTN');
    expect(posLabels).toContain('SB');
    expect(posLabels).toContain('BB');
    expect(posLabels).toContain('UTG');
    expect(posLabels).toContain('UTG1');
    expect(posLabels).toContain('MP');
    expect(posLabels).toContain('HJ');
    expect(posLabels).toContain('CO');
  });

  it('should compute positions for 6-player game', () => {
    const table = new TableActor({
      tableId: 'test-6p',
      variant: 'NL',
      maxSeats: 8,
    });

    for (let i = 0; i < 6; i++) {
      const agentId = `agent${i}`;
      const token = signSeatToken({ agentId, tableId: table.tableId });
      table.addSeat(agentId, token, 1000);
    }

    const { state } = table.startHand();

    const activeSeatIndices = state.players.map((p) => p.seatIndex);
    const positions = assignPositions(activeSeatIndices, state.dealerSeatIndex);

    expect(positions.length).toBe(6);
    const posLabels = positions.map((p) => p.position);

    // For 6 players: BTN, SB, BB, UTG, HJ, CO
    expect(posLabels).toEqual(['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO']);
  });

  it('should maintain position consistency across seatIndex values', () => {
    const table = new TableActor({
      tableId: 'test-consistency',
      variant: 'NL',
      maxSeats: 8,
    });

    const agent1Token = signSeatToken({ agentId: 'agent1', tableId: table.tableId });
    const agent2Token = signSeatToken({ agentId: 'agent2', tableId: table.tableId });
    const agent3Token = signSeatToken({ agentId: 'agent3', tableId: table.tableId });

    table.addSeat('agent1', agent1Token, 1000);
    table.addSeat('agent2', agent2Token, 1000);
    table.addSeat('agent3', agent3Token, 1000);

    const { state } = table.startHand();

    const activeSeatIndices = state.players.map((p) => p.seatIndex);
    const positions = assignPositions(activeSeatIndices, state.dealerSeatIndex);

    expect(positions.length).toBe(3);

    // For 3 players: BTN, SB, BB
    const posLabels = positions.map((p) => p.position);
    expect(posLabels).toEqual(['BTN', 'SB', 'BB']);

    // Verify each position has valid seatIndex
    for (const pos of positions) {
      expect(activeSeatIndices).toContain(pos.seatIndex);
    }
  });

  it('should handle dealer at different seat positions', () => {
    const table = new TableActor({
      tableId: 'test-dealer-rotation',
      variant: 'NL',
      maxSeats: 8,
    });

    for (let i = 0; i < 4; i++) {
      const agentId = `agent${i}`;
      const token = signSeatToken({ agentId, tableId: table.tableId });
      table.addSeat(agentId, token, 1000);
    }

    const { state } = table.startHand();

    const activeSeatIndices = state.players.map((p) => p.seatIndex);
    const positions = assignPositions(activeSeatIndices, state.dealerSeatIndex);

    // First position should always be BTN and match dealerSeatIndex
    expect(positions[0]?.position).toBe('BTN');
    expect(positions[0]?.seatIndex).toBe(state.dealerSeatIndex);

    // For 4 players: BTN, SB, BB, UTG
    const posLabels = positions.map((p) => p.position);
    expect(posLabels).toEqual(['BTN', 'SB', 'BB', 'UTG']);
  });
});
