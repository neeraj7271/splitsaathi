# SplitSaathi Technical Architecture and Implementation Plan

Research basis: `research-dossier.md`, dated 2026-07-10.

Planning date: 2026-07-10.

Fixed stack:
- Backend: NestJS, TypeORM, PostgreSQL, monorepo.
- Mobile: React Native with Expo. No separate web app is in scope.
- Financial state: event-sourced ledger. Expense creation, edits, settlement, reversals, imports, and compensations are immutable events.
- Payments: UPI-first, payer-initiated intent/deep-link by default. The MVP must not depend on P2P collect requests or payment aggregation.

## 1. Executive Summary

### Architecture At A Glance

SplitSaathi should be built as a mobile-first, event-sourced shared ledger with UPI settlement verification. The core competitive wedge is not "Splitwise with fewer limits"; it is a ledger that can explain, prove, correct, and reconcile shared money events in Indian real life.

The backend is a modular NestJS monorepo organized around bounded contexts:

- Identity and Access: phone OTP, sessions, consent, optional contacts, roles.
- Groups and Participants: flats, trips, couples, subgroups, guest participants, invites, member exits.
- Ledger: immutable event store, balanced postings, projections, invariants, audit history.
- Expenses: expense commands, multiple payers, shares, line items, recurring schedules.
- Settlements: settlement suggestions, settlement state machine, disputes, reversals.
- Payments/UPI: UPI URI/QR generation, provider abstraction, proof handling, optional PSP callbacks later.
- Receipts and Capture: attachment ingestion, OCR abstraction, receipt parsing, share-sheet/manual capture.
- Notifications: neutral reminders, settlement prompts, push delivery, notification center.
- Reporting and Export: search, CSV/PDF/Tally-style exports, settlement certificates.
- Import and Migration: Splitwise CSV/JSON import, duplicate detection, import audit.
- Entitlements: pricing policy without daily core-entry caps, future paid automation bundles.

CQRS is justified here because writes are immutable financial commands and reads are projection-heavy: group balances, settlement suggestions, search, activity feeds, exports, receipt drafts, and sync cursors. Ledger writes append events and balanced postings; read models are rebuildable projections.

### Key Decisions And Why

1. Use event sourcing plus balanced postings for financial state.
   - Dossier basis: payment proof gaps, edit/delete trust anxiety, wrong balances, audit/version history, ledger correctness.
   - Decision: every financial command appends an event and zero-sum postings. Current balances are projections, not mutable source rows.

2. Use payer-initiated UPI deep links/QR for MVP.
   - Dossier basis: UPI-first gap, P2P collect-request constraints, payment-app split features lack ledger.
   - Decision: generate exact UPI intents and store settlement intent state. Manual proof and receiver confirmation ship first; PSP callbacks come later.

3. Make roles and permissions first-class.
   - Dossier basis: Splitwise has no admins or granular edit/delete control.
   - Decision: groups have owner/admin/member/viewer roles, permission policies, edit approvals for sensitive changes, and immutable history.

4. Support high-frequency Indian households from day one.
   - Dossier basis: Bangalore flatmate use case, 20-30 weekly small transactions, free-tier cap backlash.
   - Decision: no daily core-entry cap; fast expense entry; recurring rent/utilities; UPI handoff; optional contact discovery; WhatsApp summary.

5. Do not force contact upload.
   - Dossier basis: India-first competitors get complaints for mandatory contacts and phone+Google sign-in.
   - Decision: phone OTP first, invite links/QR, guest participants, optional contacts with explicit consent.

6. Treat OCR and transaction capture as a phased automation layer.
   - Dossier basis: receipt OCR is valued but hard; platform restrictions make SMS/notification parsing uneven.
   - Decision: Phase 1 supports manual itemization and receipt attachments. Phase 2 adds OCR. Phase 3 adds deeper Android capture and optional financial-data import.

7. Use REST plus OpenAPI, not GraphQL.
   - Dossier basis: single mobile client, command idempotency, file upload, explicit state machines.
   - Decision: REST is simpler for idempotent financial commands and Expo file upload. OpenAPI generates typed mobile clients.

8. Build offline command queue early, full offline read cache later.
   - Dossier basis: offline/travel reliability and sync/data-loss complaints.
   - Decision: Phase 1 supports offline drafts and queued creates/proofs. Phase 2 expands to projection cache and conflict UI.

## 2. Traceability Matrix

Phases:
- Phase 1: shippable MVP.
- Phase 2: differentiation and automation.
- Phase 3: regulated/deeper integrations and scale features.
- Descoped means deliberately not built under the fixed "mobile-only/no web app" or regulatory constraints.

### Pain Point Catalog Coverage

| ID | Dossier item | Solving component/screen/table | Phase | Notes |
|---|---|---|---|---|
| P1.1 | Manual "paid" state is not proof of payment | Settlements module; `settlement_intents`, `payment_proofs`, `ledger_postings`; UPI settlement flow; receiver confirmation screen | 1 | Manual proof + payee confirmation in MVP; PSP callback in Phase 2. |
| P1.2 | Debt simplification can be correct but socially distrusted | Settlement Suggestion service; trust-boundary settings on group/subgroup; "why this payment" bottom sheet | 1 | Greedy with explanations in MVP; exact optimizer in Phase 2. |
| P1.3 | Settle-up recommendations can feel wrong | `settlement_suggestion_projection`; balance explanation screen | 1 | Every suggestion shows net positions and route rationale. |
| P1.4 | Calculation correctness is a purchase blocker | Ledger invariant tests; `ledger_postings`; audit/version screen; projection rebuild tests | 1 | Financial math is event-backed and explainable. |
| P1.5 | Edits/deletes by any group member create trust concerns | Group roles; `expense_versions`; `ExpenseAdjusted`, `ExpenseVoided`; approval policies; audit screen | 1 | No destructive mutation; large/old edits can require approval. |
| P1.6 | Deleted groups/bills and old history need recoverability | `groups.state=archived/deleted_for_user`; event store; restore action; export jobs | 1 | Financial groups are archived, not physically deleted. |
| P2.1 | Currency conversion is treated as premium by Splitwise | Currency module; `fx_rate_snapshots`; multi-currency trip mode | 2 | Phase 1 INR-first with per-currency-safe model; full FX in Phase 2. |
| P2.2 | Explicit INR handling and regional formatting | Currency minor-unit service; INR default; amount input component; `currencies` table | 1 | INR is first-class in MVP. |
| P2.3 | Rounding in shares/weights creates unfairness | RoundingAllocation service; `rounding_residual_allocations`; visible rounding row in expense review | 1 | Deterministic largest-remainder allocation. |
| P3.1 | Splitwise is not UPI-native | Payments/UPI module; UPI URI/QR; UPI handoff history; settlement flow | 1 | Payer-initiated UPI intent first. |
| P3.2 | P2P collect-request changes constrain request-money design | UPI state machine defaults to payer intent; no collect in MVP | 1 | Collect/aggregation deferred until regulated PSP/PA path exists. |
| P3.3 | Bank-linking automates settlement but creates privacy fear | Consent module; optional Capture/FinancialImport port; consent dashboard | 3 | Bank/AA import deferred; no forced bank linking. |
| P4.1 | Recurring rent/utilities are table stakes but not enough | Recurring Expenses module; `recurring_expense_schedules`; neutral reminders; UPI settle prompts | 1 | Monthly recurring bills ship in MVP. |
| P4.2 | Multiple payers and mixed-beneficiary expenses remain friction | Expense command model; `expense_payers`; `expense_shares`; itemized split screen | 1 | Multiple payers and beneficiaries are core. |
| P4.3 | Itemized receipts require tax/service charge/discount logic | Receipt itemization model; allocation engine; `expense_line_items`, `bill_adjustments` | 1/2 | Manual itemization in Phase 1; OCR-assisted in Phase 2. |
| P5.1 | No admins or permissions in Splitwise | Groups module; `group_role_permissions`; policy guards; role management screen | 1 | Owner/admin/member/viewer from MVP. |
| P5.2 | Removing members requires zero balance | Member exit workflow; `membership_status=inactive_locked`; `ObligationTransferred` event | 1 | Member can be locked/excluded while balance remains. |
| P5.3 | Archived groups and trip clutter | `groups.state`; archive action; group list filters | 1 | Archive, do not delete. |
| P6.1 | Reminder tone matters | Notifications module; neutral reminder templates; settlement day flow | 2 | Basic reminders Phase 1; tone controls and group-wide nudges Phase 2. |
| P6.2 | Reminder reliability is part of ledger trust | `notification_deliveries`; push token table; in-app notification center | 1/2 | Critical settlement notifications in Phase 1; full center in Phase 2. |
| P7.1 | Receipt scanning is paywalled in Splitwise Pro | Receipts/OCR module; OCR provider port; itemized split screen | 2 | Manual itemized split Phase 1; OCR is Phase 2 automation. |
| P7.2 | Digital receipt/gallery import is unmet | Attachment service; Expo ImagePicker; gallery/screenshot receipt upload | 1 | Image attachment in MVP; OCR parsing in Phase 2. |
| P7.3 | OCR confidence and correction matter | `receipt_ocr_results`; confidence flags; correction UI | 2 | Required before OCR-generated expense can post. |
| P8.1 | Daily entry caps are loudest monetization complaint | Entitlements policy; API rate-limits only for abuse; no core-entry cap | 1 | Explicit product rule, not just UI. |
| P8.2 | Users resent subscriptions for simple ledgers | Entitlements module; pricing policy; paid automation not core ledger | 3 | Billing can wait; architecture reserves entitlement checks. |
| P8.3 | Users pay for automation, not artificial scarcity | Entitlements around OCR, advanced import, business reports, cloud storage | 2/3 | Core ledger remains uncapped. |
| P9.1 | Mandatory contact upload is an anti-pattern | Identity/Contacts; optional contact import; invite links/QR; guest participants | 1 | No contact permission required for first value. |
| P9.2 | Bank/account access requires explicit consent | Consent records; optional FinancialImport adapter; privacy dashboard | 3 | No bank linking in MVP. |
| P9.3 | Shared financial data can damage relationships if opaque | Audit/version history; comments; dispute flags; evidence attachments | 1/2 | Comments and audit Phase 1; richer disputes Phase 2. |
| P10.1 | Offline mode is a travel differentiator | Mobile SQLite command outbox; offline drafts; sync endpoint | 1/2 | Queue commands in Phase 1; full read-cache and conflict UI Phase 2. |
| P10.2 | Sync/data loss is catastrophic | Event store, projection rebuilds, local command idempotency, backup/export | 1 | Server source of truth is immutable. |
| P10.3 | New entrant reliability concerns | Test strategy, observability, migration tests, error reporting | 1 | Foundational engineering requirement. |
| P11.1 | Core job is reducing awkwardness, not just math | Neutral copy system; settlement day; reminder templates; UPI proof flow | 1/2 | MVP avoids blame language; advanced tone controls Phase 2. |
| P11.2 | "Everyone install this app" is adoption friction | Guest participants; invite links; WhatsApp summaries; optional claim account | 1 | Public web page is descoped by mobile-only constraint. |
| P11.3 | Minimal UX is loved until complex real life appears | Progressive disclosure modes; Calm Precision design system; advanced drawers | 1 | Hide advanced controls until context needs them. |
| P12.1 | Search and export are not luxuries | Search projection; CSV export; export screen | 1/2 | Basic search/export Phase 1; PDF/Tally Phase 2. |
| P12.2 | Tally/accounting-style summaries may matter | Reporting/Export module; monthly statements; Tally-style CSV | 2/3 | Small-business exports after consumer MVP. |
| P13.1 | Friend invites and contact syncing are fragile | Invite links, QR, guest participants, optional contacts | 1 | Default path does not require contacts. |
| P13.2 | Migration from Splitwise is acquisition path | Import module; Splitwise CSV/JSON parser; import review screen | 1 | Shipped in MVP to capture switchers. |

