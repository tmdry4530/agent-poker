import { createHash } from 'node:crypto';
import type { GameEvent } from '@agent-poker/poker-engine';

/**
 * Hash chain entry linking an event to its predecessor.
 */
export interface HashChainEntry {
  seq: number;
  eventHash: string;
  previousHash: string;
  chainHash: string;
}

/**
 * Compute SHA-256 hash of a single event.
 */
export function hashEvent(event: GameEvent): string {
  const canonical = JSON.stringify(event, Object.keys(event).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Compute chain hash: SHA-256(previousHash + eventHash).
 */
export function computeChainHash(previousHash: string, eventHash: string): string {
  return createHash('sha256').update(previousHash + eventHash).digest('hex');
}

/**
 * Build a hash chain from a sequence of events.
 * Genesis block uses '0' as previousHash.
 */
export function buildHashChain(events: GameEvent[]): HashChainEntry[] {
  const chain: HashChainEntry[] = [];
  let previousHash = '0'.repeat(64); // Genesis

  for (const event of events) {
    const eventHash = hashEvent(event);
    const chainHash = computeChainHash(previousHash, eventHash);

    chain.push({
      seq: event.seq,
      eventHash,
      previousHash,
      chainHash,
    });

    previousHash = chainHash;
  }

  return chain;
}

/**
 * Verify a hash chain for integrity.
 * Returns true if all links are valid, false otherwise.
 */
export function verifyHashChain(
  events: GameEvent[],
  chain: HashChainEntry[]
): boolean {
  if (events.length !== chain.length) {
    return false;
  }

  let expectedPrevious = '0'.repeat(64);

  for (let i = 0; i < events.length; i++) {
    const event = events[i]!;
    const entry = chain[i]!;

    // Check seq match
    if (event.seq !== entry.seq) {
      return false;
    }

    // Check event hash
    const computedEventHash = hashEvent(event);
    if (computedEventHash !== entry.eventHash) {
      return false;
    }

    // Check previous hash link
    if (entry.previousHash !== expectedPrevious) {
      return false;
    }

    // Check chain hash
    const computedChainHash = computeChainHash(entry.previousHash, entry.eventHash);
    if (computedChainHash !== entry.chainHash) {
      return false;
    }

    expectedPrevious = entry.chainHash;
  }

  return true;
}

/**
 * Get the terminal hash of a chain (last chainHash).
 * Returns genesis hash if chain is empty.
 */
export function getTerminalHash(chain: HashChainEntry[]): string {
  if (chain.length === 0) {
    return '0'.repeat(64);
  }
  return chain[chain.length - 1]!.chainHash;
}
