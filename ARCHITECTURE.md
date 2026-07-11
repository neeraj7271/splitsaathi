# SplitSaathi Architecture

This file summarizes the target architecture from `technical-architecture-plan.md` and the current repository state. It is intentionally documentation-only and does not replace the detailed plan.

## Current State

Implemented:

- npm workspace root.
- `packages/config`: Zod environment schema and `loadEnv`.
- `packages/contracts`: shared request schemas, enums, money DTOs, and INR formatting helper.
- `packages/domain`: pure TypeScript domain primitives for money, rounding, split strategies, settlement optimization, settlement lifecycle, UPI URI generation, authorization policy, and balanced posting validation.
- `packages/db`: TypeORM logical schema, package data source, and initial migration.
- `packages/testing`: deterministic factories and ledger assertion helpers for cross-package tests.
- `apps/api`: NestJS API with Swagger setup, auth/users/consents/groups/notifications routes, TypeORM config, and financial ledger, expenses, balances, settlements, receipts, recurring, imports/exports, activity, and offline sync routes.
- `apps/mobile`: Expo app with design tokens, shared components, Phase 1 screens, API client, token store, offline outbox, and money utility tests.
- Domain, API, DB package, and mobile configured tests pass.
- `AppModule` wires financial events to a PostgreSQL event-store adapter; isolated financial tests keep the in-memory adapter.
- The initial migration and a Postgres-backed OTP -> group -> expense -> app restart/projection hydration -> UPI proof -> confirmation flow were verified against a disposable PostgreSQL 18 cluster.
- Receipt attachments persist uploaded bytes through an `ObjectStoragePort`; the current concrete adapter is local filesystem storage keyed by content hash metadata.

Not yet present:

- Device/simulator-verified mobile flows
- Live production payment/OTP/push/object-storage/AA credentials and live-provider validation
- Seeded previous-schema migration tests
- Rendered mobile visual/component coverage and device E2E tests

## Current Provider Adapters

| Port/area | Concrete adapters | Production switch |
|---|---|---|
| OTP | Development OTP, Twilio Verify REST adapter | `OTP_PROVIDER_DRIVER=twilio_verify` plus Twilio Verify env vars. |
| UPI/payment callbacks | Payer-initiated UPI URI/QR, manual gateway, Razorpay webhook verifier/normalizer | `PAYMENT_GATEWAY_DRIVER=razorpay` plus Razorpay keys and webhook secret. |
| Push notifications | Development logger, Expo Push API provider, device-installation registration | `NOTIFICATION_PROVIDER_DRIVER=expo`; real delivery needs Expo push tokens from a device/simulator. |
| OCR | No-op OCR for deterministic tests, local Tesseract OCR parser/provider | `OCR_PROVIDER_DRIVER=tesseract`. |
| Object storage | Local filesystem, S3-compatible/MinIO provider | `OBJECT_STORAGE_DRIVER=s3` plus S3/MinIO credentials; local is rejected in production. |
| Bank imports | Bank CSV parser, Setu Account Aggregator-shaped consent/transaction adapter | `BANK_IMPORT_PROVIDER_DRIVER=setu_aa`; live use requires Setu onboarding credentials. |
| FX | Frankfurter HTTP provider, static fixture provider | `FX_PROVIDER_DRIVER=frankfurter` for live rates or `static` for deterministic tests. |
| Observability | Request IDs, structured exception responses, health/ready probes, Prometheus-style text metrics | `METRICS_ENABLED=true`. |

## Target Monorepo Shape

```text
apps/
  api/                         NestJS API, controllers, guards, providers, OpenAPI
  mobile/                      Expo React Native app
packages/
  config/                      Typed env schema and feature flags
  contracts/                   DTOs, shared enums, schemas, generated client types
  domain/                      Pure domain models, value objects, policies
  db/                          TypeORM entities, migrations, data source, fixtures
  testing/                     Factories, test DB helpers, ledger assertions
```

Boundary rules:

- `packages/domain` stays free of NestJS, TypeORM, HTTP, filesystem, and provider SDK imports.
- `apps/api` wires domain services to persistence, queues, controllers, guards, and external providers.
- `packages/contracts` owns validation schemas shared by API and mobile.
- `packages/db` owns migrations and persistence shape.
- Mobile state reads server projections and queues durable commands; the server event store remains the source of truth for money.

## Bounded Contexts

Target API modules from the architecture plan:

