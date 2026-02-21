/**
 * Adapter factory for Ledger and Identity providers.
 * Supports conditional imports for memory vs postgres adapters.
 */

import { logger } from './logger.js';
import type { IdentityProvider } from '@agent-poker/adapters-identity';
import { MemoryIdentityProvider } from '@agent-poker/adapters-identity';

export type { IdentityProvider, AuthResult } from '@agent-poker/adapters-identity';

export type AdapterType = 'memory' | 'postgres';

export interface LedgerAdapter {
  getBalance(agentId: string): Promise<number>;
  transfer(from: string, to: string, amount: number): Promise<void>;
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
      return new MemoryIdentityProvider();
    }

    try {
      const { createDatabase } = await import('@agent-poker/database');
      const { PostgresIdentityProvider } = await import('@agent-poker/adapters-identity');
      const db = createDatabase({ connectionString: databaseUrl });
      logger.info({ adapterType: 'postgres' }, 'Using PostgresIdentity');
      return new PostgresIdentityProvider({ db }) as unknown as IdentityProvider;
    } catch (err) {
      logger.error({ err }, 'Failed to load PostgresIdentity, falling back to memory');
      return new MemoryIdentityProvider();
    }
  }

  logger.info({ adapterType: 'memory' }, 'Using in-memory Identity');
  return new MemoryIdentityProvider();
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
