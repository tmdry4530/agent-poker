---
name: ui-v0
description: Build MVP1 Admin UI using v0 (manual prompts or v0 Platform API), then integrate into apps/admin-ui.
---

Rules:
- MVP1 UI is minimal, dev/admin oriented only.
- Prefer v0 output (shadcn/ui + Tailwind + Next.js App Router).
- If V0_API_KEY exists, use tools/v0 generator to create files into tools/v0/output then integrate.
- If V0_API_KEY missing, generate v0 prompts and proceed with a placeholder admin UI so MVP1 doesn't block.
- Always document the chosen path in docs/WORKLOG.md and update docs/STATUS.md.
