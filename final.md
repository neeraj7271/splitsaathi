# SplitSaathi — Mobile Release Setup Guide (Final)

Complete checklist to configure **GCP server**, **GitHub Actions**, and run your **first production release**.

---

## Quick start — manual deploy (no GitHub CI)

Use this **now** to build locally, copy APK to the server, and test updates. GitHub workflows stay in the repo but you can ignore them.

### One-time on your laptop

```bash
gcloud auth login
gcloud config set project splitsaathi-api
# Java 17 + ANDROID_HOME must be set (same as before)
```

### One-time on GCP VM

Ensure `/var/www/downloads` exists and API container has the volume mount (see Part 1 below).

### Every test release

```bash
# 1) Build prod APK + upload to server + verify live download
npm run deploy:apk

# 2) Optional: tell API the new version + send FCM push
#    (put ADMIN_EMAIL + ADMIN_PASSWORD in scripts/release.env first)
npm run deploy:apk:notify
```

**Re-upload without rebuilding:**

```bash
node scripts/manual-deploy-apk.js --upload-only
```

**Test on phone:** keep old app → open app (update modal) → download/install → reopen (modal gone).

**Ignore for now:** `.github/workflows/*`, GitHub secrets, `GCP_SA_KEY`.

---

## Overview

| Layer | What it does |
|-------|----------------|
| **Server (GCP VM)** | Hosts API, serves APK at `/downloads/SplitSaathi.apk` |
| **GitHub PR workflow** | Builds APK on every mobile PR (`build-mobile-pr.yml`) |
| **GitHub release workflow** | Bump → build → upload → broadcast → commit (`release-mobile.yml`) |
| **Local script** | Same release pipeline from laptop (`npm run release:mobile`) |

**Production URLs**
- API: `https://api.thesplitsaathi.com`
- APK: `https://api.thesplitsaathi.com/downloads/SplitSaathi.apk`

**GCP instance**
- Project: `splitsaathi-api`
- Zone: `asia-south1-c`
- Instance: `spitsaathi-backend-instance`
- SSH user: `appadmin`

---

## Part 1 — Server setup (GCP VM)

Do this **once**, then again whenever API/docker config changes.

### 1.1 Pull latest code on the VM

```bash
gcloud compute ssh appadmin@spitsaathi-backend-instance \
  --zone=asia-south1-c --project=splitsaathi-api \
  --command="cd ~/splitsaathi/splitsaathi && git pull origin dev"
```

### 1.2 Create APK download directory on the host

The API container serves APKs from `/var/www/downloads` (mounted read-only into Docker).

```bash
gcloud compute ssh appadmin@spitsaathi-backend-instance \
  --zone=asia-south1-c --project=splitsaathi-api \
  --command="sudo mkdir -p /var/www/downloads && sudo chmod 755 /var/www/downloads"
```

### 1.3 Rebuild API container (includes downloads volume mount)

From the VM (or via SSH one-liner):

```bash
cd ~/splitsaathi/splitsaathi
docker compose -f deploy/docker-compose.yml up -d --build api
```

**Verify** `deploy/docker-compose.yml` includes:

```yaml
volumes:
  - /var/www/downloads:/var/www/downloads:ro
```

### 1.4 Confirm API serves downloads (after first APK upload)

```bash
curl -I https://api.thesplitsaathi.com/downloads/SplitSaathi.apk
```

Expected:
- `HTTP/2 200`
- `Content-Type: application/vnd.android.package-archive`
- `Cache-Control: no-store` (or similar no-cache headers)

### 1.5 Cloudflare (recommended)

APK responses must not be cached at the CDN.

1. Cloudflare Dashboard → your zone → **Caching** → **Cache Rules**
2. Create rule: URL path starts with `/downloads/` → **Bypass cache**
3. Optional: add `CLOUDFLARE_ZONE_ID` + `CLOUDFLARE_API_TOKEN` to GitHub secrets so releases auto-purge cache

### 1.6 FCM secret on server (if not already done)

Ensure `deploy/secrets/fcm-service-account.json` exists on the VM as a **file** (not a directory) for push broadcasts.

---

## Part 2 — GitHub repository setup

### 2.1 Push all workflow and script changes

Merge to your default branch (`dev` or `main`) so Actions can see:

