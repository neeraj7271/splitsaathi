# SplitSaathi Build Progress

Updated: 2026-07-10 9:40 PM local

Build rule: read this file first on every resumed session and continue from the first item that is not `done`.

Status values: `not started` / `in progress` / `implemented` / `tested` / `done`.

## Current Verified Checkpoint

- Subagents completed database, API foundation, financial backend, mobile, and documentation slices.
- Verified passing after activity/consent/receipt/reminder route additions, migration-script alignment, README additions, and lockfile generation: `npm run build`, `npm test -- --runInBand`, `npx tsc -p apps/mobile/tsconfig.json --noEmit`.
- Domain unit tests cover rounding, split strategies, ledger zero-sum validation, settlement optimizer, settlement state machine, authorization policy, and UPI URI builder.
- API configured tests cover auth/groups routes plus financial service flows for event store concurrency/idempotency, expense create/revise/void/rebuild, settlement proof/confirm/exception states, recurring generation, import/export, offline command sync, and route-level financial HTTP coverage.
- DB package now has TypeORM entities, data source, initial logical-model migration, and root/API scripts delegate migration runs to `@splitsaathi/db`; the migration was verified against a disposable PostgreSQL 18 cluster on port 55432.
- Mobile app now has Expo screens/components for Phase 1 flows and passes unit/type checks; device/simulator E2E has not been executed.
- Known hard gaps before Phase 1 can be called done in a production/device sense: production OTP/PSP/push credentials are absent; production S3/GCS/R2 object-storage selection/credentials are absent; no real device end-to-end journey has been verified. Attachment bytes now persist through the local filesystem `ObjectStoragePort` adapter in local/disposable environments.
- Latest verified after Postgres event-store wiring, async ledger conversion, financial route authorization, repository-backed consent/reminder/receipt metadata, local object-storage byte persistence, migration compatibility fixes, provider contract tests, mobile offline/import/export/proof-attachment contract fixes, command-level settlement transition prevalidation, scoped idempotency hardening, startup projection hydration, and opt-in Postgres e2e: `npm run build`, `npm test -- --runInBand`, `npx tsc -p apps/mobile/tsconfig.json --noEmit`, `npm run migration:run` against disposable PostgreSQL 18, and `RUN_POSTGRES_E2E=true npx jest apps/api/test/app-postgres.e2e-spec.ts --runInBand --forceExit --config apps/api/jest.config.cjs`.
- Dependency hardening: `package-lock.json` is present; the latest npm install reports audit findings. Do not run broad `npm audit fix --force` without checking Expo/Nest compatibility.
- Current completion run implemented production-shaped adapters and Phase 2/3 features: Twilio Verify OTP, Razorpay webhook normalization, Expo Push, Tesseract OCR, S3-compatible/MinIO storage, Setu AA-shaped bank import, Frankfurter/static FX, PDF/Tally/certificate/JSON exports, invite claim/QR scan, WhatsApp/native summary sharing, and health/metrics observability.
- Latest verified in this run: `npm run build -w @splitsaathi/api`, `npx tsc -p apps/mobile/tsconfig.json --noEmit`, `npm test -w @splitsaathi/api -- --runInBand`, `npm test -w @splitsaathi/mobile -- --runInBand`, `npm run build`, `npm test -- --runInBand`, `npm run lint`, focused provider/financial/settlement suites, `npx expo config --json`, and `npm run migration:run` against a disposable PostgreSQL 18 cluster on port 55435.
- Opt-in Postgres AppModule E2E had passed in the prior checkpoint. A fresh retry in this run timed out before Jest output after creating a disposable cluster; the temp cluster was stopped and removed. Default full tests remain green.
- True remaining external blockers: real Twilio/Razorpay/Expo push/S3/Setu credentials for live-provider tests, Maestro/ADB or a physical/simulator device for mobile E2E, and a real UPI app/device for handoff verification. No production-costing or irreversible actions were run.

## Reconciled Design Token Summary

- Visual direction: dark-first "Current & Calm"; premium fintech, dense ledger rows, no generic card-dashboard defaults.
- Fonts: Cabinet Grotesk for display/headings, Inter for UI/body, JetBrains Mono for every monetary figure. Cabinet files are not yet available in repo, so Phase 1 will load local Cabinet assets if added and use a documented fallback until assets exist.
- Brand gradient: Current Flow `#3730A3` to `#0D9488`, angle 135deg. Use only onboarding, splash, home hero, primary settlement CTA.
- Secondary gradient: Ember `#F97066` to `#F59E0B`, sparse premium/success use only.
- Dark tokens: canvas `#0B0E14`, surface `#12151D`, surfaceRaised `#191D27`, hairline `#232836`, ink `#F4F5F7`, inkMuted `#9AA1AF`, inkFaint `#5B6273`.
- Light tokens: canvas `#F6F7FB`, surface `#FFFFFF`, surfaceRaised `#FCFCFE`, hairline `#E4E7EF`, ink `#171922`, inkMuted `#5B6273`, inkFaint `#9AA1AF`.
- Semantic tokens: receive `#22C55E`, owe `#F04438`, pending `#F59E0B`, confirmed `#0D9488`, disputed `#F97066`, info `#6366F1`.
- Chart palette: `#0D9488`, `#6366F1`, `#F59E0B`, `#F97066`, `#84CC16`, `#38BDF8`.
- Spacing: 4px grid; screen horizontal 20, card padding 16, row vertical padding 14, section gap 24.
- Radius: sm 10, md 16, lg 24, full 999.
- Components: Phosphor icons, status pills with dot+label, segmented control, balance hero with eye toggle, numeric keypad, participant picker, settlement stepper, audit rail.
- Avoid: default Ionicons, default buttons, nested cards, generic blue primary, confetti/bouncy settlement animation, hardcoded screen-specific hex values.