| Module | Target ownership | Current state |
|---|---|---|
| IdentityAccessModule | Phone OTP, sessions, consent, optional contacts, auth primitives. | Auth/users plus dev OTP start/verify/refresh, `GET /v1/users/me`, and repository-backed consent routes are present; contact ingestion remains deferred. |
| GroupsModule | Groups, participants, guest participants, subgroups, roles, invites, archive, member exit. | Module/controller/service/DTOs/entities/policies/README exist and section 5.4 group routes are public. |
| LedgerModule | Event store, balanced postings, idempotency, projection orchestration, audit, invariants. | FinancialLedgerModule has in-memory and PostgreSQL event-store adapters; `AppModule` uses PostgreSQL and tests use in-memory unless explicitly configured. |
| ExpensesModule | Expense create/edit/void, payers, shares, itemization, recurring schedules. | Controller, command/allocation service, projections, and service tests exist. |
| SettlementsModule | Suggestions, state machine, disputes, reversals. | Controller, command/projector/suggestion services, UPI manual providers, and service tests exist. |
| PaymentsUpiModule | UPI URI/QR generation, app-open history, provider ports, proof handling. | Domain UPI URI builder, QR payloads, manual UPI provider, Razorpay webhook adapter, handoff/proof/confirm routes, and duplicate callback/idempotency tests exist. |
| ReceiptsCaptureModule | Attachments, receipt drafts, OCR abstraction, capture pipeline. | Attachment and receipt-draft metadata is repository-backed when TypeORM is available; uploaded bytes persist via local or S3-compatible storage; Tesseract OCR and capture-job parsing are wired. |
| NotificationsModule | Neutral reminders, deliveries, push provider port, notification center. | Nest module/controller/service, dev provider, Expo Push provider, device installation registration, and `GET /v1/notifications` exist. |
| ReportingExportModule | Search, CSV/PDF/Tally-style exports, settlement certificates. | CSV, PDF statement, Tally CSV, settlement certificate, and data-portability JSON exports are implemented. |
| ImportMigrationModule | Splitwise CSV/JSON import, duplicate detection, import audit. | Splitwise CSV, bank CSV, and Setu AA transaction import routes/services/tests exist for normalized reviewable import jobs. |
| EntitlementsModule | No core-entry cap policy, future paid automation gates. | Module/service/README/test exist; core ledger commands are explicitly uncapped and future automation gates are separated. |
| Balances read side | Group balance projections and settlement-suggestion read support. | Controller, query service, and service tests exist. |
| RecurringModule | Weekly/monthly recurring schedule events and generated expenses. | Controller/service/projector/tests plus reminder-schedule dev route exist. |
| OfflineSyncModule | Command batch bridge and cursor sync. | Controller/service/tests exist. |

## Module README Coverage

Repository README coverage after this documentation pass:

| Area | README present | Notes |
|---|---:|---|
| Root repository | Yes | `README.md` added. |
| Architecture summary | Yes | `ARCHITECTURE.md` added. |
| Test plan notes | Yes | `TEST_PLAN.md` added. |
| `packages/config` | Yes | Package README exists. |
| `packages/contracts` | Yes | Package README exists. |
| `packages/domain` | Yes | Package README exists. |
| `apps/api` | Yes | Workspace README exists. |
| `apps/mobile` | Yes | Workspace README exists. |
| `apps/mobile/e2e` | Yes | Runner-neutral E2E scaffold README exists. |
| `packages/db` | Yes | Package README exists. |
| `packages/testing` | Yes | Workspace README exists. |
| `apps/api/src/modules/auth` | Yes | Module README exists. |
| `apps/api/src/modules/users` | Yes | Module README exists. |
| `apps/api/src/modules/balances` | Yes | Module README exists. |
| `apps/api/src/modules/expenses` | Yes | Module README exists. |
| `apps/api/src/modules/ledger` | Yes | Module README exists. |
| `apps/api/src/modules/notifications` | Yes | Module README exists. |
| `apps/api/src/modules/settlements` | Yes | Module README exists. |
| `apps/api/src/modules/groups` | Yes | Module README exists. |
| `apps/api/src/modules/recurring` | Yes | Module README exists. |
| `apps/api/src/modules/offline-sync` | Yes | Module README exists. |
| `apps/api/src/modules/imports-exports` | Yes | Module README exists. |
| `apps/api/src/modules/activity` | Yes | Module README exists. |
| `apps/api/src/modules/receipts-capture` | Yes | Module README exists. |
| `apps/api/src/modules/consents` | Yes | Module README exists. |
| `apps/api/src/modules/entitlements` | Yes | Module README exists. |

