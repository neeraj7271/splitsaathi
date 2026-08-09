# SplitSaathi — Super Admin Discovery & Architecture Report (`SUPERADMIN_DISCOVERY.md`)

**Date:** August 4, 2026  
**Product:** SplitSaathi (thesplitsaathi.com)  
**Author:** Senior Full-Stack Engineering Team  
**Scope:** Phase 1 — Codebase & System Discovery  

---

## Executive Summary

This report documents the architectural, data, authorization, API, infrastructural, and design token findings across the **SplitSaathi** monorepo repository. SplitSaathi is built as a monorepo with an **Event-Sourced & Balanced Ledger Core** running NestJS + TypeORM + PostgreSQL on the backend, and Expo React Native on the mobile client. 

This discovery artifact serves as the ground-truth baseline before designing and building the new **Super Admin Module** (backend endpoints in NestJS + frontend dashboard in Next.js under `adminpanel/`).

---

## 1. Repo & Module Map

### 1.1 Monorepo & Directory Structure

The project follows a TypeScript monorepo structure managed via npm workspaces (`package.json` at root).

```text
Splitsaathi/
├── adminpanel/                 [NEW] Target directory for Next.js Super Admin Frontend
├── landingpage/                Static landing page (thesplitsaathi.com)
├── hostingsplitsaathi/         Production host deployment configuration
└── splitsaathi/                Core Monorepo
    ├── apps/
    │   ├── api/                NestJS API server (controllers, modules, guards, providers)
    │   │   ├── src/
    │   │   │   ├── app.module.ts
    │   │   │   ├── main.ts
    │   │   │   ├── common/     (decorators, guards, interfaces, pipes, utils)
    │   │   │   ├── config/     (API config service & Zod env loading)
    │   │   │   ├── modules/    (20 domain modules)
    │   │   │   ├── observability/
    │   │   │   └── swagger/    (OpenAPI setup)
    │   │   └── package.json
    │   └── mobile/             Expo React Native App
    │       ├── src/
    │       │   ├── api/        (API client & react-query hooks)
    │       │   ├── auth/       (Secure token storage & session)
    │       │   ├── components/ (Shared UI components)
    │       │   ├── offline/    (Offline outbox queue)
    │       │   ├── screens/    (App screen navigation)
    │       │   └── theme/      (Extracted design tokens & typography)
    │       └── package.json
    └── packages/
        ├── config/             @splitsaathi/config (Zod environment schema & loadEnv)
        ├── contracts/          @splitsaathi/contracts (DTOs, Money schemas, shared enums)
        ├── db/                 @splitsaathi/db (TypeORM entities, data-source, migrations)
        ├── domain/             @splitsaathi/domain (Pure TS domain logic, policies, ledger rules)
        └── testing/            @splitsaathi/testing (Deterministic test factories & ledger assertions)
```

### 1.2 Architecture Style
- **Style:** Monolithic Domain-Driven Monorepo / Modular Monolith.
- **Layering:**
  1. **Pure Domain (`packages/domain`):** Uncapped ledger rules, split strategy math, double-entry balanced posting invariants, UPI URI builders, zero external dependencies.
  2. **Persistence & Schema (`packages/db`):** TypeORM entity definitions (54 entities), PostgreSQL migrations, event-store table.
  3. **Shared Contracts (`packages/contracts`):** Request validation schemas, money transfer DTOs, currency formatters.
  4. **Application API (`apps/api`):** NestJS framework providing HTTP endpoints, JWT auth guards, dependency injection, and external driver adapters (Twilio, Resend, Brevo, Razorpay, Cashfree, Expo Push, FCM, Tesseract OCR, S3/Local storage).

### 1.3 Existing NestJS Modules Summary

