import { describe, it, expect } from 'vitest';
import type { GameEvent } from '@agent-poker/poker-engine';
import {
  hashEvent,
  computeChainHash,
  buildHashChain,
  verifyHashChain,
  getTerminalHash,
} from '../hash-chain.js';

describe('hash-chain', () => {
  const mockEvent1: GameEvent = {
    type: 'GameStarted',
    seq: 0,
    timestamp: Date.now(),
    handId: 'hand-1',
    players: [],
  };

  const mockEvent2: GameEvent = {
    type: 'BettingRoundStarted',
    seq: 1,
    timestamp: Date.now(),
    street: 'preflop',
  };

  const mockEvent3: GameEvent = {
    type: 'PlayerActed',
    seq: 2,
    timestamp: Date.now(),
    playerId: 'p1',
    action: { type: 'fold' },
    newPotSize: 100,
  };

  describe('hashEvent', () => {
    it('should produce deterministic hash for same event', () => {
      const hash1 = hashEvent(mockEvent1);
      const hash2 = hashEvent(mockEvent1);
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should produce different hashes for different events', () => {
      const hash1 = hashEvent(mockEvent1);
      const hash2 = hashEvent(mockEvent2);
      expect(hash1).not.toBe(hash2);
    });

    it('should be sensitive to field order (canonical JSON)', () => {
      // The function uses sorted keys, so different input orders produce same hash
      const event1 = { seq: 1, type: 'test', timestamp: 100 };
      const event2 = { timestamp: 100, seq: 1, type: 'test' };
      const hash1 = hashEvent(event1 as GameEvent);
      const hash2 = hashEvent(event2 as GameEvent);
      expect(hash1).toBe(hash2);
    });
  });

  describe('computeChainHash', () => {
    it('should compute SHA-256(prev + event)', () => {
      const prev = 'a'.repeat(64);
      const event = 'b'.repeat(64);
      const chain = computeChainHash(prev, event);
      expect(chain).toMatch(/^[0-9a-f]{64}$/);
      expect(chain).not.toBe(prev);
      expect(chain).not.toBe(event);
    });

    it('should be deterministic', () => {
      const prev = '0'.repeat(64);
      const event = '1'.repeat(64);
      const hash1 = computeChainHash(prev, event);
      const hash2 = computeChainHash(prev, event);
      expect(hash1).toBe(hash2);
    });
  });

  describe('buildHashChain', () => {
    it('should build empty chain for empty events', () => {
      const chain = buildHashChain([]);
      expect(chain).toEqual([]);
    });

    it('should build single-entry chain with genesis previous', () => {
      const chain = buildHashChain([mockEvent1]);
      expect(chain).toHaveLength(1);
      expect(chain[0].seq).toBe(0);
      expect(chain[0].previousHash).toBe('0'.repeat(64));
      expect(chain[0].eventHash).toBe(hashEvent(mockEvent1));
      expect(chain[0].chainHash).toBe(
        computeChainHash(chain[0].previousHash, chain[0].eventHash)
      );
    });

    it('should link multiple entries sequentially', () => {
      const events = [mockEvent1, mockEvent2, mockEvent3];
      const chain = buildHashChain(events);
      expect(chain).toHaveLength(3);

      // First entry
      expect(chain[0].previousHash).toBe('0'.repeat(64));
      expect(chain[0].eventHash).toBe(hashEvent(mockEvent1));

      // Second entry links to first
      expect(chain[1].previousHash).toBe(chain[0].chainHash);
      expect(chain[1].eventHash).toBe(hashEvent(mockEvent2));

      // Third entry links to second
      expect(chain[2].previousHash).toBe(chain[1].chainHash);
      expect(chain[2].eventHash).toBe(hashEvent(mockEvent3));
    });
  });

  describe('verifyHashChain', () => {
    it('should verify valid chain', () => {
      const events = [mockEvent1, mockEvent2, mockEvent3];
      const chain = buildHashChain(events);
      expect(verifyHashChain(events, chain)).toBe(true);
    });

    it('should reject mismatched length', () => {
      const events = [mockEvent1, mockEvent2];
      const chain = buildHashChain([mockEvent1, mockEvent2, mockEvent3]);
      expect(verifyHashChain(events, chain)).toBe(false);
    });

    it('should reject tampered event', () => {
      const events = [mockEvent1, mockEvent2, mockEvent3];
      const chain = buildHashChain(events);

      // Tamper with second event
      const tamperedEvents = [...events];
      tamperedEvents[1] = { ...mockEvent2, seq: 99 };

      expect(verifyHashChain(tamperedEvents, chain)).toBe(false);
    });

    it('should reject broken chain link', () => {
      const events = [mockEvent1, mockEvent2, mockEvent3];
      const chain = buildHashChain(events);

      // Break the chain by modifying previousHash
      const brokenChain = [...chain];
      brokenChain[1] = { ...brokenChain[1], previousHash: 'f'.repeat(64) };

      expect(verifyHashChain(events, brokenChain)).toBe(false);
    });

    it('should reject corrupted chain hash', () => {
      const events = [mockEvent1, mockEvent2];
      const chain = buildHashChain(events);

      // Corrupt chainHash
      const corruptedChain = [...chain];
      corruptedChain[0] = { ...corruptedChain[0], chainHash: 'deadbeef' };

      expect(verifyHashChain(events, corruptedChain)).toBe(false);
    });

    it('should accept empty chain', () => {
      expect(verifyHashChain([], [])).toBe(true);
    });
  });

  describe('getTerminalHash', () => {
    it('should return genesis hash for empty chain', () => {
      const hash = getTerminalHash([]);
      expect(hash).toBe('0'.repeat(64));
    });

    it('should return last chainHash for non-empty chain', () => {
      const events = [mockEvent1, mockEvent2, mockEvent3];
      const chain = buildHashChain(events);
      const terminal = getTerminalHash(chain);
      expect(terminal).toBe(chain[2].chainHash);
    });
  });

  describe('tampering detection', () => {
    it('should detect event reordering', () => {
      const events = [mockEvent1, mockEvent2, mockEvent3];
      const chain = buildHashChain(events);

      // Reorder events
      const reordered = [mockEvent1, mockEvent3, mockEvent2];
      expect(verifyHashChain(reordered, chain)).toBe(false);
    });

    it('should detect event insertion', () => {
      const events = [mockEvent1, mockEvent2];
      const chain = buildHashChain(events);

      // Insert event in the middle
      const inserted = [mockEvent1, mockEvent3, mockEvent2];
      expect(verifyHashChain(inserted, chain)).toBe(false);
    });

    it('should detect event deletion', () => {
      const events = [mockEvent1, mockEvent2, mockEvent3];
      const chain = buildHashChain(events);

      // Delete middle event
      const deleted = [mockEvent1, mockEvent3];
      expect(verifyHashChain(deleted, chain)).toBe(false);
    });
  });
});
