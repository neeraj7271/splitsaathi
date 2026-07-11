# Consents Module

Owns explicit user consent records for optional contacts, receipt uploads, UPI proof storage, and notifications.

Does not own contact ingestion, bank linking, or regulatory legal policy. Consent records are stored through the TypeORM `ConsentRecordEntity`; isolated tests use the shared in-memory repository test double.
