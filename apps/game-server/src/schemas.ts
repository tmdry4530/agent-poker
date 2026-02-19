/**
 * Zod schemas for WS message validation.
 */

import { z } from 'zod';

// ── Base envelope ───────────────────────────────────────────

export const WsEnvelopeSchema = z.object({
  protocolVersion: z.number().int(),
  type: z.string(),
  requestId: z.string().optional(),
  tableId: z.string().optional(),
  seatToken: z.string().optional(),
  seq: z.number().int().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

// ── Client messages ─────────────────────────────────────────

export const HelloPayloadSchema = z.object({
  agentId: z.string().min(1).max(128),
  seatToken: z.string().min(1).max(2048),
  lastSeenEventId: z.number().int().nonnegative().optional(),
});

export const ActionPayloadSchema = z.object({
  action: z.enum(['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE']),
  amount: z.number().int().nonnegative().optional(),
});

export const HelloMessageSchema = WsEnvelopeSchema.extend({
  type: z.literal('HELLO'),
  tableId: z.string().min(1),
  payload: HelloPayloadSchema,
});

export const ActionMessageSchema = WsEnvelopeSchema.extend({
  type: z.literal('ACTION'),
  requestId: z.string().min(1),
  payload: ActionPayloadSchema,
});

export const PingMessageSchema = WsEnvelopeSchema.extend({
  type: z.literal('PING'),
});

export const RefreshTokenMessageSchema = WsEnvelopeSchema.extend({
  type: z.literal('REFRESH_TOKEN'),
});
