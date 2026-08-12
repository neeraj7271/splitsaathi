# Changelog

All notable changes to the **SplitSaathi** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]
### Added
- In-app version check endpoint (`GET /v1/app/version`).
- Mobile `AppUpdateModal` for in-app update prompts and "What's New" highlights.
- Single version source of truth at `apps/mobile/version.json`.
- Automated version bump script (`scripts/bump-version.js`).

---

## [0.1.0] - 2026-08-12
### Added
- Initial development release of SplitSaathi mobile app and API server.
- Support for Equal, Exact, Percentage, and Weighted expense splitting strategies.
- Zero-penny-leakage `RoundingAllocator` algorithm with integer minor unit precision.
- Multilateral debt simplification using `GreedySettlementOptimizer`.
- Native UPI deep-linking intent generator (`upi://pay`).
- 16-state settlement lifecycle (payment proof submission, receiver confirmation, disputes).
- Multi-channel notification support (Expo Push, FCM, Brevo email, SMS OTP).
- Dark mode theme polish across all UI screens.