- `.github/workflows/release-mobile.yml`
- `.github/workflows/build-mobile-pr.yml`
- `scripts/release-mobile.js`, `scripts/build-apk.js`, etc.

### 2.2 Enable workflow permissions

**Settings → Actions → General → Workflow permissions**

- Select **Read and write permissions**
- Allow GitHub Actions to create and approve pull requests (optional; needed for `--commit-version` push)

### 2.3 Add repository secrets

**Settings → Secrets and variables → Actions → Secrets**

| Secret | Required for | How to get it |
|--------|--------------|---------------|
| `MOBILE_GOOGLE_SERVICES_JSON` | PR build + release | Full contents of Firebase `google-services.json` for `in.splitsaathi.mobile` |
| `GCP_SA_KEY` | Release only | GCP service account JSON (see §2.5) |
| `ADMIN_EMAIL` | Release only | Super/ops admin login email |
| `ADMIN_PASSWORD` | Release only | Admin password |
| `ADMIN_JWT` | Release (optional) | Skip login if you paste a valid JWT instead |
| `CLOUDFLARE_ZONE_ID` | Optional | Cloudflare zone ID |
| `CLOUDFLARE_API_TOKEN` | Optional | Token with Cache Purge permission |

**Alternative for Firebase JSON:** use `MOBILE_GOOGLE_SERVICES_JSON_B64` (base64-encoded file) if pasting raw JSON is awkward.

### 2.4 Add repository variables (optional overrides)

**Settings → Secrets and variables → Actions → Variables**

Defaults are fine if you use standard GCP setup. Override only if different:

| Variable | Default |
|----------|---------|
| `GCP_PROJECT` | `splitsaathi-api` |
| `GCP_ZONE` | `asia-south1-c` |
| `GCP_INSTANCE` | `spitsaathi-backend-instance` |
| `GCP_USER` | `appadmin` |
| `API_URL` | `https://api.thesplitsaathi.com` |
| `APK_REMOTE_DIR` | `/var/www/downloads` |
| `APK_REMOTE_FILENAME` | `SplitSaathi.apk` |

### 2.5 Create GCP service account for GitHub Actions

1. **GCP Console → IAM → Service Accounts → Create**
   - Name: `github-mobile-release`
2. **Grant roles** (minimum practical set):
   - `Compute Instance Admin (v1)` — or narrower if you prefer
   - `Compute OS Admin Login` — if VM uses OS Login
   - `Service Account User`
3. **Create JSON key** → download → paste entire file into GitHub secret `GCP_SA_KEY`

**SSH access for `gcloud compute scp`:**

The service account must reach `appadmin@spitsaathi-backend-instance`. Common options:

- **OS Login** enabled on VM + `compute.osAdminLogin` role on SA, or
- Add SA SSH key to project/instance metadata and authorize for user `appadmin`

Test from your laptop (with the same SA key):

```bash
gcloud auth activate-service-account --key-file=sa-key.json
gcloud compute scp deploy/SplitSaathi.apk appadmin@spitsaathi-backend-instance:/tmp/test.apk \
  --zone=asia-south1-c --project=splitsaathi-api
```

### 2.6 Branch protection (recommended)

**Settings → Branches → Add rule** for `dev` / `main`:

- Require status check: **Build Mobile APK (PR)** (after first successful run)
- Require pull request reviews (your preference)

---

## Part 3 — Local setup (optional fallback)

For releases from your laptop instead of GitHub:

```bash
cp scripts/release.env.example scripts/release.env
# Edit: ADMIN_EMAIL, ADMIN_PASSWORD (and GCP values if different)
```

Install on your machine:
- Node 22, Java 17, Android SDK (`ANDROID_HOME`), `aapt` in build-tools
- `gcloud` CLI authenticated

---

## Part 4 — First production release

### Option A — GitHub Actions (recommended)

1. **Actions → Release Mobile APK → Run workflow**
2. Inputs:
   - `bump_type`: **`skip-bump`** (first time only — migrates to unified `versionCode` 100010 without bumping semver)
   - `release_notes`: `Unified version codes and update pipeline`
   - `commit_version_bump`: `false` (if version files already committed)
3. Wait ~30–60 min for Gradle build
4. Check workflow summary for version + download URL

### Option B — Local machine

```bash
npm run release:mobile -- --skip-bump "Unified version codes and update pipeline"
```

