import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentAuth } from '../auth.js';

// Mock global fetch
const mockFetch = vi.fn();

describe('AgentAuth', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('login', () => {
    it('should login and cache token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'jwt_token_123',
          agent_id: 'agent_1',
          role: 'agent',
          expires_in: 86400,
        }),
      });

      const auth = new AgentAuth('http://localhost:8080', 'agent_1', 'ak_secret');
      const token = await auth.login();

      expect(token).toBe('jwt_token_123');
      expect(auth.getToken()).toBe('jwt_token_123');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            agent_id: 'agent_1',
            secret: 'ak_secret',
            client_type: 'agent',
          }),
        }),
      );
    });

    it('should throw on login failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'INVALID_CREDENTIALS' }),
      });

      const auth = new AgentAuth('http://localhost:8080', 'agent_1', 'bad_secret');
      await expect(auth.login()).rejects.toThrow('INVALID_CREDENTIALS');
    });
  });

  describe('joinTable', () => {
    it('should auto-login if no token and join', async () => {
      // First call: login
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'jwt_token',
          agent_id: 'agent_1',
          role: 'agent',
          expires_in: 86400,
        }),
      });
      // Second call: join table
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          seatToken: 'seat_tok',
          seatIndex: 0,
          tableId: 'tbl_1',
        }),
      });

      const auth = new AgentAuth('http://localhost:8080', 'agent_1', 'ak_secret');
      const result = await auth.joinTable('tbl_1', 1000);

      expect(result.seatToken).toBe('seat_tok');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 401', async () => {
      const auth = new AgentAuth('http://localhost:8080', 'agent_1', 'ak_secret');
      // Manual login first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'old_token', agent_id: 'agent_1', role: 'agent', expires_in: 86400 }),
      });
      await auth.login();

      // Join returns 401
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
      // Re-login
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'new_token', agent_id: 'agent_1', role: 'agent', expires_in: 86400 }),
      });
      // Retry join succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ seatToken: 'seat_tok', seatIndex: 0, tableId: 'tbl_1' }),
      });

      const result = await auth.joinTable('tbl_1', 1000);
      expect(result.seatToken).toBe('seat_tok');
      expect(mockFetch).toHaveBeenCalledTimes(4); // login + 401 join + re-login + retry join
    });
  });

  describe('getToken', () => {
    it('should return null before login', () => {
      const auth = new AgentAuth('http://localhost:8080', 'agent_1', 'ak_secret');
      expect(auth.getToken()).toBeNull();
    });
  });

  it('should strip trailing slash from lobbyUrl', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'tok', agent_id: 'a', role: 'agent', expires_in: 86400 }),
    });

    const auth = new AgentAuth('http://localhost:8080/', 'a', 's');
    await auth.login();

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/auth/login',
      expect.anything(),
    );
  });
});
