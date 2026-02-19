import { describe, it, expect } from 'vitest';
import { getTableName } from 'drizzle-orm';
import * as schema from './schema.js';

describe('Database Schema', () => {
  it('exports all required tables', () => {
    expect(schema.agents).toBeDefined();
    expect(schema.tables).toBeDefined();
    expect(schema.seats).toBeDefined();
    expect(schema.hands).toBeDefined();
    expect(schema.handEvents).toBeDefined();
    expect(schema.chipAccounts).toBeDefined();
    expect(schema.chipTx).toBeDefined();
    expect(schema.agentApiKeys).toBeDefined();
  });

  it('has correct table names', () => {
    expect(getTableName(schema.agents)).toBe('agents');
    expect(getTableName(schema.tables)).toBe('tables');
    expect(getTableName(schema.seats)).toBe('seats');
    expect(getTableName(schema.hands)).toBe('hands');
    expect(getTableName(schema.handEvents)).toBe('hand_events');
    expect(getTableName(schema.chipAccounts)).toBe('chip_accounts');
    expect(getTableName(schema.chipTx)).toBe('chip_tx');
    expect(getTableName(schema.agentApiKeys)).toBe('agent_api_keys');
  });
});
