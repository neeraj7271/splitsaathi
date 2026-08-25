# SplitSaathi - Detailed Technical Session Log & Context Document

---

## 1. Overview & System Context

This document captures the complete, itemized record of all architectural updates, bug diagnoses, code fixes, environment configurations, security enhancements, build procedures, and **direct GCP server deployment steps** completed for **SplitSaathi**.

---

## 2. Comprehensive Problem, Diagnosis, & Solution Log

### 🛠️ Problem 1: 401 Unauthorized in Swagger UI on Admin Endpoints
- **Symptoms**: After logging in and pasting the admin JWT token into the Swagger UI "Authorize" dialog, requests to `/v1/admin/*` routes consistently failed with `401 Unauthorized: Missing admin bearer token`.
- **Root Cause**: In `apps/api/src/swagger/setup-swagger.ts`, Swagger OpenAPI builder was configured with `.addBearerAuth()` (scheme name `'bearer'`). However, the Admin controllers (`@ApiBearerAuth('admin-auth')`) and `AdminJwtAuthGuard` expected the security scheme key to be named `'admin-auth'`. Swagger UI was omitting the Authorization header for admin requests.
- **Solution**:
  Updated `setup-swagger.ts` to register both security schemes:
  ```typescript
  const documentConfig = new DocumentBuilder()
    .setTitle('SplitSaathi API')
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'admin-auth')
    .build();
  ```

---

### 🛠️ Problem 2: Swagger UI Showing "No parameters" & Missing Interactive Payloads
- **Symptoms**: Admin `POST`, `PUT`, and `PATCH` endpoints in Swagger displayed "No parameters" without interactive body payload forms.
- **Root Cause**: Controller method parameters used inline TypeScript types or raw `@Body() body: any` / `@Body() body: Record<string, any>`, preventing NestJS Swagger metadata reflection from generating JSON schemas.
- **Solution**: Created explicit DTO classes with `@ApiProperty()` / `@ApiPropertyOptional()` decorators and linked them to controllers using `@ApiBody({ type: DtoClass })`:
  1. `apps/api/src/modules/app-version/dto/broadcast-update.dto.ts` (`BroadcastUpdateDto`)
  2. `apps/api/src/modules/admin/config-flags/dto/config-flags.dto.ts` (`UpsertFeatureFlagDto`, `UpdateAppConfigDto`)
  3. `apps/api/src/modules/admin/support/dto/support.dto.ts` (`ReplyTicketDto`, `UpdateTicketStatusDto`, `RetryJobDto`)
  4. `apps/api/src/modules/admin/management/dto/admin-management.dto.ts` (`CreateAdminUserDto`, `UpdateAdminUserDto`)

---

### 🛠️ Problem 3: Initial Super Admin Credentials Missing in Production Database
- **Symptoms**: Login requests to `/v1/admin/auth/login` failed with `401 Invalid admin credentials`.
- **Root Cause**: Fresh database deployment lacked an initial super admin record in PostgreSQL.
- **Solution**: Created `scripts/create-admin.js` to seed initial super admin user:
  - **Email**: `neeraj8829sini@gmail.com`
  - **Password**: `Github@773408`
  - **Role**: `super_admin`

---

### 🛠️ Problem 4: `500 EISDIR: illegal operation on a directory, read` on Broadcast Endpoint
- **Symptoms**: Executing `POST /v1/app/broadcast-update` returned `500 Internal Server Error` with `message: "EISDIR: illegal operation on a directory, read"`.
- **Root Cause**: In `deploy/docker-compose.yml`, Docker mounted `./secrets/fcm-service-account.json:/run/secrets/fcm-service-account.json`. Because `./secrets/fcm-service-account.json` did not exist on the host server at initial startup, Docker created it as a **directory**. Calling `fs.readFileSync(path)` inside `fcm-push.provider.ts` threw `EISDIR`.
- **Solution**:
  Added safety checks using `existsSync()` and `statSync().isFile()` in `fcm-push.provider.ts` and `app-version.service.ts`:
  ```typescript
  private loadServiceAccount(): ServiceAccount | null {
    try {
      const json = this.config.env.FCM_SERVICE_ACCOUNT_JSON?.trim();
      if (json) return JSON.parse(json) as ServiceAccount;

      const path = this.config.env.FCM_SERVICE_ACCOUNT_PATH?.trim();
      if (path && existsSync(path) && statSync(path).isFile()) {
        return JSON.parse(readFileSync(path, 'utf8')) as ServiceAccount;
      }
    } catch (error) {
      this.logger.warn(`Failed to load FCM service account: ${error}`);
    }
    return null;
  }
  ```

