# SplitSaathi — Super Admin Backend Design (`SUPERADMIN_BACKEND_PLAN.md`)

**Date:** August 4, 2026  
**Product:** SplitSaathi (thesplitsaathi.com)  
**Author:** Senior Full-Stack Engineering Team  
**Scope:** Phase 2 — Super Admin Backend Design & Endpoint Specification  

---

## Executive Summary

This plan outlines the architecture, database schema additions, access control model, audit mechanisms, and API specification for the **Super Admin Module** added to the existing NestJS backend (`apps/api`). 

The Super Admin API surface is strictly **additive** under the `/v1/admin/*` route prefix. It does not alter or disrupt mobile user APIs, guards, or data flows.

---

## 1. Database Schema Additions & Migration Plan

All new tables will be added via a new TypeORM migration in `packages/db/src/migrations/1783641600011-SuperAdminModule.ts` and corresponding entity files in `packages/db/src/entities/admin.entities.ts`.

### 1.1 New Tables Summary

```
┌───────────────────────────┐      ┌───────────────────────────┐
│        admin_users        │1    *│   admin_refresh_sessions  │
│ id (uuid)                 ├──────┤ admin_id (uuid)           │
│ email (unique)            │      │ refresh_token_hash        │
│ password_hash             │      │ expires_at                │
│ role (enum)               │      └───────────────────────────┘
└─────────────┬─────────────┘
              │1
              │*
┌─────────────┴─────────────┐      ┌───────────────────────────┐
│      admin_audit_log      │      │    admin_feature_flags    │
│ admin_id (uuid)           │      │ key (unique string)       │
│ action (string)           │      │ enabled (boolean)         │
│ target_type / target_id   │      │ rollout_percentage        │
│ before (jsonb)            │      └───────────────────────────┘
│ after (jsonb)             │
│ ip_address, user_agent    │      ┌───────────────────────────┐
└───────────────────────────┘      │     admin_app_configs     │
                                   │ platform (ios/android)    │
┌───────────────────────────┐      │ min_supported_version     │
│   admin_support_tickets   │      │ force_update_enabled      │
│ user_id, subject, status  │      └───────────────────────────┘
└───────────────────────────┘
                                   ┌───────────────────────────┐
┌───────────────────────────┐      │       subscriptions       │
│       admin_events        │      │ user_id, plan_id, status  │
│ event_type, user_id       │      │ mrr_amount_minor          │
│ amount_minor, occurred_at │      └───────────────────────────┘
└───────────────────────────┘
```

#### Entity Details:

1. **`admin_users` (`AdminUserEntity`)**
   - `id` (uuid, primary key)
   - `email` (text, unique index)
   - `password_hash` (text)
   - `full_name` (text)
   - `role` (enum: `'super_admin'`, `'ops_admin'`, `'finance_admin'`, `'read_only'`)
   - `status` (enum: `'active'`, `'suspended'`)
   - `totp_secret` (text, nullable)
   - `totp_enabled` (boolean, default false)
   - `last_login_at` (timestamptz, nullable)
   - `created_at` (timestamptz), `updated_at` (timestamptz)

2. **`admin_refresh_sessions` (`AdminRefreshSessionEntity`)**
   - `id` (uuid, primary key)
   - `admin_id` (uuid, index)
   - `refresh_token_hash` (text)
   - `ip_address` (text)
   - `user_agent` (text)
   - `expires_at` (timestamptz)
   - `revoked_at` (timestamptz, nullable)
   - `created_at` (timestamptz)

3. **`admin_audit_log` (`AdminAuditLogEntity`)**
   - `id` (uuid, primary key)
   - `admin_id` (uuid, index)
   - `action` (text, index)
   - `target_type` (text) — e.g. `'user'`, `'group'`, `'expense'`, `'subscription'`, `'feature_flag'`
   - `target_id` (text, index)
   - `before` (jsonb, nullable)
   - `after` (jsonb, nullable)
   - `ip_address` (text)
   - `user_agent` (text)
   - `created_at` (timestamptz, index)

