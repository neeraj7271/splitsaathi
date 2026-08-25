#!/usr/bin/env node
/**
 * Manual APK deploy — no GitHub Actions required.
 *
 * Usage:
 *   node scripts/manual-deploy-apk.js              # build prod APK + upload to GCP VM
 *   node scripts/manual-deploy-apk.js --notify     # patch-bump version, build, upload, FCM broadcast
 *   node scripts/manual-deploy-apk.js --notify --bump=minor
 *   node scripts/manual-deploy-apk.js --notify --skip-bump
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

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--') && !a.startsWith('--bump=')));
const uploadOnly = flags.has('--upload-only');
const notifyOnly = flags.has('--notify-only');
const skipBump = flags.has('--skip-bump');
const notify = flags.has('--notify') || notifyOnly;
const bumpArg = argv.find((a) => a.startsWith('--bump='));
const bumpType = bumpArg ? bumpArg.slice('--bump='.length) : 'patch';

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
    ADMIN_PASSWORD: env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '',
    CLOUDFLARE_ZONE_ID: env.CLOUDFLARE_ZONE_ID || process.env.CLOUDFLARE_ZONE_ID || '',
    CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || ''
  };
}

function sshBase() {
  return `gcloud compute ssh ${config.GCP_USER}@${config.GCP_INSTANCE} --zone=${config.GCP_ZONE} --project=${config.GCP_PROJECT}`;
}

function scpBase() {
  return `gcloud compute scp --zone=${config.GCP_ZONE} --project=${config.GCP_PROJECT}`;
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
      forceUpdate: true
    })
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`broadcast-update failed (${res.status}): ${body}`);
  console.log(body);
}

function purgeCloudflareCache() {
  if (!config.CLOUDFLARE_ZONE_ID || !config.CLOUDFLARE_API_TOKEN) {
    console.log(
      'ℹ️ Cloudflare purge skipped. Set CLOUDFLARE_ZONE_ID + CLOUDFLARE_API_TOKEN in scripts/release.env ' +
        '(or purge manually: Cloudflare → Caching → Purge /downloads/SplitSaathi.apk).'
    );
    return;
  }

  const downloadUrl = `${config.API_URL.replace(/\/$/, '')}/downloads/${config.APK_REMOTE_FILENAME}`;
  console.log(`\n☁️ Purging Cloudflare cache for ${downloadUrl}`);

  const payload = JSON.stringify({ files: [downloadUrl] });
  const result = spawnSync(
    'curl',
    [
      '-fsSL',
      '-X',
      'POST',
      `https://api.cloudflare.com/client/v4/zones/${config.CLOUDFLARE_ZONE_ID}/purge_cache`,
      '-H',
      `Authorization: Bearer ${config.CLOUDFLARE_API_TOKEN}`,
      '-H',
      'Content-Type: application/json',
      '--data',
      payload
    ],
    { encoding: 'utf-8' }
  );

  if (result.status !== 0) {
    throw new Error(`Cloudflare purge failed: ${result.stderr || result.stdout}`);
  }

  console.log(result.stdout.trim() || '✓ Cloudflare cache purged');
}

function verifyServerApk(expected, remoteFinal) {
  const tmp = path.join(os.tmpdir(), `splitsaathi-server-${Date.now()}.apk`);
  console.log(`\n🔎 Verifying APK on VM disk: ${remoteFinal}`);

  run(`${scpBase()} "${config.GCP_USER}@${config.GCP_INSTANCE}:${remoteFinal}" "${tmp}"`);
  try {
    const androidHome = resolveAndroidHome();
    const v = verifyApkVersion(tmp, expected, { androidHome });
    console.log(`✓ VM file OK: versionCode=${v.versionCode}, versionName=${v.versionName}`);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

function verifyLiveApk(expected) {
  const cacheBust = `v=${expected.versionCode}&t=${Date.now()}`;
  const url = `${config.API_URL}/downloads/${config.APK_REMOTE_FILENAME}?${cacheBust}`;
  const tmp = path.join(os.tmpdir(), `splitsaathi-manual-${Date.now()}.apk`);
  console.log(`\n🔎 Verifying public APK URL: ${config.API_URL}/downloads/${config.APK_REMOTE_FILENAME}`);
  execSync(`curl -fsSL -H "Cache-Control: no-cache" -H "Pragma: no-cache" "${url}" -o "${tmp}"`, {
    stdio: 'pipe'
  });
  try {
    const androidHome = resolveAndroidHome();
    const v = verifyApkVersion(tmp, expected, { androidHome });
    console.log(`✓ Public URL OK: versionCode=${v.versionCode}, versionName=${v.versionName}`);
  } catch (error) {
    throw new Error(
      `${error.message}\n\n` +
        'The VM file may be correct while Cloudflare still serves an old cached APK.\n' +
        'Add CLOUDFLARE_ZONE_ID + CLOUDFLARE_API_TOKEN to scripts/release.env, or purge cache in the Cloudflare dashboard.'
    );
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

function bumpVersion() {
  const allowed = new Set(['patch', 'minor', 'major']);
  if (!allowed.has(bumpType) && !/^\d+\.\d+\.\d+$/.test(bumpType)) {
    throw new Error(`Invalid --bump=${bumpType}. Use patch, minor, major, or a semver like 1.0.6.`);
  }

  console.log(`\n🔢 Bumping version (${bumpType})...`);
  run(`node scripts/bump-version.js ${bumpType}`);
}

async function main() {
  console.log('\n📲 Manual APK deploy (no GitHub CI)\n');

  if (notify && !notifyOnly && !uploadOnly && !skipBump) {
    bumpVersion();
  }

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

  run(`${scpBase()} "${localApkPath}" ${scpTarget}`);
  run(
    `${sshBase()} --command="sudo mkdir -p ${config.APK_REMOTE_DIR} && sudo cp ${remoteTmp} ${remoteFinal} && sudo chmod 644 ${remoteFinal}"`
  );

  verifyServerApk(
    {
      versionCode: versionData.versionCode,
      versionName: versionData.versionName
    },
    remoteFinal
  );

  purgeCloudflareCache();

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