---

### 🛠️ Problem 5: `POST /v1/app/broadcast-update` Not Persisting Server Version to Database
- **Symptoms**: Calling `POST /v1/app/broadcast-update` sent FCM push notifications, but client `GET /v1/app/version` still returned the old version details.
- **Root Cause**: `AppVersionService` relied solely on static `version.json` without updating the PostgreSQL `admin_app_configs` table.
- **Solution**: Updated `AppVersionModule` to import `TypeOrmModule.forFeature([AdminAppConfigEntity])` and updated `AppVersionService` to dynamically read/write version configurations to PostgreSQL.

---

### 🛠️ Problem 6: Force Update Modal Persisting After App Update Installation
- **Symptoms**: User downloaded and installed the `v1.0.1` update APK, but the modal popped up again on launch.
- **Root Causes**:
  1. `apps/mobile/version.json` in the codebase still had `"versionCode": 100`, so the compiled APK had `versionCode: 100`.
  2. In `AppVersionService`, `forceUpdate` evaluated `forceUpdateEnabled || (clientCode < minSupportedVersionCode)`. When `forceUpdateEnabled` was `true` in DB, `forceUpdate` evaluated to `true` for **all** clients regardless of `clientCode`.
- **Solutions**:
  1. Updated `AppVersionService` force update calculation:
     ```typescript
     const forceUpdate = clientCode > 0
       ? (forceUpdateEnabled && clientCode < latestVersionCode) || clientCode < minSupportedVersionCode
       : forceUpdateEnabled;
     ```
  2. Bumped mobile project version to `1.0.1` (`versionCode: 101`):
     ```bash
     node scripts/bump-version.js 1.0.1 "Updated release with fixes"
     ```
  3. Recompiled APK (`node scripts/build-apk.js prod`) and verified embedded Android manifest via `aapt`:
     ```text
     package: name='in.splitsaathi.mobile' versionCode='101' versionName='1.0.1'
     ```

---

### 🛠️ Problem 7: Cloudflare Security Center Recommendations
- **Findings**:
  - `Security.txt not configured`
  - `Bot Fight Mode not enabled`
  - `Review unwanted AI crawlers with AI Labyrinth`
- **Solution**:
  - Implemented RFC 9116 compliant endpoint in `apps/api/src/modules/groups/well-known.controller.ts`:
    `GET https://api.thesplitsaathi.com/.well-known/security.txt`
  - Configured setup steps for Cloudflare Dashboard (Security > Bots > Bot Fight Mode & AI Labyrinth).

---

## 3. Direct GCP Deployment Architecture & Execution Flow

### GCP Instance Metadata
- **GCP Project ID**: `splitsaathi-api`
- **Compute Instance**: `spitsaathi-backend-instance`
- **Zone**: `asia-south1-c`
- **User**: `appadmin`
- **Production API URL**: `https://api.thesplitsaathi.com`
- **Production APK URL**: `https://api.thesplitsaathi.com/downloads/SplitSaathi.apk`

---

### Step-by-Step Guide: Pushing App Directly to GCP Server

#### Step 1: Authenticate Google Cloud CLI
Log in to your GCP account locally:
```bash
gcloud auth login
```
*(Select account: `neerajsuman766@gmail.com`)*

#### Step 2: Set Active GCP Project
Set the active GCP project context to `splitsaathi-api`:
```bash
gcloud config set project splitsaathi-api
```

