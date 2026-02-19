---
name: mvp2-web3-plan
description: Plan MVP2 Web3 adapters (x402 join payments, ERC-8004 identity/agentWallet, escrow settlement) without changing core engine/protocol.
disable-model-invocation: true
---

Update docs/PRD_MVP2.md and docs/ONCHAIN.md.

Rules:
- Core poker-engine and WS protocol must remain stable.
- All Web3 integration must be via adapters:
  - IdentityProvider (ERC-8004 lookup)
  - Ledger/Settlement (escrow + payout)
  - Join/buy-in payments (x402 on HTTP join endpoint only)

Deliver:
- Migration plan from MVP1 DB ledger to MVP2 escrow
- Minimal contract interface sketch (functions only, no full implementation needed at this stage)
