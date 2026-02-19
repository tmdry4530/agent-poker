
Data Model (MVP1 / Postgres)
1. agents

id (pk)

display_name

created_at

status (active/banned)

owner_id (optional, reserved for MVP2 & anti-sybil)

2. tables

id (pk)

variant (HU_LHE)

status (open/running/closed)

created_at

3. seats

table_id, seat_no

agent_id

buy_in_amount

status (seated/left)

4. hands

id (pk)

table_id

hand_no

started_at, ended_at

result_summary (json)

5. hand_events (append-only)

id (pk, monotonic)

hand_id

seq (monotonic per hand)

type

payload (jsonb)

created_at
Indexes:

(hand_id, seq)

6. chips ledger (double-entry)
chip_accounts

id (pk)

agent_id

currency = 'CHIP'

balance (bigint)

updated_at

chip_tx (immutable)

id (pk)

ref (unique) # idempotency key

debit_account_id

credit_account_id

amount (bigint, >0)

reason (enum: BUYIN, POT_TRANSFER, REFUND, ADMIN_ADJUST)

created_at