#### Step 3: Build Production APK Locally
Run the production build script to compile the release APK with the target API URL (`https://api.thesplitsaathi.com`):
```bash
node scripts/build-apk.js prod
```
*Output*: Generates `deploy/SplitSaathi.apk` (Size: `29.24 MB`, `versionCode: 101`, `versionName: 1.0.1`).

#### Step 4: Transfer APK File Directly to GCP VM (via `gcloud compute scp`)
Upload the compiled APK directly to the `/tmp` directory on the GCP Compute Engine instance:
```bash
gcloud compute scp deploy/SplitSaathi.apk appadmin@spitsaathi-backend-instance:/tmp/SplitSaathi.apk --zone=asia-south1-c --project=splitsaathi-api
```

#### Step 5: Publish APK to Nginx Web Root on GCP Server (via `gcloud compute ssh`)
Execute remote SSH commands to ensure `/var/www/downloads` exists, copy the uploaded APK into place, and set public read permissions:
```bash
gcloud compute ssh appadmin@spitsaathi-backend-instance --zone=asia-south1-c --project=splitsaathi-api --command="sudo mkdir -p /var/www/downloads && sudo cp /tmp/SplitSaathi.apk /var/www/downloads/SplitSaathi.apk && sudo chmod 644 /var/www/downloads/SplitSaathi.apk"
```

#### Step 6: Deploy Backend Code Updates & Restart API Container
Pull the latest code from `origin dev` and rebuild the NestJS API container:
```bash
gcloud compute ssh appadmin@spitsaathi-backend-instance --zone=asia-south1-c --project=splitsaathi-api --command="cd ~/splitsaathi/splitsaathi && git pull origin dev && docker compose -f deploy/docker-compose.yml up -d --build api"
```

---

## 4. Verification & Audit Commands

### 1. Verify Live Download HTTP Headers
```bash
curl -I https://api.thesplitsaathi.com/downloads/SplitSaathi.apk
```
*Expected Response*:
```http
HTTP/2 200 
Content-Type: application/vnd.android.package-archive
Content-Length: 30659126
Server: cloudflare
```

### 2. Verify Live APK Version & Manifest Metadata (via `aapt`)
Download the live production APK and dump its Android manifest:
```bash
curl -s https://api.thesplitsaathi.com/downloads/SplitSaathi.apk -o /tmp/live_test.apk && aapt dump badging /tmp/live_test.apk | head -n 5
```
*Output*:
```text
package: name='in.splitsaathi.mobile' versionCode='101' versionName='1.0.1' platformBuildVersionName='16' platformBuildVersionCode='36' compileSdkVersion='36'
```

---

## 5. End-to-End Release Command Pipeline for Future Updates

When deploying a new app update (e.g., `v1.0.2`):

```bash
# 1. Bump version locally
node scripts/bump-version.js 1.0.2 "Release notes description"

# 2. Build production APK
node scripts/build-apk.js prod

# 3. Commit and push code changes
git add .
git commit -m "bump version to v1.0.2"
git push origin dev

# 4. Upload APK directly to GCP VM instance
gcloud compute scp deploy/SplitSaathi.apk appadmin@spitsaathi-backend-instance:/tmp/SplitSaathi.apk --zone=asia-south1-c --project=splitsaathi-api

# 5. Move APK to Nginx web root on GCP VM
gcloud compute ssh appadmin@spitsaathi-backend-instance --zone=asia-south1-c --project=splitsaathi-api --command="sudo cp /tmp/SplitSaathi.apk /var/www/downloads/SplitSaathi.apk && sudo chmod 644 /var/www/downloads/SplitSaathi.apk"

# 6. Rebuild API Docker container on GCP VM
gcloud compute ssh appadmin@spitsaathi-backend-instance --zone=asia-south1-c --project=splitsaathi-api --command="cd ~/splitsaathi/splitsaathi && git pull origin dev && docker compose -f deploy/docker-compose.yml up -d --build api"
```
