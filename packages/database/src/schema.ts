import { pgTable, text, timestamp, bigint, integer, jsonb, unique, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * 1. agents
 * Stores agent identity information
 */
export const agents = pgTable('agents', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  status: text('status', { enum: ['active', 'banned'] }).notNull().default('active'),
  ownerId: text('owner_id'), // reserved for MVP2 anti-sybil
});

/**
 * 2. tables
 * Poker table instances
 */
export const tables = pgTable('tables', {
  id: text('id').primaryKey(),
  variant: text('variant').notNull().default('HU_LHE'),
  status: text('status', { enum: ['open', 'running', 'closed'] }).notNull().default('open'),
  maxSeats: integer('max_seats').notNull().default(6),
  config: jsonb('config'), // GameConfig (blinds, ante, betting mode, etc.)
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/**
 * 3. seats
 * Agent seating at tables
 */
export const seats = pgTable(
  'seats',
  {
    tableId: text('table_id')
      .notNull()
      .references(() => tables.id),
    seatNo: integer('seat_no').notNull(),
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id),
    seatToken: text('seat_token'), // JWT seat token for WS auth
    buyInAmount: bigint('buy_in_amount', { mode: 'number' }).notNull(),
    status: text('status', { enum: ['seated', 'left'] }).notNull().default('seated'),
  },
  (t) => ({
    pk: unique().on(t.tableId, t.seatNo),
  })
);

/**
 * 4. hands
 * Hand instances (games played)
 */
export const hands = pgTable('hands', {
  id: text('id').primaryKey(),
  tableId: text('table_id')
    .notNull()
    .references(() => tables.id),
  handNo: integer('hand_no').notNull(),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  endedAt: timestamp('ended_at'),
  resultSummary: jsonb('result_summary'),
});

/**
 * 5. hand_events
 * Append-only event log for full replay capability
 */
export const handEvents = pgTable(
  'hand_events',
  {
    id: text('id').primaryKey(),
    handId: text('hand_id')
      .notNull()
      .references(() => hands.id),
    seq: integer('seq').notNull(),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    handSeqIdx: index('hand_events_hand_seq_idx').on(t.handId, t.seq),
  })
);

/**
 * 6. chip_accounts
 * Agent chip balances (double-entry accounting)
 */
export const chipAccounts = pgTable('chip_accounts', {
  id: text('id').primaryKey(),
  agentId: text('agent_id')
    .notNull()
    .unique()
    .references(() => agents.id),
  currency: text('currency').notNull().default('CHIP'),
  balance: bigint('balance', { mode: 'bigint' }).notNull().default(sql`0`),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * 7. chip_tx
 * Immutable transaction log (double-entry)
 */
export const chipTx = pgTable('chip_tx', {
  id: text('id').primaryKey(),
  ref: text('ref').notNull().unique(), // idempotency key
  debitAccountId: text('debit_account_id')
    .notNull()
    .references(() => chipAccounts.id),
  creditAccountId: text('credit_account_id')
    .notNull()
    .references(() => chipAccounts.id),
  amount: bigint('amount', { mode: 'bigint' }).notNull(),
  reason: text('reason', { enum: ['BUYIN', 'POT_TRANSFER', 'REFUND', 'ADMIN_ADJUST'] }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/**
 * 8. agent_api_keys
 * API key storage for authentication (hashed with bcrypt)
 */
export const agentApiKeys = pgTable('agent_api_keys', {
  id: text('id').primaryKey(),
  agentId: text('agent_id')
    .notNull()
    .references(() => agents.id),
  keyPrefix: text('key_prefix').notNull().default(''), // first 11 chars (ak_ + 8hex) for indexed lookup
  keyHash: text('key_hash').notNull(), // bcrypt hash
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  prefixIdx: index('agent_api_keys_prefix_idx').on(t.keyPrefix),
}));
