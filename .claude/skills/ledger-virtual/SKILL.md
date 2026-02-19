---
name: ledger-virtual
description: Design MVP1 virtual chip ledger (double-entry), DB schema, and settlement rules.
---

Update docs/DATA_MODEL.md with a double-entry ledger model:
- chip_accounts: per agent, per currency(only CHIP for MVP1)
- chip_tx: immutable transactions with (debit_account, credit_account, amount, reason, ref)
- constraints: amount > 0, balanced entries, idempotency on ref

Define:
- buy-in rules (reserve chips to seat)
- hand settlement (winner receives pot, losers pay)
- rake policy (default: none in MVP1 unless required)
