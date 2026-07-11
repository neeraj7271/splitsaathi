# Offline Sync Module

The offline sync module accepts ordered mobile command batches and returns accepted events plus replayable server events.

## Contract

- Each command carries `clientMutationId` and `idempotencyKey`.
- Commands are executed in the order received.
- Idempotent retries return the prior event result.
- Optimistic concurrency and idempotency conflicts are reported per command.
- Clients can fetch events after a global cursor.

This is a command queue bridge. It does not make local mobile state authoritative for money.