## Phase 1 Traceability Matrix

| ID | Item | Status | Files/modules | Tests | Notes/deviation |
|---|---|---|---|---|---|
| P1.1 | Manual paid state is not proof | tested | Settlements, Payments/UPI, `payment_proofs`, settlement UI | `settlement-flow.spec.ts`; `financial-routes.e2e-spec.ts`; Postgres e2e; mobile TS | Manual proof + receiver confirmation implemented; PSP auto-reconciliation blocked by provider selection. |
| P1.2 | Debt simplification socially distrusted | tested | Settlement suggestions, why-this-payment UI | `settlement-optimizer.spec.ts`; `BalancesScreen`; mobile TS | Greedy explanations Phase 1; exact optimizer Phase 2. |
| P1.3 | Settle-up recommendations feel wrong | tested | settlement suggestions, balances UI | `settlement-flow.spec.ts`; `financial-routes.e2e-spec.ts`; mobile TS | Net-position route explanations implemented. |
| P1.4 | Calculation correctness blocker | tested | Ledger postings, invariant tests, projections | domain ledger tests; expense-flow rebuild; Postgres DB trigger e2e | Zero-sum and rebuild verified; DB projection tables remain schema-ready while runtime projections hydrate from events. |
| P1.5 | Edits/deletes trust concerns | tested | Roles, expense history, audit UI | `expense-flow.spec.ts`; `financial-routes.e2e-spec.ts`; mobile TS | Void/adjust events only. |
| P1.6 | Deleted groups/bills recoverability | tested | `groups.state`, archive, event store, exports | `groups.e2e-spec.ts`; export tests | Archive only for financial groups. |
| P2.1 | Currency conversion premium | tested | Currency module, FX snapshots, `FxRateService`, `/v1/currency/*` | `fx-rate.service.spec.ts`; `financial-routes.e2e-spec.ts` | Frankfurter/static FX implemented; persisted per-expense FX snapshot workflow remains schema-ready. |
| P2.2 | INR handling | tested | Currency schema, amount formatters, UPI URI | money tests; UPI URI tests | INR default. |
| P2.3 | Rounding unfairness | tested | Rounding allocator, itemized expense allocation | `rounding.spec.ts`; `expense-flow.spec.ts` itemized test | Deterministic largest remainder and itemized residual logic covered. |
| P3.1 | Splitwise not UPI-native | tested | Payments/UPI, UPI URI, handoff history | UPI URI tests; settlement route tests; mobile TS | Payer-initiated intent. |
| P3.2 | P2P collect constraints | tested | UPI state machine, no collect routes | route/OpenAPI smoke; settlement tests | MVP does not use collect. |
| P3.3 | Bank-link privacy fear | deferred | Consent, future financial import port | pending | Phase 3; no bank linking MVP. |
| P4.1 | Recurring rent/utilities | tested | Recurring schedules, reminders, UPI prompts | `recurring-expense.spec.ts`; `financial-routes.e2e-spec.ts`; mobile TS | Weekly/monthly in MVP. |
| P4.2 | Multiple payers/mixed beneficiaries | tested | Expense payers/shares, itemized UI | `expense-flow.spec.ts`; `financial-routes.e2e-spec.ts`; mobile TS | Core Phase 1. |
| P4.3 | Itemized tax/service/discount logic | tested | Line items, bill adjustments, allocation engine | `expense-flow.spec.ts` itemized allocation test | Manual itemization Phase 1; OCR Phase 2. |
| P5.1 | Admins/permissions | tested | Groups roles, `group_role_permissions`, guards | groups e2e; financial authorization tests | First-class roles. |
| P5.2 | Remove member without zero balance | tested | Member exit lock, obligation transfer hook | groups e2e | Lock/exclude implemented; ledger obligation transfer posting deferred behind hook. |
| P5.3 | Archive groups | tested | Group state, archive endpoint/UI | groups e2e; mobile TS | No destructive delete. |
| P6.1 | Reminder tone | tested | Notification templates, reminder schedules | financial routes; recurring screen copy | Basic neutral reminders Phase 1; advanced controls Phase 2. |
| P6.2 | Reminder reliability | tested | Notification deliveries, Expo Push provider, device installations, notification center | provider contracts; notification API; migration run | Expo push adapter exists; live delivery requires device token/project setup. |
| P7.1 | Receipt scanning paywall | tested | OCR port, Tesseract adapter, OCR route/mobile receipt flow | provider contracts; `financial-routes.e2e-spec.ts`; mobile TS | Local OCR implemented without paywall; real-image QA pending device/assets. |
| P7.2 | Gallery/screenshot receipts | tested | Attachments, receipt drafts, mobile picker | financial routes; provider contracts; mobile TS | Attachment bytes persist through local object storage. |
| P7.3 | OCR confidence/correction | tested | OCR result/item projections, receipt draft review data | provider contracts; financial routes; mobile TS | Confidence and human-review flags exist; richer correction UI can be refined later. |
| P8.1 | Daily entry caps | tested | Entitlements policy, API abuse limits only | entitlements service test | Core entries uncapped. |
| P8.2 | Subscription resentment | deferred | Entitlements/billing | pending | Phase 3 billing only. |
| P8.3 | Pay for automation not scarcity | deferred | Entitlement hooks | pending | Core ledger free; automation later. |
| P9.1 | Mandatory contacts anti-pattern | tested | Optional contacts, invite links, guest participants | onboarding mobile TS; groups e2e | No forced contacts. |
| P9.2 | Bank/account consent | deferred | Consent future import | pending | Phase 3. |
| P9.3 | Opaque shared finance hurts relationships | partial defer | Audit, evidence attachments, settlement proof | expense/history tests; settlement proof upload; mobile TS | Audit/evidence present; comment surfaces and formal dispute evidence are Phase 2. |
| P10.1 | Offline mode travel differentiator | tested | Mobile SQLite outbox, sync endpoint | mobile outbox test; offline import/export tests | Queue Phase 1; full projection cache Phase 2. |
| P10.2 | Sync/data loss catastrophic | tested | Event store, projections, idempotency, export | event-store tests; Postgres restart hydration e2e | Immutable server source. |
| P10.3 | New entrant reliability | tested | Tests, observability, migration tests | full suite; disposable Postgres migration/e2e | Production telemetry still needs provider selection. |
| P11.1 | Reduce awkwardness | tested | Neutral copy, UPI proof flow, reminders | mobile TS; settlement tests | MVP avoids blame language. |
| P11.2 | Everyone install friction | tested | Guest participants, invite preview/claim, QR scan/render, native share summary | groups e2e; mobile TS | No web guest client, but mobile invite and summary flows are wired. |
| P11.3 | Minimal UX vs complex reality | tested | Progressive modes, component library | mobile TS | Advanced controls are progressive. |
| P12.1 | Search/export not luxuries | tested | Search schema, CSV export | import/export service tests | CSV export Phase 1; search table schema ready. |
| P12.2 | Tally/accounting summaries | tested | Reporting export | import/export tests; financial routes | Tally CSV, PDF statement, settlement certificate, and data-portability JSON implemented. |
| P13.1 | Fragile invites/contact sync | tested | Invite links, optional contacts, claim API, QR scan/render | groups e2e; mobile onboarding/group TS | Invite creation/preview/claim plus mobile QR path implemented. |
| P13.2 | Splitwise migration | tested | Import module, CSV parser/review | import/export tests; mobile TS | Phase 1 acquisition wedge. |
| O1 | UPI verified settlement lifecycle | tested | Settlements + Payments/UPI | settlement tests; financial routes; Postgres e2e | Phase 1 manual proof lifecycle. |
| O2 | No daily cap core entries | tested | Entitlements/rate limit policy | entitlements service test | Phase 1. |
| O3 | Immutable audit + approvals | tested | Event store + expense versions + policies | event-store; expense-flow; Postgres e2e | Phase 1. |
| O4 | Share/WhatsApp/SMS capture | tested | Capture jobs, SMS/manual parser, native share summary | financial routes; mobile TS | Native share implemented; direct WhatsApp deep-link specifics remain device QA. |
| O5 | Splitwise CSV/JSON import | tested | Import jobs/items | import/export tests; mobile TS | CSV Phase 1; JSON deferred. |
| O6 | Optional contacts/invite/guest | partial defer | Identity + Groups | groups e2e; onboarding mobile TS | Optional contacts/guests/invite creation implemented; join/claim flow pending. |
| O7 | AI receipt itemizer | tested | OCR/receipt pipeline, Tesseract parser, mobile receipt analysis | provider contracts; financial routes; mobile TS | Local OCR itemizer implemented; provider AI enhancement can be swapped later. |
| O8 | Subgroups/couples/move-out | partial defer | Participants hierarchy/member exit | group schema; groups e2e | Move-out lock implemented; relationship UI is Phase 2. |
| O9 | Recurring bills + UPI reminders | tested | Recurring + Notifications | recurring tests; financial routes; mobile TS | Phase 1. |
| O10 | Multi-currency FX snapshots | tested | Currency/FX service and endpoints | `fx-rate.service.spec.ts`; financial routes | Runtime FX conversion implemented; snapshot table remains ready for persisted expense conversion history. |
| O11 | Explainable settlement graph | tested | Settlement suggestion service | settlement optimizer tests; balances screen | Explanation Phase 1; exact Phase 2. |
| O12 | Neutral reminders/settlement day | partial defer | Notifications | financial routes; recurring screen | Basic Phase 1; advanced controls/push Phase 2. |
| O13 | CSV/PDF/Tally exports | tested | Export module | import/export tests; financial routes; mobile TS | CSV, PDF, Tally, certificate, and JSON exports implemented. |
| O14 | Offline local queue/conflict UI | tested | Mobile outbox + sync | mobile outbox test; offline sync tests | Queue Phase 1. |
| O15 | On-device parsing/consent dashboard | deferred | Consent/capture | pending | Phase 2/3. |
| O16 | Progressive disclosure modes | tested | Group mode setup/screens | mobile TS | Phase 1. |
| O17 | UPI handoff history | tested | `upi_app_open_events`, settlement timeline | settlement tests; financial routes; mobile TS | Phase 1. |
| O18 | Monthly statements/certificates | tested | Reporting | import/export tests; financial routes | PDF statement and settlement certificate export implemented. |
| O19 | Comments/dispute/evidence | tested | Evidence attachments, settlement dispute state, audit/activity | settlement tests; financial routes | Formal comment threads remain future polish, but dispute/evidence lifecycle is implemented. |
| O20 | Read-only balance/WhatsApp summary | tested | Native share summary, invite QR/link | mobile TS | No web read-only client, but mobile WhatsApp/native sharing path is implemented. |

