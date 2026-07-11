# Splitwise and Expense-Splitting App Landscape: India-First Competitive Research Dossier

Research date: 2026-07-10

Context: This dossier is written for a new India-first expense-splitting app with React Native/Expo frontend, NestJS/PostgreSQL backend, event-sourced ledger, and UPI-first settlement flows.

Evidence tags:
- High: repeated across at least three source types or large/recent review samples.
- Medium: repeated in two source types or strongly present in a high-intent source.
- Low: isolated but plausible, useful for product discovery but not yet validated.

Important research limitation:
- Reddit's public JSON endpoint returned HTTP 403 from this environment. I used search-indexed Reddit material where available and PullPush archive results for thread metadata/selftext. PullPush surfaced one highly relevant India/shared-flat thread and several promotional/alternative threads, but often had weak upvote/comment signal and incomplete comment bodies. Treat Reddit evidence here as directional unless explicitly marked as direct selftext evidence.

## 1. Executive Summary: Top 10 Opportunities

1. Native UPI settlement with verifiable payment state
   - Why: Splitwise and most global apps are ledgers first and payment confirmation second. In India, users pay via UPI, but Splitwise still largely requires manual marking or limited Paytm/Venmo/PayPal-style handoff. Google Pay, PhonePe, and Paytm split bills, but they are payment apps, not durable multi-event ledgers.
   - Product move: UPI deep links/intent, PSP callback/reconciliation where allowed, payment proof attachment, receiver confirmation, and immutable settlement events.
   - Impact: Very high. Complexity: High. Differentiator: Yes.

2. No crippling free-tier entry cap for high-frequency Indian use cases
   - Why: Recent iOS/Google Play reviews repeatedly complain about Splitwise limiting free users to roughly a few expense entries per day. A Bangalore flatmate post described 20-30 weekly Swiggy, Blinkit, Uber, Amazon, card and UPI transactions and called the 3/day limit practically unusable.
   - Product move: Keep core expense entry, groups, settlement, search, export, and UPI handoff usable without daily caps. Monetize automation, reconciliation, premium OCR, analytics, and teams.
   - Impact: Very high. Complexity: Low. Differentiator: Short-term yes, long-term table stakes.

3. Ledger trust: immutable audit log plus correction workflow
   - Why: Splitwise explicitly allows any involved/group member to edit or delete expenses, and does not support group admins or granular permissions. Users like collaborative correction, but this creates trust anxiety when money relationships are fragile.
   - Product move: Event-sourced expense lifecycle, visible version history, undo, dispute status, approval thresholds for old/large edits, and per-group permission modes.
   - Impact: High. Complexity: Medium-high. Differentiator: Yes.

4. India-first receipt and commerce import
   - Why: Indian shared living produces many small UPI/card-commerce transactions from Swiggy, Blinkit, Zepto, BigBasket, Amazon, Uber, Ola, Rapido, etc. Receipt OCR alone is not enough.
   - Product move: WhatsApp/share-sheet ingest, email/SMS/UPI notification parsing where consented, manual paste parsing, screenshot OCR, and merchant templates for common Indian apps.
   - Impact: High. Complexity: High. Differentiator: Yes.

5. Flexible group structure: households, couples inside groups, subgroups, and recurring bills
   - Why: A recent Google Play Splitwise review specifically asked for subgroups like a couple/family inside a group. Splitwise help also requires zero balances before member removal, and has no admins.
   - Product move: Group roles, households, nested participants, guest/non-user participants, archived trips, recurring rent/utilities, deposits, and move-out flows.
   - Impact: High. Complexity: Medium. Differentiator: Yes for India-first households.

6. Itemized bill splitting that handles tax/service charge, shared items, discounts, and photos from gallery
   - Why: Receipt scanning is a paywalled Splitwise Pro feature; Tab and SplitMyExpenses focus on itemization; users ask for gallery/digital receipt imports and fair proportional allocation.
   - Product move: AI itemization with "assign item to people" UX, proportional tax/tip/service charge, discount allocation, Indian GST/service-charge labels, and editable confidence review.
   - Impact: High. Complexity: High. Differentiator: Medium-high.

7. Multi-currency and rounding correctness without Pro-style lock-in
   - Why: Splitwise supports 100+ currencies but automatic conversion is Pro. Competitors like Settle Up, Tricount, Splid, and Splittr market multi-currency as a travel strength. Reviews still surface default-currency bugs and calculation distrust.
   - Product move: Per-currency ledgers, explicit FX-rate snapshot, user-chosen settlement currency, deterministic minor-unit rounding, and visible residual allocation.
   - Impact: Medium-high. Complexity: Medium. Differentiator: Medium.

8. Privacy-preserving onboarding
   - Why: India-first apps get complaints when they require both phone and Google sign-in or full contact upload. No-account apps reduce friction but can weaken recovery and accountability.
   - Product move: Phone OTP as default, optional contact discovery, invite links/QR, guest participants, privacy explainer, and no forced full-contact upload.
   - Impact: High. Complexity: Medium. Differentiator: Yes if executed cleanly.

9. Socially tactful reminders and settlement nudges
   - Why: Users want reminders but also want to avoid awkward or passive-aggressive chasing. Splitwise has feature requests for anonymous/general reminders.
   - Product move: Neutral group reminders, scheduled rent reminders, "settlement day" flows, private nudge language, and group-wide "pending balances" prompts rather than person-blaming notifications.
   - Impact: Medium-high. Complexity: Low-medium. Differentiator: Medium.

10. Migration and exports as acquisition wedge
   - Why: Competitors explicitly market Splitwise imports. Users mention export gaps and data loss concerns. Splid has a recent Google Play review complaining about export absence.
   - Product move: Import Splitwise CSV/JSON, export CSV/PDF/Tally-style summaries, settlement certificates, and full data portability.
   - Impact: Medium-high. Complexity: Medium. Differentiator: Medium.

## 2. Competitive Landscape Map

### Core Expense-Splitting Apps

