import {
  type Ledger,
  type ChipAccount,
  type ChipTx,
  type TxReason,
  InsufficientBalanceError,
  AccountNotFoundError,
  DuplicateRefError,
} from './types.js';

/**
 * In-memory ledger implementation with double-entry accounting
 * Suitable for MVP1 testing and local development
 */
export class MemoryLedger implements Ledger {
  private accounts = new Map<string, ChipAccount>();
  private accountsByAgentId = new Map<string, string>(); // agentId -> accountId
  private transactions: ChipTx[] = [];
  private txByRef = new Map<string, ChipTx>();
  private nextAccountId = 1;
  private nextTxId = 1;

  /**
   * Special HOUSE account for buy-ins and cashouts
   */
  public readonly HOUSE_AGENT_ID = 'HOUSE';

  constructor() {
    // Create HOUSE account with infinite balance (represented as 0, since it's a contra-account)
    this.createAccountSync(this.HOUSE_AGENT_ID);
  }

  private createAccountSync(agentId: string): string {
    if (this.accountsByAgentId.has(agentId)) {
      return this.accountsByAgentId.get(agentId)!;
    }

    const accountId = `acc_${this.nextAccountId++}`;
    const account: ChipAccount = {
      id: accountId,
      agentId,
      currency: 'CHIP',
      balance: 0n,
      updatedAt: new Date(),
    };

    this.accounts.set(accountId, account);
    this.accountsByAgentId.set(agentId, accountId);

    return accountId;
  }

  async createAccount(agentId: string): Promise<string> {
    return this.createAccountSync(agentId);
  }

  private getAccountByAgentId(agentId: string): ChipAccount {
    const accountId = this.accountsByAgentId.get(agentId);
    if (!accountId) {
      throw new AccountNotFoundError(agentId);
    }
    return this.accounts.get(accountId)!;
  }

  async getBalance(agentId: string): Promise<number> {
    const account = this.getAccountByAgentId(agentId);
    return Number(account.balance);
  }

  async transfer(
    ref: string,
    fromAgentId: string,
    toAgentId: string,
    amount: number,
    reason: TxReason
  ): Promise<string> {
    // Idempotency check
    const existingTx = this.txByRef.get(ref);
    if (existingTx) {
      // Verify parameters match
      const fromAccount = this.getAccountByAgentId(fromAgentId);
      const toAccount = this.getAccountByAgentId(toAgentId);

      if (
        existingTx.debitAccountId === fromAccount.id &&
        existingTx.creditAccountId === toAccount.id &&
        existingTx.amount === BigInt(amount) &&
        existingTx.reason === reason
      ) {
        return existingTx.id; // Same request, return existing tx
      } else {
        throw new DuplicateRefError(ref);
      }
    }

    // Validate amount
    if (amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }

    // Get accounts (will throw if not found)
    const fromAccount = this.getAccountByAgentId(fromAgentId);
    const toAccount = this.getAccountByAgentId(toAgentId);

    // Check balance (skip for HOUSE account)
    if (fromAgentId !== this.HOUSE_AGENT_ID && fromAccount.balance < BigInt(amount)) {
      throw new InsufficientBalanceError(
        fromAgentId,
        amount,
        Number(fromAccount.balance)
      );
    }

    // Create transaction
    const txId = `tx_${this.nextTxId++}`;
    const tx: ChipTx = {
      id: txId,
      ref,
      debitAccountId: fromAccount.id,
      creditAccountId: toAccount.id,
      amount: BigInt(amount),
      reason,
      createdAt: new Date(),
    };

    // Update balances (double-entry)
    fromAccount.balance -= BigInt(amount);
    fromAccount.updatedAt = new Date();

    toAccount.balance += BigInt(amount);
    toAccount.updatedAt = new Date();

    // Record transaction
    this.transactions.push(tx);
    this.txByRef.set(ref, tx);

    return txId;
  }

  async getTransactions(agentId: string): Promise<ChipTx[]> {
    const account = this.getAccountByAgentId(agentId);
    return this.transactions.filter(
      (tx) =>
        tx.debitAccountId === account.id || tx.creditAccountId === account.id
    );
  }

  /**
   * Test helper: get sum of all account balances (should always = 0)
   */
  getTotalBalance(): bigint {
    let total = 0n;
    for (const account of this.accounts.values()) {
      total += account.balance;
    }
    return total;
  }

  /**
   * Test helper: get all accounts
   */
  getAllAccounts(): ChipAccount[] {
    return Array.from(this.accounts.values());
  }
}