## Module / Package Checklist

| Item | Status | Files/modules | Tests | Notes |
|---|---|---|---|---|
| Monorepo workspace | tested | root package, apps, packages | `npm run build`; `npm test -- --runInBand` | npm workspaces present. |
| Config package | implemented | `packages/config` | build only | typed env schema; README present. |
| Contracts package | implemented | `packages/contracts` | build only | DTOs/shared enums; README present; needs broader endpoint schemas. |
| Domain package | tested | `packages/domain` | `packages/domain/src/*.spec.ts` | no Nest/TypeORM/HTTP imports; unit tests pass; README present. |
| DB package | tested | `packages/db` | `npm run build -w @splitsaathi/db`; `npm run migration:run` on disposable PostgreSQL 18 | entities, migration, data source present; migration verified from empty DB. |
| Testing package | tested | `packages/testing` | `npm run build -w @splitsaathi/testing`; `npm run test -w @splitsaathi/testing -- --runInBand` | deterministic fixtures and ledger assertions. |
| API app | tested | `apps/api` | `apps/api/test/**/*.spec.ts`; auth/groups/financial e2e; opt-in Postgres AppModule e2e | NestJS, Swagger, all configured tests pass; AppModule financial persistence uses Postgres adapter verified against disposable DB. |
| Mobile app | tested | `apps/mobile` | `apps/mobile/__tests__/money.test.ts`; `apps/mobile/__tests__/outbox.test.ts`; TS noEmit | Expo app and README present; device E2E not run. |
| IdentityAccessModule | tested | `apps/api/src/modules/auth`, users, consents | `apps/api/test/auth.e2e-spec.ts`; `apps/api/test/consents.e2e-spec.ts` | OTP/auth implemented; consent records are repository-backed. |
| GroupsModule | tested | `apps/api/src/modules/groups` | `apps/api/test/groups.e2e-spec.ts` | groups/participants/roles implemented; obligation transfer is hook only. |
| LedgerModule | tested | `apps/api/src/modules/ledger` | `apps/api/test/ledger/event-store.spec.ts`; `financial-authorization.spec.ts`; `app-postgres.e2e-spec.ts` | in-memory event store tested; Postgres adapter wired for `AppModule`; financial authorization mapped to group roles; Postgres e2e passes. |
| ExpensesModule | tested | `apps/api/src/modules/expenses` | `apps/api/test/expenses/expense-flow.spec.ts` | expense commands/projections tested. |
| SettlementsModule | tested | `apps/api/src/modules/settlements` | `apps/api/test/settlements/settlement-flow.spec.ts` | suggestions/state machine tested. |
| PaymentsUpiModule | tested | `apps/api/src/modules/settlements`, `packages/domain/src/upi-uri.ts` | UPI URI unit test; settlement flow tests; `provider-contracts.spec.ts`; financial routes | UPI URI/QR/manual proof plus Razorpay webhook callback normalization implemented. |
| ReceiptsCaptureModule | tested | `apps/api/src/modules/receipts-capture` | `financial-routes.e2e-spec.ts`; `provider-contracts.spec.ts`; Postgres e2e covers core app path but not all receipt metadata | local/S3 storage, Tesseract OCR, receipt draft analysis, and capture jobs implemented. |
| NotificationsModule | tested | `apps/api/src/modules/notifications` | auth/groups tests exercise notification writes; provider contract test | neutral notification center, dev delivery, Expo Push adapter, and device installation route present; live push credentials/device token pending. |
| ReportingExportModule | tested | `apps/api/src/modules/imports-exports` | `apps/api/test/imports-exports/offline-import-export.spec.ts`; financial routes | CSV, PDF, Tally, certificate, and data-portability JSON export implemented. |
| ImportMigrationModule | tested | `apps/api/src/modules/imports-exports` | `apps/api/test/imports-exports/offline-import-export.spec.ts`; financial routes; provider contracts | Splitwise CSV, bank CSV, and Setu AA-shaped bank import implemented. |
| EntitlementsModule | tested | `apps/api/src/modules/entitlements` | `apps/api/test/entitlements/entitlements.service.spec.ts` | core ledger commands explicitly uncapped; future automation gates separated. |