4. **`admin_support_tickets` (`AdminSupportTicketEntity`) & Messages**
   - `id` (uuid), `ticket_number` (text, unique), `user_id` (uuid, index), `subject` (text), `description` (text), `status` (`'open'`, `'in_progress'`, `'resolved'`, `'closed'`), `priority` (`'low'`, `'medium'`, `'high'`, `'urgent'`), `assigned_admin_id` (uuid, nullable), `created_at`, `updated_at`.
   - `admin_support_messages`: `id`, `ticket_id`, `sender_type` (`'user'`, `'admin'`, `'system'`), `sender_id`, `body`, `created_at`.

5. **`admin_feature_flags` (`AdminFeatureFlagEntity`)**
   - `id` (uuid), `key` (text, unique), `description` (text), `enabled` (boolean), `rollout_percentage` (integer 0-100), `target_platforms` (jsonb text array), `min_app_version` (text, nullable), `updated_by_admin_id` (uuid), `updated_at`.

6. **`admin_app_configs` (`AdminAppConfigEntity`)**
   - `id` (uuid), `platform` (text: `'ios'`, `'android'`, `'global'`), `min_supported_version` (text), `latest_version` (text), `force_update_enabled` (boolean), `changelog` (text, nullable), `updated_by_admin_id` (uuid), `updated_at`.

7. **`admin_events` (`AdminEventEntity`)**
   - Light-weight platform metrics ingestion table.
   - `id` (uuid), `event_type` (text: `'signup'`, `'group_created'`, `'expense_created'`, `'settlement_confirmed'`, `'subscription_started'`, `'subscription_canceled'`), `user_id` (uuid, nullable), `group_id` (uuid, nullable), `amount_minor` (bigint, nullable), `currency_code` (char(3), nullable), `platform` (text, nullable), `app_version` (text, nullable), `metadata` (jsonb), `occurred_at` (timestamptz, index).

8. **`subscriptions` (`SubscriptionEntity`) & `billing_plans` (`BillingPlanEntity`)**
   - `billing_plans`: `id` (uuid), `name` (text), `code` (text, unique), `amount_minor` (bigint), `currency_code` (char(3)), `interval` (text: `'monthly'`, `'yearly'`), `features` (jsonb), `active` (boolean), `created_at`.
   - `subscriptions`: `id` (uuid), `user_id` (uuid, index), `plan_id` (uuid), `status` (`'trial'`, `'active'`, `'past_due'`, `'canceled'`), `mrr_amount_minor` (bigint), `currency_code` (char(3)), `current_period_start` (timestamptz), `current_period_end` (timestamptz), `canceled_at` (timestamptz, nullable), `created_at`, `updated_at`.

---

## 2. Admin Identity & RBAC Matrix

### 2.1 Role Tiers
1. **`super_admin`**: Full access to all endpoints, including creating/modifying admin users, setting feature flags, manual refunds, and system configuration.
2. **`ops_admin`**: User management, support tickets, group flag/investigate, broadcast notifications, CSV job monitoring. No access to revenue/financial refunds or admin user management.
3. **`finance_admin`**: Financial ledger search, settlement proof review, subscription list, revenue dashboard, refund issuing, export downloads. No access to user banning or feature flag toggles.
4. **`read_only`**: View-only access across dashboards, users, groups, expenses, and audit logs. All `POST`, `PATCH`, `PUT`, `DELETE` routes blocked.

### 2.2 RBAC Permission Matrix Table