Recommended module README content:

- Responsibility and non-responsibility boundaries.
- Public use cases/controllers or exported APIs.
- Events, commands, projections, and tables owned by the module.
- Required tests and local test commands.
- External providers or credentials needed by the module.

## Data And Ledger Decisions

- Store money in integer minor units.
- Always include `currencyCode` with monetary values.
- Use immutable events for expense creation, edits, voids, settlements, imports, reversals, and compensations.
- Use balanced postings for financial movements; per-currency posting totals must sum to zero.
- Treat projections as rebuildable read models.
- Require idempotency for financial commands, proof uploads, imports, retries, and future webhooks.
- Do not physically delete financial history. Archive or compensate with new events.
- Settlement proof and receiver confirmation are separate from a user's manual "paid" claim.

## Migrations

Target migration architecture:

- TypeORM migrations live in `packages/db/src/migrations`.
- A shared TypeORM data source is consumed by `apps/api`.
- Migrations are run with the root `npm run migration:run` script, which delegates to `@splitsaathi/db`.
- Migration tests must validate empty-database migration, seeded previous-schema migration, DB functions, and indexes.

Current migration status:

- `packages/db/src/data-source.ts` and `packages/db/src/migrations/1783641600000-InitialLogicalModel.ts` exist.
- Root `npm run migration:run` delegates to `@splitsaathi/db`, and `apps/api/src/config/typeorm.data-source.ts` re-exports the DB package data source for compatibility.
- Live migration verification against a disposable PostgreSQL 18 database passes.
- `apps/api/test/app-postgres.e2e-spec.ts` verifies the migrated schema with the real `AppModule` when `RUN_POSTGRES_E2E=true`, including rebuilding in-memory read projections from persisted events after restart.

## Backend API Endpoints

The following is the exact representative endpoint list from `technical-architecture-plan.md` section 5.4. Commands require an `Idempotency-Key` header, and edit commands include `base_version` when they mutate an existing aggregate.

```text
POST   /v1/auth/otp/start
POST   /v1/auth/otp/verify
POST   /v1/auth/refresh

GET    /v1/sync?cursor=...
POST   /v1/commands/batch

POST   /v1/groups
GET    /v1/groups
GET    /v1/groups/:groupId
GET    /v1/groups/invites/:token
POST   /v1/groups/invites/:token/claim
POST   /v1/groups/:groupId/invites
POST   /v1/groups/:groupId/participants
PATCH  /v1/groups/:groupId/memberships/:membershipId/role
POST   /v1/groups/:groupId/archive
POST   /v1/groups/:groupId/memberships/:membershipId/lock-exit
POST   /v1/groups/:groupId/obligation-transfers

POST   /v1/expenses
POST   /v1/expenses/:expenseId/revisions
POST   /v1/expenses/:expenseId/void
GET    /v1/groups/:groupId/expenses
GET    /v1/expenses/:expenseId/history

GET    /v1/groups/:groupId/balances
GET    /v1/groups/:groupId/settlement-suggestions
POST   /v1/settlement-intents
POST   /v1/settlement-intents/:id/upi/opened
POST   /v1/settlement-intents/:id/proofs
POST   /v1/settlement-intents/:id/confirm
POST   /v1/settlement-intents/:id/reject
POST   /v1/settlement-intents/:id/dispute
POST   /v1/settlement-intents/:id/reverse
POST   /v1/payments/razorpay/webhook

POST   /v1/attachments
POST   /v1/receipt-drafts
POST   /v1/receipt-drafts/:id/ocr
POST   /v1/receipt-drafts/:id/post-expense
POST   /v1/capture-jobs

POST   /v1/imports/splitwise
POST   /v1/imports/bank/csv
POST   /v1/imports/bank/aa/consents
POST   /v1/imports/bank/aa/transactions
GET    /v1/imports/:id
POST   /v1/imports/:id/commit

POST   /v1/exports
GET    /v1/exports/:id

GET    /v1/currency/fx-rate
GET    /v1/currency/convert
POST   /v1/device-installations
GET    /v1/health/live
GET    /v1/health/ready
GET    /v1/metrics
```

Endpoint implementation status:

