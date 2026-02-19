/**
 * Adapter factory for Ledger and Identity providers.
 * Supports conditional imports for memory vs postgres adapters.
 */

import { logger } from './logger.js';

export type AdapterType = 'memory' | 'postgres';

export interface LedgerAdapter {
  getBalance(agentId: string): Promise<number>;
  transfer(from: string, to: string, amount: number): Promise<void>;
}

export interface IdentityProvider {
  verify(agentId: string, apiKey: string): Promise<boolean>;
  create(displayName: string): Promise<{ agentId: string; apiKey: string }>;
}

/**
 * Create Ledger adapter based on ADAPTER_TYPE env var.
 */
export async function createLedger(): Promise<LedgerAdapter> {
  const adapterType = (process.env['ADAPTER_TYPE'] ?? 'memory') as AdapterType;

  if (adapterType === 'postgres') {
    const databaseUrl = process.env['DATABASE_URL'];
    if (!databaseUrl) {
      logger.warn('ADAPTER_TYPE=postgres but DATABASE_URL not set, falling back to memory');
      return createMemoryLedger();
    }

    try {
      const { createDatabase } = await import('@agent-poker/database');
      const { PostgresLedger } = await import('@agent-poker/adapters-ledger');
      const db = createDatabase({ connectionString: databaseUrl });
      logger.info({ adapterType: 'postgres' }, 'Using PostgresLedger');
      return new PostgresLedger({ db }) as unknown as LedgerAdapter;
    } catch (err) {
      logger.error({ err }, 'Failed to load PostgresLedger, falling back to memory');
      return createMemoryLedger();
    }
  }

  return createMemoryLedger();
}

/**
 * Create Identity provider based on ADAPTER_TYPE env var.
 */
export async function createIdentityProvider(): Promise<IdentityProvider> {
  const adapterType = (process.env['ADAPTER_TYPE'] ?? 'memory') as AdapterType;

  if (adapterType === 'postgres') {
    const databaseUrl = process.env['DATABASE_URL'];
    if (!databaseUrl) {
      logger.warn('ADAPTER_TYPE=postgres but DATABASE_URL not set, falling back to memory');
      return createMemoryIdentity();
    }

    try {
      const { createDatabase } = await import('@agent-poker/database');
      const { PostgresIdentityProvider } = await import('@agent-poker/adapters-identity');
      const db = createDatabase({ connectionString: databaseUrl });
      logger.info({ adapterType: 'postgres' }, 'Using PostgresIdentity');
      return new PostgresIdentityProvider({ db }) as unknown as IdentityProvider;
    } catch (err) {
      logger.error({ err }, 'Failed to load PostgresIdentity, falling back to memory');
      return createMemoryIdentity();
    }
  }

  return createMemoryIdentity();
}

/**
 * In-memory Ledger (default for MVP1).
 */
function createMemoryLedger(): LedgerAdapter {
  const balances = new Map<string, number>();

  logger.info({ adapterType: 'memory' }, 'Using in-memory Ledger');

  return {
    async getBalance(agentId: string): Promise<number> {
      return balances.get(agentId) ?? 0;
    },

    async transfer(from: string, to: string, amount: number): Promise<void> {
      const fromBalance = balances.get(from) ?? 0;
      if (fromBalance < amount) {
        throw new Error('Insufficient balance');
      }
      balances.set(from, fromBalance - amount);
      balances.set(to, (balances.get(to) ?? 0) + amount);
    },

  };
}

/**
 * In-memory Identity provider (default for MVP1).
 */
function createMemoryIdentity(): IdentityProvider {
  const agents = new Map<string, { apiKey: string; displayName: string }>();

  logger.info({ adapterType: 'memory' }, 'Using in-memory Identity');

  return {
    async verify(agentId: string, apiKey: string): Promise<boolean> {
      const agent = agents.get(agentId);
      return agent?.apiKey === apiKey;
    },

    async create(displayName: string): Promise<{ agentId: string; apiKey: string }> {
      const agentId = `agent_${Math.random().toString(36).slice(2, 10)}`;
      const apiKey = `ak_${Math.random().toString(36).slice(2, 18)}`;
      agents.set(agentId, { apiKey, displayName });
      return { agentId, apiKey };
    },
  };
}