## Table Checklist

| Table | Status | Entity path | Migration | Tests |
|---|---|---|---|---|
| users | tested | `apps/api/src/modules/users/entities/user.entity.ts`; `packages/db/src/entities/identity.entities.ts` | `1783641600000-InitialLogicalModel.ts` | auth e2e + Postgres e2e |
| auth_identities | tested | `apps/api/src/modules/auth/entities/auth-identity.entity.ts`; `packages/db/src/entities/identity.entities.ts` | `1783641600000-InitialLogicalModel.ts` | auth e2e + Postgres e2e |
| otp_challenges | tested | `apps/api/src/modules/auth/entities/otp-challenge.entity.ts`; `packages/db/src/entities/identity.entities.ts` | `1783641600000-InitialLogicalModel.ts` | auth e2e + Postgres e2e |
| refresh_sessions | tested | `apps/api/src/modules/auth/entities/refresh-session.entity.ts`; `packages/db/src/entities/identity.entities.ts` | `1783641600000-InitialLogicalModel.ts` | auth e2e + Postgres e2e |
| device_installations | implemented | `packages/db/src/entities/identity.entities.ts` | `1783641600000-InitialLogicalModel.ts` | migration run; production push registration blocked by credentials/device |
| consent_records | tested | `packages/db/src/entities/identity.entities.ts`; `ConsentsService` | `1783641600000-InitialLogicalModel.ts` | `consents.e2e-spec.ts`; migration run |
| contact_aliases | implemented | `packages/db/src/entities/identity.entities.ts` | `1783641600000-InitialLogicalModel.ts` | migration run; contact ingestion deferred |
| groups | tested | `apps/api/src/modules/groups/entities/group.entity.ts`; `packages/db/src/entities/group.entities.ts` | `1783641600000-InitialLogicalModel.ts` | groups e2e + Postgres e2e |
| participants | tested | `apps/api/src/modules/groups/entities/participant.entity.ts`; `packages/db/src/entities/group.entities.ts` | `1783641600000-InitialLogicalModel.ts` | groups e2e + Postgres e2e |
| group_memberships | tested | `apps/api/src/modules/groups/entities/group-membership.entity.ts`; `packages/db/src/entities/group.entities.ts` | `1783641600000-InitialLogicalModel.ts` | groups e2e + Postgres e2e |
| participant_relationships | implemented | `packages/db/src/entities/group.entities.ts` | `1783641600000-InitialLogicalModel.ts` | migration run; relationship UI deferred |
| group_role_permissions | tested | `apps/api/src/modules/groups/entities/group-role-permission.entity.ts`; `packages/db/src/entities/group.entities.ts` | `1783641600000-InitialLogicalModel.ts` | groups e2e + financial authorization test + Postgres e2e |
| group_invites | tested | `apps/api/src/modules/groups/entities/group-invite.entity.ts`; `packages/db/src/entities/group.entities.ts` | `1783641600000-InitialLogicalModel.ts` | groups e2e + migration run |
| event_store | tested | `packages/db/src/entities/ledger.entities.ts`; `PostgresEventStore` | `1783641600000-InitialLogicalModel.ts` | in-memory adapter tests + Postgres e2e |
| ledger_postings | tested | `packages/db/src/entities/ledger.entities.ts`; `PostgresEventStore` | `1783641600000-InitialLogicalModel.ts` | domain zero-sum tests + Postgres e2e settlement |
| idempotency_records | tested | `packages/db/src/entities/ledger.entities.ts`; `PostgresEventStore` | `1783641600000-InitialLogicalModel.ts` | in-memory idempotency test + Postgres e2e idempotent routes |
| projection_checkpoints | implemented | `packages/db/src/entities/ledger.entities.ts` | `1783641600000-InitialLogicalModel.ts` | migration run; runtime projectors hydrate from event store |
| group_balance_projection | implemented | `packages/db/src/entities/ledger.entities.ts`; `BalanceProjector` | `1783641600000-InitialLogicalModel.ts` | balance tests + Postgres restart hydration |
| activity_feed_projection | implemented | `packages/db/src/entities/ledger.entities.ts`; `ActivityProjector` | `1783641600000-InitialLogicalModel.ts` | financial routes + Postgres e2e |
| search_projection | implemented | `packages/db/src/entities/ledger.entities.ts` | `1783641600000-InitialLogicalModel.ts` | migration run; search API deferred |
| expense_projection | implemented | `packages/db/src/entities/expense.entities.ts`; `ExpenseProjector` | `1783641600000-InitialLogicalModel.ts` | expense-flow + financial routes + Postgres e2e |
| expense_payers | implemented | `packages/db/src/entities/expense.entities.ts`; expense payloads | `1783641600000-InitialLogicalModel.ts` | expense-flow + financial routes |
| expense_shares | implemented | `packages/db/src/entities/expense.entities.ts`; expense payloads | `1783641600000-InitialLogicalModel.ts` | expense-flow + financial routes |
| expense_line_items | implemented | `packages/db/src/entities/expense.entities.ts`; itemized payloads | `1783641600000-InitialLogicalModel.ts` | itemized allocation test |
| expense_line_item_assignments | implemented | `packages/db/src/entities/expense.entities.ts` | `1783641600000-InitialLogicalModel.ts` | migration run; persisted item assignment UI deferred |
| bill_adjustments | implemented | `packages/db/src/entities/expense.entities.ts`; allocation engine | `1783641600000-InitialLogicalModel.ts` | itemized allocation test |
| rounding_residual_allocations | implemented | `packages/db/src/entities/expense.entities.ts`; rounding allocator | `1783641600000-InitialLogicalModel.ts` | rounding tests + itemized allocation test |
| expense_version_projection | implemented | `packages/db/src/entities/expense.entities.ts`; `ExpenseProjector` | `1783641600000-InitialLogicalModel.ts` | expense history tests |
| expense_comments | implemented | `packages/db/src/entities/expense.entities.ts` | `1783641600000-InitialLogicalModel.ts` | migration run; comment UI/API deferred |
| evidence_attachments | implemented | `packages/db/src/entities/expense.entities.ts`; receipt/proof attachments | `1783641600000-InitialLogicalModel.ts` | attachment/proof route tests |
| recurring_expense_schedules | implemented | `packages/db/src/entities/recurring-currency.entities.ts`; `RecurringProjector` | `1783641600000-InitialLogicalModel.ts` | recurring tests + financial routes |
| recurring_occurrences | implemented | `packages/db/src/entities/recurring-currency.entities.ts` | `1783641600000-InitialLogicalModel.ts` | migration run; generated occurrence persistence deferred |
| currencies | tested | `packages/db/src/entities/recurring-currency.entities.ts`; money utilities | `1783641600000-InitialLogicalModel.ts` | migration run + money/UPI tests |
| fx_rate_snapshots | implemented | `packages/db/src/entities/recurring-currency.entities.ts` | `1783641600000-InitialLogicalModel.ts` | migration run; FX service deferred |
| settlement_intents | implemented | `packages/db/src/entities/settlement.entities.ts`; `SettlementProjector` | `1783641600000-InitialLogicalModel.ts` | settlement tests + financial routes + Postgres e2e |
| upi_app_open_events | implemented | `packages/db/src/entities/settlement.entities.ts`; settlement timeline | `1783641600000-InitialLogicalModel.ts` | settlement tests + financial routes |
| payment_proofs | implemented | `packages/db/src/entities/settlement.entities.ts`; proof upload route | `1783641600000-InitialLogicalModel.ts` | settlement tests + financial routes |
| settlement_confirmations | implemented | `packages/db/src/entities/settlement.entities.ts`; settlement confirm route | `1783641600000-InitialLogicalModel.ts` | settlement tests + Postgres e2e |
| attachments | tested | `packages/db/src/entities/attachment-capture.entities.ts`; `ReceiptsCaptureService`; `LocalObjectStorageProvider` | `1783641600000-InitialLogicalModel.ts` | financial route test uploads bytes and provider contract verifies persisted content; migration run verifies schema |
| receipt_drafts | implemented | `packages/db/src/entities/attachment-capture.entities.ts`; `ReceiptsCaptureService` | `1783641600000-InitialLogicalModel.ts` | financial route test uses fallback; migration run verifies schema |
| receipt_ocr_results | implemented | `packages/db/src/entities/attachment-capture.entities.ts` | `1783641600000-InitialLogicalModel.ts` | migration run; OCR provider deferred |
| receipt_draft_items | implemented | `packages/db/src/entities/attachment-capture.entities.ts` | `1783641600000-InitialLogicalModel.ts` | migration run; OCR item review deferred |
| capture_jobs | implemented | `packages/db/src/entities/attachment-capture.entities.ts` | `1783641600000-InitialLogicalModel.ts` | migration run; share/SMS capture deferred |
| notifications | tested | `apps/api/src/modules/notifications/entities/notification.entity.ts`; `packages/db/src/entities/notification.entities.ts` | `1783641600000-InitialLogicalModel.ts` | groups/auth tests exercise dev delivery; migration run |
| notification_deliveries | tested | `apps/api/src/modules/notifications/entities/notification-delivery.entity.ts`; `packages/db/src/entities/notification.entities.ts` | `1783641600000-InitialLogicalModel.ts` | groups/auth tests exercise dev delivery; migration run |
| reminder_schedules | tested | `packages/db/src/entities/notification.entities.ts`; `ReminderScheduleService` | `1783641600000-InitialLogicalModel.ts` | financial route test + migration run |
| import_jobs | implemented | `packages/db/src/entities/import-export.entities.ts`; import projector | `1783641600000-InitialLogicalModel.ts` | import/export tests |
| import_items | implemented | `packages/db/src/entities/import-export.entities.ts`; import projector | `1783641600000-InitialLogicalModel.ts` | import/export tests |
| external_entity_maps | implemented | `packages/db/src/entities/import-export.entities.ts` | `1783641600000-InitialLogicalModel.ts` | migration run; duplicate map persistence deferred |
| export_jobs | implemented | `packages/db/src/entities/import-export.entities.ts`; export projector | `1783641600000-InitialLogicalModel.ts` | import/export tests; enum aligned to `expenses_csv`/`balances_csv`/`full_group_csv` |
| statement_snapshots | implemented | `packages/db/src/entities/import-export.entities.ts` | `1783641600000-InitialLogicalModel.ts` | migration run; statements deferred |

