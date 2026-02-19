---
name: council
description: Run multi-AI cross-validation using OMC MCP tools (ask_codex / ask_gemini), summarize, and record results.
---

Goal:
- Use `ask_codex` for architecture validation / code review (roles: architect, code-reviewer, security-reviewer, tdd-guide).
- Use `ask_gemini` for UI/UX and documentation consistency (roles: designer, writer).

Process:
1) Start both consultations in parallel (background if supported).
2) Await results before finalizing decisions that depend on them.
3) Summarize and record:
   - docs/WORKLOG.md: what was asked, conclusion, what we applied
   - docs/STATUS.md: impact on current milestone
