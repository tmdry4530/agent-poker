# Architecture

## 1. Components
- apps/lobby-api (HTTP)
- apps/game-server (WebSocket, table actors)
- packages/poker-engine (pure deterministic state machine)
- packages/hand-history (event log format + replay verifier)
- packages/agent-sdk (client library for agents)
- packages/adapters-* (Identity/Ledger/Settlement implementations)
- contracts/ (MVP2 only, optional)

## 2. Ports & Adapters
Interfaces (ports):
- IdentityProvider: authenticate agent, map to agentId/ownerId
- Ledger: reserve chips, transfer chips, settle pots
- Settlement: final payout mechanism (MVP1 internal, MVP2 on-chain)

Adapters:
- MVP1: PostgresIdentityProvider, PostgresLedger, InternalSettlement
- MVP2: ERC8004IdentityProvider, EscrowLedger, OnchainSettlement, x402JoinPayment

## 3. Table as an Actor
- One table = one serialized execution loop
- Inputs: join/leave/action/timeout/reconnect
- Outputs: events + state updates
- Persistence: append-only hand events

## 4. Event Sourcing & Replay
- Every state transition emits events
- Persist events in stable order
- Replay tool reconstructs final state and validates invariants

## 5. Future-proofing
- Optional hash-chain for events (later proofs)
- Protocol versioning