| Capability | Splitwise | Settle Up | Tricount | Splid | Splittr | Spliit | SplitMyExpenses | Tab |
|---|---|---|---|---|---|---|---|---|
| Core group ledger | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Restaurant-focused |
| Mobile apps | iOS, Android | iOS, Android | iOS, Android | iOS, Android | iOS, Android | PWA/web | iOS, Android, web | iOS |
| Web app | Yes | Limited/varies | Review complaints say no web app | No/limited | Limited/varies | Yes | Yes | Limited |
| No-account mode | No, account/friends model | Often link/viewer friendly | Some invite flow | Strong no-signup/offline story | Official says no sign-up/offline | Strong no-login/no-account story | Account/web app | App use for item claiming |
| Offline mode | Limited | Markets offline/sync | App reviews mention offline | Strong offline plus optional sync | Markets offline | Web/PWA, self-host possible | Not primary | Not primary |
| Unequal splits | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Item-level |
| Shares/weights | Yes, but rounding complaints exist | Yes | Yes, recent iOS request for fractional shares | Yes | Yes | Yes | Yes | Item assignment |
| Multiple payers on one expense | Supported in Splitwise? Users still ask category-wide | Varies | Recent Play review says missing | Partial/complex entries | Varies | Varies | Strong automation focus | No, restaurant receipt focus |
| Debt simplification | Yes | Yes | Yes | Yes | Yes | Yes | Yes | No/limited |
| Direct payments | Venmo/PayPal US, Paytm India listed in store copy; Splitwise Pay/Plaid in some markets | Payment handoffs | Newer store copy mentions payment requests/card by bunq in some markets | Manual/external | Manual/external | Manual/external | Payment app handoffs/financial links | Manual/share |
| UPI-native | No strong native UPI ledger reconciliation | No | No, India blog positions alternatives but not UPI-native | No | No | No | No India-first UPI focus | No |
| Receipt scanning/OCR | Pro | Not primary | Receipt/photo features now promoted | Not core | Requested by users | Basic/open-source extensions possible | Yes, AI/itemization | Yes, core feature |
| Multi-currency | Supported; automatic conversion Pro | Strong/free in reviews | Strong | Strong | All currencies | Supported/basic | 100+ currencies in store copy | Not core |
| Recurring expenses | Yes | Varies | Varies | Varies | Varies | Varies | Yes | No |
| Export | CSV for groups/friends; JSON backup Pro | Export marketed | Excel/PDF in listicles/app copy | Recent Play review says no export in Android v1.5.1 | Varies | Self-host/data access | Yes | No |
| Permissions/admin | No admins/granular permissions | Varies | Varies | Simple groups | Varies | Link-based simplicity | Varies | No |
| Monetization | Subscription Pro, ads/limits for free | Freemium | Bunq-backed/free-unlimited positioning | One-time unlock praised | Paid/freemium | Open source/free | Freemium | Free/ads unclear |

### India and Payment-Adjacent Apps/Workarounds

| Product/workaround | Strength | Gap vs India-first ledger app |
|---|---|---|
| Google Pay India split bills | Native UPI user base, can create a bill and request money from a group | Payment request flow is not a full event-sourced shared ledger with edits, audits, recurring bills, exports, complex receipts, and multi-month household state |
| PhonePe Split Expenses | UPI-native payment UX, strong Indian reach, official design blog discusses user testing | Payment-first, not a full shared expense operating system |
| Paytm Split Bill | UPI app with bill split, notifications, and group spend content | Payment-first; Splitwise Paytm integration is old/limited relative to UPI ecosystem |
| Venmo Groups | Strong US payment plus group expense tracking | Not India-relevant; shows payment-app threat pattern |
| PayPal split bills | Strong payment network in supported markets | Not India UPI-native and not optimized for Indian households |
| Hisaab | India/beyond positioning, simple ad-free Splitwise alternative | Recent Play complaints: no Splitwise import, mandatory Google+phone, contact access issues |
| Niptao | India UPI-settlement positioning | App metadata could not be reliably scraped in this run; needs live install test |
| Splitkaro | India/US positioning, Splitwise import, personal+group expenses | Recent Play complaints: app responsiveness, foreign-currency change issue; users request UPI auto-add |
| FairShare | AI bill splitter, no ads/free positioning | Early scale, few reviews, maturity unknown |
| Cleave/ruphiy/Walnut-style trackers | SMS/UPI transaction parsing, private/on-device positioning | More expense tracker than group settlement ledger; group logic and dispute handling may be thin |
| Google Sheets/Excel | Custom, transparent, no app lock-in | Manual errors, no payment confirmation, no reminders, no mobile-first UX, no dispute-safe audit trail |
| WhatsApp manual tracking | Everyone already uses it, culturally natural in India | No canonical balance, no settlement graph, hard to audit, easy to forget |

## 3. Pain Point Catalog

### 3.1 Debt Settlement and Ledger Correctness

1. Manual "paid" state is not proof of payment
   - Complaint/need: Users can record a payment even if the other person did not receive money; settlement state needs evidence, reconciliation, or receiver confirmation.
   - Sources: Splitwise help states that if someone records a payment, the recipient must make sure money was actually received; App Store reviews complain about funds/bank transfer issues; BBB/Trustpilot complaints mention payment/transfer trust.
   - Frequency: High.
   - Applies to: Splitwise and category-wide manual-ledger apps.
   - Solved elsewhere: Payment apps solve actual transfer but lack durable shared ledger. Venmo Groups is a US example of closer payment-ledger integration.

2. Debt simplification can be mathematically correct but socially distrusted
   - Complaint/need: Simplification routes money through fewer people, but some groups do not trust all members equally. HN comments from Splitwise's Jon noted simplification is not default because people have different trust levels with friends.
   - Sources: Splitwise help, HN founder comment, technical literature.
   - Frequency: Medium.
   - Applies to: Splitwise, Tricount, Settle Up, Spliit, any graph simplification app.
   - Solved elsewhere: No full solution. Best practice is per-group/per-relationship simplification boundaries and explanation UI.

3. Settle-up recommendations can feel wrong even when balances are right
   - Complaint/need: A July 2026 Google Play Splitwise review says individual balances were correct but "Settle up" did not make sense to minimize payments.
   - Sources: Google Play newest review sample, Splitwise balance-help docs, general algorithm discussions.
   - Frequency: Medium.
   - Applies to: Splitwise and any simplification UI.
   - Solved elsewhere: Some apps show explicit "why this payment" explanations; still uncommon.

4. Calculation correctness is a purchase blocker
   - Complaint/need: Recent iOS Tricount 1-star/3-star reviews say calculations looked wrong after sanity checks. Even if user error, visible arithmetic confidence matters.
   - Sources: App Store Tricount review sample, algorithm sources.
   - Frequency: Medium.
   - Applies to: Tricount, category-wide.
   - Solved elsewhere: Spreadsheets are trusted because formulas can be inspected; apps need auditability.

