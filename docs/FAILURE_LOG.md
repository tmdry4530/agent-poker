# FAILURE LOG

> 실패 자체보다 "재발 방지"가 목적. 각 항목은 재현/원인/해결/방지 테스트까지.

## F-0001
- Date: 2026-02-19
- Summary: structuredClone not available in pure TypeScript engine
- Symptom: Runtime error "structuredClone is not defined" when running poker-engine tests
- Repro steps: Run `pnpm test` in packages/poker-engine
- Root cause: ES2022 lib target doesn't include structuredClone (Node 17+ runtime feature)
- Fix: Replaced `structuredClone(state)` with `JSON.parse(JSON.stringify(state))` for deep cloning
- Prevention (test/guardrail): Engine purity test ensures no external dependencies; document deep clone pattern
- Files changed: packages/poker-engine/src/engine.ts

## F-0002
- Date: 2026-02-19
- Summary: hand-history used wrong RNG implementation
- Symptom: Replay tests failed with different shuffle outcomes
- Repro steps: Run hand-history tests with LCG-based RNG
- Root cause: hand-history implemented its own LCG instead of importing poker-engine's mulberry32
- Fix: Imported `createSeededRng` from poker-engine, removed duplicate RNG code
- Prevention (test/guardrail): Replay determinism tests enforce same RNG across packages
- Files changed: packages/hand-history/src/replay.ts

## F-0003
- Date: 2026-02-19
- Summary: exactOptionalPropertyTypes violations in engine
- Symptom: TypeScript error "undefined not assignable to optional property"
- Repro steps: Build with exactOptionalPropertyTypes: true
- Root cause: Direct assignment of `undefined` to optional fields (e.g., `winnerIndex: undefined`)
- Fix: Used spread syntax `...(condition ? {field: value} : {})` instead
- Prevention (test/guardrail): Enable exactOptionalPropertyTypes in all packages
- Files changed: packages/poker-engine/src/engine.ts

## F-0004
- Date: 2026-02-19
- Summary: lobby-api cross-rootDir import error
- Symptom: TypeScript error "Cannot access game-server outside rootDir"
- Repro steps: Build lobby-api with direct import from game-server
- Root cause: TypeScript doesn't allow cross-package imports without workspace dependency
- Fix: Added `"game-server": "workspace:*"` to lobby-api package.json
- Prevention (test/guardrail): Monorepo lint rule to validate workspace dependencies
- Files changed: apps/lobby-api/package.json

## F-0005
- Date: 2026-02-19
- Summary: agent-sdk no test files warning
- Symptom: Vitest warning "No test files found"
- Repro steps: Run `pnpm test` in packages/agent-sdk
- Root cause: Package had no test files initially
- Fix: Added strategy.test.ts with 6 tests for CallingStation and RandomBot
- Prevention (test/guardrail): CI check for packages with zero tests
- Files changed: packages/agent-sdk/src/strategy.test.ts (new)

## F-0006
- Date: 2026-02-19
- Summary: MemoryHandHistoryStore didn't persist empty event arrays
- Symptom: Replay tests failed when retrieving hands with zero events
- Repro steps: Create hand, call getHandEvents before any events recorded
- Root cause: Guard condition `if (events.length > 0)` prevented storing empty arrays
- Fix: Removed guard, always store event array (even if empty)
- Prevention (test/guardrail): Test case for retrieving hands with zero events
- Files changed: packages/hand-history/src/store-memory.ts

## F-0007
- Date: 2026-02-19
- Summary: tsx couldn't resolve workspace packages
- Symptom: Error "Cannot find module 'poker-engine'" when running scripts/demo-20-hands.ts
- Repro steps: Run `tsx scripts/demo-20-hands.ts` from root
- Root cause: tsx module resolution doesn't follow pnpm workspace protocol by default
- Fix: Added "default" export condition to package.json exports + installed workspace deps in root
- Prevention (test/guardrail): Document tsx usage pattern for monorepo scripts
- Files changed: package.json (root), packages/*/package.json (exports)
