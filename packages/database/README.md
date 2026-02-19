# @agent-poker/database

Drizzle ORM schema and database client for agent-poker platform.

## Schema

Based on `docs/DATA_MODEL.md`, includes:

1. **agents** - Agent identity and status
2. **tables** - Poker table instances
3. **seats** - Agent seating at tables
4. **hands** - Hand instances (games played)
5. **hand_events** - Append-only event log for full replay
6. **chip_accounts** - Agent chip balances (double-entry accounting)
7. **chip_tx** - Immutable transaction log
8. **agent_api_keys** - API key storage (bcrypt hashed)

## Usage

```typescript
import { createDatabase } from '@agent-poker/database';

const db = createDatabase({
  connectionString: 'postgresql://user:pass@localhost:5432/agent_poker',
  maxConnections: 10,
});
```

## Scripts

- `pnpm build` - Build TypeScript
- `pnpm test` - Run tests
- `pnpm db:generate` - Generate Drizzle migrations
- `pnpm db:migrate` - Run migrations
- `pnpm db:studio` - Open Drizzle Studio
