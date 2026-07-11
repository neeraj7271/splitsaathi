# SplitSaathi Design System — `design.md`

## Purpose & How Codex Should Use This File

This file is the single source of visual truth for SplitSaathi. It works together with the `design/` folder, which contains three reference screenshots (`reference-1-light-dashboard.png`, `reference-2-dark-wallet.png`, `reference-3-hanapay-flows.png`). Read this file in full before writing any UI code, then cross-check every screen you build against both this spec and the reference images.

**This is a synthesis, not a copy.** Each reference contributes specific patterns, and this document tells you exactly which patterns to take, which to leave, and what SplitSaathi's own distinct identity is. Do not literally recreate any single reference screen. Do not default to generic component-library styling (default React Native Paper, default shadcn tokens, default Expo template look) anywhere in this app — every screen must visibly use the tokens defined below.

### What we're taking from each reference, and why

- **Reference 1 (light dashboard — blue hero card, AI insights, quick actions, recent transactions list)**: Take the *structural pattern* — hero balance card at top, a horizontal quick-actions row beneath it, a clean list of recent activity below that, bottom tab navigation. **Do not** take its literal blue-gradient-card-on-white-background look — this exact blue/white AI-dashboard combination is extremely common in AI-generated fintech UIs and is exactly what we're avoiding. We use the layout skeleton, not the palette.
- **Reference 2 (dark wallet — warm gradient card, segmented Investment/Expenses tabs, multi-color bar chart, allocation list with status chips)**: Take the *dark mode approach*, the *segmented control pattern* for switching data views, and — most importantly — the **multi-color bar chart treatment** (each bar/category gets its own distinct hue rather than one monochrome series). This is the chart style to build for spending breakdowns. Also take the "allocation row with status chip" pattern (Savings / Emergency Fund / Travel with a colored status word) for budget/category rows.
- **Reference 3 (Hanapay — login, balance card with eye-toggle, activity list with colored status pills, numeric keypad, split-bill creation, QR pay)**: Take the **status-pill activity list** (Waiting / Success in colored pills next to each transaction) almost directly — this maps precisely onto our settlement lifecycle (pending / proof submitted / confirmed / disputed). Take the **numeric keypad component** for amount entry. Take the **split-bill creation flow** (title, member picker with phone number, avatar chips) as a direct structural reference for our expense-entry and settlement screens. Take the **balance-with-eye-toggle** pattern for the group/home balance card — hiding sensitive numbers is a genuinely useful pattern for shared financial data.

### SplitSaathi's own identity: "Current & Calm"

The product's job is to make shared money feel resolved, not stressful. The identity is a **dark-mode-first, premium, quietly confident fintech app** with one signature gradient (not the generic blue-purple or orange-red seen in the references) used sparingly on hero moments, a genuinely multi-color data-visualization palette for anything analytical, and a very deliberate status-color language for the settlement lifecycle, since that lifecycle (pending → proof → confirmed → disputed) is the product's core trust mechanism per the architecture plan.

---

## 1. Foundations

### 1.1 Color System

#### Brand Gradient — "Current Flow"

The signature gradient. Used only on: the home balance hero card, primary settlement CTA buttons, onboarding background, and the splash/loading screen. Never used as a background wash behind ordinary content — restraint is what makes it read as premium rather than templated.

```
--gradient-current-start: #3730A3   /* deep indigo */
--gradient-current-end:   #0D9488   /* teal */
angle: 135deg
```

This indigo-to-teal combination is deliberately chosen over the more common blue-to-purple or orange-to-red gradients seen in the references — it's less templated and reads as more distinctly "settled/current" (teal = resolved, indigo = trust).

#### Secondary Gradient — "Ember" (sparing use only)

Used only for: premium/upgrade moments, high-value settlement confirmations, and celebratory-but-restrained success states (never for routine actions).

```
--gradient-ember-start: #F97066   /* coral */
--gradient-ember-end:   #F59E0B   /* amber */
angle: 120deg
```

