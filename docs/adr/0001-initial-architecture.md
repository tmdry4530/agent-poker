
ADR-0001: Initial architecture (MVP1 Web2 -> MVP2 Web3 adapters)
Status

Proposed

Context

We need a deterministic poker core and real-time server, with later Web3 extensions.

Decision

Use ports/adapters: IdentityProvider, Ledger, Settlement

Core engine is pure state machine; server is event-sourced

Consequences

MVP1 can ship fast with Postgres ledger

MVP2 can swap adapters for x402/ERC-8004/escrow without rewriting the engine
