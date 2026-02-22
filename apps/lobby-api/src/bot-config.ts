/**
 * Bot fill configuration — all values controlled via environment variables.
 *
 * BOT_FILL_ENABLED      — Enable bot fill when table isn't full (default: false)
 * BOT_FILL_TIMEOUT_MS   — Wait time before filling with bots (default: 180000 = 3 min)
 * BOT_FILL_MODEL        — Claude model for AI decisions (default: claude-haiku-4-5-20251001)
 * BOT_DEFAULT_BUY_IN    — Default buy-in amount for bots (default: 1000)
 * BOT_WS_URL            — Game server WebSocket URL (default: ws://localhost:8081)
 * ANTHROPIC_API_KEY     — Anthropic API key for Claude (required for AI bots)
 */

export const BOT_CONFIG = {
  enabled: process.env.BOT_FILL_ENABLED === 'true',
  timeoutMs: parseInt(process.env.BOT_FILL_TIMEOUT_MS || '180000', 10),
  model: process.env.BOT_FILL_MODEL || 'claude-haiku-4-5-20251001',
  defaultBuyIn: parseInt(process.env.BOT_DEFAULT_BUY_IN || '1000', 10),
  wsUrl: process.env.BOT_WS_URL || 'ws://localhost:8081',
  apiKey: process.env.ANTHROPIC_API_KEY || '',
} as const;
