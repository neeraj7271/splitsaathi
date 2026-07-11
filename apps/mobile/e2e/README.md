# SplitSaathi Mobile E2E Scaffold

This folder is a runner-neutral scaffold for Phase 1 flows. Use Maestro or Detox once a simulator/device target and API environment are available.

Required environment:

- `EXPO_PUBLIC_API_URL` pointing at a running `/v1` backend.
- OTP provider in development mode or test OTP fixture.
- A test group with participants if the flow should skip group creation.

Covered flow in `phase1-flow.maestro.yaml`:

- OTP onboarding without contact permission.
- Group creation with manual participants.
- Expense entry.
- Settlement intent/proof path.
- Offline sync status entry point.

