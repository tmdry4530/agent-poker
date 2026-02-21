/**
 * Zod schemas for lobby-api request body validation.
 */

import { z } from 'zod';

export const CreateTableBodySchema = z.object({
  variant: z.enum(['LIMIT', 'NL', 'PL']).optional(),
  maxSeats: z.number().int().min(2).max(6).optional(),
  smallBlind: z.number().int().positive().optional(),
  bigBlind: z.number().int().positive().optional(),
  ante: z.number().int().min(0).optional(),
});

export const JoinTableBodySchema = z.object({
  agentId: z.string().min(1).max(128),
  buyIn: z.number().int().positive().max(1_000_000),
});

export const MatchmakingQueueBodySchema = z.object({
  agentId: z.string().min(1).max(128),
  variant: z.enum(['LIMIT', 'NL', 'PL']).optional(),
  blindLevel: z.enum(['micro', 'low', 'mid', 'high']).optional(),
  maxSeats: z.number().int().min(2).max(6).optional(),
});

export const CreateAgentBodySchema = z.object({
  displayName: z.string().min(1).max(128),
});

/**
 * Format zod errors into a structured error response.
 */
export function formatZodError(error: z.ZodError): { error: string; details: z.ZodIssue[] } {
  return {
    error: 'VALIDATION_ERROR',
    details: error.issues,
  };
}
