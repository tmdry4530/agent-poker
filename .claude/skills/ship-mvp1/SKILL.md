---
name: ship-mvp1
description: End-to-end delivery driver: keep going until MVP1 DoD is met, with progress/failure logs maintained.
---

Non-negotiable:
- Do not stop before MVP1_CHECKLIST.md must-have is satisfied.
- Keep docs/STATUS.md, docs/WORKLOG.md, docs/FAILURE_LOG.md updated continuously.
- Use Team mode to parallelize.
- Use council (ask_codex/ask_gemini) when uncertain; otherwise keep moving.

Deliver:
- runnable local stack (docker compose up + pnpm dev)
- tests passing
- 2 sample bots playing 20 hands deterministically with replay verification