5. Edits/deletes by any group member create trust and accountability concerns
   - Complaint/need: Users want owner/admin control, edit approvals, or at least tamper-evident history. Splitwise's wiki-like model is convenient but can be alarming.
   - Sources: Splitwise permissions docs, feature request for edit/delete permissions, App Store/Play trust complaints.
   - Frequency: High.
   - Applies to: Splitwise mostly, but collaborative apps generally.
   - Solved elsewhere: Enterprise tools use roles/approval/audit logs; consumer splitting apps rarely do this well.

6. Deleted groups/bills and old history need recoverability
   - Complaint/need: Users want restore, full history, and export before account deletion. Splitwise advertises restore/delete history; users still worry about data loss.
   - Sources: Splitwise store copy, help docs, Settle Up review reporting lost groups, export requests.
   - Frequency: Medium.
   - Applies to: Category-wide.
   - Solved elsewhere: Event-sourced ledger can solve if exposed cleanly.

### 3.2 Currency and Regional Issues

1. Currency conversion is treated as premium by Splitwise
   - Complaint/need: Travelers/NRIs need automatic conversion; users resent basic trip functionality being paywalled.
   - Sources: Splitwise currency help and Pro docs; app store reviews praising/criticizing currency conversion; competitor reviews praising free currency conversion in Settle Up and Splid.
   - Frequency: High for travel use cases.
   - Applies to: Splitwise primarily.
   - Solved elsewhere: Settle Up, Tricount, Splid, Splittr market multi-currency more generously.

2. Apps need explicit INR handling, Indian minor units, and regional formatting
   - Complaint/need: India users expect INR defaults, UPI amount exactness, and no "USD default" bugs.
   - Sources: SplitMyExpenses Play review notes default currency falling back to USD; Splitkaro review says currency could not be changed abroad; India-specific app positioning.
   - Frequency: Medium.
   - Applies to: Category-wide.
   - Solved elsewhere: India-first apps partially, but maturity varies.

3. Rounding in shares/weights can produce visible unfairness
   - Complaint/need: Users report shares-based calculation rounded too much for itemized tax/tip scenarios.
   - Sources: Splitwise feedback request on shares rounding, app reviews asking for fractional shares.
   - Frequency: Medium.
   - Applies to: Splitwise, Tricount, any fractional split app.
   - Solved elsewhere: Deterministic minor-unit residual allocation with explainable rounding.

### 3.3 Payments Integration

1. Splitwise is not UPI-native
   - Complaint/need: Indian users pay by UPI, but Splitwise does not deeply reconcile UPI payments. Store copy still lists Paytm India only, not true UPI-native settlement across GPay/PhonePe/Paytm/BHIM.
   - Sources: Splitwise app store/Play descriptions, Splitwise Paytm blog, Splitwise UPI feature request, India-specific competitor pages, Google Pay/PhonePe/Paytm split docs.
   - Frequency: High for India.
   - Applies to: Splitwise and global competitors.
   - Solved elsewhere: Payment apps split bills, but ledger depth is limited.

2. P2P UPI collect-request changes reduce "request money" design options
   - Complaint/need: If P2P collect requests are disabled from 2025-10-01 as reported, third-party apps should not build around payer-pull collect for friends.
   - Sources: NPCI circular index, Economic Times/Business Today/CNBC coverage, UPI AutoPay/NPCI docs.
   - Frequency: Regulatory constraint, not user complaint.
   - Applies to: India-first payment flows.
   - Solved elsewhere: Use payer-initiated UPI intent/deep link/QR, merchant collect only if operating as/through authorized payment entity.

3. Bank-linking automates settlement but creates privacy fear
   - Complaint/need: Users dislike giving broad bank data to apps/Plaid-like providers. A Splitwise iOS review complained a money-out flow wanted extensive bank-account information.
   - Sources: Splitwise privacy policy mentions Plaid for linked bank data; iOS review sample; general Plaid privacy concerns.
   - Frequency: Medium-high.
   - Applies to: Splitwise Pay, Chipp/SplitMyExpenses-style financial connections, any bank import.
   - Solved elsewhere: On-device SMS/notification parsing and optional proof upload reduce but do not eliminate trust issues.

### 3.4 Recurring and Complex Expenses

1. Recurring rent/utilities are table stakes but not enough
   - Complaint/need: Shared homes need recurring bills, reminders, fixed shares, deposits, electricity/water variability, and move-out finalization.
   - Sources: Splitwise recurring bill help, roommate/flatmate Reddit selftext, app reviews.
   - Frequency: High.
   - Applies to: Splitwise and all household competitors.
   - Solved elsewhere: Splitwise supports recurrence, but India-specific automation and UPI confirmation remain gaps.

2. Multiple payers and mixed-beneficiary expenses remain friction
   - Complaint/need: Users need one transaction paid by multiple people, partially shared with subgroups, or split across couples/families.
   - Sources: Tricount Play review asking for multiple payers, Splitwise Play review asking for subgroups, app store reviews asking for share modes.
   - Frequency: Medium-high.
   - Applies to: Tricount, Splitwise, category-wide.
   - Solved elsewhere: Some apps support advanced splits, but UX remains hard.

3. Itemized receipts require tax/service charge/discount logic
   - Complaint/need: Restaurant bills and grocery carts need item assignment, shared items, proportional taxes, service charges, tips, and discounts.
   - Sources: Tab official copy, Splitwise OCR feature requests, ItemSplit/GroupSplit positioning, Splitwise shares rounding complaint.
   - Frequency: High for dining/travel.
   - Applies to: Splitwise and most ledger-first apps.
   - Solved elsewhere: Tab and newer receipt-first apps solve parts of it, but not long-lived group ledger plus UPI settlement.

### 3.5 Group Management

1. No admins or permissions in Splitwise
   - Complaint/need: Users want creator/admin controls, edit/delete permissions, and dispute moderation.
   - Sources: Splitwise official docs say no admins/special permissions; feedback request asks for edit/delete permissions.
   - Frequency: High among trust-sensitive groups.
   - Applies to: Splitwise primarily.
   - Solved elsewhere: Some apps use simpler single-owner/no-account models; few combine collaboration and permissions.

2. Removing members requires zero balance
   - Complaint/need: Move-outs, ex-roommates, and trip dropouts need clean exit flows. Splitwise requires settlement before removal.
   - Sources: Splitwise remove-member help docs.
   - Frequency: Medium.
   - Applies to: Splitwise, likely category-wide.
   - Solved elsewhere: A product can support "inactive member with locked balance", "transfer obligation", or "exit settlement workflow".

