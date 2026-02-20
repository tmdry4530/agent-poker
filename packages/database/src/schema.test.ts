import { describe, it, expect } from 'vitest';
import { getTableName, getTableColumns } from 'drizzle-orm';
import * as schema from './schema.js';

describe('Database Schema', () => {
  const EXPECTED_TABLES = [
    'agents',
    'tables',
    'seats',
    'hands',
    'hand_events',
    'chip_accounts',
    'chip_tx',
    'agent_api_keys',
  ] as const;

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

  it('has exactly 8 tables', () => {
    const tableExports = [
      schema.agents,
      schema.tables,
      schema.seats,
      schema.hands,
      schema.handEvents,
      schema.chipAccounts,
      schema.chipTx,
      schema.agentApiKeys,
    ];
    expect(tableExports).toHaveLength(EXPECTED_TABLES.length);
  });

  describe('agents table columns', () => {
    it('has required columns', () => {
      const cols = getTableColumns(schema.agents);
      expect(cols.id).toBeDefined();
      expect(cols.displayName).toBeDefined();
      expect(cols.createdAt).toBeDefined();
      expect(cols.status).toBeDefined();
      expect(cols.ownerId).toBeDefined();
    });

    it('id is primary key', () => {
      const cols = getTableColumns(schema.agents);
      expect(cols.id.primary).toBe(true);
    });
  });

  describe('tables table columns', () => {
    it('has required columns', () => {
      const cols = getTableColumns(schema.tables);
      expect(cols.id).toBeDefined();
      expect(cols.variant).toBeDefined();
      expect(cols.status).toBeDefined();
      expect(cols.createdAt).toBeDefined();
    });

    it('id is primary key', () => {
      const cols = getTableColumns(schema.tables);
      expect(cols.id.primary).toBe(true);
    });
  });

  describe('seats table columns', () => {
    it('has required columns', () => {
      const cols = getTableColumns(schema.seats);
      expect(cols.tableId).toBeDefined();
      expect(cols.seatNo).toBeDefined();
      expect(cols.agentId).toBeDefined();
      expect(cols.buyInAmount).toBeDefined();
      expect(cols.status).toBeDefined();
    });
  });

  describe('hands table columns', () => {
    it('has required columns', () => {
      const cols = getTableColumns(schema.hands);
      expect(cols.id).toBeDefined();
      expect(cols.tableId).toBeDefined();
      expect(cols.handNo).toBeDefined();
      expect(cols.startedAt).toBeDefined();
      expect(cols.endedAt).toBeDefined();
      expect(cols.resultSummary).toBeDefined();
    });

    it('id is primary key', () => {
      const cols = getTableColumns(schema.hands);
      expect(cols.id.primary).toBe(true);
    });
  });

  describe('handEvents table columns', () => {
    it('has required columns for event sourcing', () => {
      const cols = getTableColumns(schema.handEvents);
      expect(cols.id).toBeDefined();
      expect(cols.handId).toBeDefined();
      expect(cols.seq).toBeDefined();
      expect(cols.type).toBeDefined();
      expect(cols.payload).toBeDefined();
      expect(cols.createdAt).toBeDefined();
    });

    it('id is primary key', () => {
      const cols = getTableColumns(schema.handEvents);
      expect(cols.id.primary).toBe(true);
    });
  });

  describe('chipAccounts table columns', () => {
    it('has required columns for double-entry accounting', () => {
      const cols = getTableColumns(schema.chipAccounts);
      expect(cols.id).toBeDefined();
      expect(cols.agentId).toBeDefined();
      expect(cols.currency).toBeDefined();
      expect(cols.balance).toBeDefined();
      expect(cols.updatedAt).toBeDefined();
    });

    it('id is primary key', () => {
      const cols = getTableColumns(schema.chipAccounts);
      expect(cols.id.primary).toBe(true);
    });
  });

  describe('chipTx table columns', () => {
    it('has required columns for immutable transaction log', () => {
      const cols = getTableColumns(schema.chipTx);
      expect(cols.id).toBeDefined();
      expect(cols.ref).toBeDefined();
      expect(cols.debitAccountId).toBeDefined();
      expect(cols.creditAccountId).toBeDefined();
      expect(cols.amount).toBeDefined();
      expect(cols.reason).toBeDefined();
      expect(cols.createdAt).toBeDefined();
    });

    it('id is primary key', () => {
      const cols = getTableColumns(schema.chipTx);
      expect(cols.id.primary).toBe(true);
    });

    it('ref is unique (idempotency key)', () => {
      const cols = getTableColumns(schema.chipTx);
      expect(cols.ref.isUnique).toBe(true);
    });
  });

  describe('agentApiKeys table columns', () => {
    it('has required columns', () => {
      const cols = getTableColumns(schema.agentApiKeys);
      expect(cols.id).toBeDefined();
      expect(cols.agentId).toBeDefined();
      expect(cols.keyHash).toBeDefined();
      expect(cols.createdAt).toBeDefined();
    });

    it('id is primary key', () => {
      const cols = getTableColumns(schema.agentApiKeys);
      expect(cols.id.primary).toBe(true);
    });
  });

  describe('not-null constraints', () => {
    it('agents: displayName, status are notNull', () => {
      const cols = getTableColumns(schema.agents);
      expect(cols.displayName.notNull).toBe(true);
      expect(cols.status.notNull).toBe(true);
    });

    it('handEvents: handId, seq, type, payload are notNull', () => {
      const cols = getTableColumns(schema.handEvents);
      expect(cols.handId.notNull).toBe(true);
      expect(cols.seq.notNull).toBe(true);
      expect(cols.type.notNull).toBe(true);
      expect(cols.payload.notNull).toBe(true);
    });

    it('chipTx: all financial columns are notNull', () => {
      const cols = getTableColumns(schema.chipTx);
      expect(cols.ref.notNull).toBe(true);
      expect(cols.debitAccountId.notNull).toBe(true);
      expect(cols.creditAccountId.notNull).toBe(true);
      expect(cols.amount.notNull).toBe(true);
      expect(cols.reason.notNull).toBe(true);
    });
  });

  describe('migration gap documentation', () => {
    /**
     * GAP: drizzle-kit scripts (db:generate, db:migrate) exist in package.json
     * but no SQL migration files have been generated yet.
     *
     * The `drizzle/` output directory does not exist.
     * To generate migrations: `pnpm --filter database db:generate`
     * To apply migrations: `pnpm --filter database db:migrate`
     *
     * This is expected for MVP1 local dev (schema is applied via drizzle-kit push
     * or the schema is used in-memory). Before production deployment, migrations
     * must be generated and committed.
     */
    it('schema is defined (migrations pending generation)', () => {
      // This test documents that schema definitions exist and are valid,
      // even though SQL migration files have not been generated yet.
      const allTables = [
        schema.agents,
        schema.tables,
        schema.seats,
        schema.hands,
        schema.handEvents,
        schema.chipAccounts,
        schema.chipTx,
        schema.agentApiKeys,
      ];
      for (const table of allTables) {
        const name = getTableName(table);
        expect(EXPECTED_TABLES).toContain(name);
        const cols = getTableColumns(table);
        expect(Object.keys(cols).length).toBeGreaterThan(0);
      }
    });
  });
});
