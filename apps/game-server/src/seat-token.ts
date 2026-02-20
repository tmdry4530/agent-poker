/**
 * JWT seat token utilities.
 * Seat tokens encode { agentId, tableId, exp } and are signed with a server secret.
 */

import jwt from 'jsonwebtoken';

export interface SeatTokenPayload {
  agentId: string;
  tableId: string;
}

const DEFAULT_EXPIRY_SECONDS = 30 * 60; // 30 minutes

function getSecret(): string {
  const secret = process.env['SEAT_TOKEN_SECRET'];
  if (!secret) {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('SEAT_TOKEN_SECRET must be set in production. Generate with: openssl rand -base64 32');
    }
    return 'dev-seat-token-secret-DO-NOT-USE-IN-PRODUCTION';
  }
  return secret;
}

/**
 * Sign a JWT seat token.
 */
export function signSeatToken(payload: SeatTokenPayload, expiresInSeconds?: number): string {
  return jwt.sign(
    { agentId: payload.agentId, tableId: payload.tableId },
    getSecret(),
    { expiresIn: expiresInSeconds ?? DEFAULT_EXPIRY_SECONDS },
  );
}

/**
 * Verify and decode a JWT seat token.
 * Returns the payload if valid, null if invalid or expired.
 */
export function verifySeatToken(token: string): SeatTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret()) as jwt.JwtPayload;
    if (typeof decoded['agentId'] !== 'string' || typeof decoded['tableId'] !== 'string') {
      return null;
    }
    return { agentId: decoded['agentId'], tableId: decoded['tableId'] };
  } catch {
    return null;
  }
}

/**
 * Refresh a seat token: verify the old one, issue a new one with fresh expiry.
 * Returns null if the old token is invalid.
 */
export function refreshSeatToken(oldToken: string, expiresInSeconds?: number): string | null {
  const payload = verifySeatToken(oldToken);
  if (!payload) {
    return null;
  }
  return signSeatToken(payload, expiresInSeconds);
}