3. Archived groups and trip clutter
   - Complaint/need: Users create many trip/household groups and want archive, not delete.
   - Sources: Splitwise feedback "Allow archiving of groups"; competitor blogs.
   - Frequency: Medium.
   - Applies to: Splitwise and trip apps.
   - Solved elsewhere: Some apps have archive; still table stakes.

### 3.6 Notifications and Reminders

1. Reminder tone matters
   - Complaint/need: Users want automated nudges that do not expose who is nagging whom.
   - Sources: Splitwise feature request for generalized/anonymous reminders, social friction articles, app reviews around notifications.
   - Frequency: Medium.
   - Applies to: Category-wide.
   - Solved elsewhere: Not deeply solved.

2. Reminder reliability is part of ledger trust
   - Complaint/need: Missed email notifications or unsubscribed users can break settlement expectations.
   - Sources: Splitwise notification help docs.
   - Frequency: Low-medium.
   - Applies to: Splitwise and any app.
   - Solved elsewhere: In-app notification center plus WhatsApp/share reminders for India can help.

### 3.7 Receipts and OCR

1. Receipt scanning is paywalled in Splitwise Pro
   - Complaint/need: Users resent paying monthly for receipt OCR/itemization.
   - Sources: Splitwise Pro docs, Splitwise App Store/Play descriptions, third-party reviews, app store complaints.
   - Frequency: High.
   - Applies to: Splitwise.
   - Solved elsewhere: SplitMyExpenses, Tab, FairShare, receipt-first apps offer free/cheaper OCR claims.

2. Digital receipt/gallery import is a clear unmet need
   - Complaint/need: Users want to scan screenshots or stored receipt images, not only live camera photos.
   - Sources: Splitwise feedback "scan receipts from gallery/image file"; Tab iOS review says file receipt/screenshot upload did not work.
   - Frequency: Medium.
   - Applies to: Splitwise, Tab, receipt apps.
   - Solved elsewhere: Some receipt tools allow file upload, but not always linked to group ledger.

3. OCR confidence and correction UI matter more than raw automation
   - Complaint/need: OCR will fail on crumpled receipts, screenshots, mixed languages, GST, and item abbreviations.
   - Sources: General OCR literature/listicles, Tab complaints, app review feature requests.
   - Frequency: Medium-high.
   - Applies to: All receipt apps.
   - Solved elsewhere: Best workflow is human-in-the-loop item review with confidence flags.

### 3.8 Pricing and Monetization Frustration

1. Daily entry caps are the loudest monetization complaint
   - Complaint/need: Users call Splitwise's free tier unusable for trips and active households.
   - Sources: July 2026 iOS reviews, July 2026 Google Play reviews, News18 coverage, competitor comparisons, Reddit/PullPush India selftext.
   - Frequency: Very high.
   - Applies to: Splitwise.
   - Solved elsewhere: Tricount, Splid, Spliit, Settle Up, and newer entrants market no caps.

2. Users resent subscriptions for simple ledgers
   - Complaint/need: "Pay as you use", one-time purchase, or low annual India pricing is preferred over monthly subscription for basic splitting.
   - Sources: Google Play Splitwise review asking for pay-as-you-use; Splid reviews praising one-time low fee; Trustpilot/listicle complaints.
   - Frequency: High.
   - Applies to: Splitwise and any subscription-first competitor.
   - Solved elsewhere: Splid one-time unlock is praised; open-source/free apps compete on this.

3. Users may pay for automation, not for artificial scarcity
   - Complaint/need: Willingness to pay appears higher for OCR, bank/card imports, high-trust reconciliation, analytics, and cloud backup than for basic entry/search.
   - Sources: Splitwise Pro feature list, app reviews, SplitMyExpenses/Chipp positioning.
   - Frequency: Medium-high.
   - Applies to: Category-wide.
   - Solved elsewhere: Mixed.

### 3.9 Privacy and Trust

1. Contact upload is an onboarding anti-pattern if mandatory
   - Complaint/need: Users want invite links instead of full contact upload.
   - Sources: Hisaab Play reviews complaining about contact upload and Google+phone requirements.
   - Frequency: Medium.
   - Applies to: India-first entrants.
   - Solved elsewhere: Spliit/Splid/no-account/link-based flows reduce friction.

2. Bank/account access requires explicit, optional consent
   - Complaint/need: Users distrust bank-linking for a bill-splitting app.
   - Sources: Splitwise privacy policy, iOS review sample, general privacy concern sources.
   - Frequency: Medium-high.
   - Applies to: Apps with Plaid/AA/bank import.
   - Solved elsewhere: On-device parsing and UPI proof upload are lower-risk alternatives.

3. Shared financial data can damage relationships if opaque
   - Complaint/need: Users need transparent history, comments, and dispute state to avoid "you changed it" fights.
   - Sources: Reddit roommate stories, Splitwise edit/delete docs, reviews.
   - Frequency: High but qualitative.
   - Applies to: Category-wide.
   - Solved elsewhere: Audit log and approvals.

### 3.10 Offline and Reliability

1. Offline mode is a travel differentiator
   - Complaint/need: International travel and weak network environments require offline expense entry.
   - Sources: Splid official/Play reviews, Splittr official, Hisaab reviews praising offline.
   - Frequency: Medium-high.
   - Applies to: Travel-focused competitors.
   - Solved elsewhere: Splid and Splittr market this strongly.

2. Sync/data loss is catastrophic
   - Complaint/need: A Settle Up review says groups and transaction details disappeared; app crash/responsiveness complaints appear in India-first reviews.
   - Sources: Google Play review samples.
   - Frequency: Medium.
   - Applies to: Category-wide.
   - Solved elsewhere: Event log plus local-first sync can reduce risk.

3. App maturity matters for India-first entrants
   - Complaint/need: Reviews cite app not responding, contact add failures, currency change issues, missing import.
   - Sources: Hisaab/Splitkaro Play reviews.
   - Frequency: Medium.
   - Applies to: New India competitors.
   - Solved elsewhere: Product quality, test coverage, error reporting.

### 3.11 Social and UX Friction

1. The core job is reducing awkwardness, not just doing math
   - Complaint/need: Users hate chasing friends. Reminders, tone, and payment confirmation should reduce social burden.
   - Sources: Splitwise positioning, Paytm/PhonePe split content, reviews.
   - Frequency: High.
   - Applies to: Category-wide.
   - Solved elsewhere: Payment apps partially; ledger apps partially.