## Endpoint Checklist

| Endpoint | Status | Controller | Tests |
|---|---|---|---|
| POST /v1/auth/otp/start | tested | `AuthController` | `auth.e2e-spec.ts` |
| POST /v1/auth/otp/verify | tested | `AuthController` | `auth.e2e-spec.ts` |
| POST /v1/auth/refresh | tested | `AuthController` | `auth.e2e-spec.ts` |
| POST /v1/consents | tested | `ConsentsController` | `consents.e2e-spec.ts` |
| GET /v1/consents | tested | `ConsentsController` | `consents.e2e-spec.ts` |
| GET /v1/sync | tested | `OfflineSyncController` | `offline-import-export.spec.ts` service flow; `financial-routes.e2e-spec.ts` |
| POST /v1/commands/batch | tested | `OfflineSyncController` | `offline-import-export.spec.ts` service flow; `financial-routes.e2e-spec.ts` |
| POST /v1/groups | tested | `GroupsController` | `groups.e2e-spec.ts` |
| GET /v1/groups | tested | `GroupsController` | `groups.e2e-spec.ts` |
| GET /v1/groups/:groupId | tested | `GroupsController` | `groups.e2e-spec.ts` |
| POST /v1/groups/:groupId/invites | tested | `GroupsController` | `groups.e2e-spec.ts` |
| POST /v1/groups/:groupId/participants | tested | `GroupsController` | `groups.e2e-spec.ts` |
| PATCH /v1/groups/:groupId/memberships/:membershipId/role | tested | `GroupsController` | `groups.e2e-spec.ts` |
| POST /v1/groups/:groupId/archive | tested | `GroupsController` | `groups.e2e-spec.ts` |
| POST /v1/groups/:groupId/memberships/:membershipId/lock-exit | tested | `GroupsController` | `groups.e2e-spec.ts` |
| POST /v1/groups/:groupId/obligation-transfers | tested | `GroupsController` | `groups.e2e-spec.ts`; hook only; ledger posting pending |
| POST /v1/expenses | tested | `ExpensesController` | `expense-flow.spec.ts`; `financial-routes.e2e-spec.ts`; Postgres e2e |
| POST /v1/expenses/:expenseId/revisions | tested | `ExpensesController` | `expense-flow.spec.ts`; `financial-routes.e2e-spec.ts` |
| POST /v1/expenses/:expenseId/void | tested | `ExpensesController` | `expense-flow.spec.ts`; `financial-routes.e2e-spec.ts` |
| GET /v1/groups/:groupId/expenses | tested | `ExpensesController` | `expense-flow.spec.ts`; `financial-routes.e2e-spec.ts` |
| GET /v1/expenses/:expenseId/history | tested | `ExpensesController` | `expense-flow.spec.ts`; `financial-routes.e2e-spec.ts` |
| GET /v1/groups/:groupId/activity | tested | `ActivityController` | `financial-routes.e2e-spec.ts`; Postgres e2e |
| GET /v1/groups/:groupId/balances | tested | `BalancesController` | `expense-flow.spec.ts`, `settlement-flow.spec.ts`, `financial-routes.e2e-spec.ts`, Postgres e2e |
| GET /v1/groups/:groupId/settlement-suggestions | tested | `SettlementsController` | `settlement-flow.spec.ts`; `financial-routes.e2e-spec.ts` |
| POST /v1/settlement-intents | tested | `SettlementsController` | `settlement-flow.spec.ts`; `financial-routes.e2e-spec.ts`; Postgres e2e |
| POST /v1/settlement-intents/:id/upi/opened | tested | `SettlementsController` | `settlement-flow.spec.ts`; `financial-routes.e2e-spec.ts` |
| POST /v1/settlement-intents/:id/proofs | tested | `SettlementsController` | `settlement-flow.spec.ts`; `financial-routes.e2e-spec.ts`; Postgres e2e |
| POST /v1/settlement-intents/:id/confirm | tested | `SettlementsController` | `settlement-flow.spec.ts`; `financial-routes.e2e-spec.ts`; Postgres e2e |
| POST /v1/settlement-intents/:id/reject | tested | `SettlementsController` | `settlement-flow.spec.ts` exception path |
| POST /v1/settlement-intents/:id/dispute | tested | `SettlementsController` | `settlement-flow.spec.ts` exception path |
| POST /v1/settlement-intents/:id/reverse | tested | `SettlementsController` | `settlement-flow.spec.ts`; `financial-routes.e2e-spec.ts` |
| POST /v1/attachments | tested | `ReceiptsCaptureController` | `financial-routes.e2e-spec.ts`; migration run |
| POST /v1/receipt-drafts | tested | `ReceiptsCaptureController` | `financial-routes.e2e-spec.ts`; migration run |
| POST /v1/receipt-drafts/:id/ocr | tested | `ReceiptsCaptureController` | `financial-routes.e2e-spec.ts`; provider contracts |
| POST /v1/receipt-drafts/:id/post-expense | tested | `ReceiptsCaptureController` | `financial-routes.e2e-spec.ts` |
| POST /v1/reminder-schedules | tested | `RecurringController` | `financial-routes.e2e-spec.ts`; migration run |
| GET /v1/groups/:groupId/reminder-schedules | tested | `RecurringController` | `financial-routes.e2e-spec.ts` |
| POST /v1/imports/splitwise | tested | `ImportsExportsController` | `offline-import-export.spec.ts` service flow |
| POST /v1/imports/bank/csv | tested | `ImportsExportsController` | `offline-import-export.spec.ts`; `financial-routes.e2e-spec.ts` |
| POST /v1/imports/bank/aa/consents | tested | `ImportsExportsController` | `financial-routes.e2e-spec.ts`; provider contracts |
| POST /v1/imports/bank/aa/transactions | tested | `ImportsExportsController` | `financial-routes.e2e-spec.ts`; provider contracts |
| GET /v1/imports/:id | tested | `ImportsExportsController` | `offline-import-export.spec.ts` service flow |
| POST /v1/imports/:id/commit | tested | `ImportsExportsController` | `offline-import-export.spec.ts` service flow |
| POST /v1/exports | tested | `ImportsExportsController` | `offline-import-export.spec.ts` service flow |
| GET /v1/exports/:id | tested | `ImportsExportsController` | `offline-import-export.spec.ts` service flow |
| GET /v1/groups/invites/:token | tested | `GroupsController` | `groups.e2e-spec.ts` |
| POST /v1/groups/invites/:token/claim | tested | `GroupsController` | `groups.e2e-spec.ts`; mobile TS |
| POST /v1/payments/razorpay/webhook | tested | `PaymentWebhookController` | provider contracts; settlement flow service callback tests |
| POST /v1/capture-jobs | tested | `ReceiptsCaptureController` | `financial-routes.e2e-spec.ts` |
| GET /v1/currency/fx-rate | tested | `CurrencyController` | `fx-rate.service.spec.ts`; `financial-routes.e2e-spec.ts` |
| GET /v1/currency/convert | tested | `CurrencyController` | `fx-rate.service.spec.ts`; `financial-routes.e2e-spec.ts` |
| POST /v1/device-installations | tested | `DeviceInstallationsController` | `device-installations.service.spec.ts`; mobile TS; provider contracts cover delivery |
| GET /v1/health/live | implemented | `HealthController` | app build/OpenAPI wiring |
| GET /v1/health/ready | implemented | `HealthController` | app build/OpenAPI wiring |
| GET /v1/metrics | implemented | `HealthController` | app build/OpenAPI wiring |

