# Receipts Capture Module

Owns attachment metadata, local object persistence for uploaded bytes, receipt drafts, and converting a reviewed draft into an expense command.

Does not own OCR accuracy, cloud object-storage vendor policy, or financial ledger posting. OCR is Phase 2, production S3/GCS/R2 credentials require a selected vendor adapter, and expenses are posted through the Expenses module.