2. "Everyone install this app" is adoption friction
   - Complaint/need: Users praise Splid/Settle Up/Spliit-like flows where one person can manage or invite by link without everyone signing up.
   - Sources: Splid and Settle Up Play reviews, Spliit official copy, Splitwise docs explaining friends/account model.
   - Frequency: High.
   - Applies to: Splitwise, Tricount, account-first apps.
   - Solved elsewhere: No-account/link-based apps.

3. Minimal UX is loved until complex real life appears
   - Contradiction: Tricount/Splid users praise no ads/no clutter, but also request multiple payers, shares, categories, web app, exports, Apple Watch, PDF receipt upload, custom categories.
   - Sources: App Store and Google Play review samples.
   - Frequency: Medium-high.
   - Implication: Use progressive disclosure, not feature dumping.

### 3.12 Reporting and Export

1. Search and export are not luxuries for power users
   - Complaint/need: Users object to search being Pro-only and want exports for audits, taxes, roommate move-outs, and migration.
   - Sources: Splitwise Pro/search docs, TechnoFino discussion, Splid export complaint, Splitwise export docs.
   - Frequency: High.
   - Applies to: Splitwise and category-wide.
   - Solved elsewhere: CSV/PDF exports vary; Spliit/self-host improves control.

2. India may need Tally/accounting-style summaries for small groups/businesses
   - Complaint/need: Some users use these apps for small businesses or family/flat operations.
   - Sources: Hisaab/Splitkaro reviews mention business/income tracking, Indian market context.
   - Frequency: Low-medium.
   - Applies to: India-first app.
   - Solved elsewhere: Expense trackers solve personal accounting but not group settlement.

### 3.13 Onboarding Friction

1. Friend invites and contact syncing are fragile
   - Complaint/need: Users want to add people without email/phone, invite via WhatsApp, and avoid contact upload.
   - Sources: Splitwise docs on needing friends; Hisaab contact complaints; Splid/Settle Up praise for no signup/link viewing.
   - Frequency: High.
   - Applies to: Splitwise and India entrants.
   - Solved elsewhere: Spliit/Splid style no-login links, but recovery/accountability tradeoffs remain.

2. Migration from Splitwise is now a major acquisition path
   - Complaint/need: Users leaving Splitwise need import from existing groups.
   - Sources: SplitMyExpenses import guide, Splitkaro review praising import, Hisaab complaint asking for import.
   - Frequency: High among switchers.
   - Applies to: New competitors.
   - Solved elsewhere: SplitMyExpenses/Splitkaro market import.

## 4. India-Specific Gap Analysis

### UPI and Settlement

India's split-expense product should be UPI-first, not UPI-as-a-button. The market gap is not merely "open GPay with amount"; it is reconciling the ledger with the actual settlement lifecycle:

- Expense created.
- Participant acknowledges or disputes.
- Net settlement computed.
- Payer initiates UPI transfer through preferred app.
- App stores settlement intent with amount, VPA/payment app, timestamp, and idempotency key.
- Payment proof or callback is attached where available.
- Receiver confirms if automatic reconciliation is not available.
- Settlement posts as immutable ledger event.
- Reversal/dispute posts as a new compensating event, never mutation.

Design implications:
- Use payer-initiated UPI intent/deep links as the default low-regulatory-friction path.
- Do not depend on P2P collect requests if NPCI discontinuation is in force.
- If using merchant collect, escrow, or money movement, partner with a regulated PSP/PA and follow RBI PA directions.
- Keep payment data storage in India if operating as a payment system participant or processing payment-system data.
- Treat UPI transaction IDs as external references, not primary ledger truth until verified.

### Indian Social and Household Patterns

Strong product patterns for India:
- Flatmate groups with 20-30 weekly small transactions from delivery, grocery, transit, household supplies, and utilities.
- Couples within larger friend groups.
- Friends who settle through different UPI apps.
- WhatsApp as the default coordination channel.
- Sensitivity to "bro you owe me" reminders and public shame.
- Price sensitivity against monthly subscriptions for basic ledgers.
- Need for language-light UX, phone-number onboarding, and optional contact discovery.

### Regulatory/Privacy Context

Key constraints:
- RBI's 2018 storage of payment system data directive requires payment-system data to be stored only in India.
- DPDP Act 2023 applies to digital personal data and pushes consent, purpose limitation, user rights, and deletion workflows.
- RBI Payment Aggregator Directions 2025 matter if the app aggregates payments or handles merchant collections/payouts.
- UPI AutoPay can be useful for recurring rent/utilities only when the mandate structure and use case are compliant. It should not be faked as casual P2P pull.

### India-First Competitive White Space

The best wedge is not "free Splitwise clone". It is:
- UPI settlement verification.
- WhatsApp/share-sheet transaction capture.
- Splitwise import.
- No forced contacts.
- Immutable audit log.
- Household-grade recurring and move-out flows.
- India-specific receipt parsing and merchant templates.

## 5. Technical and Algorithmic Findings

### Debt Simplification

Core model:
- Represent each participant's net balance after all expenses and payments.
- Debtors have negative net balances; creditors have positive balances.
- A settlement set transfers value from debtors to creditors until all nets reach zero.

Common greedy algorithm:
- Pair largest debtor with largest creditor.
- Transfer min(abs(debtor), creditor).
- Repeat until all balances settle.
- Complexity is roughly O(n log n) with heaps after netting.
- It usually produces at most debtors + creditors - 1 transfers, but it is not guaranteed to minimize the absolute number of transfers in all cases.

Exact minimization:
- The problem of minimizing number of settlement transactions is NP-hard/NP-complete in general formulations. Literature connects it to zero-sum subset/packing style problems.
- Exact bitmask DP can work for small groups, often n <= 20, by finding maximum number of disjoint zero-sum subsets, then minimizing transfers as n minus number of components.
- For consumer apps, greedy is acceptable for most groups, but the app should not overclaim "minimum possible" unless exact mode is used.

Product implication:
- Provide "simple settle" greedy as default.
- Provide "fewest payments" exact optimization for small groups, with a time/size limit.
- Provide "respect trust boundaries" mode that avoids routing money through people who were not directly involved or are outside trusted subgroups.
- Show explanation: "A pays B because A owes the group INR X and B is owed INR Y."

### Ledger Correctness