| Module Name | Primary Entities / Tables | Core Endpoints | Business Logic Owned |
|---|---|---|---|
| **AuthModule** | `AuthIdentityEntity`, `OtpChallengeEntity`, `RefreshSessionEntity` | `POST /v1/auth/otp/*`, `POST /v1/auth/phone`, `POST /v1/auth/email/*`, `POST /v1/auth/refresh`, `POST /v1/auth/logout` | Multi-factor auth: Phone OTP, SMS bypass dev mode, email password auth, Google OAuth ID tokens, refresh token session lifecycle. |
| **UsersModule** | `UserEntity`, `ContactAliasEntity` | `GET /v1/users/me`, `PATCH /v1/users/me`, `GET/PATCH /v1/users/me/preferences` | User profiles, masked phone numbers, display names, avatar attachments, UPI VPA storage, localized preferences. |
| **GroupsModule** | `GroupEntity`, `ParticipantEntity`, `GroupMembershipEntity`, `GroupInviteEntity`, `GroupRolePermissionEntity` | `GET/POST /v1/groups`, `GET/PATCH /v1/groups/:id`, `POST /v1/groups/:id/invites`, `GET /v1/join/:token` | Ledger group creation (flat, trip, couple, event, business), membership role RBAC (owner, admin, member, viewer), guest participant claims, deep-link invite links. |
| **FinancialLedgerModule** | `EventStoreEntity`, `LedgerPostingEntity`, `AuditLogEntryEntity`, `IdempotencyRecordEntity` | Internal domain engine & projector checkpoints | Event Sourcing engine for financial immutability. Append-only event stream, double-entry balanced postings (zero-sum check per currency), idempotency hashing. |
| **ExpensesModule** | `ExpenseProjectionEntity`, `ExpensePayerEntity`, `ExpenseShareEntity`, `ExpenseLineItemEntity`, `BillAdjustmentEntity`, `ExpenseVersionProjectionEntity` | `POST /v1/expenses`, `GET /v1/groups/:id/expenses`, `PATCH/VOID /v1/expenses/:id`, `GET /v1/expenses/:id/versions` | Core expense creation/editing/voiding. Split calculation (equal, exact, percent, weight, itemized), GST/tax/tip bill adjustments, expense audit version projections. |
| **SettlementsModule** | `SettlementIntentEntity`, `SettlementEventEntity`, `UpiAppOpenEventEntity`, `UpiPaymentReferenceEntity`, `PaymentProofEntity`, `SettlementConfirmationEntity` | `POST /v1/settlements/intents`, `POST /v1/settlements/:id/upi-opened`, `POST /v1/settlements/:id/proof`, `POST /v1/settlements/:id/confirm` | UPI debt settlement state machine: suggestion → intent → app-open → UTR/screenshot proof submission → receiver confirmation/dispute → ledger posting. |
| **PaymentsWebhookModule** | `SettlementIntentEntity`, `UpiPaymentReferenceEntity` | `POST /v1/payments/razorpay/webhook`, `POST /v1/payments/cashfree/webhook` | Webhook ingestion and validation for payment gateway provider callbacks. |
| **BalancesModule** | `GroupBalanceProjectionEntity` | `GET /v1/groups/:id/balances` | Optimized balance projections reading signed ledger postings per participant and currency. |
| **NotificationsModule** | `NotificationEntity`, `NotificationDeliveryEntity`, `DeviceInstallationEntity` | `GET /v1/notifications`, `POST /v1/device-installations` | Notification dispatch queue (Expo Push, FCM, email), device push token registration, in-app notification center. |
| **ReceiptsCaptureModule**| `ReceiptDraftEntity`, `ReceiptOcrResultEntity`, `AttachmentEntity` | `POST /v1/receipts/upload`, `POST /v1/receipts/:id/ocr` | Receipt image upload, local/S3 byte storage, Tesseract OCR parsing into line items. |
| **RecurringModule** | `RecurringExpenseScheduleEntity`, `RecurringOccurrenceEntity` | `GET/POST /v1/recurring/schedules` | Automated recurring expense schedules (weekly/monthly) and auto-generation jobs. |
| **ImportsExportsModule** | `ImportJobEntity`, `ImportItemEntity`, `ExportJobEntity`, `StatementSnapshotEntity` | `POST /v1/imports/splitwise`, `POST /v1/exports/tally`, `POST /v1/exports/csv` | Splitwise CSV/JSON import parser, bank CSV ingestion, Tally ERP CSV export, PDF statement generator. |
| **OfflineSyncModule** | `OfflineCommandQueueEntity`, `SyncProjectionChangeEntity` | `POST /v1/sync/commands`, `GET /v1/sync/changes` | Offline command queue ingestion, mutation processing, sync change cursor stream. |
| **EntitlementsModule** | Stubbed service | Internal service dependency | SplitSaathi entitlement policy engine: explicitly keeps core ledger functionality uncapped and free, while preparing optional gates for future heavy automation features. |
| **ActivityModule** | `ActivityFeedProjectionEntity` | `GET /v1/groups/:id/activity` | Unified group activity feed projection. |
| **FriendsModule** | Shared view over 1:1 groups | `GET /v1/friends` | Helper query calculating 1:1 net balances across direct friends. |
| **ConsentsModule** | `ConsentRecordEntity` | `GET/POST /v1/consents` | DPDP/GDPR consent management (contacts discovery, receipt upload, UPI proof storage). |
| **ContactsModule** | `ContactAliasEntity` | `POST /v1/contacts/sync` | Phone contact hashing and discovery for inviting friends. |
| **CurrencyModule** | `CurrencyEntity`, `FxRateSnapshotEntity` | `GET /v1/currency/rates` | Supported currencies registry (INR default) and FX rate snapshots (Frankfurter API). |
| **JobsModule** | Trigger for cron tasks | `POST /v1/jobs/process-recurring`, `POST /v1/jobs/cleanup` | Secured background job endpoints guarded by `CRON_SECRET`. |

