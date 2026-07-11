# SplitSaathi

SplitSaathi is an India-first shared expense ledger planned around a NestJS/PostgreSQL API, Expo mobile client, event-sourced financial state, and payer-initiated UPI settlement flows.

The current repository contains the Phase 1 monorepo foundation: shared config/contracts/domain packages, a NestJS API, a TypeORM/PostgreSQL schema package with an initial migration, a Postgres-backed financial event-store adapter for `AppModule`, and an Expo mobile app using the Current & Calm design tokens.

## Source Documents

- `BUILD_PROGRESS.md`: build checklist and current phase tracking. Read first on resumed implementation sessions. Do not edit casually.
- `research-dossier.md`: India-first product and competitor research.
- `technical-architecture-plan.md`: target backend/mobile architecture, endpoint inventory, test strategy, and roadmap.
- `design.md`: mobile design system and visual implementation rules.
- `ARCHITECTURE.md`: repository-facing architecture summary and current gaps.
- `TEST_PLAN.md`: required tests from architecture section 4.4 and current coverage gaps.

## Current Workspace

```text
apps/api             NestJS API with auth, users, groups, notifications, financial ledger, expenses, balances, settlements, receipts, recurring, imports/exports, and offline sync routes.
apps/mobile          Expo app with theme tokens, components, Phase 1 screens, API client, token store, and offline outbox.
packages/config      Typed environment schema with Zod.
packages/contracts   Shared DTO schemas, enums, and money DTO helpers.
packages/db          TypeORM entity model, package data source, and initial logical-model migration.
packages/domain      Pure TypeScript money, ledger, split, settlement, UPI, and authorization primitives.
packages/testing     Shared test fixtures and ledger assertions.
```

Module README coverage exists for the current workspaces and API modules, including `apps/mobile`, `packages/config`, `packages/contracts`, `packages/db`, `packages/domain`, and `packages/testing`. See `ARCHITECTURE.md` for the full coverage table.

## Prerequisites

- Node.js compatible with the TypeScript/Jest toolchain in `package.json`.
- npm workspaces.
- PostgreSQL for the planned API and migrations.
- Expo tooling for the planned mobile app.

Install dependencies before running scripts:

```powershell
npm install
```

`package-lock.json` is present. If `node_modules` is missing or stale, run `npm install` before using workspace scripts.

## Environment

Create a local `.env` from `.env.example`:

```powershell
Copy-Item .env.example .env
```

Defined variables:

