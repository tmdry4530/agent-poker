
Workflow — Claude Code + Oh My ClaudeCode (OMC)
0) Before you start

Ensure Claude Code is installed

Install OMC plugin (once) using its setup skill

Enable Agent Teams via env in .claude/settings.json (already set)

1) Suggested execution order

/kickoff

OMC autopilot: scaffold monorepo + minimal playable match

/engine-invariants (lock rules via tests)

/ws-protocol (finalize WS protocol)

/event-log-replay (event sourcing + replay)

/ledger-virtual (chip ledger correctness)

/security-threat-model (hardening)

(Later) /mvp2-web3-plan

2) OMC modes to use

autopilot: multi-step implementation loops

team: split engine/protocol/storage tasks

ultraqa: test-fail-fix loops

3) Rules of engagement

Keep MVP1 Web2 only.

Do not introduce Web3 libraries until MVP2.