### Prioritized Opportunity Coverage

| ID | Opportunity | Solving component/screen/table | Phase | Notes |
|---|---|---|---|---|
| O1 | UPI verified settlement lifecycle | Settlements + Payments/UPI; settlement state machine; `payment_proofs` | 1 | PSP callbacks Phase 2. |
| O2 | No daily cap for core entries | Entitlements policy; API throttling strategy | 1 | Abuse limits only. |
| O3 | Immutable audit log and approval workflow | Event store; `expense_versions`; group policy engine | 1 | Approval threshold configurable by group. |
| O4 | Share-sheet/WhatsApp/SMS/notification capture | Capture pipeline; share target; parsers; consent records | 2/3 | Manual paste/share Phase 2; SMS/notification limited to Android and deferred. |
| O5 | Splitwise CSV/JSON import | Import module; `import_jobs`, `import_items`; review screen | 1 | CSV first; JSON backup when format available. |
| O6 | Optional contacts, invite links, guest participants | Identity/Groups; invite screen; guest claim flow | 1 | No forced contact upload. |
| O7 | AI receipt itemizer with gallery/screenshot import | Receipts/OCR provider port; itemized split UI | 2 | Attachment + manual itemization Phase 1. |
| O8 | Subgroups, couples, family units, move-out flows | Participants hierarchy; `participant_memberships`; member exit workflow | 1 | Foundation in MVP. |
| O9 | Recurring rent/utilities with UPI reminders | Recurring Expenses + Notifications + UPI settle prompt | 1 | Monthly/weekly recurrence first. |
| O10 | Deterministic multi-currency with FX snapshots | Currency module; `fx_rate_snapshots`; trip mode | 2 | INR-first in MVP, schema ready. |
| O11 | Explainable settlement graph and exact optimizer | Settlement Suggestion service; exact DP optimizer | 1/2 | Explanation Phase 1; exact small-group optimizer Phase 2. |
| O12 | Neutral reminders and scheduled settlement days | Notifications module; settlement day screen | 2 | Basic reminders Phase 1. |
| O13 | CSV/PDF/Tally-style exports | Reporting/Export module | 1/2 | CSV Phase 1; PDF/Tally Phase 2. |
| O14 | Offline-first local queue and sync conflict UI | Mobile SQLite outbox; sync API; conflict resolver | 1/2 | Queue Phase 1; robust conflict UI Phase 2. |
| O15 | Optional on-device parsing and consent dashboard | Consent module; Capture module; privacy settings | 2/3 | Consent dashboard Phase 2; bank/AA import Phase 3. |
| O16 | Progressive disclosure modes | Group creation mode selector; UI component policy | 1 | Trip/flat/couple/event setup drives defaults. |
| O17 | Google Pay/PhonePe/Paytm handoff history | UPI app selector; settlement intent timeline; `upi_app_open_events` | 1 | Cannot guarantee app completion without proof/callback. |
| O18 | Monthly statements and settlement certificates | Reporting; `export_jobs`; statement screen | 2 | Certificates useful after settlements are stable. |
| O19 | Expense comments, dispute flags, evidence attachments | Ledger comments/evidence; dispute state machine | 1/2 | Comments/evidence Phase 1; formal dispute workflow Phase 2. |
| O20 | Public read-only balance page and WhatsApp summary | WhatsApp summary share; guest deep link; read-only mobile view | 1/2 | Public web page descoped because there is no web client; mobile-readable summary ships instead. |

## 3. Backend Architecture

### 3.1 Monorepo Structure

Recommended structure:

```text
apps/
  api/                         # NestJS API
  mobile/                      # Expo React Native app
packages/
  contracts/                   # OpenAPI-generated DTO types, zod schemas, shared enums
  domain/                      # Pure TypeScript domain models, value objects, policies
  db/                          # TypeORM entities, migrations, fixtures
  testing/                     # ledger property-test helpers, API test factories
  config/                      # typed env schema, feature flags
```

Rules:
- `packages/domain` has no NestJS, TypeORM, or HTTP imports.
- `apps/api` wires domain services to persistence, queues, providers, guards, and controllers.
- `packages/contracts` owns API request/response schemas shared by API and mobile.
- TypeORM migrations live in `packages/db/src/migrations` and are executed by `apps/api` using a single data source config.

### 3.2 Bounded Contexts And NestJS Modules

#### IdentityAccessModule

Responsibilities:
- Phone OTP auth, refresh tokens, device sessions, user profile.
- Optional contact discovery.
- Consent records for contacts, receipts, payment proof, notification, and future financial-data import.
- Authorization primitives used by other modules.

Does not own:
- Group roles beyond evaluating policies supplied by Groups.
- Financial ledger events.
- Payment movement.

Key entities:
- `User`, `AuthIdentity`, `OtpChallenge`, `RefreshSession`, `DeviceInstallation`, `ConsentRecord`, `ContactAlias`.

SOLID:
- `OtpProviderPort` lets SMS/WhatsApp OTP providers be swapped without touching auth use cases.
- `ConsentPolicyService` has one responsibility: evaluate consent and purpose. It does not send OTPs or write ledger events.
- Guards depend on `AuthorizationPort`, not concrete group repositories.

#### GroupsModule

Responsibilities:
- Groups, group modes, participants, guest participants, subgroups, couples/family units, memberships, roles, invites, archive, member exit.
- Permission policy definitions.

Does not own:
- Balance math. It asks Ledger projections for balances.
- Settlement payment state.
- OCR.

Key aggregates:
- `GroupAggregate`
- `ParticipantAggregate`
- `MembershipAggregate`

Key events:
- `GroupCreated`, `GroupArchived`, `ParticipantInvited`, `ParticipantClaimed`, `MembershipRoleChanged`, `MemberLockedForExit`, `ObligationTransferred`.

SOLID:
- `GroupPolicy` is isolated from controllers.
- `MembershipExitStrategy` supports lock-only and transfer-obligation flows through a common interface.

#### LedgerModule

Responsibilities:
- Event store append/load.
- Optimistic concurrency.
- Idempotency.
- Balanced postings.
- Projection orchestration.
- Audit/version history.
- Ledger invariants.

Does not own:
- UPI URI generation.
- OCR parsing.
- Notification delivery.

Key services:
- `EventStore`
- `LedgerPostingWriter`
- `LedgerInvariantService`
- `ProjectionRunner`
- `IdempotencyService`
- `AuditQueryService`

SOLID:
- Write model and read model are separated: `AppendEventUseCase` never queries `group_balance_projection`.
- Projectors implement `Projector<EventType>` and can be added without modifying the event store.
- Domain command handlers depend on `EventStorePort`, not a TypeORM repository.

#### ExpensesModule

Responsibilities:
- Expense drafts, creation, adjustment, voiding.
- Multiple payers.
- Equal/exact/percentage/share/weighted splits.
- Itemized line items and bill adjustments.
- Recurring expense schedules and generation.

Does not own:
- Settlement suggestions.
- Payment confirmation.
- OCR provider integration, except consuming receipt drafts.

Key aggregates:
- `ExpenseAggregate`
- `RecurringScheduleAggregate`

