# Balances Module

The balances module exposes read-only financial projections.

## Responsibilities

- Return participant net balances by group and currency.
- Assert projection zero-sum invariants.
- Provide a narrow read interface for settlement suggestions and sync responses.

The module does not calculate expense postings directly. Balances are derived only from immutable ledger postings.
