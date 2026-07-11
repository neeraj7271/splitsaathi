# Activity Module

Owns read-only activity feed routes backed by rebuildable ledger projections.

Does not own financial writes, notification delivery, or durable event storage. Those remain in ledger, notifications, and the future PostgreSQL event-store adapter.
