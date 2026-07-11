# Ledger Module

The ledger module is the source of truth for financial state.

## Responsibilities

- Append immutable domain events.
- Enforce optimistic concurrency per aggregate stream.
- Deduplicate retryable commands with idempotency records.
- Validate zero-sum balanced postings before storing monetary events.
- Replay events from a global cursor.
- Rebuild projections from the event store.

## Notes

The in-memory store is a testable application adapter. A TypeORM/PostgreSQL adapter should preserve the same public behavior: append and idempotency must be transactional, global positions must be monotonic, and postings must be written atomically with their source event.
