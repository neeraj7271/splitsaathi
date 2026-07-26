# SplitSaathi — UI/UX Design Specification (v1)

**Scope of this document: UI/UX only.**
This spec governs visual design, layout, navigation, component behavior, and copy. It does not change any API contract, data model, business logic, or backend behavior. See "Instructions for the Coding Agent" at the end — read that section first if you are the one implementing this.

---

## 0. Product Context (from thesplitsaathi.com — do not contradict this)

SplitSaathi is a **proof-backed UPI expense ledger** for Indian flats, trips, couples, events, and businesses. Its differentiators vs. Splitwise:

- UPI deep-link settlement (GPay, PhonePe, Paytm, BHIM) + QR fallback
- Balances only move after the **receiver confirms** payment with proof (screenshot/UTR)
- GST, tip, service, discount adjustments on expenses
- Splits: Equal, Exact, Shares, Itemized — multiple payers supported
- Audit-grade history: edit/void with reasons, version history, event rail
- Offline outbox (expenses queue, post with idempotency when back online)
- Recurring expenses (weekly/monthly)
- Import Splitwise CSV, export CSV/PDF/Tally/JSON
- Cross-group friends balances

Every screen spec below exists to serve one of these features. Nothing here should be simplified in a way that removes a differentiator from the UI — simplify the *language and layout*, not the *capability*.

Brand tone from the landing page: **"Current & Calm."** Confident fintech, not playful consumer app. Precise numbers, generous whitespace, no exclamation marks in copy.

---

## 1. Design Principles

1. **The user never sees your state machine.** "Intent," "Posted," "ExportJobCreated" are backend concepts. The UI shows what a human did and what happens next — never the internal event name.
2. **Money is never ambiguous.** Every amount shows currency, sign (owed vs. owe), and who it involves, in that visual order.
3. **One primary action per screen.** Every screen has exactly one filled/primary button. Everything else is secondary (outlined) or tertiary (text link).
4. **Native platform behavior is non-negotiable.** Back gesture and back button must always do the same thing a user expects — see Section 3.
5. **Proof is a first-class UI citizen.** Since the entire settlement model hinges on proof-then-confirm, that flow gets the most design attention in the app, not the least.

---

## 2. Foundations

### 2.1 Color Tokens

Keep the existing "Calm Precision" base neutrals if already defined in the codebase; the values below are the reference if not yet formalized. Do not introduce new brand colors outside this palette.

**Brand gradient — "Current Flow"**
- `brand.gradient.start` — Indigo `#4F46E5`
- `brand.gradient.end` — Teal `#0D9488`
- Use only for: primary balance hero card, primary CTA on the settlement success state, app icon/splash. Never use the gradient as a background for list rows, cards, or body content — it's a hero-moment color, not a wallpaper.

**Neutrals (light theme — default)**
- `bg.canvas` `#F5F6F8` (screen background)
- `bg.surface` `#FFFFFF` (cards, sheets, inputs)
- `bg.surface-sunken` `#EEF0F3` (input fields at rest, disabled rows)
- `border.subtle` `#E3E6EA`
- `text.primary` `#111318`
- `text.secondary` `#6B7280`
- `text.tertiary` `#9AA1AC`

**Semantic**
- `money.positive` (owed to you) `#16A34A`
- `money.negative` (you owe) `#DC2626`
- `money.settled` `#6B7280`
- `status.warning` `#D97706` (e.g., proof pending, offline queued)
- `status.info` `#4F46E5`

**Dark theme:** the marketing site uses a dark canvas (`#0B0E14`). Ship dark mode as a real, tested theme (not an afterthought toggle) — the brand identity outside the app is already dark, so users arriving from the website will expect it. Same token names, dark values; do not hardcode colors anywhere in the app layer.

### 2.2 Typography