| Resource / Action | Endpoint Group | Super Admin | Ops Admin | Finance Admin | Read-Only |
|---|---|:---:|:---:|:---:|:---:|
| Admin Authentication / Refresh | `/v1/admin/auth/*` | ✅ | ✅ | ✅ | ✅ |
| Admin User Management | `/v1/admin/management/*` | ✅ | ❌ | ❌ | ❌ |
| View Users & Details | `/v1/admin/users` | ✅ | ✅ | ✅ | ✅ |
| User Actions (Ban, Logout, Impersonate) | `/v1/admin/users/:id/actions` | ✅ | ✅ | ❌ | ❌ |
| GDPR Soft-Delete Request | `/v1/admin/users/:id/gdpr-delete` | ✅ | ❌ | ❌ | ❌ |
| View Groups & Details | `/v1/admin/groups` | ✅ | ✅ | ✅ | ✅ |
| Flag/Investigate Group | `/v1/admin/groups/:id/flag` | ✅ | ✅ | ❌ | ❌ |
| View Platform Ledger & Expenses | `/v1/admin/financial/expenses` | ✅ | ❌ | ✅ | ✅ |
| Review Settlement Proofs | `/v1/admin/financial/settlements` | ✅ | ❌ | ✅ | ✅ |
| View Subscriptions & Revenue | `/v1/admin/subscriptions/*` | ✅ | ❌ | ✅ | ✅ |
| Process Refund / Credit | `/v1/admin/subscriptions/refund` | ✅ | ❌ | ✅ | ❌ |
| Support Ticket Triage | `/v1/admin/support/*` | ✅ | ✅ | ❌ | ✅ |
| CSV Import/Export Job Monitor | `/v1/admin/jobs/*` | ✅ | ✅ | ✅ | ✅ |
| Feature Flags & App Config | `/v1/admin/config/*` | ✅ | ❌ | ❌ | ✅ (view) |
| Broadcast Notifications | `/v1/admin/notifications/*` | ✅ | ✅ | ❌ | ❌ |
| Overview Analytics Dashboard | `/v1/admin/analytics/*` | ✅ | ✅ | ✅ | ✅ |
| View Audit Logs | `/v1/admin/audit-logs` | ✅ | ✅ | ✅ | ✅ |

---

## 3. Complete Endpoint Specification

All endpoints reside under `/v1/admin`.

### 3.1 Authentication & Profile (`/v1/admin/auth`)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/v1/admin/auth/login` | `@Public()` | Login with admin email & password. Returns JWT access token + refresh token. |
| `POST` | `/v1/admin/auth/refresh` | `@Public()` | Exchange valid admin refresh token for new access token. |
| `POST` | `/v1/admin/auth/logout` | All Admins | Revoke active admin refresh session. |
| `GET` | `/v1/admin/auth/me` | All Admins | Fetch profile & permissions of logged-in admin. |

### 3.2 User & Account Management (`/v1/admin/users`)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/v1/admin/users` | All Admins | List/search/filter users (paginated by page/limit; filter by search query, status, signup date range). |
| `GET` | `/v1/admin/users/:userId` | All Admins | Detailed user profile: groups, expense volume, settlements, device info, subscription status. |
| `POST` | `/v1/admin/users/:userId/suspend` | `super_admin`, `ops_admin` | Suspend or ban a user. Writes entry to `admin_audit_log`. |
| `POST` | `/v1/admin/users/:userId/unsuspend` | `super_admin`, `ops_admin` | Lift suspension. Writes entry to `admin_audit_log`. |
| `POST` | `/v1/admin/users/:userId/force-logout` | `super_admin`, `ops_admin` | Revoke all active user refresh sessions. |
| `POST` | `/v1/admin/users/:userId/impersonate` | `super_admin`, `ops_admin` | Generate a short-lived, **read-only** support token to view app as user. Audited. |
| `POST` | `/v1/admin/users/:userId/gdpr-delete` | `super_admin` | Initiate DPDP Act compliant soft deletion (anonymizes phone, clears VPA, retains financial record). |

### 3.3 Groups & Ledgers (`/v1/admin/groups`)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/v1/admin/groups` | All Admins | List/search groups (mode, state, member count, total volume, date range). |
| `GET` | `/v1/admin/groups/:groupId` | All Admins | Group detail: member roster, expense timeline, settlement state, dispute flags. |
| `POST` | `/v1/admin/groups/:groupId/flag` | `super_admin`, `ops_admin` | Flag a group for fraud/abuse investigation without altering user data. |
| `POST` | `/v1/admin/groups/:groupId/unflag` | `super_admin`, `ops_admin` | Clear fraud flag on group. |

