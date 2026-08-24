# SplitSaathi — Test Case Suite Summary

Companion document to `docs/TEST_CASES.csv`. Generated entirely from
`CODEBASE_ANALYSIS.md` (no code inspection performed). **Total test cases: 506.**

---

## 1. Coverage Summary Table (by module)

| Module (ID prefix) | # of Cases | % of Total |
|---|---:|---:|
| API (systematic endpoint status-code coverage) | 75 | 14.8% |
| SPLIT-* (Equal / Exact / Percentage / Weighted / Itemized) | 64 | 12.6% |
| VALID (DTO validation, injection, encoding hardening) | 60 | 11.9% |
| AUTH (OTP, Google OAuth, tokens, admin JWT) | 37 | 7.3% |
| PERM (role × permission matrix + cross-cutting) | 44 | 8.7% |
| EXP (expense CRUD, comments) | 34 | 6.7% |
| GROUP (lifecycle, roles, invites, members) | 28 | 5.5% |
| SETTLE-* (debt simplification + settlement state machine) | 26 | 5.1% |
| NOTIF (push/email notifications) | 25 | 4.9% |
| CONC (concurrency / race conditions) | 11 | 2.2% |
| FRIEND (1-on-1 ledgers) | 12 | 2.4% |
| IMPEXP (import/export) | 10 | 2.0% |
| ATTACH (attachments/receipts/OCR/storage) | 9 | 1.8% |
| GAP (deep-dive on source doc's known gaps/questions) | 8 | 1.6% |
| ADMIN (admin control plane) | 8 | 1.6% |
| RECUR (recurring expenses) | 8 | 1.6% |
| CROSS (explicit multi-feature interaction) | 7 | 1.4% |
| UPI (UPI deep link generation) | 7 | 1.4% |
| SYNC (offline command queue & delta sync) | 7 | 1.4% |
| FX (multi-currency / FX rate) | 7 | 1.4% |
| FAIL (data integrity after failure) | 7 | 1.4% |
| LEDGER (double-entry balanced-ledger invariant) | 6 | 1.2% |
| PAYGW (payment gateway webhooks) | 6 | 1.2% |
| **Total** | **506** | **100%** |

*(The CSV's `Category` column is far more granular — 192 distinct values —
for filtering in a test tracker; the table above rolls those up to the
module level requested for this summary.)*

### By Test Type
Negative: 188 · Permission: 73 · Boundary: 81 · Happy Path: 76 · State-Sequence: 25 ·
Rounding: 19 · Concurrency: 15 · Notification: 15 · Integration: 12 · Cross-Feature: 2

### By Priority
Critical: 180 · High: 132 · Medium: 165 · Low: 29

### Weighting check against the brief
Section 3 (calculation logic: SPLIT-* + LEDGER) = 70 cases (13.8%) and
Section 8 (validation/error handling: VALID + relevant Negative-type cases
embedded throughout AUTH/EXP/GROUP) = 60 dedicated cases plus ~120 more
Negative-type cases distributed across every feature module — together the
two highest-risk areas identified in the source document account for a
disproportionate share of total cases, as instructed.

---

## 2. Assumptions & Gaps Log

**112 of 506 cases (22%) carry an `UNVERIFIED` expected result** because the
source document was silent, ambiguous, or explicitly flagged the area as
open. Every one of these is a real, runnable test case (preconditions/steps/
input are concrete) — only the *expected result* needs a developer to confirm
before the case can be marked pass/fail. They are grouped below by theme so
they can be triaged efficiently; each theme lists the case-count and a few
representative IDs (full list is filterable in the CSV via
`Expected Result` containing "UNVERIFIED").

| Theme | Count | Representative IDs | What needs confirming |
|---|---:|---|---|
| Source doc's own flagged gaps (Section 10 Gaps #1–#3, Question Log Q1–Q3) | 7 | TC-GAP-001–007, TC-FX-002/003, TC-SETTLE-SM-008, TC-SPLIT-ITM-006 | Exact behavior for MAX_SAFE_INTEGER boundary, FX-reversal historical-rate lookup, ghost-claim balance reconciliation, dispute-after-confirm policy, FX-provider-outage fallback, OCR line-item cap |
| DTO field-length / encoding limits (no documented max lengths) | 19 | TC-VALID-004,006,010,012,016,018... | Max lengths for name/description/comment/note fields; null-byte and duplicate-array handling |
| Optimistic locking / concurrency control (undocumented) | 5 | TC-CONC-002,006,008,010,011 | Whether ExpenseProjectionEntity.version and SettlementIntentEntity.state changes are protected by row-locking, and exact conflict responses |
| Authorization edge cases not in the documented matrix | 12 | TC-GROUP-007,013,014; TC-PERM-041; TC-ADMIN-002,004,007,008 | Last-owner removal, member removal with non-zero balance, admin-token scope, admin deactivation enforcement, dispute-action authorization |
| Settlement state machine — full 16-state transition table not provided | 6 | TC-SETTLE-SM-004,005,010,015 | Doc names only 2 of the claimed 16 states; full transition table needed |
| Offline sync conflict resolution | 3 | TC-SYNC-002,005,007 | Last-write-wins vs. version rejection for offline/online race; out-of-range sinceVersion handling |
| Recurring-expense edge cases | 3 | TC-RECUR-004,005,006 | Leap-day handling, permission requirement, job idempotency |
| Import/export semantics | 3 | TC-IMPEXP-003,009,010 | Partial-import rollback, large-export streaming, duplicate-import detection |
| Notification granularity / delivery guarantees | 6 | TC-NOTIF-007,021–025 | Per-event preference system, web-push mechanism, payload truncation |
| Attachment/storage edge cases | 5 | TC-ATTACH-003,004,006,008,009 | Max file size, MIME validation, orphaned-object cleanup |
| Cross-feature interaction gaps | 3 | TC-CROSS-003,004,007 | Import/recurring dedup, offline-sync vs. membership changes, itemized-export scope |
| Environment / driver misconfiguration | 3 | TC-AUTH-032 (Twilio), TC-EXP related | Cross-field env validation (driver selected without its required credentials) |
| Misc (friend consolidated balance, payment-gateway idempotency, UPI callback, expense date bounds, etc.) | 24 | TC-FRIEND-010,012; TC-PAYGW-004; TC-UPI-003; TC-EXP-016,017 | Various — see CSV `Notes/Risk Flag` column per row |

**Recommended next step:** walk this table with the dev/product owner in
roughly the order listed (source-doc-flagged gaps first, since those are
already known risk areas per the document itself), then regenerate/update
just the affected `Expected Result` cells in the CSV — no need to re-run
the whole suite-generation process.

---

## 3. Suggested Execution Order

1. **Environment & Auth foundation** (`TC-VALID-046…048` env validation,
   all `TC-AUTH-*`) — nothing else can be tested without working auth, and
   auth bugs (token forgery, admin-secret defaults) are the highest-blast-
   radius category.
2. **Money-calculation core** (`TC-SPLIT-*`, `TC-LEDGER-*`) — these have
   concrete computed expected values and are the financial heart of the
   product; run before anything that depends on correct splits (settlements,
   debt simplification, exports).
3. **Permissions matrix** (`TC-PERM-*`, permission-type cases embedded in
   `TC-GROUP-*` / `TC-EXP-*` / `TC-SETTLE-SM-*`) — authorization bugs are
   Critical-severity and independent of most other features; catch them
   early before layering more scenarios on top.
4. **Core CRUD flows** (`TC-GROUP-*`, `TC-FRIEND-*`, `TC-EXP-*`,
   `TC-ATTACH-*`) — the primary user journeys.
5. **Settlement lifecycle** (`TC-SETTLE-OPT-*`, `TC-UPI-*`, `TC-SETTLE-SM-*`,
   `TC-PAYGW-*`) — depends on correct splits (step 2) and permissions
   (step 3) being already validated.
6. **Systematic API status-code sweep** (`TC-API-*`) — best run as an
   automated regression pass once the happy paths above are confirmed
   working, to catch any endpoint whose error handling was missed.
7. **Secondary features** (`TC-RECUR-*`, `TC-IMPEXP-*`, `TC-NOTIF-*`,
   `TC-SYNC-*`, `TC-ADMIN-*`, `TC-FX-*`).
8. **Concurrency, failure-injection, and cross-feature cases**
   (`TC-CONC-*`, `TC-FAIL-*`, `TC-CROSS-*`, `TC-GAP-*`) — run **last**,
   after individual features are confirmed correct in isolation, since
   these tests specifically probe interactions and race conditions that
   only make sense once the underlying single-feature behavior is a known
   baseline. `TC-CROSS-001` (the fully-combined recurring+FX+settlement+
   simplify-debts scenario) and `TC-GAP-007` (all three known gaps
   combined) should be the very last two cases run in the whole suite.

Within every step above, prioritize **Critical** → **High** → **Medium** →
**Low**, and treat any case whose `Expected Result` still reads
`UNVERIFIED` as blocked until the corresponding row in the Gaps Log (§2)
is resolved with the dev team — do not guess a pass/fail on those in the
interim.