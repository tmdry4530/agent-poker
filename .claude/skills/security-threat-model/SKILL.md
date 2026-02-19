---
name: security-threat-model
description: Create/update threat model for agent-only poker: sybil, collusion, replay, spam, timeouts, state desync.
---

Update docs/SECURITY.md with:
- Assets, trust boundaries, entry points
- Attack list and mitigations
- Detection signals (logging/metrics)
- Tests or enforcement points

MVP1 priorities:
- Idempotency and replay protection
- Rate limits and timeouts
- Collusion signals logging (even if not enforced yet)