#### Dark Mode (default mode — build this first)

```
--color-canvas:          #0B0E14   /* near-black with cool undertone, not pure black */
--color-surface:         #12151D
--color-surface-raised:  #191D27
--color-hairline:        #232836
--color-ink:              #F4F5F7
--color-ink-muted:        #9AA1AF
--color-ink-faint:        #5B6273
```

#### Light Mode

```
--color-canvas:          #F6F7FB
--color-surface:         #FFFFFF
--color-surface-raised:  #FCFCFE
--color-hairline:        #E4E7EF
--color-ink:              #171922
--color-ink-muted:        #5B6273
--color-ink-faint:        #9AA1AF
```

#### Semantic / Status Colors (identical in both modes — status must read consistently regardless of theme)

```
--color-receive:    #22C55E   /* money owed TO the user */
--color-owe:        #F04438   /* money the user owes */
--color-pending:    #F59E0B   /* waiting / proof submitted / awaiting confirmation */
--color-confirmed:  #0D9488   /* settled / verified — ties back to the brand gradient's teal */
--color-disputed:   #F97066   /* disputed / rejected */
--color-info:       #6366F1
--color-neutral-chip-bg (dark):  #1E2330
--color-neutral-chip-bg (light): #EEF0F6
```

Status pills (direct reference from Hanapay's Waiting/Success pattern) always pair a dot or small icon with the color, never color alone — this matters for accessibility and because color-only status indicators are a common "vibe-coded" tell.

#### Chart Palette (data visualization — for the multi-color bar/category style from Reference 2)

Use this exact 6-color sequence, in order, for any multi-series chart (spending by category, weekly bars, allocation breakdowns). Do not let a charting library auto-generate colors.

```
1. #0D9488  (teal)
2. #6366F1  (indigo)
3. #F59E0B  (amber)
4. #F97066  (coral)
5. #84CC16  (lime)
6. #38BDF8  (sky)
```

### 1.2 Typography

Do not use system default fonts or Inter-everywhere (Inter is fine for body copy but using it for display text is one of the fastest ways an app reads as templated). Use this pairing:

| Role | Font | Source | Notes |
|---|---|---|---|
| Display / large balances / headings | **Cabinet Grotesk** (weights: Bold 700, Medium 500) | Fontshare (free, self-hostable) | Distinctive geometric character, premium fintech feel, not overused like Poppins/Inter for display |
| UI body / labels / buttons | **Inter** (Regular 400, Medium 500, SemiBold 600) | Google Fonts / `@expo-google-fonts/inter` | Excellent legibility at small sizes |
| Monetary figures (all amounts, balances, transaction rows) | **JetBrains Mono** (Regular 400, Medium 500) | Google Fonts / `@expo-google-fonts/jetbrains-mono` | Tabular numerals so digits never visually jump between screens; gives the ledger a "precise" character distinct from the rounded sans used elsewhere |

Install via Expo:
```
npx expo install expo-font @expo-google-fonts/inter @expo-google-fonts/jetbrains-mono
```
Cabinet Grotesk is not on Google Fonts — download the OFL-licensed files from Fontshare and load via `expo-font` with `useFonts()`.

#### Type Scale

```
display-lg     40 / 46   Cabinet Grotesk Bold     — splash/onboarding hero only
balance-hero   34 / 40   JetBrains Mono Medium    — home balance card figure
title          22 / 28   Cabinet Grotesk Medium   — screen titles
section        17 / 24   Cabinet Grotesk Medium   — section headers ("Recent Activity")
body           15 / 22   Inter Regular            — default body text
body-sm        13 / 18   Inter Regular            — secondary/meta text
amount         16 / 20   JetBrains Mono Medium    — transaction row amounts
amount-sm      13 / 16   JetBrains Mono Regular   — small inline amounts
caption        12 / 16   Inter Medium             — timestamps, labels, pill text
button         15 / 20   Inter SemiBold           — button labels
```

Amounts are **always** JetBrains Mono with tabular numerals enabled. This is non-negotiable — it's what separates a ledger app from a generic list-of-cards app.

### 1.3 Spacing & Layout Grid

Base unit: 4px. Use only multiples of 4 (4, 8, 12, 16, 20, 24, 32, 40, 48).

```
screen-horizontal-padding: 20
card-padding: 16
list-row-vertical-padding: 14
section-gap: 24
element-gap-tight: 8
element-gap-default: 12
```

### 1.4 Radius & Elevation

```
radius-sm:  10    /* chips, pills, small buttons */
radius-md:  16    /* standard cards, list containers */
radius-lg:  24    /* hero balance card, bottom sheets, modals */
radius-full: 999  /* avatars, status dots, circular icon buttons */
```

Elevation: prefer hairline borders (`--color-hairline`) over drop shadows for most surfaces — this is part of what keeps dark mode looking intentional rather than muddy. Use soft shadows only for: floating action button, bottom sheets, and modals over content.

```
shadow-floating: 0px 8px 24px rgba(0,0,0,0.35)   /* dark mode */
shadow-floating: 0px 8px 24px rgba(23,25,34,0.12) /* light mode */
```

No card should sit inside another card. Sections are separated by spacing and hairlines, not nested containers — this is one of the most common tells of a templated/vibe-coded layout.

### 1.5 Iconography

Use **Phosphor Icons** (`phosphor-react-native`) in the "duotone" or "bold" weight consistently — not a mix of outline styles from different icon sets, and not the default Expo/vector-icons Ionicons set (extremely common default, instantly reads as unstyled). Icon color follows semantic color tokens (receive/owe/pending/confirmed) when representing status; otherwise uses `--color-ink-muted`.

Custom icons (built as simple SVG components, not from a library) are needed for concepts unique to this product and not well represented in general icon sets:
- Ledger/event trail icon (small vertical dotted rail with dots) — used in audit history
- UPI handoff icon (a simple arrow-into-circle motif, not a payment-network logo)
- Split-weight icon (unequal bars) — used for weighted/percentage split mode
- Settlement stepper icon states (empty circle → half-filled → filled circle with check)

---

## 2. Motion & Background Treatment

### 2.1 The "Living Gradient" background

On the **splash screen, onboarding screens, and the home balance hero card only**, use a slow, subtle animated gradient mesh rather than a static gradient fill. This is the single biggest thing that separates a premium-feeling app from a static template.

Implementation:
- Use `expo-linear-gradient` for the static base gradient fallback.
- For the animated version, use `react-native-reanimated` to slowly interpolate the gradient's angle and color stop positions over an 8–12 second loop (shared values driving `useAnimatedProps` on an SVG-based gradient via `react-native-svg`, or a Skia canvas via `@shopify/react-native-skia` for a smoother blurred-blob effect).
- Motion must be slow and ambient — no more than a 5–8% shift in position, never a hard color swap. The effect should be almost subliminal; if a user consciously notices "the background is animating," it's moving too fast.
- Respect `prefers-reduced-motion` / a manual "reduce motion" setting — fall back to the static gradient.

### 2.2 Micro-interactions

```
duration-fast:    120ms   — button press states, chip selection
duration-default: 200ms   — screen transitions, sheet open/close
duration-slow:    320ms   — settlement stepper progress fill
easing: cubic-bezier(0.22, 1, 0.36, 1)   /* "ease-out-expo" — confident, not bouncy */
```

Haptics (`expo-haptics`):
- Light impact on row/chip selection
- Success notification haptic when a settlement posts to the ledger
- Warning notification haptic on dispute/rejection
- **Never** use a celebratory/gamified animation (confetti, bouncing checkmarks, etc.) for debt settlement — per the product's tone, paying someone back should feel like *relief*, not a game-like reward. This applies even though it might seem like an obvious "delight" moment — resist it deliberately.

### 2.3 Screen Transitions

Use `react-native-reanimated` + `react-navigation`'s native stack with shared-element-style transitions for: tapping a transaction row → detail/audit screen (the row should visually "expand" into the detail header), and tapping a settlement suggestion → the settlement flow (amount and participant avatar should persist across the transition).

---

## 3. Charts & Data Visualization

### 3.1 Library

Use **`@shopify/react-native-skia`** combined with **`victory-native`** (v37+, which is Skia-based) for all charts. Do not use `react-native-chart-kit` or `react-native-svg-charts` — both render with dated default styling that is a strong "unstyled library chart" tell. Skia-based rendering lets charts use the exact custom color palette, rounded bar caps, and smooth interpolated curves specified below, and supports the same subtle animation language as the rest of the app.

```
npx expo install @shopify/react-native-skia
npm install victory-native
```

### 3.2 Chart Styling Rules

- **Category/spending breakdown bar charts**: rounded-top bars (radius 6 on top corners only), each category gets its assigned color from the Chart Palette in order, bar width with visible gaps (not touching), baseline hairline in `--color-hairline`.
- **Weekly/daily spending trend**: smooth monotone line (not sharp linear segments) in the brand gradient's teal (`#0D9488`), with a soft gradient-fill area beneath it fading to transparent — this is the one place a gradient fill on a large surface is appropriate, since it's data-bound rather than decorative.
- **Balance-over-time**: same line treatment, but color reflects current sign (green tint if user is net owed, coral tint if net owing).
- **Allocation / budget breakdown rows**: horizontal progress bars with rounded ends, matched to the chart palette, plus a status word chip to the right (borrowed directly from Reference 2's "Under Control" pattern) — but our status words are settlement-relevant: "On track," "Ahead," "Needs review."
- Axis labels and gridlines are minimal — prefer direct data labeling (value shown at the top of a bar/point) over relying on a Y-axis scale, to keep the visual language calm rather than dashboard-dense.
- All chart figures use JetBrains Mono for any numeric labels.

---

## 4. Core Components

Build these as a shared component library (`packages/ui` or `apps/mobile/src/components/`) before building individual screens — every screen should compose from this set, not redefine styling inline.

### 4.1 Balance Hero Card
- Full-width, `radius-lg`, Current Flow gradient (animated per Section 2.1) as background.
- Eye-toggle icon top-right (direct reference from Hanapay) to mask/unmask the balance figure — persists user preference.
- Balance figure in `balance-hero` type style, white/`--color-ink` on dark gradient.
- Small label above ("Your balance across groups" / "You're owed" / "You owe" depending on context — never just "Balance" with no framing, since ambiguity here is exactly the trust problem this product solves).
- Two primary actions below the figure as pill buttons (not the default full-bleed rectangle buttons from Reference 1) — e.g. "Settle Up" and "Add Expense."

### 4.2 Quick Action Grid
- Row of 4 circular icon buttons with label beneath (Reference 1 pattern), used on Home: Add Expense, Settle, Scan Receipt, Import.
- Icons are Phosphor duotone in `--color-ink`, circular background `--color-surface-raised`.

### 4.3 Activity / Transaction Row
- Left: participant avatar (or small merchant/category icon for expenses).
- Middle: title (Inter Medium, `body`) + meta line (category · relative time, `body-sm` `--color-ink-muted`).
- Right: amount in `amount` style, colored by `--color-receive` / `--color-owe`, plus a status pill beneath it when relevant (direct reference from Hanapay's Waiting/Success pills), using the semantic status colors from Section 1.1.
- Row height respects `list-row-vertical-padding`; separated by hairlines, never card-per-row.

### 4.4 Status Pill
- `radius-sm`, `caption` text, colored dot + label, background is the status color at 12–15% opacity with full-opacity text/dot in that color.
- States: `Pending` (amber), `Proof Submitted` (amber, filled dot), `Awaiting Confirmation` (indigo), `Confirmed` (teal), `Disputed` (coral), `Expired` (muted grey).

### 4.5 Segmented Control
- Reference 2's pill-style segmented control for switching views (e.g. Expenses/Balances/Activity on group screen, Week/Month/Year on analytics).
- Full pill container `--color-surface-raised`, active segment `--color-surface` with a subtle shadow, animated sliding indicator (`react-native-reanimated`), not an instant swap.

### 4.6 Bottom Tab Bar
- 4–5 items, Phosphor duotone icons, active tab shows filled icon variant + label in `--color-confirmed` (teal) rather than the generic blue seen in all three references — ties tab-bar active state back to the brand's "settled/confirmed" color language instead of an arbitrary accent.
- Floating action button (for Add Expense) overlaps the tab bar center, using the Current Flow gradient, per Reference 1's pattern — but circular and slightly raised above the bar line, not flush.

### 4.7 Buttons
- Primary: full pill radius (`radius-full` height-wise, i.e. fully rounded ends), Current Flow gradient fill, white text, `button` type.
- Secondary: hairline border, transparent fill, `--color-ink` text.
- Destructive (void expense, reject proof): hairline border in `--color-owe`, text in `--color-owe`.
- Disabled: 40% opacity, no gradient (flat `--color-ink-faint` fill).

### 4.8 Input Fields
- Underline-style or soft-filled (`--color-surface-raised`, `radius-md`, no visible border unless focused) — avoid the heavy bordered-box input style; focused state shows a 1.5px `--color-confirmed` border, not a generic blue ring.
- Amount input fields use `balance-hero` or `title`-scale JetBrains Mono, right-aligned digits, currency symbol prefixed and slightly muted.

### 4.9 Numeric Keypad
- Direct structural reference from Hanapay's top-up screen: 3-column grid, digits 1–9, then a decimal/000 option and backspace.
- Keys are borderless, large touch targets (min 56×56), `title`-scale JetBrains Mono digits, subtle press-state background flash (`duration-fast`).
- Used for: settlement amount entry, custom split amount entry.

### 4.10 Member/Participant Picker (Split Creation)
- Direct structural reference from Hanapay's "Create split bill" screen: title field, member chips with avatar + name, phone-number add row, checkbox-style selection for "add to split."
- Selected participant chips show a small colored ring matching their assigned avatar color (assign each participant a stable color from the Chart Palette based on a hash of their ID, so the same person's color is consistent across the whole app — this reinforces "who's involved" at a glance in group views, activity rows, and settlement flows).

### 4.11 Settlement Stepper
- Horizontal or vertical rail showing the settlement lifecycle: Intent Created → UPI Opened → Proof Submitted → Confirmed → Posted.
- Each node is a circle (empty / half-filled / filled-with-check per Section 1.5's custom icon set), connected by a line that fills with `--color-confirmed` as steps complete.
- This is one of the most important components in the app — it's the direct UI answer to the "manual paid state is not proof" trust problem, so it must always be visible during any settlement flow, not tucked into a secondary tab.

### 4.12 Audit / Version History Row
- Uses the custom ledger-trail icon (Section 1.5) on a thin vertical dotted rail connecting entries chronologically.
- Each entry: actor name, change summary in plain language ("Priya changed the split from equal to weighted"), timestamp, and a "why" note if provided — never raw diff/JSON.

### 4.13 Empty States
- Never a bare "No data" text. Use a simple custom line-illustration (built as SVG, matching the Phosphor duotone weight/line thickness so it feels native to the icon set, not a stock illustration pack) plus one sentence of context plus a primary action button.

---

## 5. Screen-by-Screen Guidance

- **Onboarding**: dark canvas, animated Current Flow gradient mesh background (subtle, per 2.1), minimal copy, phone input using the soft-filled input style, no marketing hero imagery.
- **Home**: Balance Hero Card (4.1) → Quick Action Grid (4.2) → "Groups" horizontal scroll of compact group balance cards (avatar stack + net balance in `amount` style + status pill if action needed) → Recent Activity list (4.3).
- **Group View**: Segmented Control (4.5) for Activity / Balances / Expenses / People tabs. Balance strip at top showing net position per currency. Primary actions "Settle" and "Add Expense" as pill buttons, not buried in a menu.
- **Expense Entry**: Member Picker pattern (4.10) for payers and beneficiaries as two distinct sections. Split-mode selector (Equal / Exact / Shares / Itemized) as a segmented control. Live-updating difference indicator that must show zero before the primary button enables — styled as a thin status bar, teal when balanced, coral when not.
- **Itemized Split**: Receipt image at top, line items list below with per-item participant chips (colored per 4.10's participant-color system), running per-person total footer pinned to bottom.
- **Settlement/UPI Flow**: Numeric Keypad (4.9) for amount if custom, UPI app picker as a horizontal row of app icon buttons, then the Settlement Stepper (4.11) takes over the rest of the screen post-intent-creation.
- **Analytics/Spending**: Segmented Control for Week/Month/Year (Reference 2 pattern), the Skia bar chart (Section 3.2) for daily/category spending, Allocation rows (Section 3.2) below.
- **Audit History**: Audit/Version History Row (4.12) in reverse-chronological rail.
- **Profile/Settings**: standard list rows on `--color-surface`, no card wrapping, grouped by section header (`section` type style) with generous `section-gap`.

---

## 6. Dark Mode Strategy

Dark mode is the primary/default experience — design and build every screen in dark mode first, then verify the light-mode token swap holds up, not the reverse. This matches Reference 2's approach and reads as more premium for a finance app. Light mode must remain fully supported (respect system preference, with a manual override in Settings) but is the secondary design target.

---

## 7. Do's and Don'ts — Anti-Generic Checklist

Before marking any screen complete, verify:

- [ ] No default Ionicons/vector-icons — Phosphor only, consistent weight.
- [ ] No card-inside-card nesting.
- [ ] No plain blue (`#007AFF`/`#2563EB`-style default blue) used as the primary accent anywhere — the app's accent language is the indigo→teal gradient and the teal "confirmed" color, never a flat generic blue.
- [ ] No monochrome default bar charts — every multi-series chart uses the full 6-color Chart Palette in order.
- [ ] All monetary figures use JetBrains Mono with tabular numerals — no monetary figure in the default UI sans font.
- [ ] No confetti/bouncy celebration animation on settlement.
- [ ] No unstyled default React Native `<Button>` or Expo template boilerplate components anywhere in shipped screens.
- [ ] Every status indicator pairs color with a dot/icon/label — never color alone.
- [ ] Background gradient animation (Section 2.1) is present on splash/onboarding/home-hero and nowhere else — it should never feel like generic decorative motion slapped onto every screen.
- [ ] Each screen visually cross-checked against this file and the `design/` reference folder before being marked `done` in `BUILD_PROGRESS.md`.

---

## 8. Implementation Notes for Codex

### Package list to install

```
npx expo install expo-linear-gradient expo-font expo-haptics react-native-svg react-native-reanimated @shopify/react-native-skia
npm install victory-native phosphor-react-native
npx expo install @expo-google-fonts/inter @expo-google-fonts/jetbrains-mono
```

### Theme token file structure

Create a single source of truth for tokens, consumed by every component — do not hardcode hex values in individual screen files:

```
apps/mobile/src/theme/
  colors.ts       // exports light + dark token objects exactly as specified in Section 1.1
  typography.ts   // font family constants + type scale exactly as specified in Section 1.2
  spacing.ts       // Section 1.3
  radius.ts         // Section 1.4
  motion.ts        // Section 2.2 durations/easing
  chartPalette.ts  // Section 3.1's 6-color array, exported in fixed order
  index.ts          // ThemeProvider combining all of the above, with light/dark switching
```

Every component in Section 4 should be built once in `apps/mobile/src/components/` consuming these tokens via a `useTheme()` hook, and reused across every screen in Section 5 — never redefine a color, spacing value, or font size inline in a screen file.
