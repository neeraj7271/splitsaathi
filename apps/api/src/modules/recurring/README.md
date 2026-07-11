# Recurring Module

The recurring module stores immutable schedule events and generates ordinary expense events for due occurrences.

## Supported cadence

- Weekly
- Monthly

Generated expenses are not special ledger rows. They are normal expense events linked back to the recurring schedule by a `RecurringExpenseGenerated` event.
