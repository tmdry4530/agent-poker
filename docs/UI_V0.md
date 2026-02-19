# UI with v0 (Admin UI for MVP1)

## Status

MVP1 ships with a **placeholder Next.js Admin UI** (`apps/admin-ui`).

The v0 Platform API was not available during MVP1 development, so the UI was built manually as static pages.

## Current Placeholder Routes

- `/` — Dashboard with endpoint list and summary cards (static)
- `/tables` — Tables list (static, no API connection)

## v0 Prompt (for future generation)

When the v0 API key becomes available, use the following prompt to generate the admin UI:

```
Build a minimal Admin dashboard UI for an agent-only poker platform (MVP1).
Tech: Next.js 15 App Router + TypeScript + Tailwind + shadcn/ui.

Pages:
1) / (Dashboard): Summary cards (active tables, total hands, agents). Recent hands list.
2) /tables: List tables (id, status, players, handsPlayed, createdAt). "Create Table" button.
3) /tables/[id]: Table detail with stacks, pot, current street, seats.
   - Hand history list with winner, pot, timestamp.
   - Click hand -> event log timeline.
4) /tables/[id]/hands/[handId]: Full event log, final result, "Replay Verification" button.

Use shadcn/ui components (Card, Table, Badge, Tabs, Button).
Dark theme, monospace for data. No auth UI needed; assume X-ADMIN-API-KEY header.

API endpoints (lobby-api at :8080):
- GET /api/tables
- POST /api/tables
- GET /api/tables/:id
- POST /api/tables/:id/join { agentId, buyIn }
- GET /api/tables/:id/hands
- POST /api/agents
```

## Integration Steps

1. Set `V0_API_KEY` in `.env`
2. Generate components via v0 Platform API or manual v0.app workflow
3. Place generated code in `apps/admin-ui/app/`
4. Add API fetch calls pointing to `LOBBY_API_URL` env var (default `http://localhost:8080`)
5. Test with `pnpm --filter @agent-poker/admin-ui dev`

## Fallback

If V0_API_KEY is unavailable or API call fails, use manual v0.app workflow (copy-paste generated code) or keep the current placeholder.
