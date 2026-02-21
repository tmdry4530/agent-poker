/**
 * JWT access token utilities for lobby-api authentication.
 */

import jwt from 'jsonwebtoken';

export interface AccessTokenPayload {
  sub: string;
  displayName: string;
  role: string;
}

export interface VerifiedToken extends AccessTokenPayload {
  iat: number;
  exp: number;
}

/** TTL in seconds per role */
const TTL: Record<string, number> = {
  agent: 86400,     // 24h
  spectator: 14400, // 4h
};

function getSecret(): string {
  const secret = process.env['AUTH_JWT_SECRET'];
  if (!secret) {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('AUTH_JWT_SECRET must be set in production. Generate with: openssl rand -base64 32');
    }
    return 'dev-auth-jwt-secret-DO-NOT-USE-IN-PRODUCTION';
  }
  return secret;
}

/**
 * Sign a JWT access token.
 */
export function signAccessToken(payload: AccessTokenPayload): string {
  const expiresIn = TTL[payload.role] ?? 14400;
  return jwt.sign(
    { sub: payload.sub, displayName: payload.displayName, role: payload.role },
    getSecret(),
    { expiresIn },
  );
}

/**
 * Verify and decode a JWT access token.
 * Returns the decoded payload if valid, null if invalid or expired.
 */
export function verifyAccessToken(token: string): VerifiedToken | null {
  try {
    const decoded = jwt.verify(token, getSecret()) as jwt.JwtPayload;
    if (
      typeof decoded['sub'] !== 'string' ||
      typeof decoded['displayName'] !== 'string' ||
      typeof decoded['role'] !== 'string'
    ) {
      return null;
    }
    return {
      sub: decoded['sub'],
      displayName: decoded['displayName'],
      role: decoded['role'],
      iat: decoded['iat'] as number,
      exp: decoded['exp'] as number,
    };
  } catch {
    return null;
  }
}