### After release — verify

```bash
# 1. Live headers
curl -I https://api.thesplitsaathi.com/downloads/SplitSaathi.apk

# 2. Version in APK
curl -s https://api.thesplitsaathi.com/downloads/SplitSaathi.apk -o /tmp/live.apk
aapt dump badging /tmp/live.apk | head -n 3
# Expect: versionCode='100010' versionName='1.0.1'

# 3. Update API
curl "https://api.thesplitsaathi.com/v1/app/version?versionCode=101"
# Expect: updateAvailable: true, latestVersionCode: 100010

curl "https://api.thesplitsaathi.com/v1/app/version?versionCode=100010"
# Expect: updateAvailable: false
```

Install the new APK on a test device — force-update modal should **not** reappear after install.

---

## Part 5 — Day-to-day usage

### Normal patch release (GitHub)

**Actions → Release Mobile APK → Run workflow**

| Input | Value |
|-------|-------|
| bump_type | `patch` |
| release_notes | Your user-facing notes |
| commit_version_bump | `true` |

### Normal patch release (local)

```bash
npm run release:mobile -- patch "Fixed settle screen totals"
```

### PR validation (automatic)

Any PR touching `apps/mobile/**` triggers **Build Mobile APK (PR)** — no deploy, build-only.

### Release pipeline steps (both local & CI)

1. Bump `apps/mobile/version.json` + `app.json`
2. `clean assembleRelease` + embed JS bundle
3. `aapt` verify version matches `version.json`
4. SCP APK → VM `/var/www/downloads/SplitSaathi.apk`
5. Optional Cloudflare purge
6. Verify live APK via download + `aapt`
7. `POST /v1/app/broadcast-update` (admin JWT) → FCM to all devices
8. Optional: commit version bump to git

---

## Part 6 — Version numbering reference

Single formula everywhere:

```
versionCode = (MAJOR × 100000) + (MINOR × 1000) + (PATCH × 10)
```

| versionName | versionCode |
|-------------|-------------|
| 1.0.0 | 100000 |
| 1.0.1 | 100010 |
| 1.0.2 | 100020 |
| 1.1.0 | 101000 |

Source of truth: `apps/mobile/version.json` (Gradle reads this for the APK).

---

## Part 7 — Troubleshooting

| Problem | Fix |
|---------|-----|
| Force-update modal after installing | APK `versionCode` ≠ server `latestVersionCode` — rerun release with correct bump; verify with `aapt` |
| `broadcast-update` returns 401 | Add `ADMIN_EMAIL`/`ADMIN_PASSWORD` secrets; redeploy API with admin auth change |
| PR build fails: no google-services | Add `MOBILE_GOOGLE_SERVICES_JSON` secret |
| Release SCP fails | Fix GCP SA IAM / OS Login; test `gcloud compute scp` locally |
| Download returns old APK | Purge Cloudflare cache; confirm file on VM: `ls -la /var/www/downloads/` |
| Fork PR skips build | Expected — secrets unavailable on forks; merge from branch in same repo |
| Gradle fails in CI | Check **Build Mobile APK (PR)** logs; often missing SDK or google-services |

---

## Part 8 — Setup checklist (printable)

**Server**
- [ ] `/var/www/downloads` exists on GCP VM
- [ ] API container rebuilt with downloads volume mount
- [ ] FCM service account JSON is a valid file on VM
- [ ] Cloudflare bypass cache for `/downloads/*`

**GitHub**
- [ ] Workflow permissions: read + write
- [ ] Secret: `MOBILE_GOOGLE_SERVICES_JSON`
- [ ] Secret: `GCP_SA_KEY`
- [ ] Secrets: `ADMIN_EMAIL` + `ADMIN_PASSWORD`
- [ ] Optional: Cloudflare secrets
- [ ] Branch protection requires PR build check

**First release**
- [ ] Run release workflow (or local script)
- [ ] Verify live APK with `aapt`
- [ ] Verify `/v1/app/version` responses
- [ ] Test install on device — modal clears after update

**Ongoing**
- [ ] Use GitHub **Release Mobile APK** for each production release
- [ ] PRs auto-build via **Build Mobile APK (PR)**

---

*Last updated: August 2026 — matches release pipeline Phases 0–4.*