Key events:
- `ExpenseCreated`
- `ExpenseAdjusted`
- `ExpenseVoided`
- `RecurringScheduleCreated`
- `RecurringExpenseGenerated`
- `ExpenseCommentAdded`
- `ExpenseEvidenceAttached`

SOLID:
- `SplitStrategy` interface: `EqualSplitStrategy`, `ExactAmountSplitStrategy`, `WeightedShareSplitStrategy`, `ItemizedSplitStrategy`.
- `RoundingAllocator` is a standalone deterministic service.
- `ExpenseCommandHandler` validates and emits events; it does not update projections.

#### SettlementsModule

Responsibilities:
- Net balance calculation from projections.
- Settlement suggestions.
- Greedy settlement optimizer.
- Exact small-group optimizer in Phase 2.
- Settlement state machine.
- Disputes, reversals, refunds.

Does not own:
- UPI provider details.
- Receipt parsing.
- Identity auth.

Key events:
- `SettlementIntentCreated`
- `PaymentProofSubmitted`
- `PaymentAutoMatched`
- `PaymentProofRejected`
- `SettlementConfirmed`
- `SettlementRecorded`
- `SettlementDisputed`
- `SettlementReversed`
- `SettlementIntentExpired`
- `DuplicatePaymentReferenceDetected`
- `PartialPaymentDetected`
- `RefundRecorded`

SOLID:
- `SettlementOptimizer` interface supports `GreedySettlementOptimizer` and `ExactDpSettlementOptimizer`.
- `SettlementStateMachine` is pure domain logic and can be exhaustively tested.

#### PaymentsUpiModule

Responsibilities:
- UPI URI/deep-link construction.
- QR payload generation.
- Preferred app handoff metadata.
- PSP/payment-gateway adapter interface for Phase 2 callbacks.
- UTR/reference normalization.
- Webhook verification when a provider exists.

Does not own:
- Ledger posting.
- Receiver confirmation.
- Group balances.

Key ports:
- `UpiIntentProviderPort`
- `QrCodeProviderPort`
- `PaymentGatewayPort`
- `WebhookVerifierPort`
- `PaymentReferenceNormalizerPort`

SOLID:
- Dependency inversion is non-negotiable: settlements depend on `PaymentInitiationPort`, not Razorpay/Cashfree/Paytm SDKs.
- Interface segregation keeps URI generation separate from callback reconciliation.

#### ReceiptsCaptureModule

Responsibilities:
- Attachment upload.
- Receipt OCR orchestration.
- Receipt draft parse and correction.
- Gallery/screenshot/image ingestion.
- Share-sheet/manual text capture.
- Merchant parser templates.

Does not own:
- Final financial posting. It creates drafts; Expenses posts events.
- Payment settlement.

Key events:
- `AttachmentUploaded`
- `ReceiptOcrRequested`
- `ReceiptOcrCompleted`
- `ReceiptDraftCorrected`
- `CaptureTextParsed`

SOLID:
- `OcrProviderPort` supports Google ML Kit, AWS Textract, Azure, or custom OCR.
- `ReceiptParserStrategy` is open for Indian merchants without changing the pipeline.

#### NotificationsModule

Responsibilities:
- Neutral reminder templates.
- Push and in-app notifications.
- Delivery tracking.
- Scheduled settlement day and recurring bill reminders.

Does not own:
- Ledger state.
- Payment state transitions except via commands from user/system.

Key entities:
- `Notification`, `NotificationDelivery`, `ReminderSchedule`, `PushToken`.

SOLID:
- `NotificationTemplateRenderer` is separate from `NotificationDeliveryPort`.
- Delivery adapters are swappable: Expo Push first, FCM/APNs later if needed.

#### ReportingExportModule

Responsibilities:
- Search projection queries.
- CSV/PDF/Tally-style exports.
- Monthly statements.
- Settlement certificates.
- Data portability exports.

Does not own:
- Source financial state.
- Import parsing.

Key entities:
- `ExportJob`, `ExportFile`, `StatementSnapshot`.

SOLID:
- Export builders implement `ExportRenderer` for CSV, PDF, Tally CSV, JSON.

#### ImportMigrationModule

Responsibilities:
- Splitwise CSV/JSON import.
- Import review, duplicate detection, external ID mapping.
- Import events into ledger.

Does not own:
- Ledger append implementation.
- Long-term reporting.

Key entities:
- `ImportJob`, `ImportItem`, `ExternalEntityMap`.

SOLID:
- `ImportParser` interface supports Splitwise CSV first, Splitwise JSON later, and other sources later.

#### EntitlementsModule

Responsibilities:
- Product entitlement checks.
- Future paid automation bundles.
- Abuse-throttle policy separate from monetization.

Does not own:
- Ledger correctness or auth.

MVP rule:
- Core expense entry, groups, search basics, settlement, import, and CSV export must not be daily-capped.

### 3.3 CQRS Decision

Use CQRS for ledger-backed features.

Why it is justified:
- The write side must preserve immutable facts with optimistic concurrency and idempotency.
- The read side needs fast mobile queries: group list, balances, settlement suggestions, activity, search, exports, receipt drafts, notification center.
- Projection rebuild is a direct response to sync/data-loss and calculation-trust findings.

Where not to overdo it:
- Do not create separate microservices.
- Keep command handlers and query services in the same NestJS app.
- Use one PostgreSQL database with separate event/projection tables.

### 3.4 Event-Sourcing Design

#### Event Store Tables

`event_store`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | Event id. |
| `stream_id` | text | Example: `group:{groupId}`, `expense:{expenseId}`. |
| `aggregate_type` | text | `Group`, `Expense`, `SettlementIntent`, etc. |
| `aggregate_id` | uuid | Aggregate id. |
| `group_id` | uuid nullable | Denormalized for group replay/search. |
| `version` | integer | Aggregate stream version. |
| `global_position` | bigserial unique | Projection cursor. |
| `event_type` | text | Versioned event name. |
| `event_schema_version` | integer | Event payload schema version. |
| `actor_user_id` | uuid nullable | System events allowed. |
| `idempotency_key` | text nullable | Client or webhook idempotency. |
| `correlation_id` | uuid | Request workflow id. |
| `causation_id` | uuid nullable | Event or command that caused this. |
| `occurred_at` | timestamptz | Server commit time. |
| `payload` | jsonb | Domain event data. |
| `metadata` | jsonb | Device, app version, IP hash, consent purpose. |
| `previous_hash` | text nullable | Tamper-evident chain per stream. |
| `event_hash` | text | Hash of event data plus previous hash. |

Constraints:
- `unique(stream_id, version)`
- `unique(idempotency_key)` where not null for command scopes that require uniqueness
- `index(group_id, global_position)`
- `index(event_type, occurred_at)`
- `gin(payload jsonb_path_ops)` only for debugging/admin queries, not product reads

`ledger_postings`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | Posting id. |
| `event_id` | uuid fk event_store | Source event. |
| `group_id` | uuid | Required. |
| `participant_id` | uuid | Ledger account owner. |
| `currency_code` | char(3) | ISO code, INR default. |
| `signed_amount_minor` | bigint | Positive means participant is owed; negative means participant owes. |
| `posting_type` | text | `expense_payment`, `expense_share`, `settlement_paid`, `settlement_received`, `fx_close`, etc. |
| `source_type` | text | `expense`, `settlement`, `obligation_transfer`, etc. |
| `source_id` | uuid | Expense/settlement id. |
| `created_at` | timestamptz | Same transaction as event append. |

Invariant:
- For every financial event, the sum of `signed_amount_minor` grouped by `currency_code` must equal zero.
- Enforcement is both application-level and DB-level:
  - Domain command handler constructs postings through `BalancedPostingSet`.
  - `appendFinancialEvent()` inserts event and postings in one transaction.
  - A database function `assert_event_postings_balanced(event_id)` runs before commit or before marking an event as dispatchable.
  - Property tests generate random payer/share combinations and assert zero-sum.

`idempotency_records`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `scope` | text | `expense.create`, `settlement.proof`, `webhook.razorpay`, `import.item`. |
| `actor_key` | text | User id, device id, or provider id. |
| `idempotency_key` | text | Client `Idempotency-Key` or provider event id. |
| `request_hash` | text | Detects reuse with different payload. |
| `status` | text | `processing`, `succeeded`, `failed`. |
| `response_snapshot` | jsonb nullable | Safe replay response. |
| `created_at` | timestamptz | |
| `expires_at` | timestamptz nullable | Longer retention for payments/imports. |

Constraints:
- `unique(scope, actor_key, idempotency_key)`

`projection_checkpoints`

| Column | Type | Notes |
|---|---|---|
| `projector_name` | text pk | |
| `last_global_position` | bigint | |
| `projector_version` | integer | Increment on projection schema change. |
| `updated_at` | timestamptz | |

#### Aggregate Versioning

Command flow:
1. Controller validates DTO and idempotency key.
2. Command handler loads aggregate events by `stream_id`.
3. Aggregate method validates command and returns new domain event(s).
4. Financial events include a `BalancedPostingSet`.
5. Event store appends with `expected_version`.
6. If `unique(stream_id, version)` fails, return 409 with latest version and relevant activity for mobile rebase.

#### Projection Design

Core projections:
- `group_balance_projection`: current participant balances per group/currency.
- `expense_projection`: current expense state.
- `expense_version_projection`: visible version history.
- `activity_feed_projection`: user-facing ledger timeline.
- `settlement_suggestion_projection`: cached suggestions.
- `search_projection`: tsvector-indexed expense/search rows.
- `notification_projection`: notification center.
- `sync_projection_changes`: mobile incremental sync cursor.