- One typeface family for UI text (system font is fine: SF Pro / Roboto per platform). Do not mix multiple font families.
- **Numerals must be tabular/monospaced-figure** everywhere money appears (you're already doing this in the current build — keep it, extend it to every amount, not just totals).
- Type scale (mobile):
  - Display (balance hero number): 34/40, weight 700
  - Title (screen headers): 22/28, weight 700
  - Subtitle (card headers, section labels): 16/22, weight 600
  - Body: 15/22, weight 400
  - Caption (timestamps, helper text): 13/18, weight 400, `text.secondary`
  - Micro (badges, tags): 11/14, weight 600, uppercase, letter-spacing 0.04em

### 2.3 Spacing & Grid

- Base unit: 4px. All padding/margin values are multiples of 4.
- Screen horizontal padding: 16px (never less; 20px on tablets).
- Card internal padding: 16px.
- Vertical rhythm between sections: 24px. Between related items in a list: 12px.
- Minimum tap target: 44×44px, no exceptions — this includes checkboxes, close icons, and chip toggles.

### 2.4 Elevation & Radius

Two elevation levels only — more than two and hierarchy collapses:
- **Level 0 (flat):** list rows, inline content — `border: 1px solid border.subtle`, no shadow.
- **Level 1 (raised):** cards that are tappable/interactive, bottom sheets, modals — `shadow: 0 2px 8px rgba(17,19,24,0.06)`, no border.
- Corner radius: 12px for cards, 10px for inputs/buttons, 24px for pill buttons/chips, 20px for bottom sheet top corners.

### 2.5 Iconography

- One icon set app-wide (pick Lucide or Phosphor, not both — the current build mixes icon presence/absence across screens, e.g., Settings rows have no icons while bottom nav does). Every list row with a settings/action meaning gets a leading icon, no exceptions.
- Icon size: 20px inline with text, 24px standalone tap targets.
- Icon color follows text color at that hierarchy level (primary icons = `text.primary`, decorative = `text.tertiary`).

### 2.6 Motion

- Screen transitions: platform-native (slide-from-right on push, slide-down-to-dismiss on modal). Do not build custom screen transitions.
- Micro-interactions: 150–200ms ease-out for toggles, checkboxes, tab selection. 250ms for bottom sheets.
- No bouncy/spring effects on financial confirmation moments (settlement confirm, expense save) — calm, not playful, per brand tone.

---

## 3. Navigation & Platform Back Behavior

This is a common source of bugs and confusion — spec it explicitly.

### 3.1 Rule set (applies identically to Android hardware/gesture back and iOS edge-swipe/back button)

1. **Any screen pushed onto a stack (group detail, add expense, settlement, expense detail, settings sub-pages) must close on back gesture/button** and return to the exact previous screen state (scroll position preserved).
2. **Any open bottom sheet, modal, or popover must be dismissed by back gesture/button first**, before the back action is allowed to affect the screen underneath. Never let a back-press skip a modal and navigate two levels at once.
3. **Multi-step flows (Add Expense, Settlement, Create Group, Import CSV) use a step stack, not a single screen with internal state.** Back from step 3 returns to step 2 with fields preserved — it must never exit the whole flow. Exiting the flow entirely requires the explicit "X" / close icon in the header, and if the user has entered data, show a confirm dialog: "Discard this expense? / Discard / Keep editing."
4. **Bottom nav tabs (Home, Groups, Friends, Settle) each keep their own back stack.** Switching tabs does not lose your place in another tab. Back button/gesture from a tab's root screen either (a) returns to Home tab if you're not already on it, or (b) exits the app if you are on Home tab at root — standard Android convention. Do not intercept back to show an "Are you sure you want to exit?" dialog; that's an anti-pattern.
5. **After a completed settlement or saved expense, the flow must pop the entire stack back to the screen the user started from** (usually Group detail) — never leave a "success" screen sitting in the stack such that back-button from it re-triggers the flow.
6. **Every pushed screen and every modal has a visible back/close affordance in the UI** (top-left chevron for pushed screens, top-right X for modals/sheets) — never rely on gesture-only navigation. Users on button-nav Android devices must have a tappable equivalent for every gesture action.

---

## 4. Global Components

### 4.1 Buttons

- **Primary:** filled, `brand.gradient` background only for the single highest-stakes action per screen (Settle, Save expense, Confirm payment). Everywhere else, primary buttons are solid `text.primary` (near-black) fill, not the gradient — gradient is reserved, not default, or it stops meaning anything.
- **Secondary:** outlined, 1.5px border, transparent fill.
- **Tertiary:** text-only, no border, used for "Cancel," "Skip," "Add another."
- **Destructive:** outlined or text in `money.negative` red, used for Void/Delete only. Always paired with a confirm dialog.
- Full-width on mobile forms; inline/auto-width when paired (e.g., "Discard / Keep editing").
- Disabled state: 40% opacity, no shadow, not tappable — never hide a button instead of disabling it when the reason for disablement is fixable by the user (e.g., "Total amount required").

### 4.2 Inputs (text fields, amount fields)

- Visible bordered box at all times (`bg.surface`, 1px `border.subtle`), never bottom-line-only or borderless — borderless inputs are the #1 cause of "where do I type" confusion on unfamiliar forms.
- Label sits above the field, always visible (not placeholder-as-label) — "Description," "Total amount" as persistent labels, with example text ("Groceries, rent, dinner") as lighter placeholder inside the box, not a replacement for the label. Your current Add Expense screen does this partially right; make it consistent everywhere.
- Focus state: border color changes to `status.info`, 2px.
- Error state: border `money.negative`, helper text below in same color, icon (⚠) leading the field.
- Amount fields: ₹ symbol prefixed inside the field (not as separate label text), right-aligned tabular numerals, numeric keyboard only.
- Every required field is marked; every optional field is explicitly labeled "optional" in the label itself (you already do this for Category/Notes — keep it, apply everywhere).

### 4.3 Date Picker / Calendar

- Tapping a date field opens a **native platform date picker** (Android Material date picker / iOS wheel), not a custom in-app calendar grid, unless you need range selection (e.g., recurring expense end date, export date range) — for ranges, use a bottom-sheet calendar with a visible start/end pill summary at the top.
- Display format: `DD MMM YYYY` (e.g., "26 Jul 2026") in en-IN convention — never MM/DD, ever, anywhere in this app.
- Recurring schedules use a dedicated bottom sheet: frequency chips (Weekly/Monthly), day-of-week or day-of-month picker, and a plain-language summary line ("Repeats monthly on the 5th") — never show a cron-like string.

### 4.4 Attachments / Receipts / Proof

This is a differentiator feature — give it real design, not a bare paperclip label:

- **Receipt attachment (expense entry):** tap opens an action sheet — Camera / Choose from gallery / PDF file. Once attached, show a thumbnail chip with filename + a small "✕" to remove, not just the word "Receipt" as static text.
- **Proof attachment (settlement):** same pattern, but this screen also needs a **UTR/reference number text field** alongside the screenshot — landing page confirms both are part of proof. Show both fields together under a "Proof" section header, screenshot thumbnail on the left, UTR field on the right (stack on narrow screens).
- Both attachment types show upload progress inline (thin progress bar under the thumbnail) and a retry affordance on failure — never a silent failure.

### 4.5 Toggles / Switches

- Use switches only for true binary on/off settings (Notifications, Adjustments and rounding). Do not use a switch where you actually mean "pick one of two modes" — that's a segmented control (see 4.6).
- Switch track: `bg.surface-sunken` off, `brand.gradient.end` (teal) on. Thumb always white.

### 4.6 Segmented Tabs / Chip Groups (Equal/Exact/Shares/Itemized, Payers/Split between)

- Rendered as a pill-shaped segmented control with a **filled, high-contrast selected state** — current build's selection state (thin outline ring) is too weak for a money-affecting choice. Selected segment: `text.primary` fill, white text. Unselected: transparent, `text.secondary` text.
- Max 4 segments per row before wrapping to a horizontal scroll — never shrink text to fit more than 4.

### 4.7 Cards & List Rows

- **List row** (Level 0): leading icon or avatar, title, optional subtitle/timestamp, trailing value or chevron. Used for: settings, activity feed, friend list, group list.
- **Card** (Level 1): used only for tappable summary objects — group summary cards, the balance hero, expense summary on group detail. Don't wrap every piece of content in a card; overuse flattens hierarchy (current build does this — everything is a white rounded box).
- Group/expense avatars: colored circle with initial, color assigned per group **type** (Trip/Couple/Home/Event/Business each get a fixed accent color from a small defined palette), not random — this gives users a visual pattern-match across the group list that the current build lacks entirely.

### 4.8 Modals / Bottom Sheets / Popups — when to use which

| Use case | Component |
|---|---|
| Confirm a destructive action (void expense, remove member, discard draft) | Center modal, 2 buttons |
| Pick from a short list (split type detail, currency — future) | Bottom sheet, single select |
| Multi-field entry that's a sub-step of a bigger flow (add participant, recurring schedule) | Bottom sheet, full form |
| Filter a list (see 4.9) | Bottom sheet, filter panel |
| Share/export/invite options | Bottom sheet, action list with icons |
| Non-blocking status update (proof submitted, synced) | Toast/snackbar, not a modal — never block the user with a modal for something that isn't a decision |

Every modal/sheet has a visible close affordance (see Section 3.6) and dims the background (40% black scrim) so it's unambiguous something is layered on top.

### 4.9 Filters

Screens that need filtering: Group list, Friends list (already has All/Outstanding/You owe/Owes you — good pattern, keep it as a persistent segmented row, not a hidden filter icon, since it's the primary way users scan these screens), Activity/History (needs filters: by group, by date range, by type — expense/settlement/edit), Expense list within a group (by category, by payer, by date range).

- Simple filters (2–4 mutually exclusive states): persistent horizontal segmented row under the screen title, always visible — as you've already built for Friends.
- Complex filters (multiple simultaneous facets: date range + category + member): a filter icon in the header opens a bottom sheet with grouped controls and a sticky "Apply (N)" button showing the result count live, plus a "Clear all" text link.
- Active complex filters always show as removable chips under the header once applied, so the user never forgets a filter is on and wonders why a list looks short.

### 4.10 Empty States

Every empty state gets: a simple line-art icon (not a generic file/document glyph reused everywhere — differentiate by context), one line of plain-language explanation, and where relevant, a direct action button. Current build's empty states ("No expense selected," "No ledger activity yet") are acceptable in tone but need distinct icons per context and, where applicable, a CTA:
- No expenses in group → icon + "No expenses yet" + **"Add expense"** button.
- No activity → icon + "Nothing recorded yet — expenses and settlements will show up here."
- Friends list fully settled → icon + "All settled up" (positive framing, not neutral).

### 4.11 Toasts / Snackbars

- Bottom-anchored, 3–4 second auto-dismiss, one line, optional single action link ("Undo").
- Used for: expense saved, synced from offline queue, proof submitted, CSV exported. Never used for errors that block progress — those go inline on the field or as a modal if blocking.

---

## 5. Screen-by-Screen Specification

### 5.1 Home / Dashboard

- Header: app wordmark small top-left, profile avatar top-right (taps to Profile).
- **Hero balance card** (Level 1, `brand.gradient` background): "Net across groups," large tabular number with sign color logic even on the gradient (use white number, but a small colored pill badge "You are owed" / "You owe" / "Settled up" beneath it — the current build's plain white-on-gradient number loses the positive/negative signal that matters most).
- Two primary actions directly under the hero: **Add expense** and **Settle up** as side-by-side filled/outlined button pair — not buried in a 5-icon row.
- Secondary actions (Recurring, Sync, Import, Export) move into a horizontal icon row *below* the two primary buttons, visually subordinate (smaller, `text.secondary` labels) — or into a "More" overflow if you want to keep the home screen calmer.
- **Groups row:** horizontal scroll, each card shows group name, type-colored avatar, and net balance in that group (color-coded). Show ~20% of the next card at the edge so scrollability is obvious. Add a "See all" text link at the row's end.
- **Recent activity:** vertical list, 3–5 items, human-readable (see 5.8), with a "See all" link to the full Activity screen.

### 5.2 Groups List

- Segmented filter row: All / Outstanding / You owe / Owes you (matches Friends pattern for consistency).
- Section headers: "Outstanding balances" then "Settled up" — keep this grouping, it's good.
- Each row: type-colored avatar with initial, group name, type + member count as subtitle, trailing balance with color.
- Floating "+" action (already present) opens **Create group** as a pushed screen or full sheet, not the current split "Create group / Group list" segmented-tab-on-the-same-screen pattern — creation and browsing are different intents and should be different screens. FAB → Create group screen; Groups tab root → the list.

### 5.3 Create Group

- Fields top to bottom: group photo/logo (optional, tap to add), group name (required, with live placeholder example per type), group type as a **chip row** (Trip/Couple/Home-Flat/Event/Business — icon per chip, not just text), then "Add people" section with three entry methods clearly separated: search contacts, add by name (guest/manual), invite link/QR — present as three tappable rows, not stacked forms competing for attention (current screen shows the manual-add form fully expanded by default, which is the least-used path for most users; collapse it under a "Add manually" row that expands on tap).
- Primary button "Create group" pinned to bottom, always visible above keyboard.

### 5.4 Group Detail

- Tabs: **Expenses / Balances / Activity** (segmented, sticky under header).
- Expenses tab: chronological list, each row = description, category icon, amount, payer avatar, date. Tap → Expense detail.
- Balances tab: per-member net balance list + a **"Settle up"** primary button that pre-fills the largest debt.
- Activity tab: this is where "Expense version history" and "Group event rail" belong, rewritten per Section 5.8 — human sentences, not event names.
- Group-level "+" for add expense stays as a FAB scoped to this screen.

### 5.5 Add / Edit Expense

Order top to bottom (single scroll, no tabs):
1. Group context chip (which group, non-editable once entering from a group; editable/selectable if entered from Home)
2. Description (required text field)
3. Total amount (required, ₹ prefixed, numeric keyboard, large text — this is the second most important number on the screen after the group balance)
4. Category (optional, icon-picker chip row or searchable dropdown — not a bare text field; a fixed category set with icons reads faster than free text)
5. Split type segmented control: Equal / Exact / Shares / Itemized (per Section 4.6 styling)
6. Paid by: avatar row, supports multi-select for multiple payers with per-payer amount shown once >1 selected (landing page explicitly supports multiple payers — make this reachable, not hidden; current screen shows single-select checkboxes with no visible path to multi-payer)
7. Split between: avatar row with per-person computed amount, editable inline when split type is Exact/Shares
8. **Adjustments** (collapsed accordion, closed by default): GST %, tip, service charge, discount — each a small labeled numeric field, live-updates the total when expanded. Landing page confirms this exists; today's build has an "Adjustments and rounding" toggle only, with no visible GST/tip/service fields — build them out per the marketing promise.
9. Date (tap → native date picker), Receipt attachment (per 4.4), Notes (optional, plainly labeled "Add a note")
10. Sticky bottom bar: running total on the left, **Save expense** primary button on the right — user should never have to scroll to find the save action or to see the total is correct.

### 5.6 Expense Detail / Edit / Void

- Read view mirrors the entry layout, non-editable, with a small "Edited" badge + "View history" link if the expense has prior versions (opens the version-history bottom sheet — a clean diff list, "Amount: ₹450 → ₹489, by Neeraj, 23 Jul" — not the raw event feed).
- Edit reuses the Add Expense screen pre-filled.
- Void is a destructive text/icon action in the overflow menu, always requires a reason (short text field in the confirm modal) since the landing page promises "void with reasons" — make that reason field mandatory, not optional, or the audit trail promise is broken.

### 5.7 Settlement Flow

Redesign as **3 visible steps**, not 5 internal ones:

**Step 1 — Amount & recipient**
- "Settle up" header, recipient card (name, avatar, what it settles — e.g., "Settles Book and Coffee"), amount with Suggested/Custom toggle, method toggle Pay via UPI / Paid in cash.

**Step 2 — Pay**
- If UPI: a grid of UPI app icons (GPay/PhonePe/Paytm/BHIM) that deep-link out, plus a QR code fallback shown by default alongside — don't hide the QR behind a tab, some users will scan rather than tap (landing page treats QR as a first-class fallback).
- If cash: skip straight to Step 3 confirmation entry.

**Step 3 — Add proof & confirm**
- Screenshot/receipt attach + UTR field (per 4.4).
- Plain-language status line: **"Waiting for [Receiver] to confirm"** after submission — this replaces "Proof before posted" entirely. Show a simple 2-state indicator (Submitted → Confirmed), not the 5-node technical stepper.
- Once confirmed (push notification or refresh), show a calm success state: check icon, "₹854.50 settled with Jitendra," single "Done" button that pops the whole flow back to where the user started (Section 3.5).

For the **receiver's side** (confirming a payment someone else made to them): a dedicated notification-driven screen — proof thumbnail, amount, payer name, UTR, with **Confirm received / Dispute** as the two buttons. This flow exists implicitly in the feature set (landing page: "only the person receiving money can confirm") but isn't in your current screenshots — make sure it's designed, it's half the settlement experience.

### 5.8 Activity / History (rewrite target)

Replace the raw event rail entirely. Each row:
- Icon (expense/settlement/edit/void, color-coded)
- One sentence, human voice: "Neeraj added ₹489 for Book, split equally with Jitendra." / "Jitendra confirmed ₹854.50 from Neeraj." / "Neeraj edited Book — ₹450 → ₹489."
- Timestamp, right-aligned, relative for <24h ("2h ago"), absolute date after.
- Never show: job names, "Reason:" prefixes, internal status enums, timestamps in raw ISO/epoch form.
- Filterable per Section 4.9 (by type, member, date range).

### 5.9 Friends

Current layout (All/Outstanding/You owe/Owes you segmented row, "Settled up" section) is good — keep the structure. Additions:
- Each row should be tappable into a **per-friend detail screen**: net balance, shared groups list, mini activity feed, and a direct "Settle up" button scoped to that person — right now Friends is a dead-end list.
- Add avatars (photo if available from contacts, else colored initial) — current rows are bare gray circles with no visual distinction between people.

### 5.10 Invite / Add Participant

- Three methods as separate, clearly labeled rows (Search contacts / Add manually (name + optional phone) / Share link or QR) — don't show the manual-entry form expanded by default (current screen does); it's the fallback path, not the primary one for most users who'll add from contacts.
- Invite link: show as a **"Copy invite link"** button with a masked/branded short URL, not the raw `api.thesplitsaathi.com` string as visible plain text (Section 1, backend-infra leak). QR code stays large and prominent — that part is already good.

### 5.11 Recurring Expenses

- List of active recurring rules per group: description, amount, frequency in plain language ("Monthly on the 5th"), next date, with a toggle to pause and an edit/delete overflow.
- Creation reuses the Add Expense form with a "Repeat" section appended (frequency chips + native date picker for start, optional end).
- Landing page copy: "Reminders say a bill is ready to review — not that someone is late." Match this exactly in notification copy — never use "overdue," "late," or red warning color for a recurring reminder; use `status.info`, neutral tone.

### 5.12 Import / Export

- **Import Splitwise CSV:** file picker → preview screen showing row count and a sample of 3 mapped rows before committing → progress → success/failure summary with a downloadable error report if any rows failed. Never a silent bulk import with no preview.
- **Export:** bottom sheet with format chips (CSV / PDF / Tally / JSON), scope selection (this group / all groups / date range), single "Export" button, then a share sheet or download confirmation.

### 5.13 Profile & Settings

- Fix duplicate phone number display (Section — show it once, in the identity card only; the "Phone number" detail card below becomes unnecessary or is merged).
- Add leading icons to every settings row (Notifications, Security, Appearance) — consistent with 2.5.
- UPI ID section: keep, but tighten the explanatory copy and make it visually secondary (caption-size, `text.secondary`) so it doesn't compete with the ID itself.

---

## 6. Copy & Microcopy Rules

Banned → Replacement (apply everywhere in the app, not just the screens audited):

| Banned (internal/technical) | Use instead |
|---|---|
| ExportJobCreated / Reason: Export Job Created | "[Name] exported the ledger" or omit from user-facing feed entirely |
| Proof before posted | "Add proof" / "Waiting for confirmation" |
| Intent → UPI opened → Proof → Confirmed → Posted | 2–3 step plain labels per flow (see 5.7) |
| Beneficiaries | Split between |
| Extra context for this expense | Add a note |
| Book added / Reason: neerajsuman766 added ₹489.00 for "Book" | "Neeraj added ₹489 for Book" |
| Any raw enum, snake_case, or CamelCase string | A full plain-language sentence |

General rules:
- No exclamation marks (brand tone is calm, not hype).
- Amounts always with ₹ and Indian digit grouping (₹1,240.00, not ₹1240.00).
- Dates always `DD MMM YYYY`.
- Usernames like "neerajsuman766" should display as the person's actual name/first name wherever a display name exists — the login handle is not a friendly identity string; reserve it for the profile/account screen only.

---

## 7. Accessibility & Responsiveness

- Minimum contrast 4.5:1 for body text, 3:1 for large text/numerals — verify the `money.positive`/`money.negative` greens/reds against both light and dark canvas.
- All icons that carry meaning (not purely decorative) need an accessible label.
- Support Android font-scaling up to at least 130% without truncating amounts or button labels.
- Design for 360dp width minimum (common Android baseline); test the horizontal group-card row and segmented controls at that width specifically, since 4-segment rows are tightest there.

---

## Instructions for the Coding Agent

Paste/give this block directly to whoever (or whatever agent) implements this spec:

> This is a **UI/UX-only** design pass. Do not modify:
> - API endpoints, request/response shapes, or contracts
> - Database schema, migrations, or the event-sourced ledger model
> - Business logic (split calculations, balance math, settlement state machine, idempotency handling, offline outbox logic)
> - Any backend service code
>
> You are only allowed to touch: component/screen markup, styles/theme tokens, navigation/routing configuration, client-side copy strings, and client-side presentation logic (e.g., which fields are visible/collapsed, formatting of dates/numbers/labels).
>
> Where this spec asks for new UI states (e.g., multi-payer selection, GST/tip/service adjustment fields, receiver-confirmation screen), check whether the backend already supports the underlying data before building the UI — if the API doesn't yet expose it, flag it back rather than mocking it or inventing a new backend contract yourself.
>
> Follow Section 3 (back/gesture navigation) exactly — this is the most common source of regressions when redesigning screen flows. Test both hardware/gesture back and in-UI back/close affordances on every changed screen before considering it done.
>
> Do not rename or restructure any user-facing copy that display raw system data (event names, statuses) without confirming the underlying data still exists — you're changing how it's *displayed*, not deleting the data itself.