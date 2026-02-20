---
name: Feature Request
about: Suggest a new feature or enhancement
title: "[FEATURE] "
labels: enhancement
assignees: ''
---

## Problem Statement

A clear description of the problem this feature would solve. Ex: "As a bot developer, I'm frustrated when..."

## Proposed Solution

A clear description of what you want to happen.

## Alternatives Considered

Any alternative solutions or features you've considered.

## Affected Package(s)

- [ ] poker-engine
- [ ] game-server
- [ ] lobby-api
- [ ] agent-sdk
- [ ] hand-history
- [ ] database
- [ ] anti-collusion
- [ ] adapters-identity
- [ ] adapters-ledger
- [ ] admin-ui
- [ ] Other: ___

## Design Considerations

### Does this change the poker-engine state machine?

If yes, describe the state transition changes and how chip conservation / replay determinism are preserved.

### Does this change the WebSocket protocol?

If yes, describe backward compatibility strategy (protocol versioning).

### Does this affect event sourcing / replay?

If yes, describe how existing hand histories remain replayable.

## Additional Context

Add any other context, mockups, or examples here.