Projection rebuild:
- Projectors are deterministic and idempotent.
- Rebuild uses a shadow table: `group_balance_projection_rebuild_vN`.
- Replay from `event_store.global_position=0`.
- Swap tables transactionally after checksum verification.
- Keep projector versions in `projection_checkpoints`.

#### Corrections, Edits, Deletes

No posted financial event is mutated.

Expense edit:
- User submits `AdjustExpenseCommand` with `expense_id`, `base_expense_version`, new payer/share/item model, reason, and idempotency key.
- Backend loads current expense version.
- If version mismatch, return conflict and require user review.
- Domain calculates delta postings:
  - Reverse previous live expense postings.
  - Apply new expense postings.
  - Store both in one `ExpenseAdjusted` event or two linked posting groups under the same event.
- `expense_version_projection` stores before/after diff.
- Activity feed shows "edited amount/split/payers" with actor and reason.

Expense delete:
- Product label: "Void expense".
- Event: `ExpenseVoided`.
- Postings reverse the current live expense.
- Expense remains in audit, search if "include voided" is enabled, and exports.

Group delete:
- Product label: "Archive" unless the group has no financial events.
- `GroupArchived` hides from main list but keeps events.

### 3.5 Logical Data Model / ERD

This is a logical ERD. TypeORM entities should mirror these tables, but domain objects should remain separate from TypeORM entities.

#### Identity And Consent

`users`
- `id uuid pk`
- `phone_e164 encrypted nullable`
- `phone_hash text unique nullable`
- `display_name text`
- `avatar_attachment_id uuid nullable`
- `default_currency_code char(3) default 'INR'`
- `locale text default 'en-IN'`
- `status text` (`active`, `deactivated`, `deleted_pending`)
- `created_at`, `updated_at`

`auth_identities`
- `id uuid pk`
- `user_id uuid fk`
- `provider text` (`phone_otp`, `google`, `apple`)
- `provider_subject text`
- `created_at`
- Unique: `(provider, provider_subject)`

`otp_challenges`
- `id uuid pk`
- `phone_hash text`
- `otp_hash text`
- `purpose text` (`login`, `claim_invite`)
- `attempt_count int`
- `expires_at timestamptz`
- `consumed_at timestamptz nullable`

`refresh_sessions`
- `id uuid pk`
- `user_id uuid fk`
- `device_id uuid`
- `refresh_token_hash text`
- `expires_at`, `revoked_at`, `created_at`

`device_installations`
- `id uuid pk`
- `user_id uuid fk nullable`
- `platform text` (`ios`, `android`)
- `app_version text`
- `push_token text nullable`
- `last_seen_at timestamptz`

`consent_records`
- `id uuid pk`
- `user_id uuid fk`
- `purpose text` (`contacts_discovery`, `receipt_upload`, `upi_proof_storage`, `notification_delivery`, `financial_import`)
- `status text` (`granted`, `revoked`)
- `source text` (`onboarding`, `settings`, `capture_flow`)
- `metadata jsonb`
- `granted_at timestamptz nullable`
- `revoked_at timestamptz nullable`

`contact_aliases`
- `id uuid pk`
- `owner_user_id uuid fk`
- `phone_hash text`
- `display_name text nullable`
- `source text` (`manual`, `contacts_import`)
- `created_at`
- Unique: `(owner_user_id, phone_hash)`

#### Groups, Participants, Roles

`groups`
- `id uuid pk`
- `name text`
- `mode text` (`flat`, `trip`, `couple`, `event`, `business`, `custom`)
- `base_currency_code char(3) default 'INR'`
- `state text` (`active`, `archived`, `deleted_empty`)
- `created_by_user_id uuid fk`
- `created_at`, `archived_at nullable`

`participants`
- `id uuid pk`
- `registered_user_id uuid nullable fk users`
- `participant_type text` (`individual`, `guest`, `couple`, `household`, `subgroup`)
- `display_name text`
- `phone_hash text nullable`
- `guest_claim_token_hash text nullable`
- `state text` (`active`, `claimed`, `inactive`)
- `created_at`

`group_memberships`
- `id uuid pk`
- `group_id uuid fk`
- `participant_id uuid fk`
- `role text` (`owner`, `admin`, `member`, `viewer`)
- `status text` (`active`, `inactive_locked`, `removed_zero_balance`, `transferred_obligation`)
- `joined_at`, `left_at nullable`
- `locked_at nullable`
- Unique: `(group_id, participant_id)`

`participant_relationships`
- `id uuid pk`
- `group_id uuid fk`
- `parent_participant_id uuid fk participants`
- `child_participant_id uuid fk participants`
- `relationship_type text` (`couple_member`, `household_member`, `subgroup_member`)
- `default_weight_numerator bigint default 1`
- `default_weight_denominator bigint default 1`
- `active boolean`

`group_role_permissions`
- `id uuid pk`
- `group_id uuid fk`
- `role text`
- `permission text` (`expense_create`, `expense_edit_own`, `expense_edit_any`, `expense_void`, `settlement_confirm`, `member_invite`, `member_role_change`, `export`, `archive`)
- `enabled boolean`
- Unique: `(group_id, role, permission)`

`group_invites`
- `id uuid pk`
- `group_id uuid fk`
- `created_by_user_id uuid fk`
- `invite_token_hash text unique`
- `intended_phone_hash text nullable`
- `role_on_accept text default 'member'`
- `expires_at timestamptz`
- `accepted_at timestamptz nullable`

#### Ledger And Projections

`event_store`, `ledger_postings`, `idempotency_records`, `projection_checkpoints` as above.

`group_balance_projection`
- `group_id uuid`
- `participant_id uuid`
- `currency_code char(3)`
- `balance_minor bigint`
- `last_global_position bigint`
- Primary key: `(group_id, participant_id, currency_code)`
- Index: `(participant_id, currency_code)`

`activity_feed_projection`
- `id uuid pk`
- `group_id uuid`
- `event_id uuid`
- `actor_user_id uuid nullable`
- `activity_type text`
- `title text`
- `body text`
- `amount_minor bigint nullable`
- `currency_code char(3) nullable`
- `entity_type text`
- `entity_id uuid`
- `occurred_at timestamptz`
- Index: `(group_id, occurred_at desc)`

`search_projection`
- `id uuid pk`
- `group_id uuid`
- `entity_type text`
- `entity_id uuid`
- `title text`
- `body text`
- `amount_minor bigint nullable`
- `currency_code char(3) nullable`
- `occurred_at timestamptz`
- `search_vector tsvector`
- GIN index: `search_vector`
- Btree index: `(group_id, occurred_at desc)`

#### Expenses

`expense_projection`
- `id uuid pk`
- `group_id uuid`
- `current_version int`
- `state text` (`active`, `voided`)
- `description text`
- `category text nullable`
- `expense_date date`
- `total_amount_minor bigint`
- `currency_code char(3)`
- `created_by_user_id uuid`
- `last_event_id uuid`
- `created_at`, `updated_at`, `voided_at nullable`
- Index: `(group_id, expense_date desc)`

`expense_payers`
- `id uuid pk`
- `expense_id uuid`
- `participant_id uuid`
- `amount_minor bigint`
- `currency_code char(3)`
- `source text` (`cash`, `upi`, `card`, `unknown`)
- Unique: `(expense_id, participant_id, currency_code)`

`expense_shares`
- `id uuid pk`
- `expense_id uuid`
- `participant_id uuid`
- `share_type text` (`equal`, `exact`, `percent`, `weight`, `itemized`)
- `weight_numerator bigint nullable`
- `weight_denominator bigint nullable`
- `amount_minor bigint`
- `currency_code char(3)`
- `rounding_delta_minor bigint default 0`
- Unique: `(expense_id, participant_id, currency_code)`

`expense_line_items`
- `id uuid pk`
- `expense_id uuid`
- `receipt_draft_id uuid nullable`
- `label text`
- `quantity numeric(12,4) default 1`
- `unit_amount_minor bigint`
- `gross_amount_minor bigint`
- `currency_code char(3)`
- `taxable boolean default true`
- `confidence numeric(5,4) nullable`
- `position int`

`expense_line_item_assignments`
- `id uuid pk`
- `line_item_id uuid`
- `participant_id uuid`
- `weight_numerator bigint`
- `weight_denominator bigint`
- `amount_minor bigint`
- `rounding_delta_minor bigint default 0`

`bill_adjustments`
- `id uuid pk`
- `expense_id uuid`
- `adjustment_type text` (`tax`, `gst_cgst`, `gst_sgst`, `service_charge`, `tip`, `discount`, `rounding`)
- `label text`
- `amount_minor bigint`
- `allocation_basis text` (`subtotal_proportional`, `equal`, `manual`, `taxable_items_only`)
- `currency_code char(3)`

`rounding_residual_allocations`
- `id uuid pk`
- `source_type text` (`expense`, `line_item`, `bill_adjustment`, `fx`)
- `source_id uuid`
- `participant_id uuid`
- `currency_code char(3)`
- `residual_minor bigint`
- `reason text`
- Index: `(source_type, source_id)`

`expense_version_projection`
- `id uuid pk`
- `expense_id uuid`
- `version int`
- `event_id uuid`
- `actor_user_id uuid`
- `change_summary jsonb`
- `snapshot jsonb`
- `reason text nullable`
- `created_at`
- Unique: `(expense_id, version)`

