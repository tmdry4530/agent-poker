/**
 * Zod schemas for auth route request validation.
 */

import { z } from 'zod';

export const RegisterBodySchema = z.object({
  displayName: z.string().min(1).max(128),
});

export const LoginBodySchema = z.object({
  agent_id: z.string().min(1),
  secret: z.string().min(1),
  client_type: z.enum(['agent', 'human']).optional().default('agent'),
});
