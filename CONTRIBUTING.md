# Contributing to agent-poker

Thank you for your interest in contributing to agent-poker. This guide covers setup, coding standards, and the PR process.

## Development Setup

### Prerequisites

- Node.js >= 20
- pnpm >= 9 (`corepack enable && corepack prepare pnpm@9.15.4 --activate`)
- Docker and Docker Compose v2 (for integration tests)
- Git

### Getting Started

```bash
# Clone the repository
git clone https://github.com/chamdom/agent-poker.git
cd agent-poker

# Install dependencies
pnpm install

# Build all packages
pnpm -r build

# Run all tests
pnpm -r test

# Start development servers
pnpm dev
# -> Lobby API :8080, Game Server :8081, Admin UI :3000
```

### Project Structure

```
agent-poker/
├── apps/
│   ├── lobby-api/          # Fastify HTTP server
│   ├── game-server/        # WebSocket game server
│   └── admin-ui/           # Next.js 15 admin dashboard
├── packages/
│   ├── poker-engine/       # Pure state machine (no side effects)
│   ├── hand-history/       # Event log + hash chain + replay
│   ├── agent-sdk/          # Bot SDK + built-in strategies
│   ├── database/           # Drizzle ORM schema + migrations
│   ├── anti-collusion/     # Collusion detection algorithms
│   ├── adapters-identity/  # Authentication adapters
│   └── adapters-ledger/    # Chip ledger adapters
├── scripts/                # Demo and utility scripts
├── docker/                 # Dockerfiles
└── monitoring/             # Prometheus + Grafana config
```

### Workspace Commands

```bash
pnpm -r build       # Build all packages
pnpm -r test        # Run all tests
pnpm -r lint        # Lint all packages
pnpm -r typecheck   # TypeScript type checking
pnpm dev            # Start all dev servers
pnpm demo           # Run 20-hand demo
```

### Running a Single Package

```bash
pnpm --filter @agent-poker/poker-engine test
pnpm --filter @agent-poker/lobby-api dev
pnpm --filter @agent-poker/admin-ui build
```

## Coding Standards

### TypeScript

- **Strict mode**: `strict: true` in all packages
- **Target**: ES2022
- **Module**: ES2022 with Bundler resolution
- **Additional strict flags**: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- No `any` types without explicit justification
- Prefer `interface` over `type` for object shapes
- Use `readonly` for immutable data

### Poker Engine Invariants

The poker-engine is a **pure state machine**. It must NEVER:
- Access network, database, filesystem, or timers directly
- Use `Math.random()` (use the injected RNG)
- Mutate input state (always return new state)

The engine signature is:
```
(state, action, rng?) -> (newState, events)
```

### Testing

- **Framework**: Vitest
- All state transitions must have tests including invalid-input cases
- Chip conservation, turn order, and betting rules must be enforced via invariant tests
- Hand history must be replayable from event logs alone

```bash
# Run tests with watch mode
pnpm --filter @agent-poker/poker-engine test -- --watch

# Run a specific test file
pnpm --filter @agent-poker/poker-engine test -- src/__tests__/specific.test.ts
```

### Code Style

- Use named exports (no default exports)
- Prefer `const` over `let`; never use `var`
- Error handling: use structured `PokerError` types, not string throws
- Naming: camelCase for variables/functions, PascalCase for types/interfaces/classes
- File naming: kebab-case (`my-module.ts`)

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/).

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting (no code change) |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `chore` | Build process, tooling, dependencies |
| `ci` | CI/CD changes |

### Scopes

Use the package name without the `@agent-poker/` prefix:

- `poker-engine`, `hand-history`, `agent-sdk`, `database`
- `anti-collusion`, `adapters-identity`, `adapters-ledger`
- `lobby-api`, `game-server`, `admin-ui`
- `docker`, `ci`, `docs`

### Examples

```
feat(poker-engine): add pot-limit betting mode
fix(game-server): prevent duplicate HELLO message processing
test(agent-sdk): add reconnection edge case tests
docs(api): update WebSocket protocol specification
chore(ci): upgrade Node.js to v22 in CI workflow
```

## Pull Request Process

1. **Create a branch** from `master`:
   ```bash
   git checkout -b feat/my-feature
   ```

2. **Make changes** following the coding standards above.

3. **Verify locally**:
   ```bash
   pnpm -r build      # Must pass
   pnpm -r test       # Must pass
   pnpm -r lint       # Must pass
   pnpm -r typecheck  # Must pass
   ```

4. **Commit** using conventional commit format.

5. **Push and create a PR** against `master`.

6. **PR requirements**:
   - CI must pass (typecheck, lint, test, build, demo)
   - At least one approving review
   - PR description must explain what and why
   - Breaking changes must be called out in the PR description

### PR Template

```markdown
## What

Brief description of the change.

## Why

Motivation and context.

## How

Implementation approach (if non-obvious).

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests (if applicable)
- [ ] Manual verification steps

## Breaking Changes

None / Description of breaking changes
```

## Architecture Decisions

When proposing significant changes, consider these design principles:

1. **poker-engine is a pure state machine** -- no side effects allowed
2. **Event sourcing** -- all hands must be replayable from event logs
3. **Protocol versioning** -- WebSocket messages include `protocolVersion`
4. **Idempotency** -- actions use `requestId` for dedup, `seq` for replay protection
5. **Port-adapter pattern** -- external dependencies hidden behind interfaces

## Getting Help

- Check existing [documentation](docs/) for architecture and API details
- Open an issue for bugs or feature requests
- Use the issue templates for structured reports
