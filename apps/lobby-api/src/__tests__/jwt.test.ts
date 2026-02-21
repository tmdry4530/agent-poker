import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { signAccessToken, verifyAccessToken } from '../jwt.js';

const DEV_SECRET = 'dev-auth-jwt-secret-DO-NOT-USE-IN-PRODUCTION';

describe('JWT utilities', () => {
  beforeEach(() => {
    delete process.env['AUTH_JWT_SECRET'];
    delete process.env['NODE_ENV'];
  });

  describe('signAccessToken + verifyAccessToken roundtrip', () => {
    it('signs and verifies a token for agent role', () => {
      const payload = { sub: 'agent-1', displayName: 'TestBot', role: 'agent' };
      const token = signAccessToken(payload);
      const verified = verifyAccessToken(token);

      expect(verified).not.toBeNull();
      expect(verified!.sub).toBe('agent-1');
      expect(verified!.displayName).toBe('TestBot');
      expect(verified!.role).toBe('agent');
      expect(typeof verified!.iat).toBe('number');
      expect(typeof verified!.exp).toBe('number');
    });

    it('signs and verifies a token for spectator role', () => {
      const payload = { sub: 'agent-2', displayName: 'Viewer', role: 'spectator' };
      const token = signAccessToken(payload);
      const verified = verifyAccessToken(token);

      expect(verified).not.toBeNull();
      expect(verified!.role).toBe('spectator');
    });
  });

  describe('TTL by role', () => {
    it('agent token has 24h TTL', () => {
      const token = signAccessToken({ sub: 'a', displayName: 'A', role: 'agent' });
      const decoded = jwt.decode(token) as jwt.JwtPayload;
      const ttl = decoded['exp']! - decoded['iat']!;
      expect(ttl).toBe(86400); // 24h in seconds
    });

    it('spectator token has 4h TTL', () => {
      const token = signAccessToken({ sub: 'b', displayName: 'B', role: 'spectator' });
      const decoded = jwt.decode(token) as jwt.JwtPayload;
      const ttl = decoded['exp']! - decoded['iat']!;
      expect(ttl).toBe(14400); // 4h in seconds
    });
  });

  describe('verifyAccessToken edge cases', () => {
    it('returns null for expired token', () => {
      const token = jwt.sign(
        { sub: 'x', displayName: 'X', role: 'agent' },
        DEV_SECRET,
        { expiresIn: -1 },
      );
      expect(verifyAccessToken(token)).toBeNull();
    });

    it('returns null for invalid token', () => {
      expect(verifyAccessToken('not-a-valid-token')).toBeNull();
    });

    it('returns null for token signed with wrong secret', () => {
      const token = jwt.sign(
        { sub: 'x', displayName: 'X', role: 'agent' },
        'wrong-secret',
        { expiresIn: '1h' },
      );
      expect(verifyAccessToken(token)).toBeNull();
    });

    it('returns null for token missing required fields', () => {
      const token = jwt.sign({ sub: 'x' }, DEV_SECRET, { expiresIn: '1h' });
      expect(verifyAccessToken(token)).toBeNull();
    });
  });
});
