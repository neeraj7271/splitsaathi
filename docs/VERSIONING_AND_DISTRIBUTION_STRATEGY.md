# SplitSaathi — Versioning & Dual-Channel Distribution Strategy Blueprint

> **Status**: Production Strategy & Implementation Specification  
> **Target Audience**: Core Team, Mobile Engineers, Backend Engineers, DevOps  
> **App Package Name**: `in.splitsaathi.mobile`  
> **Primary Distribution Channels**: Direct APK Download (`thesplitsaathi.com/downloads/SplitSaathi.apk`) + Google Play Store  
> **Last Updated**: August 2026  

---

## Executive Summary & Architecture Recommendations

SplitSaathi is expanding from a direct APK download model to a **dual-channel distribution model** (Direct APK + Google Play Store). To ensure smooth app updates, prevent user fragmentation, and allow seamless crossover when users transition from Direct APK to Google Play Store, we establish the following core decisions:

1. **Versioning Scheme**: **Semantic Versioning (`MAJOR.MINOR.PATCH`)** for user-facing `versionName` (e.g. `1.0.0`), coupled with a **Deterministic Mathematical Formula** for Android `versionCode`:
   $$\text{versionCode} = (\text{MAJOR} \times 100000) + (\text{MINOR} \times 1000) + (\text{PATCH} \times 10)$$
   *Example*: `0.1.0` $\rightarrow$ `100`, `1.0.0` $\rightarrow$ `100000`, `1.2.5` $\rightarrow$ `102050`.
2. **Single Source of Truth**: Centralized configuration file at `apps/mobile/version.json` consumed by Expo (`app.json`), Android Gradle (`build.gradle`), NestJS API (`/v1/app/version`), and Mobile UI.
3. **Unified App Signing Key (Critical)**: **Sign both Direct APK and Google Play Store builds with the exact same Upload Certificate / Keystore from Day 1.** Using identical package names (`in.splitsaathi.mobile`) and matching signing certificates allows Play Store updates to seamlessly upgrade existing direct APK installs without requiring an uninstall.
4. **In-App Update Engine**:
   - **Direct APK Channel**: Lightweight in-app check against `GET /v1/app/version` on launch, displaying a customizable "Update Available / What's New" modal with direct APK download support.
   - **Google Play Store Channel**: Play In-App Update API integration (`flex` / `immediate` update flows).
5. **Changelog Governance**: Strict *Keep a Changelog* format in `CHANGELOG.md`, paired with automated version bump tooling (`scripts/bump-version.js`).

---

## 1. Versioning Scheme Detail

### 1.1 `versionName` (Semantic Versioning)
We adopt **Semantic Versioning 2.0.0 (`MAJOR.MINOR.PATCH`)**:
- **MAJOR**: Incremented for breaking architecture changes, major UI/UX overhauls, or incompatible API schema changes.
- **MINOR**: Incremented for new user-facing features (e.g., adding Splitwise CSV import, recurring expenses, new settlement payment options).
- **PATCH**: Incremented for bug fixes, performance optimizations, and minor text/style tweaks.

### 1.2 `versionCode` Formula & Android Requirements
Android requires `versionCode` to be a 32-bit positive integer that **strictly increases** with every release uploaded to Google Play or distributed to users. The maximum allowed value by Google Play is $2,147,483,647$ ($2^{31} - 1$).

We derive `versionCode` using a deterministic 6-digit to 8-digit formula:

$$\text{versionCode} = (\text{MAJOR} \times 100000) + (\text{MINOR} \times 1000) + (\text{PATCH} \times 10)$$

#### Version Mapping Examples:
| `versionName` | Calculation | `versionCode` | Description / Milestone |
| :--- | :--- | :--- | :--- |
| `0.1.0` | $(0 \times 100000) + (1 \times 1000) + (0 \times 10)$ | `100` | Current initial development build |
| `1.0.0` | $(1 \times 100000) + (0 \times 1000) + (0 \times 10)$ | `100000` | First Public Release |
| `1.0.1` | $(1 \times 100000) + (0 \times 1000) + (1 \times 10)$ | `100010` | Patch release for bug fix |
| `1.1.0` | $(1 \times 100000) + (1 \times 1000) + (0 \times 10)$ | `101000` | Feature release (e.g. OCR scan) |
| `2.0.0` | $(2 \times 100000) + (0 \times 1000) + (0 \times 10)$ | `200000` | Major release (SplitSaathi v2) |