Recommended architecture:
- Use double-entry ledger principles for monetary movements, even if product language says "expense".
- Store amounts in integer minor units per currency.
- Never mutate posted monetary events. Corrections are new events.
- Use event-sourced aggregate streams for group, expense, participant, and settlement state.
- Maintain projections for balances, activity feeds, search, and exports; projections are rebuildable.
- Require idempotency keys for expense creation, settlement attempts, UPI callbacks/proof uploads, imports, and retries.
- Every expense edit should create a new version with before/after diff.
- Payment confirmation must be distinct from "user says paid".
- Support compensating entries for refund/reversal/dispute.

Key invariants:
- Sum of group balances per currency must equal zero after each committed event.
- Each participant balance equals sum(expense shares) minus sum(payments made/received) in that currency.
- FX conversion must create explicit rate snapshot and settlement currency event.
- Rounding residual must be deterministic and visible.
- Deleted or archived entities must not erase financial history.

### UPI Reconciliation Model

Minimum viable approach:
- Generate UPI deep link with exact amount, note, and a unique ledger reference.
- Store settlement_intent_created.
- User returns and uploads screenshot or enters UTR/reference if automatic callback unavailable.
- Receiver gets confirmation prompt.
- Once confirmed, post settlement_recorded and update balances.

Higher maturity:
- PSP/payment gateway integration to generate payment links/dynamic QR and receive status callbacks.
- Webhook handler with idempotency, signature verification, retry ledger, and reconciliation dashboard.
- Exception states: expired, partial amount, wrong recipient, duplicate UTR, disputed proof, refunded.

## 6. Monetization Insight Summary

Users resent paying for:
- Basic expense entry after a few daily transactions.
- Search of their own expense history.
- Core multi-currency conversion on trips.
- Basic itemized receipt splitting when it is positioned as part of the core job.
- Ads/cooldowns that interrupt high-frequency trip entry.
- Monthly subscriptions for a simple calculator/ledger.
- Mandatory paid upgrade caused by artificial scarcity.

Users appear willing to pay for:
- Reliable OCR and itemization that saves real effort.
- UPI settlement verification/reconciliation.
- Bank/card/UPI transaction import with clear privacy controls.
- Advanced analytics and household budgets.
- Cloud backup and large receipt storage.
- Export packs for business/accounting/taxes.
- Family/couple/group plans where one payer covers the group.
- One-time unlocks or low annual pricing, especially in India.

India pricing hypothesis:
- Core group splitting should be free or very low friction.
- Monetize automation bundles: "Smart Capture", "UPI Verified Settlements", "Household Pro", "Trip Pro".
- Avoid per-user Pro when value is group-level; consider group subscription or organizer-paid model.
- Offer one-time lifetime plan early only if unit economics allow, because reviews praise one-time pricing.

## 7. Prioritized Opportunity List

| Rank | Gap | Feature | Impact | Complexity | Differentiator/Table Stakes |
|---:|---|---|---|---|---|
| 1 | Manual settlement does not prove payment | UPI verified settlement lifecycle | Very high | High | Differentiator |
| 2 | Splitwise free limits frustrate users | No daily cap for core entries | Very high | Low | Differentiator now, table stakes later |
| 3 | Trust issues around edits/deletes | Immutable audit log and approval workflow | High | Medium-high | Differentiator |
| 4 | India transaction volume is high and fragmented | Share-sheet/WhatsApp/SMS/notification capture | High | High | Differentiator |
| 5 | Moving from Splitwise is painful | Splitwise CSV/JSON import | High | Medium | Table stakes for switchers |
| 6 | Contact upload/sign-in friction | Optional contacts, invite links, guest participants | High | Medium | Differentiator |
| 7 | Receipt OCR paywall and poor digital receipt handling | AI receipt itemizer with gallery/screenshot import | High | High | Differentiator |
| 8 | Complex household participants | Subgroups, couples, family units, move-out flows | High | Medium | Differentiator |
| 9 | Recurring bills need settlement automation | Recurring rent/utilities with UPI reminders | High | Medium | Table stakes plus India twist |
| 10 | Multi-currency Pro lock-in and bugs | Free deterministic multi-currency with FX snapshots | Medium-high | Medium | Differentiator for travel |
| 11 | Settle-up algorithm opacity | Explainable settlement graph and exact optimizer for small groups | Medium-high | Medium | Differentiator |
| 12 | Reminder awkwardness | Neutral group reminders and scheduled settlement days | Medium-high | Low-medium | Differentiator |
| 13 | Export gaps | CSV/PDF/Tally-style exports | Medium-high | Medium | Table stakes |
| 14 | New entrant reliability concerns | Offline-first local queue and sync conflict UI | Medium | High | Differentiator if strong |
| 15 | Privacy concerns around bank linking | Optional on-device parsing and consent dashboard | Medium | High | Differentiator |
| 16 | Category clutter vs power features | Progressive disclosure modes: trip, flat, couple, event | Medium | Medium | Differentiator |
| 17 | Payment app split features lack ledger | Google Pay/PhonePe/Paytm handoff history | Medium | Medium | Differentiator |
| 18 | Businesses/families want summaries | Monthly statements and settlement certificates | Medium | Medium | Niche differentiator |
| 19 | Dispute resolution is ad hoc | Expense comments, dispute flags, evidence attachments | Medium | Medium | Differentiator |
| 20 | Friend who does not use app | Public read-only balance page and WhatsApp summary | Medium | Medium | Table stakes in India |

## 8. Source Appendix

### Official Splitwise Sources

