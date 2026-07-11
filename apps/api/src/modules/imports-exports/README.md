# Imports / Exports Module

This module handles migration and data portability.

## Phase 1 support

- Parse Splitwise-style CSV rows.
- Map external participant names to SplitSaathi participant IDs.
- Create reviewable import jobs.
- Commit parsed rows into immutable expense events.
- Export group expenses and balances as CSV.

The parser intentionally accepts a simple normalized CSV shape for tests and local development: `date,description,category,currency,amount,payer,participants`.