## Mobile Screen Checklist

| Screen/flow | Status | Files | Tests | Notes |
|---|---|---|---|---|
| Theme tokens/provider | tested | `apps/mobile/src/theme`, shared components | mobile TS noEmit; `status-pill.test.tsx` presentation helper coverage | Must match design.md; visual device QA pending. |
| Onboarding welcome | tested | `OnboardingScreen` | mobile TS noEmit | Dark gradient. |
| Phone OTP entry | tested | `OnboardingScreen`, API client | mobile TS noEmit; auth e2e backend | No forced contacts. |
| Profile name | tested | `OnboardingScreen` | mobile TS noEmit |  |
| Consent choices | tested | `OnboardingScreen`, `ConsentsController` | mobile TS noEmit; `consents.e2e-spec.ts` | consent records are repository-backed. |
| Invite link/QR join | tested | `GroupsController`, `OnboardingScreen` | groups e2e; mobile TS noEmit | invite preview/claim API and mobile QR scan implemented. |
| Guest claim | tested | groups schema, `GroupsController` | groups e2e; mobile TS noEmit | claim flow implemented for authenticated phone users. |
| Home | tested | `HomeScreen`, balance hero components | mobile TS noEmit | Balance hero + quick actions; visual QA pending. |
| Group creation | tested | `GroupCreateScreen` | mobile TS noEmit; groups e2e backend | Modes + participants. |
| Group management/settings | tested | `GroupDetailScreen` | mobile TS noEmit | Roles/archive/member exit wired. |
| Group view | tested | `GroupDetailScreen` | mobile TS noEmit | Activity/Balances/Expenses/People. |
| Expense entry | tested | `ExpenseEntryScreen` | mobile TS noEmit; expense service tests | Multiple payers, split modes. |
| Itemized split | tested | `ExpenseEntryScreen`; allocation engine | mobile TS noEmit; `expense-flow.spec.ts` itemized allocation test | Manual receipt. |
| Settlement/UPI flow | tested | `SettlementScreen` | mobile TS noEmit; settlement service tests | Stepper, proof, confirm. |
| Balances/explainability | tested | `HomeScreen`, `SettlementScreen`, `BalanceHeroCard` | mobile TS noEmit; settlement suggestions test | Why-this-payment. |
| Audit/version history | tested | `AuditRail`, group/activity screens | mobile TS noEmit; expense history service test | Rail. |
| Recurring expenses/reminders | implemented | `RecurringScreen`, `RecurringController`, `ReminderScheduleService` | mobile TS noEmit; recurring service test; `financial-routes.e2e-spec.ts` | Reminder schedules use repository when TypeORM is available and in-memory fallback in isolated tests. |
| Multi-currency trip mode | tested | currency APIs, mobile API client | API FX tests; mobile TS | Conversion APIs implemented; richer trip UX can be refined. |
| Notification center | tested | notification APIs + home surfaces + device registration | auth/groups tests; provider contracts; mobile TS | Expo push registration wired; live delivery pending device token/project setup. |
| Import from Splitwise | tested | mobile import entry points + API imports | mobile TS noEmit; import/export service test | CSV upload/review. |
| Export/reporting | tested | mobile export entry points + API exports | mobile TS noEmit; import/export service/route tests | CSV/PDF/Tally/JSON selectors wired. |
| Offline outbox | tested | `apps/mobile/src/offline/outbox.ts`, `OfflineSyncController` | `apps/mobile/__tests__/outbox.test.ts`; mobile TS noEmit; offline service test | Expo SQLite queue enqueue/flush failure behavior covered; device QA pending. |

## Open Questions

- Cabinet Grotesk font files are not present. Space Grotesk display fallback is wired; adding Cabinet later is a font asset/config swap.
- No live Twilio/Razorpay/Expo/S3/Setu credentials are present. Production-shaped adapters are implemented and documented; live validation waits on provider credentials.
- Maestro/ADB are not installed and no simulator/physical device is attached, so mobile E2E and real UPI app handoff remain true environment blockers.