`expense_comments`
- `id uuid pk`
- `expense_id uuid`
- `event_id uuid`
- `author_user_id uuid`
- `body text`
- `created_at`

`evidence_attachments`
- `id uuid pk`
- `entity_type text` (`expense`, `settlement`, `dispute`)
- `entity_id uuid`
- `attachment_id uuid`
- `event_id uuid`
- `uploaded_by_user_id uuid`
- `created_at`

#### Recurring Expenses

`recurring_expense_schedules`
- `id uuid pk`
- `group_id uuid`
- `state text` (`active`, `paused`, `ended`)
- `template jsonb` | normalized expense draft, payers/shares/category
- `frequency text` (`weekly`, `monthly`, `custom_rrule`)
- `rrule text nullable`
- `next_run_at timestamptz`
- `reminder_days_before int default 2`
- `created_by_user_id uuid`
- `created_at`, `updated_at`

`recurring_occurrences`
- `id uuid pk`
- `schedule_id uuid`
- `expense_id uuid nullable`
- `scheduled_for date`
- `state text` (`pending`, `generated`, `skipped`, `failed`)
- Unique: `(schedule_id, scheduled_for)`

#### Currency And FX

`currencies`
- `code char(3) pk`
- `minor_unit int`
- `symbol text`
- `display_locale text`
- `enabled boolean`

`fx_rate_snapshots`
- `id uuid pk`
- `base_currency_code char(3)`
- `quote_currency_code char(3)`
- `rate_numerator bigint`
- `rate_denominator bigint`
- `provider text`
- `as_of timestamptz`
- `source_metadata jsonb`
- Unique: `(base_currency_code, quote_currency_code, provider, as_of)`

FX rule:
- Store rates as rational numerator/denominator, not floating point.
- FX conversion events must create balanced close/open postings and reference a snapshot.

#### Settlements And UPI

`settlement_intents`
- `id uuid pk`
- `group_id uuid`
- `payer_participant_id uuid`
- `payee_participant_id uuid`
- `amount_minor bigint`
- `currency_code char(3)`
- `state text`
- `suggestion_id uuid nullable`
- `upi_uri text nullable`
- `upi_payee_vpa_encrypted text nullable`
- `upi_payee_name text nullable`
- `preferred_upi_app text nullable` (`gpay`, `phonepe`, `paytm`, `bhim`, `other`)
- `client_reference text unique`
- `provider_name text nullable`
- `provider_payment_id text nullable`
- `expires_at timestamptz`
- `created_by_user_id uuid`
- `created_at`, `updated_at`
- Index: `(group_id, state, created_at desc)`

`upi_app_open_events`
- `id uuid pk`
- `settlement_intent_id uuid`
- `app_name text`
- `platform text`
- `opened_at timestamptz`
- `client_metadata jsonb`

`payment_proofs`
- `id uuid pk`
- `settlement_intent_id uuid`
- `submitted_by_user_id uuid`
- `proof_type text` (`screenshot`, `utr_text`, `provider_callback`, `manual_note`)
- `attachment_id uuid nullable`
- `upi_reference_hash text nullable`
- `claimed_amount_minor bigint`
- `currency_code char(3)`
- `paid_at timestamptz nullable`
- `status text` (`submitted`, `auto_matched`, `needs_receiver_confirmation`, `accepted`, `rejected`, `disputed`)
- `ocr_extracted jsonb nullable`
- `created_at`
- Index: `(settlement_intent_id, created_at desc)`
- Partial unique suggestion: `(group_id, upi_reference_hash)` through materialized column or trigger when UTR exists.

`settlement_confirmations`
- `id uuid pk`
- `settlement_intent_id uuid`
- `confirmed_by_user_id uuid`
- `decision text` (`accept`, `reject`, `dispute`, `accept_partial`)
- `amount_minor bigint nullable`
- `reason text nullable`
- `created_at`

#### Attachments, Receipts, Capture

`attachments`
- `id uuid pk`
- `owner_user_id uuid`
- `storage_key text`
- `mime_type text`
- `byte_size bigint`
- `sha256 text`
- `purpose text` (`receipt`, `payment_proof`, `avatar`, `export`)
- `created_at`
- Index: `(owner_user_id, created_at desc)`

`receipt_drafts`
- `id uuid pk`
- `group_id uuid`
- `attachment_id uuid nullable`
- `source text` (`gallery`, `camera`, `screenshot`, `share_sheet`, `manual_text`)
- `state text` (`uploaded`, `ocr_pending`, `needs_review`, `reviewed`, `posted`, `discarded`)
- `merchant_name text nullable`
- `receipt_date date nullable`
- `currency_code char(3) default 'INR'`
- `subtotal_minor bigint nullable`
- `tax_minor bigint nullable`
- `total_minor bigint nullable`
- `confidence numeric(5,4) nullable`
- `created_by_user_id uuid`
- `created_at`, `updated_at`

`receipt_ocr_results`
- `id uuid pk`
- `receipt_draft_id uuid`
- `provider text`
- `raw_text text`
- `raw_json jsonb`
- `confidence numeric(5,4)`
- `created_at`

`receipt_draft_items`
- `id uuid pk`
- `receipt_draft_id uuid`
- `label text`
- `amount_minor bigint`
- `currency_code char(3)`
- `confidence numeric(5,4)`
- `position int`

`capture_jobs`
- `id uuid pk`
- `user_id uuid`
- `source text` (`share_sheet`, `paste`, `sms_manual`, `email_forward`, `android_notification`)
- `raw_text text nullable`
- `attachment_id uuid nullable`
- `state text`
- `parsed_result jsonb nullable`
- `consent_record_id uuid nullable`
- `created_at`, `updated_at`

#### Notifications

`notifications`
- `id uuid pk`
- `user_id uuid`
- `group_id uuid nullable`
- `type text`
- `title text`
- `body text`
- `entity_type text nullable`
- `entity_id uuid nullable`
- `tone text` (`neutral`, `urgent`, `system`)
- `read_at timestamptz nullable`
- `created_at`
- Index: `(user_id, read_at, created_at desc)`

`notification_deliveries`
- `id uuid pk`
- `notification_id uuid`
- `channel text` (`push`, `email`, `in_app`)
- `provider text`
- `status text` (`queued`, `sent`, `failed`, `suppressed`)
- `attempt_count int`
- `last_error text nullable`
- `sent_at timestamptz nullable`

`reminder_schedules`
- `id uuid pk`
- `group_id uuid`
- `type text` (`settlement_day`, `recurring_expense`, `stale_proof`)
- `schedule jsonb`
- `enabled boolean`
- `created_by_user_id uuid`

#### Import, Export, Reporting

`import_jobs`
- `id uuid pk`
- `user_id uuid`
- `source text` (`splitwise_csv`, `splitwise_json`)
- `state text` (`uploaded`, `parsed`, `reviewed`, `posting`, `completed`, `failed`)
- `attachment_id uuid`
- `summary jsonb`
- `created_at`, `updated_at`

`import_items`
- `id uuid pk`
- `import_job_id uuid`
- `external_id text nullable`
- `item_type text`
- `parsed_payload jsonb`
- `mapped_entity_type text nullable`
- `mapped_entity_id uuid nullable`
- `status text` (`pending`, `accepted`, `skipped`, `duplicate`, `posted`, `failed`)
- Unique: `(import_job_id, external_id)` where external id exists

`external_entity_maps`
- `id uuid pk`
- `source text`
- `external_id text`
- `entity_type text`
- `entity_id uuid`
- Unique: `(source, external_id, entity_type)`

`export_jobs`
- `id uuid pk`
- `user_id uuid`
- `group_id uuid nullable`
- `export_type text` (`group_csv`, `group_pdf`, `tally_csv`, `settlement_certificate`, `data_portability_json`)
- `state text`
- `parameters jsonb`
- `file_attachment_id uuid nullable`
- `created_at`, `completed_at nullable`

`statement_snapshots`
- `id uuid pk`
- `group_id uuid`
- `period_start date`
- `period_end date`
- `currency_code char(3)`
- `snapshot jsonb`
- `created_at`

### 3.6 Indexing Strategy

Core indexes:
- `event_store(stream_id, version)` unique.
- `event_store(group_id, global_position)` for group replay.
- `ledger_postings(group_id, participant_id, currency_code)`.
- `ledger_postings(source_type, source_id)`.
- `group_memberships(participant_id, status)`.
- `participants(registered_user_id)`.
- `expense_projection(group_id, expense_date desc)`.
- `expense_projection(group_id, state, updated_at desc)`.
- `search_projection using gin(search_vector)`.
- `settlement_intents(group_id, state, created_at desc)`.
- `payment_proofs(settlement_intent_id, created_at desc)`.
- `notifications(user_id, read_at, created_at desc)`.
- `import_items(import_job_id, status)`.
- `export_jobs(user_id, state, created_at desc)`.

Partitioning:
- Do not partition in MVP.
- Add monthly partitioning for `event_store`, `ledger_postings`, and `activity_feed_projection` only after measurable scale pressure.

### 3.7 TypeORM Migration Strategy

Rules:
- `synchronize: false` always.
- One migration per logical change.
- Filename: `YYYYMMDDHHMMSS-ShortName.ts`.
- Never edit a migration after it has reached shared environments.
- Migrations are generated only as a starting point; review manually for indexes, constraints, partial indexes, and database functions.
- Seed data is separate from migrations.

Migration order:
1. Identity and groups base tables.
2. Event store, ledger postings, idempotency, projection checkpoints.
3. Expense projections and recurring schedules.
4. Settlements and UPI state.
5. Attachments/receipts/capture.
6. Notifications.
7. Import/export/search.
8. DB functions/triggers for balanced posting assertions.

