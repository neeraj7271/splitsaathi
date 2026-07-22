# SplitSaathi Mobile

Expo React Native client. Talks to the hosted API via `EXPO_PUBLIC_API_URL` in `apps/mobile/.env`.

## Firebase / Google Services (Android)

`app.json` does **not** set `android.googleServicesFile` by default. Expo prebuild fails if that path points at a missing file.

Before a native Android build that needs FCM / Firebase:

1. Place your Firebase `google-services.json` at `apps/mobile/google-services.json`
2. Add to `app.json` under `expo.android`:

```json
"googleServicesFile": "./google-services.json"
```

Then run prebuild / `expo run:android` again.

## Brand assets

Source files live in `public/assets/` and are mirrored under `assets/brand/` for the app:

| File | Use |
|------|-----|
| `logo-mark.png` | App icon / adaptive icon / compact UI mark |
| `logo-wordmark.png` | Header & auth wordmark |
| `logo-lockup.png` | Splash, loading, welcome hero |

Change launcher icon/splash in a native rebuild (`expo run:android` or release APK). In-app logos reload via Metro.

| Mode | When | Command |
|------|------|---------|
| **Expo / Metro (default)** | Day-to-day testing — no rebuild | `npm run dev:mobile` |
| **Release APK** | Only when you ask for production testing | `npm run mobile:apk` |

### Daily testing (Expo / Metro)

```bash
# from repo root
npm run dev:mobile
# if the phone cannot reach this machine on LAN / public IP:
npm run dev:mobile:tunnel
```

Metro serves JS over the network. After code changes: shake device → **Reload** (or leave Fast Refresh on).

**One-time:** install a **debug** build that can load Metro (release APKs embed JS and ignore Metro):

```bash
# USB device attached to this machine:
npm run android:device -w @splitsaathi/mobile

# or install deploy/SplitSaathi-dev.apk on the phone, then in the app:
# Dev settings → Debug server host & port → <this-machine-ip>:8081
```

API calls still go to `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` (hosted API).

### Production / store-style APK (only on request)

```bash
npm run mobile:apk
# → apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

Do **not** rebuild the release APK for every small change while iterating in Expo.
