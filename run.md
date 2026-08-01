# SplitSaathi — run commands

## Daily live testing (debug APK + Metro tunnel)

Use this for UI/logic/API testing **without rebuilding** after every change.

### Every day (keep Metro running)

```bash
cd /home/neeraj/Neeraj/Splitsaathi/splitsaathi/apps/mobile
EXPO_NO_METRO_WORKSPACE_ROOT=1 EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0 npx expo start --tunnel --port 8081 --clear
```

When Metro shows something like:
`Metro waiting on exp://xxxx-anonymous-8081.exp.direct`

Copy the host for `strings.xml` (no `exp://`):
`xxxx-anonymous-8081.exp.direct:80`

**Only if the tunnel host changed** since last debug APK build, update:
`apps/mobile/android/app/src/main/res/values/strings.xml`

```xml
<string name="react_native_packager_host">xxxx-anonymous-8081.exp.direct:80</string>
```

Then rebuild debug APK once (see below). If tunnel subdomain is the same as before, skip rebuild.

On phone: open the **debug** app → shake → **Reload** after code changes.

API stays live at `https://api.thesplitsaathi.com` (no Metro needed for API).

---

### One-time: install debug APK on phone

```bash
cd /home/neeraj/Neeraj/Splitsaathi/splitsaathi/apps/mobile/android
./gradlew assembleDebug
cp -f app/build/outputs/apk/debug/app-debug.apk \
  /home/neeraj/Neeraj/Splitsaathi/splitsaathi/deploy/SplitSaathi-debug.apk
```

Download on phone:
`http://65.20.81.44:8099/SplitSaathi-debug.apk`

(If proxy not running: `cd deploy && node metro-apk-proxy.js`)

Uninstall the **release** APK first if install fails (same package name).

In Expo terminal press **`s`** → switch to **development build** (not Expo Go).

---

### When you MUST rebuild debug APK

- Tunnel host changed in `strings.xml`
- Native changes: `AndroidManifest.xml`, new Expo module, permissions, `google-services.json`, `app.json` plugins
- First install on a new phone

You do **not** need to rebuild for: screens, components, API client, styles, most TS/JS logic.

---

## Production APK (standalone, no Metro)

```bash
cd /home/neeraj/Neeraj/Splitsaathi/splitsaathi
npm run mobile:apk

cp -f apps/mobile/android/app/build/outputs/apk/release/app-release.apk \
  deploy/SplitSaathi.apk
```

Use release APK only for final smoke tests / sharing — not for day-to-day dev.