### 3.8 UPI And Payments Architecture

#### Settlement State Machine

States:
- `suggested`: read-model suggestion, not yet an intent.
- `intent_created`: payer selected a suggestion or custom settlement.
- `intent_generated`: UPI URI/QR generated.
- `payer_opened_upi_app`: mobile recorded app handoff.
- `awaiting_payment_evidence`: waiting for proof or provider callback.
- `proof_submitted`: payer uploaded screenshot/UTR/manual proof.
- `auto_matched`: provider callback or UTR/OCR match is plausible.
- `awaiting_receiver_confirmation`: payee must accept or reject.
- `confirmed`: payee/system accepted payment.
- `ledger_posted`: `SettlementRecorded` event posted balanced ledger entries.
- `expired`: payer did not complete within TTL.
- `cancelled`: payer cancels before proof.
- `disputed`: payee or admin disputes proof.
- `rejected`: proof is invalid.
- `partial_detected`: amount does not match intent.
- `duplicate_reference_review`: UTR/reference already used.
- `reversed`: settlement previously posted, then reversed by compensating event.
- `refunded`: refund recorded by compensating event.

Transitions:

| From | To | Trigger | Actor |
|---|---|---|---|
| `suggested` | `intent_created` | Create settlement intent | Payer/admin |
| `intent_created` | `intent_generated` | Generate UPI URI/QR | System |
| `intent_generated` | `payer_opened_upi_app` | App open callback/client event | Payer device |
| `intent_generated`/`payer_opened_upi_app` | `proof_submitted` | Upload screenshot/UTR | Payer |
| any pre-confirmation | `expired` | TTL job | System |
| any pre-proof | `cancelled` | Cancel intent | Payer |
| `proof_submitted` | `auto_matched` | UTR/OCR/provider match | System |
| `proof_submitted`/`auto_matched` | `awaiting_receiver_confirmation` | Request confirmation | System |
| `awaiting_receiver_confirmation` | `confirmed` | Accept proof | Payee/system if trusted callback |
| `confirmed` | `ledger_posted` | Append `SettlementRecorded` | System |
| `awaiting_receiver_confirmation` | `rejected` | Reject proof | Payee/admin |
| `proof_submitted`/`auto_matched` | `partial_detected` | Amount mismatch | System |
| `proof_submitted`/`auto_matched` | `duplicate_reference_review` | Duplicate UTR hash | System |
| any post-proof | `disputed` | Open dispute | Payee/payer/admin |
| `ledger_posted` | `reversed` | Reverse settlement | Admin or both parties |
| `ledger_posted` | `refunded` | Record refund | Payer/payee/admin |

Ledger impact:
- `SettlementIntentCreated`, `PaymentProofSubmitted`, `DuplicatePaymentReferenceDetected`, and `SettlementIntentExpired` do not change balances.
- `SettlementRecorded` posts balanced entries:
  - payer participant: `+amount` in currency, reducing what they owe.
  - payee participant: `-amount` in currency, reducing what they are owed.
- `SettlementReversed` posts exact inverse of the original settlement postings.
- `RefundRecorded` posts a new financial event linked to the settlement.

#### UPI Deep Link And QR

MVP URI builder:

```text
upi://pay?pa=<payee_vpa>&pn=<payee_name>&am=<decimal_amount>&cu=INR&tn=<short_note>&tr=<client_reference>
```

Rules:
- Amount is formatted from integer paise using currency minor-unit metadata.
- `client_reference` is unique and short enough to survive app notes where possible.
- The app must not assume all UPI apps preserve `tr` or `tn`.
- URI generation is not settlement confirmation.
- QR code encodes the same URI for cross-device payment.

Mobile handoff:
- Show buttons for GPay, PhonePe, Paytm, BHIM, and "other UPI app" if available.
- Record `upi_app_open_events`.
- Return to app shows proof prompt, not "paid" by default.

#### PSP Callback Path

Phase 2 optional:
- Add a regulated PSP/payment gateway adapter only for payer-initiated payment links/dynamic QR and status callbacks.
- Webhook handler verifies signature, provider idempotency, amount, currency, VPA/merchant reference, and intent id.
- Matching callback triggers `PaymentAutoMatched`; high-confidence callbacks can skip receiver confirmation only if product/legal policy permits.

MVP recommendation:
- Do not become a payment aggregator.
- Do not hold funds.
- Do not use collect requests as the primary settlement flow.

If moving into aggregation/collect territory:
- Partner with a regulated PA/PSP or obtain required authorization.
- Implement merchant KYC, escrow/settlement controls, dispute/refund processes, fraud monitoring, and RBI/NPCI reporting.
- Store payment-system data in India.
- Run legal review before product design is finalized.

#### Exception Handling

Expired intent:
- Event: `SettlementIntentExpired`.
- No ledger postings.
- UI offers "generate fresh UPI link".

Partial payment:
- Event: `PartialPaymentDetected`.
- Payee can reject, accept partial, or request remaining amount.
- Accept partial creates `SettlementRecorded` for paid amount and optional new intent for remaining balance.

Duplicate UTR:
- Event: `DuplicatePaymentReferenceDetected`.
- State: `duplicate_reference_review`.
- No ledger postings until admin/payee resolves.

Disputed proof:
- Event: `SettlementDisputed`.
- Attach reason/evidence.
- Settlement is excluded from "settled" state until resolved.

Wrong recipient:
- Event: `PaymentProofRejected` with reason `wrong_recipient`.
- No ledger postings.

Refund/reversal:
- Event: `RefundRecorded` or `SettlementReversed`.
- Always compensating postings, never mutation.

### 3.9 Receipts, OCR, And India-Specific Capture

#### Receipt Pipeline

1. `AttachmentUploaded`
   - User uploads gallery image, screenshot, or camera image.
   - Attachment stored with purpose `receipt`.

2. `ReceiptDraftCreated`
   - Draft is linked to group and creator.
   - User can manually enter total/items in Phase 1.

3. `ReceiptOcrRequested` Phase 2
   - Only after user consent.
   - OCR provider called through `OcrProviderPort`.

4. `ReceiptOcrCompleted`
   - Raw result stored in `receipt_ocr_results`.
   - Parsed draft items get confidence scores.

5. Human review
   - User confirms merchant, date, total, line items, tax/service charge/discount.
   - Low-confidence rows are visually marked.

6. Assignment
   - Items assigned to participants with equal/exact/weighted shares.
   - Shared items support fractional assignments.

7. Allocation
   - Taxes/GST/service charge/tip allocated by selected basis.
   - Discounts allocated before or after tax according to user choice.
   - Rounding residual is visible.

8. `ExpenseCreated`
   - Only reviewed data posts to ledger.

#### Allocation Logic

Amount safety:
- All amounts are integer minor units.
- Shares are rational weights.
- Allocation uses floor division and largest-remainder residual distribution.
- Tie-breaker is deterministic: `(source_id, participant_id)` hash ascending.
- Store residual in `rounding_residual_allocations`.

Bill adjustments:
- Tax/GST: default proportional to taxable item subtotal.
- Service charge: default proportional to subtotal.
- Tip: optional; default proportional to subtotal.
- Discount: default proportional to pre-tax subtotal unless user applies to specific items.
- Rounding: explicit line.

#### Capture Pipeline

Phase 1:
- Manual text paste.
- Gallery/screenshot upload.
- Receipt attachment.

Phase 2:
- Android share target for text/images using Expo prebuild/custom config plugin if needed.
- iOS share extension is not supported in Expo Go and requires a native extension. Treat it as a separate build task.
- WhatsApp summary parsing from pasted/shared text where user initiates sharing.
- Merchant parsers for Swiggy, Blinkit, BigBasket, Uber/Ola/Rapido, Amazon order snippets where shared by user.

Phase 3:
- Android notification listener only if user explicitly enables special access. This is sensitive and may be poor Play Store fit.
- SMS parsing is not feasible on iOS. Android SMS access is heavily restricted and generally inappropriate unless the app qualifies as default SMS/financial use under Play policies. Prefer manual share, email forwarding, or Account Aggregator/bank APIs with explicit consent.
- Optional Account Aggregator/bank/card import through a compliant partner, not scraping.

## 4. Non-Functional Architecture

### 4.1 Security

Authentication:
- Phone OTP default.
- Optional Google/Apple later, never mandatory.
- JWT access token with short TTL.
- Rotating refresh tokens stored in Expo SecureStore.
- Device session table with revoke support.

Authorization:
- Every command runs through `GroupAuthorizationGuard`.
- Guard checks group role, membership status, permission, and entity involvement.
- Sensitive commands require current expense version and, optionally, approval policy.

Secrets:
- PSP/OCR/OTP credentials stored in environment secret manager, not repository.
- Never log OTP, VPA, UTR, phone, full payment proof text, or raw OCR unless in restricted debug storage.

Data protection:
- Encrypt phone, VPA, UTR/proof extracted text, and sensitive provider references at column or application level.
- Store hashes for lookup/deduplication.

### 4.2 Privacy And Compliance Controls

Verified official anchors:
- RBI payment data storage directive/FAQ: payment-system data for domestic transactions must be stored only in India. Source: https://www.rbi.org.in/CommonPerson/english/Scripts/FAQs.aspx?Id=2995
- RBI Payment Aggregator Directions 2025: relevant if aggregating payments/merchant collections. Source: https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=12896
- India Code DPDP Act 2023: governs digital personal data processing. Source: https://www.indiacode.nic.in/handle/123456789/22037?locale=en
- NPCI UPI product/circular pages: UPI features and operating circulars. Sources: https://www.npci.org.in/product/upi and https://www.npci.org.in/circulars/upi

