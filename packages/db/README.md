# @splitsaathi/db

This package owns the PostgreSQL and TypeORM persistence model for SplitSaathi.

## Boundaries

- TypeORM entities and migrations live here.
- Domain objects, command handlers, split math, settlement state machines, and API controllers do not live here.
- Financial source of truth is `event_store` plus `ledger_postings`; projection tables are rebuildable read models.
- Posted financial history is append-only. Corrections should be represented by new events and compensating postings, not destructive updates.
- API and worker packages should import `dbEntities`, `AppDataSource`, or individual entity classes from this package instead of duplicating table definitions.

## Schema Scope

The initial migration mirrors architecture Section 3.5 and includes:

- identity, OTP, sessions, devices, consent, contacts
- groups, participants, subgroups, households, couples, memberships, roles, invites
- immutable event store, balanced ledger postings, idempotency, projection checkpoints
- expense projections, payers, shares, line items, bill adjustments, rounding residuals, version history, comments, evidence
- recurring expenses, currencies, FX snapshots
- settlement intents, settlement timeline events, UPI app opens, UPI references, proofs, confirmations
- attachments, receipt drafts, OCR results, capture jobs
- notifications, deliveries, reminder schedules
- import/export jobs, external entity mapping, statements
- offline command queue, sync projection changes, settlement suggestions, audit log entries

## Migration Notes

`1783641600000-InitialLogicalModel.ts` creates PostgreSQL-specific objects that should stay in migrations rather than decorators:

- `pgcrypto` for database-side UUID defaults
- deferred `ledger_postings_balance_check` trigger for zero-sum postings per event/currency
- `search_projection.search_vector` and its GIN index
- partial unique indexes for nullable idempotency and provider/reference fields

Run migrations through the API package once it wires the data source, or directly during development:

```sh
npm run migration:run -w @splitsaathi/db
```
