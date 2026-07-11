# SplitSaathi Test Plan Notes

Source of truth: `technical-architecture-plan.md` section 4.4.

This file tracks required testing coverage against the current repository. It is a gap-analysis document, not a replacement for test code.

## Required Tests From Architecture Section 4.4

Unit tests:

- Split strategies.
- Rounding allocator property tests.
- Settlement optimizer.
- Settlement state machine transitions.
- Authorization policy.
- UPI URI builder.

Integration tests:

- Event append with optimistic concurrency.
- Zero-sum posting assertion.
- Expense create/edit/void projection correctness.
- Settlement proof -> confirmation -> ledger posting.
- Import job -> ledger events.
- Projection rebuild from empty database.

Contract tests:

- `OtpProviderPort`
- `OcrProviderPort`
- `PaymentGatewayPort`
- `NotificationDeliveryPort`

Concurrency tests:

- Two users edit same expense version.
- Duplicate idempotency key with same payload.
- Duplicate idempotency key with different payload.
- Duplicate UPI webhook/provider reference.

Migration tests:

- Run all TypeORM migrations on empty DB.
- Run forward migration on seeded previous-schema DB.
- Validate DB functions and indexes exist.

## Current Implemented Test Coverage

| Required area | Current coverage | Gap |
|---|---|---|
| Split strategies | `packages/domain/src/split-strategies.spec.ts` covers equal, exact mismatch rejection, and weighted shares. | Percent and itemized strategies are not implemented or tested. |
| Rounding allocator property tests | `packages/domain/src/rounding.spec.ts` uses `fast-check` to assert exact integer allocation and stable output. | Needs negative totals, rational denominators beyond simple cases, and residual visibility cases if persisted. |
| Settlement optimizer | `packages/domain/src/settlement-optimizer.spec.ts` covers a basic greedy debtor-to-creditor suggestion. | Needs multi-currency, zero balances, unbalanced input rejection/handling, trust boundaries, and exact optimizer tests once implemented. |
| Settlement state machine transitions | `packages/domain/src/settlement-state-machine.spec.ts` covers happy path, exception events, explicit allowed transition matrix, invalid transition rejection, and terminal-state immutability. `apps/api/test/settlements/settlement-flow.spec.ts` verifies invalid command-level transitions, Razorpay-style gateway auto-match, idempotent duplicate callback replay, and duplicate UTR detection. | Needs live PSP callback verification once credentials exist. |
| Authorization policy | `packages/domain/src/authorization-policy.spec.ts` covers owner archive permission and viewer denial. | Needs complete role/permission matrix and sensitive action policy cases. |
| UPI URI builder | `packages/domain/src/upi-uri.spec.ts` covers INR URI amount/reference, encoded names/notes/references, non-INR rejection, positive integer amounts, and invalid VPAs. | Needs PSP-specific URI parameter compatibility tests once a PSP is selected. |
| Zero-sum posting assertion | `packages/domain/src/ledger.spec.ts` covers balanced and unbalanced posting sets. API event append calls `BalancedPostingSet.create`; Postgres e2e verifies settlement postings through the DB adapter and directly rejects an unbalanced manual `ledger_postings` transaction through the database constraint trigger. | Needs future seeded-previous-schema migration coverage as migrations evolve. |
| Idempotency scope/retry behavior | `apps/api/test/ledger/event-store.spec.ts` covers same-key/same-payload replay, same-key/different-payload conflict, and safe key reuse across actors and aggregate/command families in the in-memory adapter. Offline batch tests cover duplicate command replay. | Needs Postgres-specific duplicate/conflict matrix once default DB test helpers exist. |
| API auth endpoints | `apps/api/test/auth.e2e-spec.ts` covers OTP start/verify, refresh rotation, incorrect OTP attempts, expired challenge handling, and invalid refresh tokens. `app-postgres.e2e-spec.ts` covers OTP against migrated Postgres. | Needs rate-limit and device metadata cases. |
| API groups endpoints | `apps/api/test/groups.e2e-spec.ts` covers group creation, invite creation, list/detail, participant add, role change, archive, lock-exit, and the current obligation-transfer manual-review hook. `app-postgres.e2e-spec.ts` covers group creation against migrated Postgres. | Needs broader permission-denial cases. |
| API financial routes | `apps/api/test/financial-routes.e2e-spec.ts` covers route-level expense create/revise/list/history/void, balance, settlement create/open/proof/confirm/reverse/get/list, activity, sync, receipt upload/draft/OCR/posting, capture jobs, recurring/reminder due list, Splitwise import, bank CSV import, Setu AA transaction import through fake provider, CSV/PDF exports, offline batch, FX conversion, missing idempotency, and invalid UPI validation paths with the in-memory adapter. `apps/api/test/expenses/expense-flow.spec.ts` covers stale concurrent expense revision rejection. | Needs broader cross-user permission-denial cases. |
| OpenAPI/schema compatibility | `apps/api/test/openapi.spec.ts` generates a Swagger document from a controller-only test module and asserts core Phase 1 paths. | Needs generated client/schema diffing once contracts are complete. |
| Postgres AppModule e2e | `apps/api/test/app-postgres.e2e-spec.ts` is opt-in via `RUN_POSTGRES_E2E=true` and covers OTP -> group -> expense -> restart projection hydration -> UPI proof -> confirmation -> balances -> activity against migrated Postgres plus direct DB trigger rejection of unbalanced postings. | Not part of default `npm test`; requires a live test DB and migration run. |
| Provider ports | `apps/api/test/providers/provider-contracts.spec.ts` covers dev OTP, Twilio Verify, dev notifications, Expo Push, UPI intent, manual gateway, Razorpay webhook normalization/signature rejection, no-op OCR, Tesseract line parsing, local object storage, S3-compatible storage, and Setu AA HTTP normalization through fake transports. | Needs live-provider contract runs with real Twilio/Razorpay/Expo/S3/Setu credentials and device tokens. |
| Bank import and exports | `apps/api/test/imports-exports/offline-import-export.spec.ts` covers Splitwise CSV import/commit, bank debit CSV import, Tally CSV, PDF statement, and data-portability JSON. `financial-routes.e2e-spec.ts` covers route-level bank CSV and Setu AA import paths. | Needs real AA consent callback flow and broader bank statement formats. |
| Observability | `financial-routes.e2e-spec.ts` and OpenAPI bootstrapping exercise the API module graph; health and metrics endpoints are wired in `ObservabilityModule`. | Needs production log sink/error tracking integration and metrics scraping in deployment. |
| Mobile utilities and offline queue | `apps/mobile/__tests__/money.test.ts` covers amount parsing/formatting. `apps/mobile/__tests__/outbox.test.ts` covers enqueue, backend `results`-based flushes, rejected/conflict failures, and network-failure retry state. `apps/mobile/__tests__/status-pill.test.tsx` covers settlement status presentation copy and semantic colors through a pure helper. | Needs rendered component, API client, token refresh, and visual/accessibility tests; local RN/Jest preset resolution currently blocks renderer-based component tests. |
| Mobile config and fonts | `npx tsc -p apps/mobile/tsconfig.json --noEmit` validates QR, push-registration, SecureStore, API, and screen typing. `npx expo config --json` validates Expo config/plugins. | Device E2E, visual screenshots, real UPI handoff, and push delivery remain blocked by missing Maestro/ADB/device setup. |