Engineering controls:
- Host production PostgreSQL, object storage for payment proofs, logs, and backups in India region if storing payment-system data.
- Separate payment proof bucket from general attachments with stricter retention and access policies.
- Store consent records by purpose.
- Provide in-app data export.
- Provide deletion workflow:
  - Personal profile deletion/deactivation.
  - Financial events remain with participant anonymization where legally/product-wise required because group ledger integrity must remain intact.
- Minimize contact data: hash phone numbers for matching; do not upload contacts unless consent is granted.
- OCR and capture consent is separate from account consent.
- Bank/financial import is Phase 3 and must have a separate consent purpose and revocation path.

### 4.3 Observability

Core telemetry:
- Structured JSON logs with `correlation_id`, `event_id`, `group_id`, `command_type`.
- OpenTelemetry traces for command handling, event append, projection, UPI webhook, OCR job.
- Metrics:
  - event append latency
  - projection lag by projector
  - idempotency replay count
  - settlement state transition counts
  - proof rejection/dispute rate
  - UPI intent expiry rate
  - webhook retry/failure count
  - rounding residual distribution
  - import failure count

Audit:
- Event store is the compliance audit source.
- Admin support tools must read audit events, not patch data.

### 4.4 Testing Strategy

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

### 4.5 Offline-First Strategy

Mobile local storage:
- Use `expo-sqlite` for durable queue/cache.
- Use SecureStore for tokens only.
- Tables:
  - `local_command_outbox`
  - `local_projection_cache`
  - `local_drafts`
  - `local_attachments_pending_upload`
  - `local_sync_cursor`

Command fields:
- `client_mutation_id`
- `idempotency_key`
- `command_type`
- `payload`
- `expected_aggregate_version`
- `created_at`
- `status`
- `last_error`

Sync:
- Client posts queued commands in order per aggregate.
- Backend returns accepted events/projection changes.
- Client fetches `/v1/sync?cursor=<last_global_position>`.
- Duplicate commands are safe because server idempotency returns prior result.

Conflict handling:
- Create commands usually auto-merge.
- Edit commands require exact base version.
- If conflict, mobile shows before/after diff and asks user to reapply changes.
- Settlement proof duplicates show reference conflict rather than silently posting.

## 5. Mobile App Architecture

### 5.1 Calm Precision Design System

The UI job is to reduce money-related social anxiety while making ledger truth visible. It should feel like a careful notebook and payment instrument, not a generic fintech dashboard.

Design principles:
- Calm first, precise when money changes.
- Numbers are stable, tabular, and never visually jump.
- Financial actions use explicit review steps.
- Status is conveyed by language, icon, and color, not color alone.
- No broad blue/purple gradients, no generic rounded card dashboard, no nested cards.

Typography:
- Display/headings: `Anek Latin SemiBold` for a subtle India-compatible voice without decorative excess.
- Body/UI: `Inter` for dense readability.
- Amounts/ledger references: `IBM Plex Mono` or `Roboto Mono` with tabular numerals.
- Type scale:
  - `title`: 24/30
  - `section`: 18/24
  - `body`: 15/22
  - `body-sm`: 13/18
  - `amount-lg`: 28/34 mono
  - `amount`: 17/22 mono
  - `caption`: 12/16
- Do not scale fonts with viewport width.

Color tokens:
- `canvas`: #F7F8F5, quiet neutral base.
- `surface`: #FFFFFF, plain content surfaces.
- `surface-raised`: #FBFCF8, used sparingly for repeated rows.
- `ink`: #1E2523, primary text.
- `ink-muted`: #65706A, secondary text.
- `rule`: #D9DED6, dividers and borders.
- `trust`: #0A7A75, verified/confirmed state.
- `receive`: #2F7D52, money owed to user.
- `owe`: #B64B45, money user owes.
- `pending`: #586676, awaiting action.
- `review`: #A66A12, needs review.
- `danger`: #9F2F2F, destructive/void/reject.
- `upi`: #5C6F2D, UPI handoff accent, not a page-wide theme.

Shape and layout:
- Radius: 6px default, 8px max for modals and repeated list items.
- Elevation: prefer borders/dividers; shadow only for bottom sheets and toasts.
- Rows: ledger-like, dense but breathable.
- Cards: only repeated groups/expenses, modals, and framed tools. No card-inside-card.
- Spacing: 4px base grid; common steps 8, 12, 16, 24.
- Amount columns align right; participant names align left.
- Use thin vertical "event rail" for audit and settlement timelines.

Motion:
- 120-180ms transitions for state changes.
- Settlement flow uses a stepper rail: Intent, UPI opened, Proof, Confirmation, Posted.
- Haptics:
  - light on row selection
  - success on settlement posted
  - warning on dispute/rejection
- Avoid celebratory animation for debt payment; the emotional tone is relief, not gamification.

Icon language:
- Use custom line icons or lucide-compatible equivalents for:
  - ledger line
  - rupee settlement
  - proof stamp
  - subgroup link
  - archive box
  - split weights
- Icons are functional, not decorative.

### 5.2 Core Screen Inventory And Flow Map

#### Onboarding

Screens:
- Welcome: phone-first, short value proposition, no marketing hero.
- Phone OTP entry.
- Profile name.
- Consent choices:
  - optional contacts
  - notifications
  - receipt/proof storage
- Join via invite link/QR.
- Guest claim flow.

Rationale:
- Solves forced-contact and "everyone install" friction.
- Trust starts with minimal data collection.

#### Home

Screens:
- Group list with compact balances:
  - "You owe"
  - "You are owed"
  - pending proofs
  - archived filter
- Floating primary action: create expense or group depending context.

Rationale:
- High-frequency users need fast access, not dashboard ceremony.

#### Group Creation And Management

Screens:
- Mode selector: Flat, Trip, Couple, Event, Business.
- Add participants:
  - manual name
  - invite link
  - optional contacts
  - guest participant
- Subgroup setup:
  - couple/family unit
  - default weights
- Role setup:
  - owner/admin/member/viewer
- Group settings:
  - permissions
  - archive
  - member exit/lock/obligation transfer

Rationale:
- Directly targets household/couple/subgroup gaps and Splitwise no-admin gap.

#### Group View

Layout:
- Header: group name, mode, archive/status.
- Balance strip: net per currency.
- Primary row: "Settle" and "Add expense".
- Tabs:
  - Activity
  - Balances
  - Expenses
  - People

Rationale:
- Keeps balance truth and recent changes visible.

#### Expense Entry

Flows:
- Simple equal split.
- Exact amounts.
- Shares/weights.
- Multiple payers.
- Itemized/manual receipt.
- Attach receipt image.

Key UI:
- Payers section at top.
- Beneficiaries section below.
- Difference indicator must show zero before posting.
- Rounding row visible when residual exists.
- Review screen before event append.

Rationale:
- Calculation trust and rounding visibility are product features.

#### Itemized Split

Screens:
- Receipt image/draft.
- Item list with assignment chips.
- Tax/service charge/discount allocation.
- Confidence/review flags in Phase 2 OCR.
- Final per-person summary.

Rationale:
- Avoids unfair equal restaurant/grocery splits.

#### Settlement/UPI Flow

Screens:
- Settlement suggestions with "why this payment".
- Choose payee and amount.
- UPI app picker/QR.
- Return from UPI: "Add proof" / "I'll do it later".
- Proof upload/UTR entry.
- Payee confirmation.
- Settlement timeline.
- Dispute/reject reason.

Rationale:
- Manual paid state is not proof; visible lifecycle creates trust.

#### Balances And Explainability

Screens:
- Participant balance list.
- Currency tabs if multi-currency.
- "Why this payment?" explanation:
  - net amount owed
  - debts simplified within trust boundary
  - events contributing to balance

Rationale:
- Addresses settle-up recommendation distrust.

#### Audit/Version History

Screens:
- Expense timeline:
  - created
  - edited
  - evidence attached
  - voided
- Diff view:
  - amount changes
  - payer/share changes
  - line item changes
  - actor and reason

Rationale:
- Makes edit/delete transparency concrete.

#### Recurring Expenses And Reminders

Screens:
- Recurring schedule list.
- Schedule editor.
- Upcoming generated expenses.
- Reminder settings.
- Settlement day setup.

Tone:
- "Rent is ready to review" instead of "Pay now".
- Group-wide reminders default, person-specific nudges optional.

#### Multi-Currency Trip Mode

Screens:
- Trip currency setup.
- Per-expense currency picker.
- FX snapshot review.
- Settle in selected currency.

Rationale:
- Solves travel/currency pain without hiding conversion.

#### Notification Center

Screens:
- Pending confirmations.
- Proof submitted.
- Expense edits needing approval.
- Recurring bills.
- Settlement reminders.

Rationale:
- Notification reliability is visible and recoverable.

#### Import From Splitwise

Screens:
- Upload CSV/JSON.
- Parse summary.
- Map participants.
- Review duplicates/conflicts.
- Commit import.
- Import audit result.

Rationale:
- Migration is an acquisition wedge.

#### Export/Reporting

Screens:
- Group CSV export.
- Monthly statement.
- Settlement certificate.
- Tally-style export in later phase.

Rationale:
- Search/export are power-user basics, not Pro luxuries.

### 5.3 State Management