- Implemented as public Nest routes from the section 5.4 list:
  - `POST /v1/auth/otp/start`
  - `POST /v1/auth/otp/verify`
  - `POST /v1/auth/refresh`
  - `POST /v1/groups`
  - `GET /v1/groups`
  - `GET /v1/groups/:groupId`
  - `POST /v1/groups/:groupId/invites`
  - `POST /v1/groups/:groupId/participants`
  - `PATCH /v1/groups/:groupId/memberships/:membershipId/role`
  - `POST /v1/groups/:groupId/archive`
  - `POST /v1/groups/:groupId/memberships/:membershipId/lock-exit`
  - `POST /v1/groups/:groupId/obligation-transfers`
- Additional public Nest routes outside the section 5.4 list:
  - `GET /v1/users/me`
  - `GET /v1/notifications`
- Offline sync, expense, balance, settlement, recurring, imports/exports, activity, attachments, receipt-draft, consent, notification, and settlement read/exception APIs are decorated Nest routes in the current API graph.
- Contract schemas currently cover only a subset of intended request shapes: OTP start/verify, group creation, and expense creation.
- `apps/api/test/openapi.spec.ts` generates a controller-only Swagger document and asserts core Phase 1 paths are published without requiring a live database.
- `POST /v1/receipt-drafts/:id/ocr` is listed in the plan but marked deferred in build progress because OCR is Phase 2.

## Mobile Architecture Decisions

Target mobile stack:

- Expo React Native.
- TanStack Query for server projection reads.
- Zustand for local UI/flow state.
- React Hook Form and Zod for command form validation.
- `expo-sqlite` for durable offline command queue, drafts, pending attachments, projection cache, and sync cursor.
- SecureStore for tokens only.
- Design implementation must follow `design.md` exactly.

Current mobile status:

- `apps/mobile` exists with Expo config, theme token files, shared components, initial onboarding/home/group/expense screens, API client, token store, offline outbox, and money utilities.
- `apps/mobile/README.md` is present.
- Mobile money utility, offline outbox, and status-presentation tests are present; rendered UI component tests remain thin because the local React Native/Jest renderer setup is blocked.
- E2E is a runner-neutral scaffold only; no simulator/device runner is configured.
- No Cabinet Grotesk assets are present.

## External Credentials And Provider Gaps

| Area | Current gap | MVP handling |
|---|---|---|
| OTP/SMS | Twilio adapter exists; no Twilio credentials are present. | Use dev OTP locally; supply Twilio env vars for production. |
| UPI/PSP callbacks | Razorpay adapter exists; no Razorpay credentials/webhook secret are present. | Use UPI URI/QR and proof/confirmation locally; enable Razorpay only with test/live keys. |
| OCR | Tesseract adapter exists. | Use `OCR_PROVIDER_DRIVER=tesseract` when local OCR is desired. |
| Push notifications | Expo Push adapter exists; no device tokens/project validation are present. | Register tokens from the app and use Expo provider when a device/simulator is available. |
| Object storage | S3-compatible adapter exists; no bucket credentials are present. | Use local storage in dev and S3/MinIO in production. |
| Financial import | Setu AA adapter exists; no Setu credentials are present. | Use CSV locally; live AA requires Setu onboarding and consent review. |
| Fonts | Cabinet Grotesk files absent. | Space Grotesk display fallback is wired; Cabinet is a later asset swap. |

## Script Gap Notes

Existing root scripts are available for the current monorepo, with the following caveats:

- `migration:run` targets `@splitsaathi/db`; live migration verification requires PostgreSQL and has been tested with a disposable local cluster.
- `dev:mobile` targets `@splitsaathi/mobile`, which exists.
- `npm test -- --runInBand` currently passes for configured tests; the Postgres e2e is skipped unless `RUN_POSTGRES_E2E=true`.
- `npm run build`, `npm test -- --runInBand`, `npx tsc -p apps/mobile/tsconfig.json --noEmit`, migration run on disposable Postgres, and the opt-in Postgres e2e pass at the latest checkpoint.

Non-invasive suggestions for later:

- Add `typecheck` once all packages/apps have stable TypeScript configs.
- Add direct focused scripts such as `test:domain`, `test:contracts`, `test:migrations`, and `test:e2e:api`.
- Add `openapi:generate` when API controllers and contract generation exist.
- Add `db:reset:test` only after a test database helper exists in `packages/testing`.
- Add focused aliases for API service/e2e subsets if command length becomes noisy.