- Splitwise Pro: https://www.splitwise.com/pro
- Splitwise subscriptions/Pro features: https://www.splitwise.com/subscriptions/new
- Splitwise API: https://dev.splitwise.com/
- Splitwise API docs repo: https://github.com/splitwise/api-docs
- Splitwise debt simplification help: https://feedback.splitwise.com/knowledgebase/articles/107220-what-does-the-simplify-debts-setting-do
- Splitwise debt shuffling help: https://feedback.splitwise.com/knowledgebase/articles/107218-does-splitwise-support-debt-shuffling
- Splitwise payment help: https://feedback.splitwise.com/knowledgebase/articles/475734-how-do-i-send-money-via-paypal-or-venmo
- Splitwise "recorded payment" help: https://feedback.splitwise.com/knowledgebase/articles/174432-someone-sent-me-a-payment-on-splitwise-how-do-i
- Splitwise permissions/admin help: https://feedback.splitwise.com/knowledgebase/articles/264547-can-i-set-a-group-admin-or-set-different-permis
- Splitwise edit/delete help: https://feedback.splitwise.com/knowledgebase/articles/89944-why-can-other-people-edit-or-delete-expenses-that
- Splitwise add friends help: https://feedback.splitwise.com/knowledgebase/articles/206028-why-do-i-have-to-add-friends-in-order-to-use-split
- Splitwise remove member help: https://feedback.splitwise.com/knowledgebase/articles/177468-how-do-i-remove-a-person-from-a-group
- Splitwise zero-balance member removal: https://feedback.splitwise.com/knowledgebase/articles/386282-why-can-t-i-remove-a-group-member-with-a-non-zero
- Splitwise balances help: https://feedback.splitwise.com/knowledgebase/articles/425486-help-my-balances-are-wrong
- Splitwise dashboard/group balance mismatch: https://feedback.splitwise.com/knowledgebase/articles/746853-my-dashboard-balances-are-different-than-my-group
- Splitwise currency conversion help: https://feedback.splitwise.com/knowledgebase/articles/301146-can-splitwise-do-currency-conversion-between-multi
- Splitwise default currency help: https://feedback.splitwise.com/knowledgebase/articles/122630-can-i-set-a-default-currency
- Splitwise recurring bill help: https://feedback.splitwise.com/knowledgebase/articles/238785-how-do-i-create-a-recurring-bill
- Splitwise export help: https://feedback.splitwise.com/knowledgebase/articles/88333-how-do-i-export-my-transactions-to-a-spreadsheet-o
- Splitwise privacy policy: https://www.splitwise.com/privacy
- Splitwise Android permissions help: https://feedback.splitwise.com/knowledgebase/articles/651235-why-does-the-android-app-ask-for-so-many-permissio
- Splitwise Paytm Android integration blog: https://blog.splitwise.com/category/payments/
- Splitwise UPI feature request: https://feedback.splitwise.com/forums/162446-general/suggestions/15872739-is-it-possible-to-integrate-upi-unified-payment-s

### Competitor Official Sources

- Settle Up: https://settleup.io/
- Settle Up alternate domain: https://settleup.app/
- Tricount features: https://tricount.com/en-us/expense-tracker-features
- Tricount multi-currency: https://tricount.com/en-us/expense-tracker-features/multi-currency-support
- Tricount India alternatives blog: https://www.tricount.com/en-in/blog/top-splitwise-alternatives-in-india-2025-which-app-should-you-switch-to
- Spliit app: https://spliit.app/
- Spliit GitHub: https://github.com/spliit-app/spliit
- Splid: https://splid.app/english/
- Splittr: https://splittr.io/
- SplitMyExpenses: https://www.splitmyexpenses.com/
- SplitMyExpenses import guide: https://www.splitmyexpenses.com/articles/how-to-import-from-splitwise
- Tab: https://www.tabapp.co/
- Even: https://www.evenapp.io/
- Venmo Groups help: https://help.venmo.com/cs/articles/settling-up-group-expenses-vhel192
- Venmo Groups management: https://help.venmo.com/cs/articles/managing-expenses-for-venmo-groups-vhel173
- Venmo Groups announcement: https://newsroom.paypal-corp.com/2023-11-14-Introducing-Venmo-Groups
- PayPal split bill help: https://www.paypal.com/us/cshelp/article/how-do-i-split-a-bill-using-paypal-help279

### India Payment and Regulatory Sources

- Google Pay India split bills: https://support.google.com/pay/india/answer/11420982?hl=en-IN
- PhonePe Split Expenses design blog: https://www.phonepe.com/blog/design/phonepes-split-expenses-streamlining-group-transactions-with-ease/
- Paytm split bills blog: https://paytm.com/blog/payments/upi/split-bills-with-anyone-sending-your-share-to-any-upi-id-via-paytm/
- Paytm first-time split guide: https://paytm.com/blog/payments/your-first-time-splitting-a-bill-on-paytm-a-step-by-step-guide/
- Paytm split notifications: https://paytm.com/blog/payments/why-paytms-split-bill-notifications-keep-your-friendships-happy-and-finances-clear/
- NPCI UPI product page: https://www.npci.org.in/product/upi
- NPCI UPI product statistics: https://www.npci.org.in/product/upi/product-statistics
- NPCI UPI circulars: https://www.npci.org.in/circulars/upi
- NPCI UPI AutoPay/BHIM: https://www.bhimupi.org.in/upiautopay
- RBI payment data storage FAQ: https://www.rbi.org.in/CommonPerson/english/Scripts/FAQs.aspx?Id=2995
- RBI payment aggregator directions 2025: https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=12896
- RBI PPI directions: https://www.rbi.org.in/scripts/BS_ViewMasDirections.aspx?id=12156
- DPDP Act 2023 PDF: https://www.indiacode.nic.in/bitstream/123456789/22037/1/a2023-22.pdf
- Economic Times on P2P collect discontinuation: https://economictimes.indiatimes.com/industry/banking/finance/banking/npci-to-stop-upi-p2p-collect-requests-from-oct-1-to-combat-fraud/articleshow/123303105.cms
- Business Today on P2P collect discontinuation: https://www.businesstoday.in/personal-finance/banking/story/npci-to-tighten-upi-rules-peer-to-peer-collect-feature-to-end-in-october-489244-2025-08-13
- CNBC TV18 on P2P collect discontinuation: https://www.cnbctv18.com/personal-finance/upi-new-rule-october-1-person-to-person-collect-request-feature-to-end-19653779.htm

### India-First and Adjacent App Sources

- Niptao: https://niptao.app/
- Niptao UPI bill splitting article: https://niptao.app/en/blog/bill-splitting-apps-with-upi
- Settl: https://www.settlapp.in/
- Hisaab Play listing: https://play.google.com/store/apps/details?id=com.krishanblr.hisaab
- SpendSync: https://www.spendsync.in/
- Splitkaro: https://www.splitkaro.com/
- Splitkaro Play listing: https://play.google.com/store/apps/details?id=com.bsquare.splitkaro
- Wasooli: https://wasooli.in/
- FairShare: https://fairshareapp.co.in/
- FairShare Play listing: https://play.google.com/store/apps/details?id=com.debayan.fairshare
- Cleave Play listing: https://play.google.com/store/apps/details?id=com.context.app
- ruphiy: https://www.ruphiy.in/
- splitmybills.in: https://www.splitmybills.in/
- OnlineSplit: https://www.onlinesplit.com/
- Splitd: https://www.getsplitd.com/

### App Store and Google Play Review Feeds Sampled