Recommendation:
- TanStack Query for server read models and cache invalidation.
- Zustand for UI state, drafts, current group mode, and ephemeral flow state.
- `expo-sqlite` for durable offline command queue, projection cache, drafts, and pending attachments.
- React Hook Form + Zod for command forms and shared validation.

Why not Redux as the main store:
- Event-sourced backend already defines canonical state.
- The hardest client problem is durable command queue and projection sync, not global in-memory state.
- TanStack Query fits projection reads; Zustand keeps flow state small and explicit.

Local reconciliation:
- Each command has `client_mutation_id` and `idempotency_key`.
- Optimistic UI only for drafts and local pending rows.
- Financial balances update after server accepts event/projection.
- Pending rows display "queued" or "syncing" status, not final balance.

### 5.4 Backend Integration

API style:
- REST with OpenAPI.
- Version prefix: `/v1`.
- Request validation: DTO + shared Zod schema where practical.
- Commands require `Idempotency-Key` header.
- Commands that edit existing aggregates include `base_version`.

Representative endpoints:

```text
POST   /v1/auth/otp/start
POST   /v1/auth/otp/verify
POST   /v1/auth/refresh

GET    /v1/sync?cursor=...
POST   /v1/commands/batch

POST   /v1/groups
GET    /v1/groups
GET    /v1/groups/:groupId
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

POST   /v1/attachments
POST   /v1/receipt-drafts
POST   /v1/receipt-drafts/:id/ocr
POST   /v1/receipt-drafts/:id/post-expense

POST   /v1/imports/splitwise
GET    /v1/imports/:id
POST   /v1/imports/:id/commit

POST   /v1/exports
GET    /v1/exports/:id
```

Realtime recommendation:
- Phase 1: polling plus push notifications.
  - TanStack Query refetch on focus/reconnect.
  - Expo Push for settlement confirmations, proof requests, recurring reminders.
- Phase 2: optional WebSocket or SSE for active group collaboration if usage proves need.

Token handling:
- Access token in memory.
- Refresh token in SecureStore.
- On 401, refresh once, then replay request if idempotent.
- Command replay must preserve the same `Idempotency-Key`.

## 6. Phased Roadmap

### Phase 1: Shippable MVP

Goal:
- A trustworthy India-first shared ledger for flats/trips that can record expenses, explain balances, and settle through UPI with proof and confirmation.

Backend:
- Monorepo foundation.
- Identity phone OTP.
- Consent records.
- Groups, participants, guest invites, roles, archive.
- Event store, ledger postings, zero-sum invariant.
- Projections: balances, expenses, activity, search basic, sync cursor.
- Expense creation/edit/void.
- Multiple payers.
- Equal/exact/share split.
- Deterministic rounding.
- Manual itemized split and receipt attachment.
- Recurring schedules for weekly/monthly bills.
- Greedy settlement suggestions with explanation.
- UPI deep link/QR.
- Manual proof upload/UTR entry.
- Receiver confirmation.
- Settlement posting/reversal basics.
- Splitwise CSV import.
- CSV export.
- Notifications for proof/confirmation/recurring due.
- Offline command queue for expense create and proof submit.

Mobile:
- Calm Precision core components.
- Onboarding without forced contacts.
- Group create/manage.
- Expense entry.
- Itemized manual split.
- Settlement/UPI flow.
- Activity/audit history.
- Recurring bills.
- Import/export basic.
- Offline queued drafts.

Why this is coherent:
- It solves the top pain: UPI settlement proof, no daily caps, ledger trust, high-frequency flatmate use, optional contacts, basic recurring, and migration.
- It defers OCR and deeper parsing because manual itemization plus attachment is still usable while avoiding unreliable automation.

### Phase 2: Differentiation And Automation

Backend:
- OCR provider abstraction live.
- Receipt confidence/correction pipeline.
- Android share target and manual WhatsApp text parsing.
- Multi-currency trip mode with FX snapshots.
- Exact DP settlement optimizer for small groups.
- Formal dispute workflow.
- Full notification center.
- Neutral reminder controls and settlement day.
- PDF export, settlement certificates, Tally-style CSV.
- Full offline projection cache and conflict resolver.
- PSP callback adapter if a compliant partner is selected.
- Consent dashboard.

Mobile:
- OCR review UI.
- Share-sheet capture.
- Multi-currency screens.
- Dispute center.
- Notification center.
- Statement/export screens.
- Conflict resolution diff UI.

### Phase 3: Regulated/Deep Integrations And Scale

Backend:
- Optional Account Aggregator/bank/card import with explicit consent and legal review.
- UPI AutoPay/mandate exploration for recurring bills only through compliant rails.
- PSP/payment gateway deeper reconciliation if business model requires.
- Advanced business/family statements.
- Data portability automation.
- Fraud/risk scoring for duplicate/false payment proofs.
- Advanced analytics and paid entitlements.

Mobile:
- Advanced privacy controls.
- Rich merchant capture.
- Business/family reporting views.
- Premium automation settings.

Descoped under current constraints:
- Full public web read-only balance page because the only client in scope is Expo mobile. Provide WhatsApp summaries, PDFs, and mobile deep links instead.
- P2P collect-request-based settlement because regulatory direction makes payer-initiated flows safer.
- Holding funds or operating as a payment aggregator in MVP.

### Build Sequencing For A Small AI-Augmented Team

Assumption:
- This is planned for a technically strong solo/small-team builder using AI coding agents such as Codex/Emergent, similar to the execution model used on Tally Sync, ComplyDesk, and BOS. The sequence therefore favors vertical slices with hard financial invariants early, not a large parallel team split.

Sequence:
1. Monorepo, env config, PostgreSQL, TypeORM, auth skeleton.
2. Event store, ledger postings, idempotency, invariant tests.
3. Groups/participants/roles and mobile onboarding/group creation.
4. Expense create/edit/void with projections and mobile expense flow.
5. Balance projections and settlement suggestions.
6. UPI intent/QR, proof upload, receiver confirmation, settlement posting.
7. Activity/audit UI.
8. Recurring expenses and reminders.
9. Splitwise CSV import and CSV export.
10. Offline command queue and sync endpoint.
11. Hardening: concurrency tests, projection rebuild, error tracking.
12. Phase 2 OCR/capture/multi-currency.

Dependency rules:
- Event store and postings precede all financial commands.
- Group roles precede edit/void/member-exit workflows.
- Settlement suggestions require balance projections.
- UPI proof flow requires settlement state machine.
- OCR can wait because it produces drafts, not canonical ledger state.
- PSP callbacks must not ship before idempotent webhook and reconciliation testing exist.

## 7. Open Questions And Tradeoffs

1. OCR provider choice
   - Options: on-device ML Kit, cloud OCR, hybrid.
   - Tradeoff: on-device is private but weaker for messy receipts; cloud is stronger but raises consent and cost.
   - Recommendation: Phase 2 start with provider port and one cloud provider for accuracy, with explicit consent and redaction/minimization.

2. PSP/payment gateway partner
   - Options: no PSP, payment gateway dynamic QR, full PA/PSP partnership.
   - Tradeoff: callbacks improve reconciliation but add compliance, vendor risk, and operational burden.
   - Recommendation: MVP no PSP. Phase 2 evaluate provider only after proof-confirmation flow has usage.

3. Exact settlement optimizer threshold
   - Options: exact for all groups, exact only under participant limit, greedy always.
   - Tradeoff: exact minimization is hard at scale; greedy is predictable.
   - Recommendation: greedy default; exact DP for groups up to a configured participant count in Phase 2.

4. Public read-only access
   - Options: mobile-only summaries, server-rendered minimal web page, full web app.
   - Tradeoff: public web improves non-user access but violates current client scope if it becomes a product surface.
   - Recommendation: mobile deep links, PDFs, and WhatsApp summaries first. Revisit a minimal server-rendered view only if the "non-user friend" problem blocks adoption.

5. Contact discovery
   - Options: no contacts, optional upload, on-device matching.
   - Tradeoff: discovery helps invites but creates privacy fear.
   - Recommendation: manual/invite first; optional contact upload with phone hashes and explicit consent.

6. Offline scope
   - Options: command queue only, full local projections, local-first CRDT-style app.
   - Tradeoff: full local-first is expensive and can confuse financial truth.
   - Recommendation: command queue in Phase 1; read projection cache and conflict UI in Phase 2; avoid CRDT for money events.

7. Multi-currency in MVP
   - Options: INR only, per-currency ledger without conversion, full FX conversion.
   - Tradeoff: FX adds complexity, but schema must not block it.
   - Recommendation: INR-first MVP with currency-safe schema. Full FX snapshots Phase 2.

8. Formal approval workflow in MVP
   - Options: role permissions only, approvals for old/large edits, approvals for all edits.
   - Tradeoff: approvals improve trust but slow entry.
   - Recommendation: role permissions and full audit in MVP; optional approval threshold for old/large edits. Full dispute center Phase 2.

9. Billing/entitlements
   - Options: no monetization code until later, entitlement hooks now, full billing now.
   - Tradeoff: early billing distracts from trust wedge; no hooks creates later refactor.
   - Recommendation: entitlement checks with all core features enabled in Phase 1; billing provider in Phase 3.

10. Attachment storage and retention
   - Options: keep all proof/receipt images indefinitely, user-configurable retention, aggressive deletion.
   - Tradeoff: audit value vs privacy/storage cost.
   - Recommendation: receipts user-retained by default; payment proofs retained for a defined dispute window and exportable, then user/admin deletion policy subject to legal review.