### 3.4 Financial Integrity & Settlements (`/v1/admin/financial`)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/v1/admin/financial/expenses` | `super_admin`, `finance_admin`, `read_only` | Searchable platform-wide expense ledger with filters (amount range, group, date range, voided state). |
| `GET` | `/v1/admin/financial/expenses/:expenseId/audit-trail` | `super_admin`, `finance_admin`, `read_only` | Surface complete version projection history and event rail for an expense. |
| `GET` | `/v1/admin/financial/settlements` | `super_admin`, `finance_admin`, `read_only` | Searchable platform settlements (filter by state: pending-proof, confirmed, disputed, duplicate UTR). |
| `GET` | `/v1/admin/financial/settlements/:settlementId/proof` | `super_admin`, `finance_admin`, `read_only` | View proof attachment (screenshot/UTR text), OCR output, and time-to-confirm metrics. |
| `POST` | `/v1/admin/financial/settlements/:settlementId/force-confirm` | `super_admin`, `finance_admin` | Manual override to post a settlement to ledger during dispute resolution. Audited. |

### 3.5 Subscriptions & Revenue (`/v1/admin/subscriptions`)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/v1/admin/subscriptions` | `super_admin`, `finance_admin`, `read_only` | Subscriber list with filters (plan, status: trial/active/past_due/canceled, renewal date). |
| `GET` | `/v1/admin/subscriptions/plans` | `super_admin`, `finance_admin`, `read_only` | List available billing plans and pricing tiers. |
| `GET` | `/v1/admin/subscriptions/revenue-summary` | `super_admin`, `finance_admin`, `read_only` | Revenue metrics: MRR, ARR, new vs churned, plan mix, trial-to-paid conversion. |
| `GET` | `/v1/admin/subscriptions/cohorts` | `super_admin`, `finance_admin`, `read_only` | Monthly subscriber retention cohorts (D1, D7, D30 retention curves). |
| `POST` | `/v1/admin/subscriptions/refund` | `super_admin`, `finance_admin` | Issue a subscription refund/credit with mandatory audit log reason. |

### 3.6 Support & Jobs (`/v1/admin/support` & `/v1/admin/jobs`)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/v1/admin/support/tickets` | `super_admin`, `ops_admin`, `read_only` | List support tickets (filter by status, priority, user). |
| `GET` | `/v1/admin/support/tickets/:ticketId` | `super_admin`, `ops_admin`, `read_only` | View ticket details and full conversation thread. |
| `POST` | `/v1/admin/support/tickets/:ticketId/reply` | `super_admin`, `ops_admin` | Post an admin response to support ticket thread. |
| `PATCH` | `/v1/admin/support/tickets/:ticketId/status` | `super_admin`, `ops_admin` | Update ticket status (`in_progress`, `resolved`, `closed`). |
| `GET` | `/v1/admin/jobs/import-export` | All Admins | Monitor CSV/JSON import/export background jobs (Splitwise import, Tally export). |
| `POST` | `/v1/admin/jobs/import-export/:jobId/retry` | `super_admin`, `ops_admin` | Retry a failed background import/export job. |

### 3.7 Feature Flags & App Configuration (`/v1/admin/config`)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/v1/admin/config/feature-flags` | All Admins | List all feature flags, rollout %, and platform targets. |
| `POST` | `/v1/admin/config/feature-flags` | `super_admin` | Create or update a feature flag. Audited. |
| `DELETE` | `/v1/admin/config/feature-flags/:key` | `super_admin` | Delete a feature flag. Audited. |
| `GET` | `/v1/admin/config/app-version` | All Admins | View app version requirements and force-update settings. |
| `PUT` | `/v1/admin/config/app-version` | `super_admin` | Update minimum supported version & force-update configuration. Audited. |

### 3.8 Broadcast Notifications (`/v1/admin/notifications`)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/v1/admin/notifications/broadcast` | `super_admin`, `ops_admin` | Compose & dispatch segmented push/in-app notification to users. |
| `GET` | `/v1/admin/notifications/history` | All Admins | View past broadcast notification campaigns and delivery stats. |

