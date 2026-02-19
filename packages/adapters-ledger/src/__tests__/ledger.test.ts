import { describe, it, expect, beforeEach } from 'vitest';
import {
  MemoryLedger,
  InsufficientBalanceError,
  AccountNotFoundError,
  DuplicateRefError,
} from '../index.js';

describe('MemoryLedger', () => {
  let ledger: MemoryLedger;

  beforeEach(() => {
    ledger = new MemoryLedger();
  });

  describe('Account creation', () => {
    it('should create a new account for an agent', async () => {
      const accountId = await ledger.createAccount('agent1');
      expect(accountId).toMatch(/^acc_\d+$/);

      const balance = await ledger.getBalance('agent1');
      expect(balance).toBe(0);
    });

    it('should return same account id for duplicate agent id', async () => {
      const id1 = await ledger.createAccount('agent1');
      const id2 = await ledger.createAccount('agent1');
      expect(id1).toBe(id2);
    });

    it('should create HOUSE account automatically', async () => {
      const balance = await ledger.getBalance(ledger.HOUSE_AGENT_ID);
      expect(balance).toBe(0);
    });
  });

  describe('Balance queries', () => {
    it('should throw for non-existent account', async () => {
      await expect(ledger.getBalance('nonexistent')).rejects.toThrow(
        AccountNotFoundError
      );
    });

    it('should return correct balance after transfers', async () => {
      await ledger.createAccount('agent1');
      await ledger.createAccount('agent2');

      // HOUSE -> agent1 (buy-in)
      await ledger.transfer('ref1', ledger.HOUSE_AGENT_ID, 'agent1', 1000, 'BUYIN');

      expect(await ledger.getBalance('agent1')).toBe(1000);
      expect(await ledger.getBalance(ledger.HOUSE_AGENT_ID)).toBe(-1000);
    });
  });

  describe('Transfer - basic functionality', () => {
    beforeEach(async () => {
      await ledger.createAccount('agent1');
      await ledger.createAccount('agent2');
    });

    it('should transfer chips between agents', async () => {
      // Buy-in for agent1
      await ledger.transfer('buy1', ledger.HOUSE_AGENT_ID, 'agent1', 1000, 'BUYIN');

      // Transfer from agent1 to agent2
      const txId = await ledger.transfer(
        'transfer1',
        'agent1',
        'agent2',
        300,
        'POT_TRANSFER'
      );

      expect(txId).toMatch(/^tx_\d+$/);
      expect(await ledger.getBalance('agent1')).toBe(700);
      expect(await ledger.getBalance('agent2')).toBe(300);
    });

    it('should reject negative or zero amounts', async () => {
      await ledger.transfer('buy1', ledger.HOUSE_AGENT_ID, 'agent1', 1000, 'BUYIN');

      await expect(
        ledger.transfer('bad1', 'agent1', 'agent2', 0, 'POT_TRANSFER')
      ).rejects.toThrow('Transfer amount must be positive');

      await expect(
        ledger.transfer('bad2', 'agent1', 'agent2', -100, 'POT_TRANSFER')
      ).rejects.toThrow('Transfer amount must be positive');
    });

    it('should reject transfer with insufficient balance', async () => {
      await ledger.transfer('buy1', ledger.HOUSE_AGENT_ID, 'agent1', 500, 'BUYIN');

      await expect(
        ledger.transfer('over1', 'agent1', 'agent2', 600, 'POT_TRANSFER')
      ).rejects.toThrow(InsufficientBalanceError);

      // Balance should be unchanged
      expect(await ledger.getBalance('agent1')).toBe(500);
      expect(await ledger.getBalance('agent2')).toBe(0);
    });

    it('should allow HOUSE to transfer unlimited chips', async () => {
      // HOUSE can create chips from nothing
      await ledger.transfer('buy1', ledger.HOUSE_AGENT_ID, 'agent1', 1000000, 'BUYIN');
      expect(await ledger.getBalance('agent1')).toBe(1000000);
      expect(await ledger.getBalance(ledger.HOUSE_AGENT_ID)).toBe(-1000000);
    });
  });

  describe('Idempotency', () => {
    beforeEach(async () => {
      await ledger.createAccount('agent1');
      await ledger.createAccount('agent2');
      await ledger.transfer('buy1', ledger.HOUSE_AGENT_ID, 'agent1', 1000, 'BUYIN');
    });

    it('should return same tx id for duplicate ref with same params', async () => {
      const txId1 = await ledger.transfer(
        'idempotent1',
        'agent1',
        'agent2',
        100,
        'POT_TRANSFER'
      );

      const txId2 = await ledger.transfer(
        'idempotent1',
        'agent1',
        'agent2',
        100,
        'POT_TRANSFER'
      );

      expect(txId1).toBe(txId2);

      // Balance should only change once
      expect(await ledger.getBalance('agent1')).toBe(900);
      expect(await ledger.getBalance('agent2')).toBe(100);
    });

    it('should throw for duplicate ref with different params', async () => {
      await ledger.transfer('dup1', 'agent1', 'agent2', 100, 'POT_TRANSFER');

      await expect(
        ledger.transfer('dup1', 'agent1', 'agent2', 200, 'POT_TRANSFER')
      ).rejects.toThrow(DuplicateRefError);

      await expect(
        ledger.transfer('dup1', 'agent1', 'agent2', 100, 'REFUND')
      ).rejects.toThrow(DuplicateRefError);
    });

    it('should prevent double-execution on retry', async () => {
      // Simulate network retry scenario
      const ref = 'retry-test';
      await ledger.transfer(ref, 'agent1', 'agent2', 100, 'POT_TRANSFER');

      // Retry same operation
      await ledger.transfer(ref, 'agent1', 'agent2', 100, 'POT_TRANSFER');
      await ledger.transfer(ref, 'agent1', 'agent2', 100, 'POT_TRANSFER');

      // Should only execute once
      expect(await ledger.getBalance('agent1')).toBe(900);
      expect(await ledger.getBalance('agent2')).toBe(100);
    });
  });

  describe('Transaction history', () => {
    beforeEach(async () => {
      await ledger.createAccount('agent1');
      await ledger.createAccount('agent2');
      await ledger.createAccount('agent3');
    });

    it('should return all transactions for an agent', async () => {
      await ledger.transfer('buy1', ledger.HOUSE_AGENT_ID, 'agent1', 1000, 'BUYIN');
      await ledger.transfer('tx1', 'agent1', 'agent2', 300, 'POT_TRANSFER');
      await ledger.transfer('tx2', 'agent1', 'agent3', 200, 'POT_TRANSFER');
      await ledger.transfer('tx3', 'agent2', 'agent1', 50, 'REFUND');

      const txs = await ledger.getTransactions('agent1');
      expect(txs).toHaveLength(4);

      // Check all have valid structure
      for (const tx of txs) {
        expect(tx.id).toMatch(/^tx_\d+$/);
        expect(tx.ref).toBeTruthy();
        expect(tx.amount).toBeGreaterThan(0n);
        expect(tx.createdAt).toBeInstanceOf(Date);
      }
    });

    it('should return empty array for agent with no transactions', async () => {
      const txs = await ledger.getTransactions('agent1');
      expect(txs).toEqual([]);
    });

    it('should include both debit and credit transactions', async () => {
      await ledger.transfer('buy1', ledger.HOUSE_AGENT_ID, 'agent1', 1000, 'BUYIN');
      await ledger.transfer('buy3', ledger.HOUSE_AGENT_ID, 'agent3', 500, 'BUYIN');
      await ledger.transfer('tx1', 'agent1', 'agent2', 300, 'POT_TRANSFER');
      await ledger.transfer('tx2', 'agent3', 'agent1', 100, 'POT_TRANSFER');

      const txs = await ledger.getTransactions('agent1');
      expect(txs).toHaveLength(3);

      // agent1 should appear as both debit and credit
      const credits = txs.filter((tx) => {
        const accounts = ledger.getAllAccounts();
        const agent1Account = accounts.find((a) => a.agentId === 'agent1');
        return tx.creditAccountId === agent1Account?.id;
      });
      expect(credits.length).toBeGreaterThan(0);
    });
  });

  describe('Double-entry invariant', () => {
    it('should maintain zero total balance across all accounts', async () => {
      await ledger.createAccount('agent1');
      await ledger.createAccount('agent2');
      await ledger.createAccount('agent3');

      expect(ledger.getTotalBalance()).toBe(0n);

      await ledger.transfer('buy1', ledger.HOUSE_AGENT_ID, 'agent1', 1000, 'BUYIN');
      expect(ledger.getTotalBalance()).toBe(0n);

      await ledger.transfer('buy2', ledger.HOUSE_AGENT_ID, 'agent2', 2000, 'BUYIN');
      expect(ledger.getTotalBalance()).toBe(0n);

      await ledger.transfer('tx1', 'agent1', 'agent2', 300, 'POT_TRANSFER');
      expect(ledger.getTotalBalance()).toBe(0n);

      await ledger.transfer('tx2', 'agent2', 'agent3', 500, 'POT_TRANSFER');
      expect(ledger.getTotalBalance()).toBe(0n);

      await ledger.transfer('tx3', 'agent1', 'agent3', 700, 'POT_TRANSFER');
      expect(ledger.getTotalBalance()).toBe(0n);
    });

    it('should maintain conservation after many operations', async () => {
      const agents = ['a1', 'a2', 'a3', 'a4', 'a5'];
      for (const agent of agents) {
        await ledger.createAccount(agent);
        await ledger.transfer(
          `buy-${agent}`,
          ledger.HOUSE_AGENT_ID,
          agent,
          1000,
          'BUYIN'
        );
      }

      // Random transfers
      await ledger.transfer('t1', 'a1', 'a2', 100, 'POT_TRANSFER');
      await ledger.transfer('t2', 'a2', 'a3', 200, 'POT_TRANSFER');
      await ledger.transfer('t3', 'a3', 'a4', 150, 'POT_TRANSFER');
      await ledger.transfer('t4', 'a4', 'a5', 300, 'POT_TRANSFER');
      await ledger.transfer('t5', 'a5', 'a1', 250, 'POT_TRANSFER');

      expect(ledger.getTotalBalance()).toBe(0n);
    });
  });

  describe('Transaction reasons', () => {
    beforeEach(async () => {
      await ledger.createAccount('agent1');
      await ledger.createAccount('agent2');
    });

    it('should accept all valid transaction reasons', async () => {
      await ledger.transfer('buy', ledger.HOUSE_AGENT_ID, 'agent1', 1000, 'BUYIN');
      await ledger.transfer('pot', 'agent1', 'agent2', 100, 'POT_TRANSFER');
      await ledger.transfer('refund', 'agent2', 'agent1', 50, 'REFUND');
      await ledger.transfer('admin', ledger.HOUSE_AGENT_ID, 'agent2', 100, 'ADMIN_ADJUST');

      const txs = await ledger.getTransactions('agent1');
      expect(txs.some((tx) => tx.reason === 'BUYIN')).toBe(true);
      expect(txs.some((tx) => tx.reason === 'POT_TRANSFER')).toBe(true);
      expect(txs.some((tx) => tx.reason === 'REFUND')).toBe(true);
    });
  });

  describe('Concurrent operations', () => {
    it('should handle multiple transfers in sequence correctly', async () => {
      await ledger.createAccount('agent1');
      await ledger.createAccount('agent2');
      await ledger.transfer('buy1', ledger.HOUSE_AGENT_ID, 'agent1', 1000, 'BUYIN');

      const transfers = [];
      for (let i = 0; i < 10; i++) {
        transfers.push(
          ledger.transfer(`tx${i}`, 'agent1', 'agent2', 10, 'POT_TRANSFER')
        );
      }

      await Promise.all(transfers);

      expect(await ledger.getBalance('agent1')).toBe(900);
      expect(await ledger.getBalance('agent2')).toBe(100);
      expect(ledger.getTotalBalance()).toBe(0n);
    });
  });

  describe('Edge cases', () => {
    it('should handle transfer to self', async () => {
      await ledger.createAccount('agent1');
      await ledger.transfer('buy1', ledger.HOUSE_AGENT_ID, 'agent1', 1000, 'BUYIN');

      await ledger.transfer('self', 'agent1', 'agent1', 100, 'ADMIN_ADJUST');

      // Balance unchanged (debit and credit same account)
      expect(await ledger.getBalance('agent1')).toBe(1000);
    });

    it('should handle exact balance transfer', async () => {
      await ledger.createAccount('agent1');
      await ledger.createAccount('agent2');
      await ledger.transfer('buy1', ledger.HOUSE_AGENT_ID, 'agent1', 500, 'BUYIN');

      await ledger.transfer('exact', 'agent1', 'agent2', 500, 'POT_TRANSFER');

      expect(await ledger.getBalance('agent1')).toBe(0);
      expect(await ledger.getBalance('agent2')).toBe(500);
    });

    it('should handle large amounts', async () => {
      await ledger.createAccount('agent1');
      const largeAmount = 10_000_000_000; // 10 billion chips

      await ledger.transfer(
        'large',
        ledger.HOUSE_AGENT_ID,
        'agent1',
        largeAmount,
        'BUYIN'
      );

      expect(await ledger.getBalance('agent1')).toBe(largeAmount);
      expect(ledger.getTotalBalance()).toBe(0n);
    });
  });
});
