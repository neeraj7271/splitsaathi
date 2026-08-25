#!/usr/bin/env node
/**
 * Manual APK deploy — no GitHub Actions required.
 *
 * Usage:
 *   node scripts/manual-deploy-apk.js              # build prod APK + upload to GCP VM
 *   node scripts/manual-deploy-apk.js --notify     # also call broadcast-update (needs release.env admin creds)
 *   node scripts/manual-deploy-apk.js --notify-only  # broadcast only (APK already on server)
 *
 * Requires on your laptop:
 *   - gcloud CLI logged in (gcloud auth login)
 *   - Java 17 + ANDROID_HOME for builds
 */
const { execSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readVersionJson, verifyApkVersion, resolveAndroidHome } = require('./version-utils');

const rootDir = path.join(__dirname, '..');
const releaseEnvPath = path.join(__dirname, 'release.env');
const localApkPath = path.join(rootDir, 'deploy/SplitSaathi.apk');

const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith('--')));
const uploadOnly = flags.has('--upload-only');
const notifyOnly = flags.has('--notify-only');
const notify = flags.has('--notify') || notifyOnly;

const config = loadReleaseEnv();

function loadReleaseEnv() {
  const env = {};
  if (fs.existsSync(releaseEnvPath)) {
    for (const line of fs.readFileSync(releaseEnvPath, 'utf-8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const i = trimmed.indexOf('=');
      if (i === -1) continue;
      env[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim();
    }
  }
  return {
    GCP_PROJECT: env.GCP_PROJECT || process.env.GCP_PROJECT || 'splitsaathi-api',
    GCP_ZONE: env.GCP_ZONE || process.env.GCP_ZONE || 'asia-south1-c',
    GCP_INSTANCE: env.GCP_INSTANCE || process.env.GCP_INSTANCE || 'spitsaathi-backend-instance',
    GCP_USER: env.GCP_USER || process.env.GCP_USER || 'appadmin',
    API_URL: env.API_URL || process.env.API_URL || 'https://api.thesplitsaathi.com',
    APK_REMOTE_DIR: env.APK_REMOTE_DIR || '/var/www/downloads',
    APK_REMOTE_FILENAME: env.APK_REMOTE_FILENAME || 'SplitSaathi.apk',
    ADMIN_JWT: env.ADMIN_JWT || process.env.ADMIN_JWT || '',
    ADMIN_EMAIL: env.ADMIN_EMAIL || process.env.ADMIN_EMAIL || '',
    ADMIN_PASSWORD: env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || ''
  };
}

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { cwd: rootDir, stdio: 'inherit' });
}

async function resolveAdminJwt() {
  if (config.ADMIN_JWT) return config.ADMIN_JWT;
  if (!config.ADMIN_EMAIL || !config.ADMIN_PASSWORD) {
    throw new Error('Set ADMIN_EMAIL + ADMIN_PASSWORD in scripts/release.env (or use --notify only after configuring).');
  }
  const res = await fetch(`${config.API_URL}/v1/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: config.ADMIN_EMAIL, password: config.ADMIN_PASSWORD })
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Admin login failed (${res.status}): ${body}`);
  const parsed = JSON.parse(body);
  return parsed.accessToken;
}

async function notifyUsers(versionData) {
  const token = await resolveAdminJwt();
  const res = await fetch(`${config.API_URL}/v1/app/broadcast-update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      versionName: versionData.versionName,
      versionCode: versionData.versionCode,
      minSupportedVersionCode: versionData.minSupportedVersionCode,
      releaseNotes: versionData.releaseNotes,
      forceUpdate: false
    })
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`broadcast-update failed (${res.status}): ${body}`);
  console.log(body);
}

function verifyLiveApk(expected) {
  const url = `${config.API_URL}/downloads/${config.APK_REMOTE_FILENAME}`;
  const tmp = path.join(os.tmpdir(), `splitsaathi-manual-${Date.now()}.apk`);
  console.log(`\n🔎 Verifying live APK: ${url}`);
  execSync(`curl -fsSL "${url}" -o "${tmp}"`, { stdio: 'pipe' });
  try {
    const androidHome = resolveAndroidHome();
    const v = verifyApkVersion(tmp, expected, { androidHome });
    console.log(`✓ Live APK OK: versionCode=${v.versionCode}, versionName=${v.versionName}`);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

function printTestSteps(versionData) {
  console.log('\n--- Test update flow on your phone ---');
  console.log(`1. Keep OLD app installed (or install an older APK first).`);
  console.log(`2. Open app → update modal should appear if client versionCode < ${versionData.versionCode}.`);
  console.log(`3. Tap download → install ${versionData.versionName} (${versionData.versionCode}).`);
  console.log(`4. Re-open app → modal should disappear.`);
  console.log(`\nCheck API manually:`);
  console.log(`  curl "${config.API_URL}/v1/app/version?versionCode=101"`);
  console.log(`  curl "${config.API_URL}/v1/app/version?versionCode=${versionData.versionCode}"`);
  console.log(`\nDownload URL: ${config.API_URL}/downloads/${config.APK_REMOTE_FILENAME}`);
  if (!notify) {
    console.log(`\nTo update server version + send push: run again with --notify`);
    console.log(`  (requires ADMIN_EMAIL/PASSWORD in scripts/release.env)`);
  }
}

async function main() {
  console.log('\n📲 Manual APK deploy (no GitHub CI)\n');

  const versionData = readVersionJson();

  if (notifyOnly) {
    console.log(`\n📣 Notify-only: v${versionData.versionName} (versionCode=${versionData.versionCode})`);
    console.log('\n📣 Updating server version + FCM broadcast...');
    await notifyUsers(versionData);
    printTestSteps(versionData);
    console.log('\n✅ Notify complete.\n');
    return;
  }

  if (!uploadOnly) {
    run('node scripts/build-apk.js prod');
  } else if (!fs.existsSync(localApkPath)) {
    throw new Error(`--upload-only but missing ${localApkPath}`);
  }

  console.log(`\n📌 Deploying v${versionData.versionName} (versionCode=${versionData.versionCode})`);

  const remoteTmp = `/tmp/${config.APK_REMOTE_FILENAME}`;
  const remoteFinal = `${config.APK_REMOTE_DIR}/${config.APK_REMOTE_FILENAME}`;
  const scpTarget = `${config.GCP_USER}@${config.GCP_INSTANCE}:${remoteTmp}`;
  const ssh = `gcloud compute ssh ${config.GCP_USER}@${config.GCP_INSTANCE} --zone=${config.GCP_ZONE} --project=${config.GCP_PROJECT}`;

  run(
    `gcloud compute scp "${localApkPath}" ${scpTarget} --zone=${config.GCP_ZONE} --project=${config.GCP_PROJECT}`
  );
  run(
    `${ssh} --command="sudo mkdir -p ${config.APK_REMOTE_DIR} && sudo cp ${remoteTmp} ${remoteFinal} && sudo chmod 644 ${remoteFinal}"`
  );

  verifyLiveApk({
    versionCode: versionData.versionCode,
    versionName: versionData.versionName
  });

  if (notify) {
    console.log('\n📣 Updating server version + FCM broadcast...');
    await notifyUsers(versionData);
  }

  printTestSteps(versionData);
  console.log('\n✅ Manual deploy complete.\n');
}

main().catch((err) => {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
});
