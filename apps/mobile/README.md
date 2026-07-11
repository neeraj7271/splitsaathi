# SplitSaathi Mobile

Expo React Native client for the Phase 1 SplitSaathi flows.

Owns mobile screens, Current & Calm design tokens, offline outbox, token storage, and API client mapping.

Does not own financial correctness, event sourcing, UPI reconciliation, or persistence of authoritative balances. The API event ledger remains the source of truth.

Run locally:

```powershell
npm run start -w @splitsaathi/mobile
```

Verification:

```powershell
npm run test -w @splitsaathi/mobile -- --runInBand
npx tsc -p apps\mobile\tsconfig.json --noEmit
npx expo config --json
```

Known gaps:

- Cabinet Grotesk font files are not present. The app uses Space Grotesk for display fallback, Inter for body, and JetBrains Mono for monetary amounts.
- To drop in Cabinet later, add licensed files under `apps/mobile/assets/fonts/` and update the display family in `src/theme/typography.ts` plus `App.tsx` font loading.
- Maestro E2E is scaffolded in `e2e/`, but Maestro/ADB are not installed in this environment and no device run has been executed.
- Real UPI app handoff and Expo push delivery require a simulator/device with installed payment/push capabilities; the code path is implemented and tested around safe stubs/contracts.