### 3.9 Platform Analytics Dashboard (`/v1/admin/analytics`)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/v1/admin/analytics/overview` | All Admins | Top-level KPIs: DAU, WAU, MAU, signups, activation rate, total expense volume (₹), settlement completion rate, avg time-to-settle. |
| `GET` | `/v1/admin/analytics/funnels` | All Admins | Key funnel completion conversion: Signup → Create Group → Add Expense → Confirm Settlement. |
| `GET` | `/v1/admin/analytics/revenue-tile` | All Admins | Financial overview tile cluster: MRR, ARR, Churn %, LTV, ARPU. |

### 3.10 Audit Log Viewer (`/v1/admin/audit-logs`)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/v1/admin/audit-logs` | All Admins | Searchable `admin_audit_log` table (filter by admin, action, target, date range). |

### 3.11 Admin User Management (`/v1/admin/management`)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/v1/admin/management/admins` | `super_admin` | List registered admin users and assigned roles. |
| `POST` | `/v1/admin/management/admins` | `super_admin` | Invite/create a new admin user with assigned role. |
| `PATCH` | `/v1/admin/management/admins/:id` | `super_admin` | Update role or status of an admin user. |

---

## 4. Technical Architecture of Admin Module

```text
apps/api/src/modules/admin/
├── admin.module.ts                   Main module bundling all admin sub-controllers
├── auth/
│   ├── admin-auth.controller.ts      Auth endpoints (/v1/admin/auth/*)
│   ├── admin-auth.service.ts         Password hashing, JWT generation, session management
│   ├── guards/
│   │   ├── admin-jwt-auth.guard.ts   Strict guard for admin JWT tokens
│   │   └── admin-roles.guard.ts      RBAC role tier guard
│   └── decorators/
│       ├── admin-roles.decorator.ts  @AdminRoles(...) decorator
│       └── current-admin.decorator.ts @CurrentAdmin() parameter decorator
├── users/                            User management controller & service
├── groups/                           Group management controller & service
├── financial/                        Financial ledger search & settlement proof controller & service
├── subscriptions/                    Subscriptions, revenue, refunds controller & service
├── support/                          Support tickets & job monitor controller & service
├── config-flags/                     Feature flags & app version controller & service
├── notifications/                    Broadcast notification composer & controller
├── analytics/                        Platform analytics controller & aggregation queries
├── audit-log/
│   ├── admin-audit-log.controller.ts Audit log search controller
│   └── interceptors/
│       └── admin-audit.interceptor.ts Interceptor auto-writing mutations to admin_audit_log
└── management/                       Admin user management controller & service
```

---

## 5. Non-Functional & Security Requirements

1. **Strict Server-Side Pagination & Filtering:** Every list endpoint accepts `page`, `limit` (max 100), `search`, `sortBy`, `sortOrder`, and resource-specific filters.
2. **Materialized / Cached Analytics Queries:** Aggregations for DAU/MAU and MRR cohorts compute server-side, utilizing materialized views or lightweight cached windows.
3. **Dedicated Admin Audit Interceptor (`AdminAuditInterceptor`):** Automatically captures `admin_id`, `action`, `target_type`, `target_id`, `before`, `after`, `ip_address`, and `user_agent` for any mutating HTTP request (`POST`, `PATCH`, `DELETE`).
4. **Token Audience Isolation:** Admin JWT access tokens have `aud: 'splitsaathi-superadmin'` and rely on secret `JWT_ADMIN_ACCESS_SECRET`. Regular user tokens targeting `/v1/admin/*` will be immediately rejected with 401 Unauthorized.
5. **OpenAPI Integration:** All admin endpoints annotated with `@ApiTags('admin-*')` and `@ApiBearerAuth('admin-auth')`.
6. **Automated Unit & E2E Tests:** Unit tests for services and E2E guarded route tests ensuring non-admin tokens receive 403 Forbidden.

---

## 6. Checkpoint & Verification Plan

1. Review `SUPERADMIN_BACKEND_PLAN.md`.
2. Upon approval, execute backend implementation in structured order:
   - Migration `1783641600011-SuperAdminModule.ts` & entity definitions.
   - Admin Auth & Guards (`AdminJwtAuthGuard`, `AdminRolesGuard`).
   - Module implementation in resource groups (Users → Groups → Financial → Subscriptions → Support/Config/Analytics/Audit).
   - E2E auth security test suite.
