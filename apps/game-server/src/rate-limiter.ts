/**
 * Token bucket rate limiter.
 * Interface designed to be Redis-ready via RateLimiterStore abstraction.
 */

export interface RateLimiterStore {
  get(key: string): Promise<TokenBucket | null>;
  set(key: string, bucket: TokenBucket): Promise<void>;
}

export interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

export interface RateLimitConfig {
  maxTokens: number;
  refillRate: number; // tokens per second
}

export class RateLimiter {
  private store: RateLimiterStore;
  private configs: Map<string, RateLimitConfig>;

  constructor(store?: RateLimiterStore) {
    this.store = store ?? new InMemoryStore();
    this.configs = new Map();

    // Default configs
    this.configs.set('action', { maxTokens: 10, refillRate: 10 }); // 10 actions/sec
    this.configs.set('join', { maxTokens: 5, refillRate: 5 / 60 }); // 5 joins/min
  }

  setConfig(type: string, config: RateLimitConfig): void {
    this.configs.set(type, config);
  }

  async tryConsume(agentId: string, type: string, tokens = 1): Promise<{ allowed: boolean; retryAfterMs?: number }> {
    const config = this.configs.get(type);
    if (!config) {
      return { allowed: true }; // No limit configured
    }

    const key = `${agentId}:${type}`;
    let bucket = await this.store.get(key);

    const now = Date.now();

    if (!bucket) {
      bucket = {
        tokens: config.maxTokens,
        lastRefill: now,
      };
    }

    // Refill tokens based on elapsed time
    const elapsedMs = now - bucket.lastRefill;
    const elapsedSec = elapsedMs / 1000;
    const tokensToAdd = elapsedSec * config.refillRate;

    bucket.tokens = Math.min(config.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      await this.store.set(key, bucket);
      return { allowed: true };
    } else {
      // Calculate retry time
      const tokensNeeded = tokens - bucket.tokens;
      const retryAfterMs = Math.ceil((tokensNeeded / config.refillRate) * 1000);
      await this.store.set(key, bucket);
      return { allowed: false, retryAfterMs };
    }
  }
}

/**
 * In-memory store (default for MVP1).
 * Can be replaced with RedisStore for production.
 */
class InMemoryStore implements RateLimiterStore {
  private data = new Map<string, TokenBucket>();

  async get(key: string): Promise<TokenBucket | null> {
    return this.data.get(key) ?? null;
  }

  async set(key: string, bucket: TokenBucket): Promise<void> {
    this.data.set(key, bucket);
  }
}