## Missing Required Test Families

Configured tests now exist for the core API endpoints from architecture section 5.4 and for TypeScript-discovered API specs under `apps/api/test/**/*.spec.ts`. Remaining missing or incomplete families:

- Live production provider adapter tests using real test credentials/device tokens.
- Seeded previous-schema migration tests once a second migration exists.
- Rendered mobile UI flows and device/simulator E2E.
- Mobile accessibility and visual design-token compliance.

## Verification Attempt

Attempted command:

```powershell
npm test -- --runInBand
```

Observed result:

- Passed.
- `@splitsaathi/config`, `@splitsaathi/contracts`, and `@splitsaathi/db` pass with no tests because their scripts use `--passWithNoTests`.
- `@splitsaathi/domain` passes: 7 suites, 48 tests.
- `@splitsaathi/api` passes configured e2e/service tests; the opt-in Postgres e2e is skipped unless `RUN_POSTGRES_E2E=true`.
- `@splitsaathi/mobile` passes money, offline outbox, and status-presentation tests: 3 suites, 8 tests.

Additional verification:

- `npm run build` passes.
- `npx tsc -p apps/mobile/tsconfig.json --noEmit` passes.
- `npx expo config --json` passes after repairing the Expo CLI dependency tree.
- `npm run migration:run` was run successfully against a disposable PostgreSQL 18 database on port `55435`.
- `RUN_POSTGRES_E2E=true npx jest apps/api/test/app-postgres.e2e-spec.ts --runInBand --forceExit --config apps/api/jest.config.cjs` previously passed after migrations, including restart projection hydration and direct DB ledger trigger rejection. In this run, a fresh disposable-cluster retry timed out before producing Jest output; the temp cluster was stopped and removed.
- `npm run build -w @splitsaathi/api` and focused provider/financial route tests pass after local object-storage wiring.
- `npm run test -w @splitsaathi/mobile -- --runInBand` and `npx tsc -p apps/mobile/tsconfig.json --noEmit` pass after offline outbox tests.
- `npm run test -w @splitsaathi/domain -- --runInBand` passes after UPI URI edge cases and settlement terminal-state matrix coverage.
- `npm run test -w @splitsaathi/api -- apps/api/test/settlements/settlement-flow.spec.ts apps/api/test/imports-exports/offline-import-export.spec.ts --runInBand` passes after command-level settlement prevalidation and backend-compatible offline batch handling.
- `npm test -w @splitsaathi/api -- --runInBand test/providers/provider-contracts.spec.ts test/financial-routes.e2e-spec.ts test/settlements/settlement-flow.spec.ts` passes after Twilio/Razorpay/Expo/Tesseract/S3/Setu adapter wiring and gateway callback idempotency hardening.

## Suggested Test Sequence

1. Keep domain unit tests fast and framework-free.
2. Add package-level contract tests for DTO schemas before API controllers consume them.
3. Keep API financial specs under Jest discovery and add regression tests beside the owning service/controller when command contracts change.
4. Expand `packages/testing` fixtures as new integration families need shared setup.
5. Add event store/idempotency integration tests before exposing expense or settlement routes publicly.
6. Add migration tests with a disposable PostgreSQL database after migration files and data-source ownership are aligned.
7. Keep endpoint tests aligned with each section 5.4 endpoint as controllers change.
8. Add mobile command queue tests before enabling offline create/proof flows.
9. Add end-to-end settlement tests only after UPI intent, proof, confirmation, and ledger posting are wired.

## Script Suggestions

These are suggestions only; no package scripts were changed in this pass.

- `test:domain`: run `@splitsaathi/domain` tests directly.
- `test:contracts`: run schema/compatibility tests for `@splitsaathi/contracts`.
- `test:integration`: keep for API integration once `@splitsaathi/api` exists.
- `test:migrations`: run TypeORM migration tests once `packages/db` exists.
- `test:e2e:api`: run endpoint-level tests against a test API instance.
- `test:api:services`: run `apps/api/test/**/*.spec.ts` if those are intended application-service tests.
- `typecheck`: run TypeScript across all packages/apps independent of emit.