---

## 2. Data Model & Database Schema

The database relies on **PostgreSQL** managed through **TypeORM** (`packages/db`). All money values are strictly stored as integer minor units (`bigint` or `numeric`) paired with ISO 3-letter `currency_code` (e.g. `124000` minor units = ₹1,240.00).

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     users       │1     *│ group_membership│*     1│     groups      │
│ id (uuid)       ├───────┤ group_id (uuid) ├───────┤ id (uuid)       │
│ display_name    │       │ participant_id  │       │ name            │
│ phone_hash      │       │ role            │       │ mode (trip/flat)│
└────────┬────────┘       └─────────────────┘       └────────┬────────┘
         │1                                                  │1
         │*                                                  │*
┌────────┴────────┐                                 ┌────────┴────────┐
│ auth_identities │                                 │  event_store    │
│ provider        │                                 │ stream_id       │
│ provider_subject│                                 │ event_type      │
└─────────────────┘                                 │ payload (jsonb) │
                                                    └────────┬────────┘
                                                             │1
                                                             │*
                                                    ┌────────┴────────┐
                                                    │ ledger_postings │
                                                    │ participant_id  │
                                                    │ signed_amount   │
                                                    └─────────────────┘
```

### 2.1 Core Entities & Attributes

1. **`users` (`UserEntity`)**
   - Attributes: `id` (uuid), `phone_e164` (encrypted), `phone_hash` (unique index), `display_name`, `avatar_attachment_id`, `upi_vpa`, `default_currency_code` (INR), `locale`, `status` (`active` | `deactivated` | `deleted_pending`), `created_at`, `updated_at`.
   - Privacy Note: Phone numbers are stored as salted SHA-256 hashes (`phone_hash`) for lookup; actual E.164 string is encrypted.

2. **`groups` (`GroupEntity`) & Memberships**
   - Attributes: `id`, `name`, `mode` (`flat`, `trip`, `couple`, `event`, `business`, `custom`), `base_currency_code`, `state` (`active`, `archived`), `created_by_user_id`, `created_at`, `archived_at`.
   - Associated tables: `participants`, `group_memberships` (role: `owner` | `admin` | `member` | `viewer`), `participant_relationships`, `group_role_permissions`, `group_invites`.

3. **`expenses` (`ExpenseProjectionEntity`) & Versioning**
   - Attributes: `id`, `group_id`, `current_version`, `state` (`active`, `voided`), `description`, `category`, `expense_date`, `total_amount_minor`, `currency_code`, `created_by_user_id`, `last_event_id`, `created_at`, `updated_at`, `voided_at`.
   - Associated tables: `expense_payers` (multiple payers supported), `expense_shares` (share types: `equal`, `exact`, `percent`, `weight`, `itemized`), `expense_line_items`, `bill_adjustments` (GST CGST/SGST, tip, service charge), `expense_version_projection` (full JSON snapshot audit history per version edit).

4. **`settlements` (`SettlementIntentEntity`) & State Machine**
   - State Machine: `suggested` → `intent_created` → `payer_opened_upi_app` → `proof_submitted` → `auto_matched` → `awaiting_receiver_confirmation` → `confirmed` → `ledger_posted`.
   - Associated tables: `settlement_events`, `upi_app_open_events`, `upi_payment_references` (unique constraint on UTR reference hash per group to prevent double-spending), `payment_proofs` (screenshot attachment or UTR text), `settlement_confirmations`.

5. **`event_store` (`EventStoreEntity`) & Ledger Engine**
   - Attributes: `id`, `stream_id`, `aggregate_type`, `aggregate_id`, `group_id`, `version`, `global_position` (bigint sequence), `event_type`, `event_schema_version`, `actor_user_id`, `idempotency_key`, `correlation_id`, `occurred_at`, `payload` (jsonb), `metadata` (jsonb), `previous_hash`, `event_hash` (cryptographic link).

6. **`audit_log_entries` (`AuditLogEntryEntity`)**
   - Attributes: `id`, `event_id`, `group_id`, `entity_type`, `entity_id`, `actor_user_id`, `action`, `diff` (jsonb), `reason`, `created_at`.

### 2.2 Schema Gaps for Super Admin
The current production schema lacks:
- **No `admin_users` table:** Regular user identities cannot be safely re-used for admin operations due to security and session lifetime requirements.
- **No `admin_audit_log` table:** Current `audit_log_entries` tracks domain-level user mutations; super admin mutations (banning users, manual refunds, role escalation) require an immutable `admin_audit_log` (`admin_id`, `action`, `target_type`, `target_id`, `before`, `after`, `ip`, `user_agent`).
- **No `subscriptions` / `billing_plans` tables:** Billing is currently evaluated dynamically via `EntitlementsModule`. Super admin panel will need dedicated tables (`admin_feature_flags`, `subscriptions`, `system_settings`).

---

## 3. Auth & Authorization Policy

### 3.1 Current User Auth Strategy
- **Mechanism:** JWT Bearer tokens passed via HTTP `Authorization: Bearer <token>` header.
- **Tokens:** Access token (JWT verified via `JWT_ACCESS_SECRET`) containing `{ sub: userId, phoneE164, sid }`.
- **Sessions:** Refresh token hashes persisted in `refresh_sessions` with device link.
- **Guard & Decorators:** `JwtAuthGuard` applied globally or per route; `@Public()` decorator bypasses JWT verification; `@CurrentUser()` extracts authenticated user payload.
- **Domain Authorization:** `FinancialAuthorizationPort` checks `GroupRolePermissionEntity` before performing mutations (`expense.create`, `expense.edit_own`, `group.update`, etc.).

### 3.2 Recommended Admin Auth Architecture
To guarantee isolation and security:

```
                  ┌───────────────────────────────┐
                  │    Super Admin Next.js App    │
                  │         (adminpanel/)         │
                  └──────────────┬────────────────┘
                                 │ HTTP Bearer JWT
                                 ▼
                  ┌───────────────────────────────┐
                  │      NestJS Admin API         │
                  │   (/v1/admin/* guarded by     │
                  │      AdminJwtAuthGuard)       │
                  └──────────────┬────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
      ┌────────────────────┐          ┌────────────────────┐
      │    admin_users     │          │  admin_audit_log   │
      │  (email, password, │          │ (admin_id, action, │
      │  role, 2fa_secret) │          │  target, ip, diff) │
      └────────────────────┘          └────────────────────┘
```

1. **Dedicated Database Table (`admin_users`):**
   - Fields: `id`, `email`, `password_hash`, `full_name`, `role` (`super_admin` | `ops_admin` | `finance_admin` | `read_only`), `status`, `totp_secret`, `last_login_at`, `created_at`.
2. **Dedicated Token Scope & Guard:**
   - Admin JWT Payload: `{ sub: adminId, email, role, type: 'superadmin' }`.
   - Secret: `JWT_ADMIN_ACCESS_SECRET` (distinct from mobile user JWT secret).
   - Guard: `AdminJwtAuthGuard` + `@AdminRoles('super_admin', 'ops_admin')` decorator.
3. **Mandatory Audit Logging:** Every mutating request in `/v1/admin/*` automatically passes through an `AdminAuditInterceptor` writing to `admin_audit_log`.

---

## 4. API Conventions & Patterns

### 4.1 Global Setup & Pipeline
- **Global Route Prefix:** `/v1` (configured in `main.ts`).
- **OpenAPI / Swagger:** Exposed at `/docs` using `@nestjs/swagger` decorators (`@ApiTags`, `@ApiOkResponse`, `@ApiBearerAuth`).
- **Request DTO Validation:** Global `ValidationPipe` with configuration:
  ```ts
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true
  })
  ```
- **Idempotency Header:** Mutating endpoints accept `idempotency-key` header checked against `idempotency_records`.

### 4.2 Response Shape & HTTP Conventions
- Direct JSON DTO payloads or arrays returned directly with proper HTTP status codes (`200 OK`, `201 Created`, `204 No Content`).
- Errors throw standard NestJS HTTP exceptions (`BadRequestException`, `UnauthorizedException`, `ForbiddenException`, `NotFoundException`, `ConflictException`), which format automatically into structured JSON:
  ```json
  {
    "statusCode": 400,
    "message": "At least one field must be provided.",
    "error": "Bad Request"
  }
  ```

---

## 5. Infra, Environment & Observability

### 5.1 Environment Configuration
Managed via Zod validation schema in `packages/config/src/index.ts`:
- Core: `NODE_ENV`, `HOST`, `PORT`, `DATABASE_URL`.
- Security Secrets: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PHONE_HASH_PEPPER`, `CRON_SECRET`.
- Drivers Configured:
  - `PAYMENT_GATEWAY_DRIVER`: `manual` | `razorpay` | `cashfree`
  - `NOTIFICATION_PROVIDER_DRIVER`: `dev` | `expo` | `fcm`
  - `EMAIL_PROVIDER_DRIVER`: `dev` | `resend` | `brevo`
  - `OBJECT_STORAGE_DRIVER`: `local` | `s3`
  - `OCR_PROVIDER_DRIVER`: `noop` | `tesseract`
  - `BANK_IMPORT_PROVIDER_DRIVER`: `csv` | `setu_aa`
  - `FX_PROVIDER_DRIVER`: `frankfurter` | `static`

### 5.2 Observability & Metrics
- `ObservabilityModule` configures Prometheus text metrics output when `METRICS_ENABLED=true`.
- Health probes available at standard routes.

---

## 6. Brand & Design Tokens (Extracted from Source)

Extracted directly from `apps/mobile/src/theme/`:

### 6.1 Color Palette Table

| Token Name | Hex Value | Purpose / Usage |
|---|---|---|
| **`canvas`** | `#0B0E14` | Primary dark background / page root |
| **`surface`** | `#12151D` | Card backgrounds & sidebars |
| **`surfaceRaised`** | `#191D27` | Elevated modal dialogs & active row hover |
| **`hairline`** | `#232836` | Table borders & divider lines |
| **`ink` (text-primary)** | `#F4F5F7` | Primary text & high-contrast headings |
| **`inkMuted`** | `#9AA1AF` | Secondary labels & table sub-headers |
| **`inkFaint`** | `#5B6273` | Disabled text & subtle metadata |
| **`neutralChipBg`** | `#1E2330` | Tag / pill backgrounds |
| **`receive` (success)** | `#22C55E` | Positive balance, settlements, paid status |
| **`owe` (danger)** | `#F04438` | Negative balance, unpaid debt, banned status |
| **`pending` (warning)** | `#F59E0B` | Pending proof, trial status, warning alerts |
| **`confirmed` (teal)** | `#0D9488` | Active status, verified badge, brand accent |
| **`disputed`** | `#F97066` | Disputed settlements & flagged items |
| **`info`** | `#6366F1` | Informational callouts & system badges |

### 6.2 Gradients
- **`current`:** Linear gradient 135° (`#3730A3` → `#0D9488`)
- **`ember`:** Linear gradient 120° (`#F97066` → `#F59E0B`)

### 6.3 Typography & Font Families
- **Display Font:** `SpaceGrotesk` (`SpaceGrotesk_600SemiBold`, `SpaceGrotesk_700Bold`)
- **Body Font:** `Inter` (`Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold`)
- **Monospace / Amounts Font:** `JetBrainsMono` (`JetBrainsMono_400Regular`, `JetBrainsMono_500Medium`)

### 6.4 Spacing & Border Radius Scale
- **Border Radius (`radius`):** `sm`: 10px, `md`: 16px, `lg`: 24px, `full`: 999px
- **Spacing (`spacing`):** `xxs`: 4px, `xs`: 8px, `sm`: 12px, `md`: 16px, `lg`: 24px, `xl`: 32px, `xxl`: 40px, `xxxl`: 48px

---

## 7. Status & Checkpoint

Phase 1 discovery complete. The codebase exhibits a clean modular monolith structure with strict domain boundaries and event-sourced ledger capabilities.

**Next Step:** Proceed to **Phase 2 — Super Admin Backend Design**, producing `SUPERADMIN_BACKEND_PLAN.md` detailing the schema diff (`admin_users`, `admin_audit_log`, `admin_feature_flags`), RBAC matrix, and complete endpoint specification.
