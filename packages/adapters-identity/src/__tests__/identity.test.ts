// Identity provider tests

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryIdentityProvider } from '../memory-identity.js';

describe('MemoryIdentityProvider', () => {
  let provider: MemoryIdentityProvider;

  beforeEach(() => {
    provider = new MemoryIdentityProvider();
  });

  describe('registerAgent', () => {
    it('should register a new agent with valid credentials', async () => {
      const result = await provider.registerAgent('TestBot');

      expect(result.agentId).toBeTruthy();
      expect(result.apiKey).toMatch(/^ak_[a-f0-9]{32}$/);
    });

    it('should generate unique IDs and keys for multiple agents', async () => {
      const result1 = await provider.registerAgent('Bot1');
      const result2 = await provider.registerAgent('Bot2');

      expect(result1.agentId).not.toBe(result2.agentId);
      expect(result1.apiKey).not.toBe(result2.apiKey);
    });
  });

  describe('authenticate', () => {
    it('should authenticate with valid API key', async () => {
      const { apiKey } = await provider.registerAgent('AuthBot');

      const result = await provider.authenticate(apiKey);

      expect(result).toMatchObject({
        agentId: expect.any(String),
        displayName: 'AuthBot',
      });
    });

    it('should return null for invalid API key', async () => {
      const result = await provider.authenticate('ak_invalid123456789012345678901234');

      expect(result).toBeNull();
    });

    it('should return null for banned agent', async () => {
      const { agentId, apiKey } = await provider.registerAgent('BadBot');

      await provider.banAgent(agentId);

      const result = await provider.authenticate(apiKey);
      expect(result).toBeNull();
    });
  });

  describe('getAgent', () => {
    it('should retrieve agent info by ID', async () => {
      const { agentId } = await provider.registerAgent('InfoBot');

      const agent = await provider.getAgent(agentId);

      expect(agent).toMatchObject({
        agentId,
        displayName: 'InfoBot',
        status: 'active',
      });
    });

    it('should return null for non-existent agent', async () => {
      const agent = await provider.getAgent('non-existent-id');

      expect(agent).toBeNull();
    });

    it('should return banned status for banned agent', async () => {
      const { agentId } = await provider.registerAgent('BannableBot');

      await provider.banAgent(agentId);

      const agent = await provider.getAgent(agentId);
      expect(agent?.status).toBe('banned');
    });
  });

  describe('end-to-end flow', () => {
    it('should complete register -> authenticate -> getAgent flow', async () => {
      // 1. Register
      const { agentId, apiKey } = await provider.registerAgent('E2EBot');

      // 2. Authenticate
      const authResult = await provider.authenticate(apiKey);
      expect(authResult).toMatchObject({
        agentId,
        displayName: 'E2EBot',
      });

      // 3. Get agent info
      const agentInfo = await provider.getAgent(agentId);
      expect(agentInfo).toMatchObject({
        agentId,
        displayName: 'E2EBot',
        status: 'active',
      });
    });
  });
});