| Variable | Purpose | Current note |
|---|---|---|
| `NODE_ENV` | Runtime environment: `development`, `test`, or `production`. | Defaults to development in config schema. |
| `PORT` | Planned API port. | Defaults to `3000`. |
| `DATABASE_URL` | PostgreSQL connection for the API. | Required by config schema. |
| `TEST_DATABASE_URL` | PostgreSQL connection for integration/migration tests. | Optional until DB tests exist. |
| `JWT_ACCESS_SECRET` | Access-token signing secret. | Dev placeholder in `.env.example`; replace outside local dev. |
| `JWT_REFRESH_SECRET` | Refresh-token signing secret. | Dev placeholder in `.env.example`; replace outside local dev. |
| `OTP_DEV_CODE` | Development OTP code. | Dev fallback only, default `123456`. |
| `APP_PUBLIC_URL` | Public API/app URL used in links and callbacks. | Local default is `http://localhost:3000`. |
| `MOBILE_API_URL` | Mobile client's API base URL. | Local default is `http://localhost:3000`. |
| `LOCAL_OBJECT_STORAGE_DIR` | Local filesystem root for attachment bytes. | Defaults to `.local-storage` under the API process cwd if unset. |
| `OTP_PROVIDER_DRIVER` | OTP adapter selector: `dev` or `twilio_verify`. | Production must use `twilio_verify` with Twilio credentials. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` | Twilio Verify adapter credentials. | Required when `OTP_PROVIDER_DRIVER=twilio_verify`. |
| `PAYMENT_GATEWAY_DRIVER` | Payment callback adapter selector: `manual` or `razorpay`. | Production must not use `manual` if callback reconciliation is enabled. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Razorpay/test-mode payment gateway settings. | Webhook secret is required for `/v1/payments/razorpay/webhook`. |
| `NOTIFICATION_PROVIDER_DRIVER`, `EXPO_PUSH_ACCESS_TOKEN` | Notification delivery selector and optional Expo Push access token. | Expo device tokens are registered by the mobile app. |
| `OCR_PROVIDER_DRIVER` | OCR adapter selector: `noop` or `tesseract`. | `tesseract` runs local OCR without provider credentials. |
| `OBJECT_STORAGE_DRIVER` | Attachment storage selector: `local` or `s3`. | `local` is blocked in production; use S3-compatible storage. |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_USE_SSL` | S3/MinIO-compatible object storage settings. | Required when `OBJECT_STORAGE_DRIVER=s3`. |
| `BANK_IMPORT_PROVIDER_DRIVER` | Bank import selector: `csv` or `setu_aa`. | CSV is local; Setu AA requires partner credentials. |
| `SETU_AA_BASE_URL`, `SETU_AA_CLIENT_ID`, `SETU_AA_CLIENT_SECRET` | Setu Account Aggregator adapter settings. | Required when `BANK_IMPORT_PROVIDER_DRIVER=setu_aa`. |
| `FX_PROVIDER_DRIVER`, `FRANKFURTER_BASE_URL` | FX provider selector and Frankfurter API base URL. | `static` is available for tests; Frankfurter is the default. |
| `METRICS_ENABLED` | Enables Prometheus-style in-process metrics endpoint. | Defaults to true. |

## Running

Current root scripts:

```powershell
npm run build
npm run lint
npm test
npm run test:unit
npm run test:integration
npm run migration:run
npm run dev:api
npm run dev:mobile
```

Current verification:

- `npm run build` passes across configured workspaces.
- `npm test -- --runInBand` passes for configured domain, API, DB, and mobile suites.
- `npx tsc -p apps/mobile/tsconfig.json --noEmit` passes.
- `npm run dev:api` requires a valid `.env` and PostgreSQL because auth/groups use TypeORM repositories.
- `npm run dev:mobile` starts the Expo app.
- `npx expo config --json` validates the Expo config without starting a simulator.
- `npm install` currently reports npm audit findings; do not apply `npm audit fix --force` without checking Expo/Nest compatibility.

## Migrations

Target architecture:

- TypeORM entities and migrations live in `packages/db`.
- Migrations run through the API workspace using the shared data-source configuration.
- Migration tests must run all migrations on an empty database and against seeded previous-schema databases.

Current state:

- `packages/db` owns the logical TypeORM entity model and `packages/db/src/migrations/1783641600000-InitialLogicalModel.ts`.
- `packages/db/src/data-source.ts` exists and is the package-level migration data source.
- Root `npm run migration:run` now delegates to `@splitsaathi/db`.
- The initial migration was verified against a disposable PostgreSQL 18 cluster. Normal local development still requires `DATABASE_URL`.
- An opt-in Postgres AppModule e2e spec exists at `apps/api/test/app-postgres.e2e-spec.ts`; it previously verified projection hydration after a Nest app restart. In this run, the migration was verified on a disposable PostgreSQL 18 cluster, while the opt-in Postgres E2E retry timed out before producing Jest output.

Opt-in Postgres e2e example:

```powershell
$env:RUN_POSTGRES_E2E='true'
$env:DATABASE_URL='postgres://postgres@localhost:55432/splitsaathi_test'
$env:TEST_DATABASE_URL=$env:DATABASE_URL
npx jest apps/api/test/app-postgres.e2e-spec.ts --runInBand --config apps/api/jest.config.cjs
```

## Tests

Required test categories are tracked in `TEST_PLAN.md` from `technical-architecture-plan.md` section 4.4.

Current implemented tests cover:

