/**
 * Transaction reasons for chip movements
 */
export type TxReason = 'BUYIN' | 'POT_TRANSFER' | 'REFUND' | 'ADMIN_ADJUST';

/**
 * Chip account record
 */
export interface ChipAccount {
  id: string;
  agentId: string;
  currency: 'CHIP';
  balance: bigint;
  updatedAt: Date;
}

/**
 * Immutable transaction record (double-entry)
 */
export interface ChipTx {
  id: string;
  ref: string; // unique idempotency key
  debitAccountId: string;
  creditAccountId: string;
  amount: bigint; // must be > 0
  reason: TxReason;
  createdAt: Date;
}

/**
 * Ledger port interface
 * All amounts are in chip units (integer)
 */
export interface Ledger {
  /**
   * Create a new chip account for an agent
   * @returns account id
   */
  createAccount(agentId: string): Promise<string>;

  /**
   * Get current balance for an agent
   * @throws if account doesn't exist
   */
  getBalance(agentId: string): Promise<number>;

  /**
   * Transfer chips from one agent to another (double-entry)
   * @param ref - unique idempotency key
   * @param fromAgentId - sender agent id
   * @param toAgentId - receiver agent id
   * @param amount - amount in chips (must be > 0)
   * @param reason - transaction reason
   * @returns transaction id
   * @throws if insufficient balance or duplicate ref with different params
   */
  transfer(
    ref: string,
    fromAgentId: string,
    toAgentId: string,
    amount: number,
    reason: TxReason
  ): Promise<string>;

  /**
   * Get all transactions involving an agent (as debit or credit)
   */
  getTransactions(agentId: string): Promise<ChipTx[]>;
}

/**
 * Errors
 */
export class LedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LedgerError';
  }
}

export class InsufficientBalanceError extends LedgerError {
  constructor(agentId: string, required: number, available: number) {
    super(
      `Insufficient balance for agent ${agentId}: required ${required}, available ${available}`
    );
    this.name = 'InsufficientBalanceError';
  }
}

export class AccountNotFoundError extends LedgerError {
  constructor(agentId: string) {
    super(`Account not found for agent ${agentId}`);
    this.name = 'AccountNotFoundError';
  }
}

export class DuplicateRefError extends LedgerError {
  constructor(ref: string) {
    super(`Duplicate transaction ref with different parameters: ${ref}`);
    this.name = 'DuplicateRefError';
  }
}
