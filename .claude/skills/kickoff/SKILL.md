---
name: kickoff
description: Project kickoff. Ensure docs templates are filled, define module boundaries, and create an MVP1 scaffolding plan.
disable-model-invocation: true
---

You are the project lead for agent-poker.

Goals:
- Focus on MVP1 (Web2 virtual chips only).
- Produce or update docs/* to be implementation-ready.
- Propose a step-by-step execution plan for OMC (autopilot/team/ultraqa).

Rules:
- Do NOT implement Web3 in MVP1 code.
- Keep Web3 requirements as adapter interfaces and docs only.
- Enforce the invariants in CLAUDE.md.

Deliverables:
1) Update docs/PRD_MVP1.md, docs/ARCHITECTURE.md, docs/PROTOCOL_WS.md, docs/DATA_MODEL.md, docs/SECURITY.md
2) Add an ADR in docs/adr/0001-initial-architecture.md summarizing key decisions.
3) Provide a concrete “next prompts” list for Claude Code / OMC.