- Split strategies.
- Rounding allocator property behavior.
- Greedy settlement optimizer.
- Settlement state machine.
- Authorization policy.
- UPI URI builder.
- Balanced posting validation.
- API auth and groups e2e flows.
- API financial service flows: event store idempotency/concurrency, expense create/revise/void/rebuild, settlement lifecycle/exceptions, recurring generation, import/export, offline sync, route-level financial coverage, and opt-in Postgres-backed AppModule flow.
- Mobile money utility formatting/parsing.

Provider contract suites now cover Twilio Verify, Razorpay webhook normalization, Expo Push, Tesseract parsing, local storage, S3-compatible storage, and Setu AA HTTP normalization with fake transports. Seeded previous-schema migration coverage, rendered mobile visual checks, live-provider checks, and device E2E coverage are still incomplete. See `TEST_PLAN.md`.

## Implementation Decisions

- Financial amounts are integer minor units with explicit currency codes.
- Domain code stays framework-independent; `packages/domain` must not import NestJS, TypeORM, or HTTP concerns.
- Financial state is immutable events plus balanced ledger postings. The API keeps an in-memory event store for isolated tests and wires `AppModule` to the PostgreSQL event-store adapter.
- Current balance views are planned as rebuildable projections, not source-of-truth mutable rows.
- UPI MVP uses payer-initiated `upi://pay` URI/QR flows, manual proof, and receiver confirmation.
- P2P collect-request flows, holding funds, payment aggregation, and bank linking are not MVP assumptions.
- Contacts are optional; invite links, QR, and guest participants are the preferred default path.
- Core expense entry should not be limited by artificial daily caps.
- Design is dark-first "Current & Calm"; mobile UI must follow `design.md` tokens and component rules.

## External Provider Status

- OTP/SMS: `DevOtpProvider` and `TwilioVerifyOtpProvider` are wired. To go live, set `OTP_PROVIDER_DRIVER=twilio_verify` and supply Twilio Verify credentials.
- Payments: payer-initiated UPI URI/QR remains the default. Razorpay webhook verification/normalization is wired for callback reconciliation; live use requires Razorpay test/live keys and webhook secret.
- Push: `ExpoPushProvider` and device-installation registration are wired. Real delivery still needs Expo push tokens from a simulator/device and project setup.
- OCR: `TesseractOcrProvider` is wired and needs no external credentials; `noop` remains available for local deterministic tests.
- Object storage: local filesystem and S3-compatible/MinIO providers are wired. Production must use `OBJECT_STORAGE_DRIVER=s3` with bucket credentials.
- Bank imports: bank CSV and Setu AA-shaped consent/transaction adapters are wired. Live Setu AA requires partner onboarding credentials and consent/compliance review.
- FX: Frankfurter and static FX providers are wired for `/v1/currency/fx-rate` and `/v1/currency/convert`.
- Fonts: Cabinet Grotesk files are absent. Mobile uses Space Grotesk for display fallback, Inter for body, and JetBrains Mono for amounts. To add Cabinet later, place font files under `apps/mobile/assets/fonts/` and swap the display family in `apps/mobile/src/theme/typography.ts`.
- Device E2E: Maestro and ADB are not installed in this environment, and no physical UPI app handoff can be verified here. The Maestro flow remains in `apps/mobile/e2e/`.

## Non-Invasive Script Suggestions

These are documentation-only suggestions; `package.json` has not been changed.

- Add a root `typecheck` script once all packages have reliable `tsconfig` coverage.
- Add `test:domain` as a direct alias to `npm run test -w @splitsaathi/domain` for fast domain verification.
- Add `test:contracts` after contract tests exist.
- Add `test:migrations` after `packages/db` exists.
- Add `test:e2e:api` after `apps/api` exposes endpoints.
- Update the API Jest config or filenames so `apps/api/test/**/*.spec.ts` financial-flow specs are intentionally included or explicitly separated.
- Add focused aliases for common API service/e2e subsets if command length becomes noisy.
- Consider making future mobile scripts resilient with `--if-present` during early scaffolding, or leave them strict once that workspace is mandatory.
#   s p l i t s a a t h i  
 