> **Why the trailing zero ($\times 10$)?**  
> Leaving the last digit reserved ($0-9$) allows hotfix channel builds (e.g., build `100011` for `1.0.1-hotfix1`) without breaking the primary semantic progression.

---

## 2. Dual-Channel Distribution Strategy (Direct APK + Play Store)

### 2.1 App Signing Policy (Recommendation: Option A - Single Key)
Android enforces that an app update will be **rejected by the OS** unless the signature of the new APK matches the signature of the installed APK.

We strongly recommend **Option A: Sign both Direct APK and Play Store uploads with the exact same Upload Key.**

- **Tradeoffs & Advantages**:
  - **Seamless Migration**: A user who downloads `SplitSaathi.apk` directly from `thesplitsaathi.com` today can later click "Update" on the Google Play Store, and Play Store will update the app in-place without losing user data or requiring an uninstall.
  - **Consistent `applicationId`**: Both channels use `in.splitsaathi.mobile`.
  - **Security**: The Keystore private key must be stored securely in CI/CD secrets (e.g., GitHub Secrets / Vault) and backed up safely.

### 2.2 In-App Update Engine Architecture

```
                                  [ SplitSaathi Mobile App ]
                                             │
                                   (App Launch / Foreground)
                                             │
                                  GET /v1/app/version?platform=android&versionCode=100
                                             │
                                             ▼
                                  [ NestJS Backend API ]
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       ▼                                           ▼
             serverVersionCode > client               serverMinVersionCode > client
                       │                                           │
                       ▼                                           ▼
             [ Soft Update Banner ]                     [ Forced Update Modal ]
           ("What's New in v1.0.1")                    ("Critical Update Required")
                       │                                           │
             ┌─────────┴─────────┐                                 │
             ▼                   ▼                                 ▼
    [ Download APK ]     [ Open Play Store ]            [ Block App Access ]
```

#### API Response Schema (`GET /v1/app/version`):
```json
{
  "latestVersionName": "1.0.0",
  "latestVersionCode": 100000,
  "minSupportedVersionCode": 100000,
  "forceUpdate": false,
  "directApkUrl": "https://api-dev.thesplitsaathi.com/downloads/SplitSaathi-debug.apk",
  "playStoreUrl": "https://play.google.com/store/apps/details?id=in.splitsaathi.mobile",
  "releaseNotes": "• Added 1-Click Splitwise Migration\n• Optimized debt simplification\n• Fixed dark mode contrast issues",
  "releasedAt": "2026-08-12"
}
```

---

## 3. Changelog Governance

We maintain a root **`CHANGELOG.md`** following the *Keep a Changelog* standard:

```markdown
# Changelog

All notable changes to the SplitSaathi project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- In-app update check modal for direct APK installations.
- Version check API endpoint `/v1/app/version`.

## [0.1.0] - 2026-08-12
### Added
- Initial development release of SplitSaathi.
- Support for Equal, Exact, Percentage, and Weighted expense splitting.
- Native UPI deep-linking settlement integration.
```

---

## 4. CI & Release Pipeline Automation

### Version Bump Script (`scripts/bump-version.js`)
We provide a simple, automated version bump script:
- `npm run bump:patch` $\rightarrow$ Bumps patch version (e.g. `0.1.0` $\rightarrow$ `0.1.1`, `versionCode: 110`).
- `npm run bump:minor` $\rightarrow$ Bumps minor version (e.g. `0.1.0` $\rightarrow$ `0.2.0`, `versionCode: 2000`).
- `npm run bump:major` $\rightarrow$ Bumps major version (e.g. `0.1.0` $\rightarrow$ `1.0.0`, `versionCode: 100000`).

The script automatically synchronizes:
1. `apps/mobile/version.json`
2. `apps/mobile/app.json` (`version` & `android.versionCode`)

---

## 5. Open Questions & Human Decisions Required

| # | Question / Decision Point | Tradeoffs / Context | Action Required |
| :-: | :--- | :--- | :--- |
| **1** | **Signing Keystore Custody** | Should we generate a dedicated Production Release Keystore now and store it in environment secrets? | **Human Action**: Confirm production keystore passwords and secure storage location. |
| **2** | **Direct APK Sunsetting** | Should direct APK downloads remain available indefinitely alongside Play Store? | **Recommendation**: Keep direct APK alive as a secondary download on `thesplitsaathi.com/downloads/` for India users without Play Store access. |
| **3** | **iOS / App Store Timeline** | Will iOS distribution use TestFlight or App Store link? | `version.json` supports `appStoreUrl` when iOS distribution launches. |

---
*End of Versioning & Distribution Strategy Blueprint.*
