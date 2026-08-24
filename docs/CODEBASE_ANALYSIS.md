# SplitSaathi — Complete Codebase Analysis & Technical Audit Documentation

> **Document Status**: Production-Grade Reverse-Engineering & Architecture Blueprint  
> **Target Audience**: AI Agents, Test Engineers, Core Developers, Security Auditors  
> **Repository Path**: `/home/neeraj/Neeraj/Splitsaathi/splitsaathi`  
> **Last Updated**: August 2026  

---

## Table of Contents
1. [High-Level System Overview](#1-high-level-system-overview)
2. [Feature Inventory](#2-feature-inventory)
3. [Splitting & Settlement Calculation Logic](#3-splitting--settlement-calculation-logic)
4. [Data Model / Database Schema](#4-data-model--database-schema)
5. [API Reference](#5-api-reference)
6. [External Integrations & Side Effects](#6-external-integrations--side-effects)
7. [Auth, Permissions & Multi-tenancy](#7-auth-permissions--multi-tenancy)
8. [Validation & Error Handling](#8-validation--error-handling)
9. [State Management & Sync (Frontend)](#9-state-management--sync-frontend)
10. [Known Gaps, Risks & Assumptions](#10-known-gaps-risks--assumptions)
11. [Question Log](#11-question-log)

---

## 1. High-Level System Overview

### Core Purpose & Primary User Flows
**SplitSaathi** is an enterprise-grade bill-splitting, expense management, and settlement tracking web and mobile platform. It enables groups of friends, roommates, travel teams, and households to track shared expenses, calculate exact pairwise balances, settle debts using native UPI deep links or manual payment proofs, and maintain an immutable financial ledger.

```
[ User Auth ] ──> [ Create / Join Group ] ──> [ Add Expense (Equal / Exact / % / Shares / OCR) ]
                                                            │
                                                            ▼
[ Settlement Confirmation ] <── [ UPI Payment / Proof ] <── [ Event Store & CQRS Balance Projection ]
```

#### Primary User Flows:
1. **Onboarding & Authentication**: User registers via Phone OTP, Email OTP, or Google OAuth 2.0. The system creates a unified `AuthIdentityEntity` linked to a core `UserEntity`.
2. **Group Management**: Users create groups or join existing groups via a unique group invite code / deep link (`/v1/join/:inviteCode`). Group roles (`owner`, `admin`, `member`, `viewer`) dictate permissions.
3. **Expense Logging & Splitting**: A user logs an expense with multiple payers and split participants using one of five split strategies: Equal, Exact Amounts, Percentage, Weighted Shares, or Itemized.
4. **Event-Sourced Ledger Posting**: Every financial action is written to an immutable `EventStoreEntity` and produces balanced `LedgerPostingEntity` entries (`sum(signedAmountMinor) === 0`).
5. **Debt Simplification & Settlement**: The `GreedySettlementOptimizer` minimizes the number of transactions required to settle up. The payer opens a UPI app via generated deep link (`upi://pay`), submits payment proof (reference/screenshot), and the receiver confirms or disputes the payment.

---

### Tech Stack
- **Monorepo Management**: npm Workspaces (`packages/*`, `apps/*`)
- **Backend Framework**: NestJS 10 (Node.js 22, TypeScript 5.7)
- **Database & ORM**: PostgreSQL 16 with TypeORM 0.3 (Event Store + CQRS Projections)
- **Frontend / Mobile**: Expo SDK 54 / React Native 0.81, React 19, TanStack React Query 5, Phosphor Icons, Expo Router / Navigation
- **Domain Layer**: `@splitsaathi/domain` — pure TypeScript domain logic (no DB dependencies) for `Money`, `RoundingAllocator`, `SplitStrategy`, `GreedySettlementOptimizer`, `SettlementStateMachine`, and `UpiUriBuilder`
- **Object Storage**: MinIO / AWS S3 via `@aws-sdk/client-s3` (local MinIO for dev/test)
- **OCR Engine**: Tesseract.js / No-op OCR driver for receipt image scanning
- **Background Jobs / Cron**: NestJS `JobsController` authenticated via `x-cron-secret` header for recurring expenses, FX rate sync, statement snapshots, and notification deliveries
- **Hosting / Deployment**: Ubuntu VM, Docker Compose (Postgres + MinIO + NestJS API), Nginx Reverse Proxy with Let's Encrypt SSL (`api-dev.thesplitsaathi.com`), PM2 / Docker process management

---

### Folder & Package Architecture

```
splitsaathi/
├── apps/
│   ├── api/                      # NestJS REST API Server
│   │   └── src/
│   │       ├── common/           # Interceptors, Filters, Guards, Decorators
│   │       ├── config/           # Config module wrapping @splitsaathi/config
│   │       ├── modules/          # 21 Domain & Feature Modules (Auth, Expenses, Groups, etc.)
│   │       └── observability/    # Prometheus metrics, Logger, Request ID tracing
│   └── mobile/                   # Expo React Native Cross-Platform App
│       ├── android/              # Native Android wrapper & Gradle configuration
│       └── src/                  # React Native UI Components, Screens, Auth, Navigation
├── packages/
│   ├── config/                   # Centralized Zod Environment Schema & Loader
│   ├── contracts/                # Shared DTOs, TypeScript interfaces, and API contracts
│   ├── db/                       # TypeORM Data Source, 60+ Entities, & Migrations
│   ├── domain/                   # Pure Business Logic (Money, Rounding, Split, Settlement, UPI)
│   └── testing/                  # Shared test utilities, fixtures, and mocks
├── deploy/                       # Docker Compose, Nginx configs, setup & start shell scripts
└── docs/                         # Architecture dossiers, API docs, & analysis blueprints
```

---

### Environment Variables & Config Flags
Defined in `packages/config/src/index.ts` via Zod schema validation:

| Variable Name | Type / Allowed Values | Default Value | Purpose / Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | `development \| test \| production` | `development` | Runtime environment mode |
| `HOST` | `string` | `0.0.0.0` | Bind host IP for API server |
| `PORT` | `number` | `3000` | Bind TCP port for API server |
| `DATABASE_URL` | `string` | *Required* | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | `string (min 16)` | *Required* | Secret key for signing user access JWTs |
| `JWT_REFRESH_SECRET` | `string (min 16)` | *Required* | Secret key for signing user refresh JWTs |
| `JWT_ADMIN_ACCESS_SECRET`| `string (min 16)` | `super-admin-secret...` | Secret key for signing admin access JWTs |
| `JWT_ADMIN_REFRESH_SECRET`| `string (min 16)` | `super-admin-secret...` | Secret key for signing admin refresh JWTs |
| `OTP_DEV_CODE` | `string (6 digits)` | `123456` | Bypass OTP code for development/testing |
| `OTP_PROVIDER_DRIVER` | `dev \| twilio_verify` | `dev` | OTP SMS provider driver selection |
| `TWILIO_ACCOUNT_SID` | `string` | `undefined` | Twilio Account SID for live SMS OTP |
| `TWILIO_AUTH_TOKEN` | `string` | `undefined` | Twilio Auth Token |
| `TWILIO_VERIFY_SERVICE_SID`| `string` | `undefined` | Twilio Verify Service SID |
| `EMAIL_PROVIDER_DRIVER` | `dev \| resend \| brevo` | `dev` | Transactional email provider driver |
| `RESEND_API_KEY` | `string` | `undefined` | Resend Email API Key |
| `BREVO_API_KEY` | `string` | `undefined` | Brevo Email API Key |
| `BREVO_SENDER_EMAIL` | `string` | `undefined` | Brevo sender email address |
| `CRON_SECRET` | `string` | `undefined` | Shared secret header (`x-cron-secret`) for cron endpoints |
| `GOOGLE_OAUTH_CLIENT_ID` | `string` | `undefined` | Web Client ID for Google OAuth token verification |
| `PAYMENT_GATEWAY_DRIVER` | `manual \| razorpay \| cashfree` | `manual` | Payment gateway driver for webhooks/payouts |
| `CASHFREE_APP_ID` | `string` | `undefined` | Cashfree App ID |
| `CASHFREE_SECRET_KEY` | `string` | `undefined` | Cashfree Secret Key |
| `NOTIFICATION_PROVIDER_DRIVER`| `dev \| expo \| fcm` | `dev` | Push notification driver |
| `FCM_SERVICE_ACCOUNT_JSON`| `string` | `undefined` | Firebase Service Account JSON string |
| `OCR_PROVIDER_DRIVER` | `noop \| tesseract` | `noop` | Receipt OCR engine driver |
| `OBJECT_STORAGE_DRIVER` | `local \| s3` | `local` | Object storage provider (MinIO / S3) |
| `S3_ENDPOINT` | `string` | `undefined` | Custom S3 endpoint URL (MinIO) |
| `S3_BUCKET` | `string` | `undefined` | S3 / MinIO bucket name for attachments |
| `FX_PROVIDER_DRIVER` | `frankfurter \| static` | `frankfurter` | Foreign exchange rate provider |
| `ALLOW_INSECURE_DEV_PROVIDERS`| `boolean` | `false` | Gate flag for dev OTP/providers in non-prod |

---

## 2. Feature Inventory

| Feature | Description | Implementation Path(s) | Flags / Permissions | Status / Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Phone / Email OTP Auth** | Send & verify 6-digit OTP codes via SMS (Twilio) or Email (Brevo/Resend). Generates JWT access/refresh token pairs. | `apps/api/src/modules/auth/auth.controller.ts`<br>`auth.service.ts` | `OTP_PROVIDER_DRIVER`, `EMAIL_PROVIDER_DRIVER` | Production Ready |
| **Google OAuth 2.0** | Native Google Sign-In on mobile via `@react-native-google-signin`, backend verification via `google-auth-library`. | `apps/api/src/modules/auth/auth.service.ts`<br>`apps/mobile/src/auth/GoogleSignInButton.tsx` | `GOOGLE_OAUTH_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Production Ready |
| **User Profile & Contacts** | User profile update, contact alias sync (`ContactAliasEntity`), and device token registration (`DeviceInstallationEntity`). | `apps/api/src/modules/users/users.controller.ts`<br>`apps/api/src/modules/contacts/contacts.controller.ts` | Authenticated User | Production Ready |
| **Group Lifecycle & Roles** | Create, edit, archive groups. Roles: `owner`, `admin`, `member`, `viewer`. Role changes and member removal. | `apps/api/src/modules/groups/groups.controller.ts`<br>`packages/domain/src/authorization-policy.ts` | `member_role_change`, `archive` | Production Ready |
| **Group Invite Links** | Generate unique join codes / URLs (`/v1/join/:inviteCode`). Users join directly by code. | `apps/api/src/modules/groups/join-link.controller.ts` | Authenticated User | Production Ready |
| **Friends & 1-on-1 Ledgers** | Add friends by phone/email. Creates direct pairwise ledger without formal group container. | `apps/api/src/modules/friends/friends.controller.ts` | Authenticated User | Production Ready |
| **Equal Split Strategy** | Equal division of total expense among participants. Residual minor units allocated via `RoundingAllocator`. | `packages/domain/src/split-strategies.ts` (`EqualSplitStrategy`) | `expense_create` | Production Ready |
| **Exact Amount Split** | Custom exact minor unit amounts per participant. Enforces `sum === totalMinor`. | `packages/domain/src/split-strategies.ts` (`ExactAmountSplitStrategy`) | `expense_create` | Production Ready |
| **Percentage / Weighted Split** | Split by relative weights or percentages. Allocates remainder using floored remainder ordering. | `packages/domain/src/split-strategies.ts` (`WeightedShareSplitStrategy`) | `expense_create` | Production Ready |
| **Itemized Receipt Split** | Line-item assignments to specific participants, allocating tax, tip, and discount proportionally. | `apps/api/src/modules/expenses/expenses.service.ts`<br>`apps/api/src/modules/receipts-capture/` | `expense_create` | Production Ready |
| **Expense Attachments & Receipts** | Upload receipt images / PDF bills to object storage (MinIO/S3). OCR extraction via Tesseract.js. | `apps/api/src/modules/receipts-capture/receipts-capture.controller.ts` | `OCR_PROVIDER_DRIVER`, `OBJECT_STORAGE_DRIVER` | Production Ready |
| **Expense Comments** | Discussion thread per expense with comment creation and soft deletion. | `apps/api/src/modules/expenses/expenses.controller.ts` | Group Member | Production Ready |
| **Debt Simplification** | Multilateral debt optimization (`GreedySettlementOptimizer`) reducing N-way debt graph into minimal transfers. | `packages/domain/src/settlement-optimizer.ts` | Group Member | Production Ready |
| **UPI Intent & Deep Link** | Generates standard `upi://pay` URI with payee VPA, note, transaction reference, and decimal amount. | `packages/domain/src/upi-uri.ts` (`UpiUriBuilder`) | `UPI_INTENT_PROVIDER_DRIVER` | Production Ready |
| **Settlement State Machine** | 16-state lifecycle for payment proof, auto-matching, receiver confirmation, dispute, and reversal. | `packages/domain/src/settlement-state-machine.ts` | `settlement_confirm` | Production Ready |
| **Payment Gateways** | Webhook listeners for Razorpay & Cashfree payment status updates. | `apps/api/src/modules/settlements/payment-webhook.controller.ts` | `PAYMENT_GATEWAY_DRIVER` | Production Ready |
| **Recurring Expenses** | Schedule expenses on daily/weekly/monthly/yearly frequency. Background job generates occurrences. | `apps/api/src/modules/recurring/recurring.controller.ts`<br>`apps/api/src/modules/jobs/jobs.controller.ts` | Authenticated User | Production Ready |
| **Import / Export** | Import Splitwise CSV dumps or Setu Account Aggregator bank statements. Export PDF/CSV ledgers. | `apps/api/src/modules/imports-exports/imports-exports.controller.ts` | `export` | Production Ready |
| **Push Notifications & Emails** | Trigger push alerts (Expo/FCM) and transactional emails (Brevo/Resend) on expense creation and settlements. | `apps/api/src/modules/notifications/notifications.controller.ts` | `NOTIFICATION_PROVIDER_DRIVER` | Production Ready |
| **Offline Command Queue & Delta Sync** | Queue actions offline in SQLite; push commands and pull `SyncProjectionChangeEntity` deltas. | `apps/api/src/modules/offline-sync/offline-sync.controller.ts` | Authenticated User | Production Ready |
| **Admin Control Plane** | Admin auth, user management, audit log inspection, feature flag toggles, system metrics, and support tickets. | `apps/api/src/modules/admin/` (12 Controllers) | `AdminUserEntity` with JWT Admin Secret | Production Ready |

---

## 3. Splitting & Settlement Calculation Logic

### 3.1 Money Representation & Exact Minor Units
All monetary values in SplitSaathi are stored as **integer minor units** (e.g., paise in INR, cents in USD, where ₹100.00 = `10000` minor units).

`packages/domain/src/money.ts`:
```typescript
export class Money {
  private constructor(
    public readonly amountMinor: number,
    public readonly currencyCode: string
  ) {
    if (!Number.isInteger(amountMinor)) {
      throw new Error('Money amount must be stored in integer minor units.');
    }
    if (!/^[A-Z]{3}$/.test(currencyCode)) {
      throw new Error('Currency must be a three-letter ISO code.');
    }
  }

  static of(amountMinor: number, currencyCode = 'INR'): Money {
    return new Money(amountMinor, currencyCode);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this.amountMinor + other.amountMinor, this.currencyCode);
  }
}
```

---

### 3.2 The Rounding Allocator Algorithm
When splitting an integer minor unit amount among $N$ participants, exact division often leaves a non-zero fractional remainder (e.g., 10000 paise / 3 = 3333.3333... paise). SplitSaathi solves this deterministically using `RoundingAllocator` in `packages/domain/src/rounding.ts`.

#### Algorithm Step-by-Step:
1. **Input**: `totalMinor: number`, list of inputs `{ id: string, weightNumerator: number, weightDenominator: number }`.
2. **Normalized Weight**: Compute $w_i = \text{weightNumerator}_i / \text{weightDenominator}_i$. Total weight $W = \sum w_i$.
3. **Exact Allocation**: Compute $E_i = \frac{| \text{totalMinor} | \times w_i}{W}$.
4. **Floor Allocation**: Compute $F_i = \lfloor E_i \rfloor$. Compute fractional residual $Frac_i = E_i - F_i$.
5. **Remainder**: Compute unallocated remainder $R = |\text{totalMinor}| - \sum F_i$.
6. **Deterministic Ordering**: Sort inputs by $Frac_i$ descending. For ties ($Frac_i = Frac_j$), sort by `stableHash(id)` ascending:
   ```typescript
   function stableHash(value: string): number {
     let hash = 2166136261;
     for (let index = 0; index < value.length; index += 1) {
       hash ^= value.charCodeAt(index);
       hash = Math.imul(hash, 16777619);
     }
     return hash >>> 0;
   }
   ```
7. **Remainder Distribution**: Distribute $+1$ minor unit to each participant in sorted order until $R = 0$.
8. **Final Result**: $\text{amountMinor}_i = \text{sign} \times (F_i + \text{extra}_i)$. The visible residual is $\text{residualMinor}_i = \text{extra}_i$.

#### Worked Numeric Example:
> **Scenario**: Split ₹100.00 (`10000` paise) equally among 3 participants: User A (`usr_a`), User B (`usr_b`), User C (`usr_c`).
> - Total = `10000` paise. Weights = 1, 1, 1. Total Weight $W = 3$.
> - Exact: $E_A = 3333.3333...$, $E_B = 3333.3333...$, $E_C = 3333.3333...$
> - Floored: $F_A = 3333$, $F_B = 3333$, $F_C = 3333$. Sum = $9999$ paise.
> - Unallocated Remainder $R = 10000 - 9999 = 1$ paise.
> - Fractions: $0.3333...$ for all three.
> - Tie-breaker Hash: `stableHash('usr_a')`, `stableHash('usr_b')`, `stableHash('usr_c')`.
> - Lowest hash winner receives $+1$ paise.
> - **Final Split**: Participant 1 = `3334` paise (₹33.34), Participant 2 = `3333` paise (₹33.33), Participant 3 = `3333` paise (₹33.33). Sum = `10000` paise (₹100.00). **Zero penny leakage!**

---

### 3.3 Split Strategies Reference

| Strategy | Formula / Algorithm | File:Function | Rounding Behavior | Notes / Risks |
| :--- | :--- | :--- | :--- | :--- |
| **Equal Split** | $w_i = 1 / 1$. Allocates `totalMinor` equally across $N$ participants via `RoundingAllocator`. | `packages/domain/src/split-strategies.ts`<br>`EqualSplitStrategy.calculate` | Deterministic remainder distribution via `stableHash`. | No penny leakage. Sum guaranteed to equal `totalMinor`. |
| **Exact Split** | Participant inputs exact `amountMinor`. Enforces $\sum \text{amountMinor}_i === \text{totalMinor}$. | `packages/domain/src/split-strategies.ts`<br>`ExactAmountSplitStrategy.calculate` | No rounding (exact integer inputs). | Throws Error if $\sum \neq \text{totalMinor}$. |
| **Weighted / Share Split** | Inputs specify $w_i = \text{numerator}_i / \text{denominator}_i$. Allocates via `RoundingAllocator`. | `packages/domain/src/split-strategies.ts`<br>`WeightedShareSplitStrategy.calculate` | Remainder allocated to largest fractional remainders. | Requires positive non-zero rational weights. |
| **Percentage Split** | Converted to Weighted Split where $w_i = \text{percent}_i / 100$. Enforces $\sum \text{percent}_i === 100$. | `apps/api/src/modules/expenses/expenses.service.ts` | Allocated via `RoundingAllocator`. | Pre-validated at DTO layer to sum to 100%. |
| **Itemized Split** | Line items assigned to specific users. Tax, tip, & discounts allocated proportionally to item totals. | `apps/api/src/modules/expenses/expenses.service.ts` | Proportional allocation using `RoundingAllocator`. | Complex rounding on tax/tip allocation across items. |

---

### 3.4 Simplify Debts Algorithm (`GreedySettlementOptimizer`)
In `packages/domain/src/settlement-optimizer.ts`:
Given a set of net balances for group members, the system minimizes settlement transactions using a **Greedy Max-Debtor / Max-Creditor Matching Algorithm**:

```typescript
export class GreedySettlementOptimizer {
  suggest(balances: NetBalance[], expenseHints: SettlementExpenseHint[] = []): SettlementSuggestion[] {
    const byCurrency = new Map<string, NetBalance[]>();
    for (const balance of balances) {
      if (balance.amountMinor === 0) continue;
      byCurrency.set(balance.currencyCode, [...(byCurrency.get(balance.currencyCode) ?? []), balance]);
    }

    const suggestions: SettlementSuggestion[] = [];
    for (const [currencyCode, rows] of byCurrency.entries()) {
      const debtors = rows
        .filter((row) => row.amountMinor < 0)
        .map((row) => ({ ...row, amountMinor: Math.abs(row.amountMinor) }))
        .sort((left, right) => right.amountMinor - left.amountMinor);
      const creditors = rows
        .filter((row) => row.amountMinor > 0)
        .map((row) => ({ ...row }))
        .sort((left, right) => right.amountMinor - left.amountMinor);

      let debtorIndex = 0;
      let creditorIndex = 0;
      while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
        const debtor = debtors[debtorIndex];
        const creditor = creditors[creditorIndex];
        const amountMinor = Math.min(debtor.amountMinor, creditor.amountMinor);
        suggestions.push({
          payerParticipantId: debtor.participantId,
          payeeParticipantId: creditor.participantId,
          amountMinor,
          currencyCode,
          explanation: buildSettlementExplanation(debtor.participantId, creditor.participantId, expenseHints)
        });
        debtor.amountMinor -= amountMinor;
        creditor.amountMinor -= amountMinor;
        if (debtor.amountMinor === 0) debtorIndex += 1;
        if (creditor.amountMinor === 0) creditorIndex += 1;
      }
    }
    return suggestions;
  }
}
```

---

### 3.5 Double-Entry Balanced Ledger Rule
In `packages/domain/src/ledger.ts`:
Every event posted to the financial ledger must form a **Balanced Posting Set**. The sum of `signedAmountMinor` across all participants for each currency MUST equal zero:

$$\sum \text{signedAmountMinor}_i = 0$$

```typescript
export class BalancedPostingSet {
  static create(postings: LedgerPostingInput[]): BalancedPostingSet {
    const totals = new Map<string, number>();
    for (const posting of postings) {
      if (!Number.isInteger(posting.signedAmountMinor)) {
        throw new Error('Ledger posting amounts must use integer minor units.');
      }
      totals.set(posting.currencyCode, (totals.get(posting.currencyCode) ?? 0) + posting.signedAmountMinor);
    }
    for (const [currencyCode, total] of totals.entries()) {
      if (total !== 0) {
        throw new Error(`Ledger postings must balance to zero for ${currencyCode}; got ${total}.`);
      }
    }
    return new BalancedPostingSet(postings);
  }
}
```

---

## 4. Data Model / Database Schema

The database contains **68 TypeORM entities** organized into domain clusters:

### 4.1 Identity & Authentication Cluster
- **`UserEntity`** (`users` table): Primary user record.
  - Fields: `id` (UUID), `phoneNumber` (string, nullable), `email` (string, nullable), `displayName` (string), `avatarUrl` (string, nullable), `defaultCurrencyCode` (string), `status` (`active` | `suspended`), `createdAt`, `updatedAt`.
- **`AuthIdentityEntity`** (`auth_identities` table): Authentication credentials.
  - Fields: `id`, `userId`, `provider` (`phone_otp` | `email_otp` | `google` | `password`), `identifier` (phone/email/googleSub), `passwordHash`, `lastLoginAt`.
- **`OtpChallengeEntity`** (`otp_challenges` table): Tracks OTP lifecycle.
  - Fields: `id`, `target` (phone/email), `codeHash`, `expiresAt`, `attemptsCount`, `verifiedAt`.
- **`RefreshSessionEntity`** (`refresh_sessions` table): Active JWT refresh sessions.
  - Fields: `id`, `userId`, `refreshTokenHash`, `deviceInfo`, `expiresAt`, `revokedAt`.
- **`DeviceInstallationEntity`** (`device_installations` table): Push notification device tokens.
  - Fields: `id`, `userId`, `deviceToken`, `platform` (`ios` | `android` | `web`), `pushProvider` (`expo` | `fcm`), `lastSeenAt`.

### 4.2 Group & Member Cluster
- **`GroupEntity`** (`groups` table): Group container.
  - Fields: `id`, `name`, `description`, `category`, `defaultCurrencyCode`, `simplifyDebtsEnabled` (boolean), `inviteCode` (unique index), `archivedAt`, `createdById`.
- **`ParticipantEntity`** (`participants` table): Group or direct 1-on-1 ledger participant representation.
  - Fields: `id`, `groupId` (nullable for 1-on-1), `userId` (nullable for ghost/guest users), `displayName`, `email`, `phoneNumber`.
- **`GroupMembershipEntity`** (`group_memberships` table): Maps user to group role.
  - Fields: `id`, `groupId`, `userId`, `participantId`, `role` (`owner` | `admin` | `member` | `viewer`), `joinedAt`.

### 4.3 Expenses Cluster
- **`ExpenseProjectionEntity`** (`expense_projections` table): Read-optimized view of expenses.
  - Fields: `id`, `groupId`, `description`, `totalAmountMinor`, `currencyCode`, `category`, `expenseDate`, `createdById`, `version`, `status` (`active` | `voided`).
- **`ExpensePayerEntity`** (`expense_payers` table): Amounts paid per participant.
  - Fields: `id`, `expenseId`, `participantId`, `paidAmountMinor`.
- **`ExpenseShareEntity`** (`expense_shares` table): Amounts owed per participant.
  - Fields: `id`, `expenseId`, `participantId`, `owedAmountMinor`, `shareType` (`equal` | `exact` | `percent` | `weight` | `itemized`), `shareValueMinor`.
- **`ExpenseLineItemEntity`** (`expense_line_items` table): Itemized bill rows.
  - Fields: `id`, `expenseId`, `description`, `amountMinor`, `quantity`.

### 4.4 Financial Ledger & CQRS Cluster
- **`EventStoreEntity`** (`event_store` table): Immutable ledger event journal.
  - Fields: `id` (bigint auto-increment), `aggregateType`, `aggregateId`, `eventType`, `eventData` (JSONB), `metadata` (JSONB), `createdAt`.
- **`LedgerPostingEntity`** (`ledger_postings` table): Double-entry ledger postings.
  - Fields: `id`, `eventId`, `groupId`, `participantId`, `currencyCode`, `signedAmountMinor`, `postingType`, `sourceType`, `sourceId`, `createdAt`.
- **`GroupBalanceProjectionEntity`** (`group_balance_projections` table): Cached net balances.
  - Fields: `id`, `groupId`, `participantId`, `currencyCode`, `netBalanceMinor`, `updatedAt`. Updated synchronously on every ledger event transaction.

### 4.5 Settlements & Payment Cluster
- **`SettlementIntentEntity`** (`settlement_intents` table): Payment lifecycle.
  - Fields: `id`, `groupId`, `payerParticipantId`, `payeeParticipantId`, `amountMinor`, `currencyCode`, `state` (`suggested` ... `confirmed`), `paymentMethod` (`upi` | `cash` | `gateway`).
- **`PaymentProofEntity`** (`payment_proofs` table): User uploaded payment evidence.
  - Fields: `id`, `settlementIntentId`, `proofType` (`upi_ref` | `screenshot_attachment`), `referenceNumber`, `attachmentId`, `notes`.
- **`UpiPaymentReferenceEntity`** (`upi_payment_references` table): Tracks UPI transaction references.

---

## 5. API Reference

### Auth Endpoints (`/v1/auth`)
| Method | Route | Auth | Summary & Side Effects |
| :--- | :--- | :--- | :--- |
| `POST` | `/v1/auth/request-otp` | Public | Sends 6-digit OTP code via SMS/Email. Writes `OtpChallengeEntity`. |
| `POST` | `/v1/auth/verify-otp` | Public | Verifies OTP code. Creates `UserEntity` if new, returns JWT Access/Refresh tokens. |
| `POST` | `/v1/auth/google` | Public | Verifies Google ID token via `google-auth-library`. Logs in or registers user. |
| `POST` | `/v1/auth/refresh` | Refresh JWT | Rotates refresh token, invalidates old token, returns new Access/Refresh tokens. |
| `POST` | `/v1/auth/logout` | Access JWT | Revokes active `RefreshSessionEntity`. |

### Group Endpoints (`/v1/groups`)
| Method | Route | Auth | Summary & Side Effects |
| :--- | :--- | :--- | :--- |
| `POST` | `/v1/groups` | Access JWT | Creates group and owner membership (`GroupEntity`, `GroupMembershipEntity`). |
| `GET` | `/v1/groups` | Access JWT | Returns all groups where user is an active member. |
| `GET` | `/v1/groups/:id` | Access JWT | Returns group metadata, members, and net balance summary. |
| `POST` | `/v1/groups/:id/members` | Member Permission | Adds new member or ghost participant to group. |
| `POST` | `/v1/join/:inviteCode` | Access JWT | Joins user to group via invite code. |

### Expense Endpoints (`/v1/expenses` & `/v1/groups/:id/expenses`)
| Method | Route | Auth | Summary & Side Effects |
| :--- | :--- | :--- | :--- |
| `POST` | `/v1/groups/:id/expenses` | `expense_create` | Validates split, appends event to `EventStoreEntity`, posts `LedgerPostingEntity` entries, updates `GroupBalanceProjectionEntity`. |
| `GET` | `/v1/groups/:id/expenses` | Access JWT | Returns paginated expense list for group. |
| `PUT` | `/v1/expenses/:id` | `expense_edit_own` / `any` | Reverses previous ledger postings and appends new version event to event store. |
| `DELETE` | `/v1/expenses/:id` | `expense_void` | Voids expense, appends `EXPENSE_VOIDED` event, posts reversing ledger entries. |

### Settlement Endpoints (`/v1/settlements`)
| Method | Route | Auth | Summary & Side Effects |
| :--- | :--- | :--- | :--- |
| `GET` | `/v1/groups/:id/settlements/suggestions` | Access JWT | Runs `GreedySettlementOptimizer` and returns optimized transfers. |
| `POST` | `/v1/settlements/intents` | Access JWT | Creates settlement intent, builds UPI deep link if payment method is UPI. |
| `POST` | `/v1/settlements/intents/:id/proof` | Payer Access | Submits payment proof reference or screenshot. Transitions state to `proof_submitted`. |
| `POST` | `/v1/settlements/intents/:id/confirm` | Payee / Admin | Confirms payment. Posts balanced settlement postings to ledger (`SETTLEMENT_POSTED`). |
| `POST` | `/v1/settlements/intents/:id/dispute` | Access JWT | Transitions settlement state to `disputed`. |

---

## 6. External Integrations & Side Effects

1. **Google OAuth**: Verified via Google Auth Library (`google-auth-library`). Validates web client ID and retrieves profile/email.
2. **SMS OTP**: Driver `twilio_verify`. Sends OTP via Twilio Verify API. Fallback `dev` driver uses static `OTP_DEV_CODE` (`123456`).
3. **Transactional Emails**: Drivers `brevo` (Brevo API v3) and `resend` (Resend Node SDK). Sends onboarding OTPs and monthly summary reports.
4. **Push Notifications**: Drivers `expo` (Expo Push API) and `fcm` (Firebase Admin SDK v14). Sends push alerts on expense additions, settlement requests, and reminders.
5. **Object Storage**: MinIO / S3 via `@aws-sdk/client-s3`. Presigned URLs generated for receipt uploads and evidence screenshots.
6. **Receipt OCR**: Driver `tesseract` (Tesseract.js). Parses uploaded bill image text into line items and totals.
7. **Foreign Exchange Rates**: Driver `frankfurter` (Frankfurter API `https://api.frankfurter.dev/v1`). Syncs FX rate snapshots for multi-currency conversion.

---

## 7. Auth, Permissions & Multi-tenancy

### Authentication Architecture
Uses dual-token JWT authentication:
- **Access Token**: Short-lived (15 minutes), signed with `JWT_ACCESS_SECRET`. Contains `sub` (userId), `email`, and `roles`.
- **Refresh Token**: Long-lived (7 days), stored hashed in `RefreshSessionEntity`.
- **Admin JWT**: Dedicated secrets (`JWT_ADMIN_ACCESS_SECRET`, `JWT_ADMIN_REFRESH_SECRET`) for control plane routes (`/v1/admin/*`).

---

### Authorization Matrix (`packages/domain/src/authorization-policy.ts`)

| Permission | Owner | Admin | Member | Viewer |
| :--- | :---: | :---: | :---: | :---: |
| `expense_create` | ✅ | ✅ | ✅ | ❌ |
| `expense_edit_own` | ✅ | ✅ | ✅ | ❌ |
| `expense_edit_any` | ✅ | ✅ | ❌ | ❌ |
| `expense_void` | ✅ | ✅ | ❌ | ❌ |
| `settlement_confirm`| ✅ | ✅ | ✅ | ❌ |
| `member_invite` | ✅ | ✅ | ❌ | ❌ |
| `member_role_change`| ✅ | ❌ | ❌ | ❌ |
| `export` | ✅ | ✅ | ❌ | ❌ |
| `archive` | ✅ | ❌ | ❌ | ❌ |

---

## 8. Validation & Error Handling

1. **Environment Validation**: Validated on startup via Zod (`packages/config/src/index.ts`). Process terminates immediately if required secrets are missing.
2. **DTO Input Validation**: NestJS `ValidationPipe` with `class-validator` and `class-transformer`. Enforces types, positive integers for minor units, valid ISO currency codes, and exact percentage sums (100%).
3. **Idempotency Control**: Header `x-idempotency-key` processed by `IdempotencyInterceptor` writing to `IdempotencyRecordEntity`. Prevents duplicate expense creation or double settlements during network retries.
4. **Database Transactions**: Event Store appends and ledger postings are wrapped in atomic PostgreSQL database transactions (`QueryRunner` / `EntityManager.transaction`).

---

## 9. State Management & Sync (Frontend)

1. **Server State**: Managed via **TanStack React Query** (`@tanstack/react-query`). Automatic background refetching and query invalidation on mutation.
2. **Offline Support & SQLite Queue**: Mobile client uses `expo-sqlite` to persist local changes to an `OfflineCommandQueue`. When connection resumes, queued actions are pushed to `POST /v1/offline-sync/push`.
3. **Delta Sync Protocol**: Client pulls server updates via `GET /v1/offline-sync/pull?sinceVersion=N`, receiving incremental changes from `SyncProjectionChangeEntity`.

---

## 10. Known Gaps, Risks & Assumptions

### 1. Integer Minor Units vs JS Number Safety
- **Risk**: JavaScript `number` is a 64-bit float (`double`). Number.MAX_SAFE_INTEGER is $2^{53} - 1 = 9,007,199,254,740,991$.
- **Finding**: In INR paise, MAX_SAFE_INTEGER corresponds to ₹90,071,992,547,409.91 (₹90 Trillion). For standard expenses this is completely safe, but integer validation (`Number.isInteger(amountMinor)`) is critical and enforced in `Money` and `RoundingAllocator`.

### 2. Multi-Currency FX Settlement Reversals
- **Risk**: Settling an expense in a currency different from group default currency relies on `FxRateSnapshotEntity`.
- **Finding**: If an FX rate changes between expense creation and settlement dispute/reversal, reversing the ledger posting at the historical rate requires strict audit lookup of the original `eventId`.

### 3. Ghost / Guest User Claiming
- **Risk**: When a ghost participant (added by email/phone before signing up) later registers an account.
- **Finding**: The system links `ParticipantEntity.userId` via `ContactAliasEntity` matching during signup, but partial settlements made prior to user claim must update balance projections cleanly.

---

## 11. Question Log

| # | Question / Ambiguity | Context / Code Location | Recommended Action |
| :-: | :--- | :--- | :--- |
| **Q1** | Should partial settlements allow dispute after receiver confirmation? | `packages/domain/src/settlement-state-machine.ts` line 70 (`confirmed -> ledger_posted -> dispute`) | Confirm product policy on dispute windows after ledger posting. |
| **Q2** | Is there a maximum cap on expense line items per receipt? | `apps/api/src/modules/receipts-capture/` | Add DTO validation array size limit (e.g. max 100 line items per bill) to prevent OCR memory spikes. |
| **Q3** | How are historical FX rates handled if Frankfurter API is unreachable? | `packages/config/src/index.ts` (`FX_PROVIDER_DRIVER`) | Provide local static exchange rate fallback table for offline / unreachable provider scenarios. |

---
*End of Codebase Analysis Documentation.*
