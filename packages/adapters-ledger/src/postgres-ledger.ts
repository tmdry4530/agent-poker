import { randomUUID } from 'node:crypto';
import { eq, or } from 'drizzle-orm';
import type { Database } from '@agent-poker/database';
import { chipAccounts, chipTx } from '@agent-poker/database';
import {
  type Ledger,
  type ChipTx,
  type TxReason,
  InsufficientBalanceError,
  AccountNotFoundError,
  DuplicateRefError,
} from './types.js';

export interface PostgresLedgerConfig {
  db: Database;
}

/**
 * Postgres-based ledger implementation with double-entry accounting
 */
export class PostgresLedger implements Ledger {
  private db: Database;
  public readonly HOUSE_AGENT_ID = 'HOUSE';

  constructor(config: PostgresLedgerConfig) {
    this.db = config.db;
  }

  async createAccount(agentId: string): Promise<string> {
    const existing = await this.db
      .select()
      .from(chipAccounts)
      .where(eq(chipAccounts.agentId, agentId))
      .limit(1);

    if (existing.length > 0) {
      return existing[0]!.id;
    }

    const accountId = `acc_${randomUUID()}`;
    await this.db.insert(chipAccounts).values({
      id: accountId,
      agentId,
      currency: 'CHIP',
      balance: BigInt(0),
      updatedAt: new Date(),
    });

    return accountId;
  }

  async getBalance(agentId: string): Promise<number> {
    const accounts = await this.db
      .select()
      .from(chipAccounts)
      .where(eq(chipAccounts.agentId, agentId))
      .limit(1);

    if (accounts.length === 0) {
      throw new AccountNotFoundError(agentId);
    }

    return Number(accounts[0]!.balance);
  }

  async transfer(
    ref: string,
    fromAgentId: string,
    toAgentId: string,
    amount: number,
    reason: TxReason
  ): Promise<string> {
    if (amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }

    return await this.db.transaction(async (tx) => {
      const existingTxs = await tx
        .select()
        .from(chipTx)
        .where(eq(chipTx.ref, ref))
        .limit(1);

      if (existingTxs.length > 0) {
        const existingTx = existingTxs[0]!;
        const fromAccounts = await tx
          .select()
          .from(chipAccounts)
          .where(eq(chipAccounts.agentId, fromAgentId))
          .limit(1);
        const toAccounts = await tx
          .select()
          .from(chipAccounts)
          .where(eq(chipAccounts.agentId, toAgentId))
          .limit(1);

        if (fromAccounts.length === 0) throw new AccountNotFoundError(fromAgentId);
        if (toAccounts.length === 0) throw new AccountNotFoundError(toAgentId);

        const fromAccount = fromAccounts[0]!;
        const toAccount = toAccounts[0]!;

        if (
          existingTx.debitAccountId === fromAccount.id &&
          existingTx.creditAccountId === toAccount.id &&
          existingTx.amount === BigInt(amount) &&
          existingTx.reason === reason
        ) {
          return existingTx.id;
        } else {
          throw new DuplicateRefError(ref);
        }
      }

      const fromAccounts = await tx
        .select()
        .from(chipAccounts)
        .where(eq(chipAccounts.agentId, fromAgentId))
        .limit(1);
      const toAccounts = await tx
        .select()
        .from(chipAccounts)
        .where(eq(chipAccounts.agentId, toAgentId))
        .limit(1);

      if (fromAccounts.length === 0) throw new AccountNotFoundError(fromAgentId);
      if (toAccounts.length === 0) throw new AccountNotFoundError(toAgentId);

      const fromAccount = fromAccounts[0]!;
      const toAccount = toAccounts[0]!;

      if (fromAgentId !== this.HOUSE_AGENT_ID && fromAccount.balance < BigInt(amount)) {
        throw new InsufficientBalanceError(fromAgentId, amount, Number(fromAccount.balance));
      }

      const txId = `tx_${randomUUID()}`;
      await tx.insert(chipTx).values({
        id: txId,
        ref,
        debitAccountId: fromAccount.id,
        creditAccountId: toAccount.id,
        amount: BigInt(amount),
        reason,
        createdAt: new Date(),
      });

      await tx
        .update(chipAccounts)
        .set({
          balance: fromAccount.balance - BigInt(amount),
          updatedAt: new Date(),
        })
        .where(eq(chipAccounts.id, fromAccount.id));

      await tx
        .update(chipAccounts)
        .set({
          balance: toAccount.balance + BigInt(amount),
          updatedAt: new Date(),
        })
        .where(eq(chipAccounts.id, toAccount.id));

      return txId;
    });
  }

  async getTransactions(agentId: string): Promise<ChipTx[]> {
    const accounts = await this.db
      .select()
      .from(chipAccounts)
      .where(eq(chipAccounts.agentId, agentId))
      .limit(1);

    if (accounts.length === 0) {
      throw new AccountNotFoundError(agentId);
    }

    const account = accounts[0]!;
    const txs = await this.db
      .select()
      .from(chipTx)
      .where(
        or(
          eq(chipTx.debitAccountId, account.id),
          eq(chipTx.creditAccountId, account.id)
        )
      );

    return txs.map((tx) => ({
      id: tx.id,
      ref: tx.ref,
      debitAccountId: tx.debitAccountId,
      creditAccountId: tx.creditAccountId,
      amount: tx.amount,
      reason: tx.reason,
      createdAt: tx.createdAt,
    }));
  }
}

export function createLedger(config: PostgresLedgerConfig): Ledger {
  return new PostgresLedger(config);
}