iOS recent review RSS:
- Splitwise: https://itunes.apple.com/us/rss/customerreviews/id=458023433/sortBy=mostRecent/json
- Tricount: https://itunes.apple.com/us/rss/customerreviews/id=349866256/sortBy=mostRecent/json
- Settle Up: https://itunes.apple.com/us/rss/customerreviews/id=737534985/sortBy=mostRecent/json
- Splid: https://itunes.apple.com/us/rss/customerreviews/id=991473495/sortBy=mostRecent/json
- Splittr: https://itunes.apple.com/us/rss/customerreviews/id=588332804/sortBy=mostRecent/json
- Tab: https://itunes.apple.com/us/rss/customerreviews/id=595068606/sortBy=mostRecent/json
- SplitMyExpenses: https://itunes.apple.com/us/rss/customerreviews/id=6502963284/sortBy=mostRecent/json

Google Play app pages/review samples via google-play-scraper:
- Splitwise: com.Splitwise.SplitwiseMobile
- Tricount: com.tribab.tricount.android
- Splid: splid.teamturtle.com.splid
- Settle Up: cz.destil.settleup
- SplitMyExpenses: com.vuxbyte.SplitMyExpenses
- Hisaab: com.krishanblr.hisaab
- Niptao: app.niptao
- Splitkaro: com.bsquare.splitkaro
- FairShare: com.debayan.fairshare
- Cleave: com.context.app

Selected review signals captured:
- Splitwise iOS 2026-07: low-star reviews complain about 2/few expense entries per day, subscription greed, bank-transfer/fund withdrawal, and bank-info demands.
- Splitwise Google Play 2026-07: newest reviews complain about 4 free logs/day, annual subscription, Pro for basic features, Android issues, settle-up recommendations, and desire for subgroups.
- Tricount iOS/Play 2026-07: praised for no ads/simple trips; complaints about calculation confidence, missing multiple-payer expense, no web app, and fractional shares.
- Splid iOS/Play 2026-07: praised for offline/simple/no ads/one-time unlock; complaints/request for export and custom repayment assignments.
- Splittr iOS 2026-07: praised for travel; complaint about requiring online account despite offline positioning and request for PDF receipt upload.
- Tab iOS 2026-06/05: complaint about inability to upload file/screenshot receipt; request to view receipt image while editing.
- Hisaab Play 2026-06/07: complaints about no Splitwise import, mandatory Google sign-in plus phone, contact upload, and contact add bug.
- Splitkaro Play 2026-06: complaints about responsiveness/download/currency abroad; requests for UPI auto-add and payment type tagging.

### Review Aggregators and Comparison Sources

- Trustpilot Splitwise: https://www.trustpilot.com/review/splitwise.com
- Trustpilot Tricount: https://www.trustpilot.com/review/tricount.com
- AlternativeTo Splitwise alternatives: https://alternativeto.net/software/splitwise/?license=free
- AlternativeTo Spliit: https://alternativeto.net/software/spliit/about/
- Product Hunt Splitwise reviews: https://www.producthunt.com/products/splitwise/reviews
- ComplaintsBoard Splitwise: https://www.complaintsboard.com/splitwise-b149630
- News18 on Splitwise daily limits: https://www.news18.com/tech/splitwise-now-limits-number-of-expenses-you-can-add-for-free-but-here-are-4-apps-that-dont-8720041.html
- TechnoFino Splitwise Pro discussion: https://technofino.in/community/threads/splitwise-is-useless-without-pro-now.19199/
- WhistleOut Splitwise/Splid reviews: https://www.whistleout.com/CellPhones/Apps/splitwise-for-group-expense-tracking and https://www.whistleout.com/CellPhones/Guides/splid-app-for-splitting-group-expenses

### Reddit/Hacker News/Community Sources

- PullPush Reddit archive query: "I am extremely frustrated with Splitwise. If I build an alternative..." in r/bangalore, 2024-01-22. Key selftext: 27-year-old Bangalore 3BHK user, 20-30 weekly transactions on Swiggy/Blinkit/Licious/Uber/BigBasket/Amazon/Ola/Rapido, 99 percent card/UPI, Splitwise 3/day free limit practically unusable.
- PullPush Reddit archive query: "Is anyone else tired of Splitwise?" in r/apps/r/indiasocial/r/AskIndia, 2025-05. Mostly promotional alternative posts, but recurring claim set: 3-4 transaction day limit, no search, no conversion, no itemization, no receipt scanning on free tier.
- Hacker News: Splitwise founder comment on debt simplification/trust: https://news.ycombinator.com/item?id=7666703
- Hacker News: Spliit as minimalist no-ads alternative: https://news.ycombinator.com/item?id=31863691
- Hacker News: Medici open-source Splitwise alternative prompted by daily expense limits: https://news.ycombinator.com/item?id=44612306

### Academic and Technical Sources

- Tom Verhoeff, "Settling Multiple Debts Efficiently": https://infedu.vu.lt/doi/10.15388/infedu.2004.08
- Verhoeff problem PDF: https://wstomv.win.tue.nl/publications/settling-debts-problems.pdf
- Harvard DASH, "Settling Debts Efficiently: Zero-Sum Set Packing": https://dash.harvard.edu/entities/publication/cd9c8fdc-96f3-439f-8931-a2aecf78d707
- Anton Cao, "The Splitwise Problem": https://antoncao.me/blog/splitwise
- "The Splitwise Problem" PDF: https://ashlin-v-thomas.github.io/assets/pdfs/The__Splitwise__Problem-1.pdf
- Terbium debt simplification: https://terbium.io/2020/09/debt-simplification/
- Stack Overflow algorithm discussion: https://stackoverflow.com/questions/974922/algorithm-to-share-settle-expenses-among-a-group
- Stack Overflow NP-hard discussion: https://stackoverflow.com/questions/1163116/algorithm-to-determine-minimum-payments-amongst-a-group
- GeeksforGeeks min cash flow: https://www.geeksforgeeks.org/dsa/minimize-cash-flow-among-given-set-friends-borrowed-money/
- TigerBeetle data modeling: https://docs.tigerbeetle.com/coding/data-modeling/
- Modern Treasury immutability in double-entry ledger: https://www.moderntreasury.com/journal/enforcing-immutability-in-your-double-entry-ledger
- Modern Treasury scale ledger immutability: https://www.moderntreasury.com/journal/how-to-scale-a-ledger-part-v
- Square Books immutable double-entry accounting service: https://developer.squareup.com/blog/books-an-immutable-double-entry-accounting-database-service/
- Azure Event Sourcing pattern: https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing
