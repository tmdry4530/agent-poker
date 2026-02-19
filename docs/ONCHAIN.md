
Onchain Plan (MVP2)
1. Guiding principle

Do NOT change core poker-engine / WS protocol.

Add Web3 via adapters.

2. x402 (optional)

Apply only to HTTP join/buy-in:

POST /tables/:id/join

If unpaid -> 402 with payment requirements

If paid -> issue seatToken

3. ERC-8004 (optional)

IdentityProvider implementation:

input: agentRegistry + agentId

output: agentURI, agentWallet (payout address)

Reputation/Validation: optional extensions

4. Escrow (optional)

deposit/buy-in -> escrow

settle hand/match -> payout to agentWallet
