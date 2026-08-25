#!/usr/bin/env node
const { execSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readVersionJson, verifyApkVersion } = require('./version-utils');

const rootDir = path.join(__dirname, '..');
const releaseEnvPath = path.join(__dirname, 'release.env');
const localApkPath = path.join(rootDir, 'deploy/SplitSaathi.apk');

function loadReleaseEnv() {
  const env = {};

  if (fs.existsSync(releaseEnvPath)) {
    const lines = fs.readFileSync(releaseEnvPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const separator = trimmed.indexOf('=');
      if (separator === -1) {
        continue;
      }

      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim();
      env[key] = value;
    }
  }

  return {
    GCP_PROJECT: env.GCP_PROJECT || process.env.GCP_PROJECT || 'splitsaathi-api',
    GCP_ZONE: env.GCP_ZONE || process.env.GCP_ZONE || 'asia-south1-c',
    GCP_INSTANCE: env.GCP_INSTANCE || process.env.GCP_INSTANCE || 'spitsaathi-backend-instance',
    GCP_USER: env.GCP_USER || process.env.GCP_USER || 'appadmin',
    API_URL: env.API_URL || process.env.API_URL || 'https://api.thesplitsaathi.com',
    APK_REMOTE_DIR: env.APK_REMOTE_DIR || process.env.APK_REMOTE_DIR || '/var/www/downloads',
    APK_REMOTE_FILENAME: env.APK_REMOTE_FILENAME || process.env.APK_REMOTE_FILENAME || 'SplitSaathi.apk',
    CLOUDFLARE_ZONE_ID: env.CLOUDFLARE_ZONE_ID || process.env.CLOUDFLARE_ZONE_ID || '',
    CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '',
    ADMIN_JWT: env.ADMIN_JWT || process.env.ADMIN_JWT || '',
    ADMIN_EMAIL: env.ADMIN_EMAIL || process.env.ADMIN_EMAIL || '',
    ADMIN_PASSWORD: env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || ''
  };
}

function parseArgs(argv) {
  const flags = new Set();
  const positional = [];

  for (const arg of argv) {
    if (arg.startsWith('--')) {
      flags.add(arg);
    } else {
      positional.push(arg);
    }
  }

  const skipBump = flags.has('--skip-bump');
  let bumpType = 'patch';
  let releaseNotes = '';

  if (skipBump) {
    releaseNotes = positional[0] || '';
  } else {
    bumpType = positional[0] || 'patch';
    releaseNotes = positional[1] || '';
  }

  return {
    bumpType,
    releaseNotes,
    skipUpload: flags.has('--skip-upload'),
    skipBroadcast: flags.has('--skip-broadcast'),
    skipBump,
    dryRun: flags.has('--dry-run'),
    commitVersion: flags.has('--commit-version')
  };
}

function run(command, options = {}) {
  console.log(`\n$ ${command}`);
  if (options.dryRun) {
    return '';
  }

  return execSync(command, {
    cwd: options.cwd || rootDir,
    encoding: 'utf-8',
    stdio: options.stdio || 'inherit',
    env: options.env || process.env
  });
}

function runNodeScript(scriptPath, args = [], options = {}) {
  const command = `node "${scriptPath}" ${args.map((arg) => `"${arg.replace(/"/g, '\\"')}"`).join(' ')}`.trim();
  run(command, options);
}

async function resolveAdminJwt(config) {
  if (config.ADMIN_JWT) {
    return config.ADMIN_JWT;
  }

  if (!config.ADMIN_EMAIL || !config.ADMIN_PASSWORD) {
    throw new Error(
      'Missing admin credentials. Set ADMIN_JWT or ADMIN_EMAIL + ADMIN_PASSWORD in scripts/release.env.'
    );
  }

  console.log(`\n🔐 Logging in admin user ${config.ADMIN_EMAIL}`);
  const response = await fetch(`${config.API_URL}/v1/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: config.ADMIN_EMAIL,
      password: config.ADMIN_PASSWORD
    })
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Admin login failed (${response.status}): ${body}`);
  }

  const parsed = JSON.parse(body);
  if (!parsed.accessToken) {
    throw new Error('Admin login succeeded but accessToken was missing.');
  }

  return parsed.accessToken;
}

async function broadcastUpdate(config, versionData, options = {}) {
  const payload = {
    versionName: versionData.versionName,
    versionCode: versionData.versionCode,
    minSupportedVersionCode: versionData.minSupportedVersionCode,
    releaseNotes: versionData.releaseNotes,
    forceUpdate: false
  };

  console.log(`\n📣 Broadcasting update via ${config.API_URL}/v1/app/broadcast-update`);
  if (options.dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const adminJwt = await resolveAdminJwt(config);
  const response = await fetch(`${config.API_URL}/v1/app/broadcast-update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminJwt}`
    },
    body: JSON.stringify(payload)
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`broadcast-update failed (${response.status}): ${body}`);
  }

  console.log(body);
}

function verifyLiveApk(apiUrl, expected, options = {}) {
  const downloadUrl = `${apiUrl}/downloads/${path.basename(localApkPath)}`;
  const tempApkPath = path.join(os.tmpdir(), `splitsaathi-live-${Date.now()}.apk`);

  console.log(`\n🔎 Verifying live APK at ${downloadUrl}`);
  if (options.dryRun) {
    return;
  }

  run(`curl -fsSL "${downloadUrl}" -o "${tempApkPath}"`, { stdio: 'pipe' });

  try {
    const verified = verifyApkVersion(tempApkPath, expected, {
      androidHome: process.env.ANDROID_HOME
    });
    console.log(`✓ Live APK verified: versionCode=${verified.versionCode}, versionName=${verified.versionName}`);
  } finally {
    if (fs.existsSync(tempApkPath)) {
      fs.rmSync(tempApkPath, { force: true });
    }
  }
}

function purgeCloudflareCache(config, apiUrl, options = {}) {
  if (!config.CLOUDFLARE_ZONE_ID || !config.CLOUDFLARE_API_TOKEN) {
    console.log('ℹ️ Cloudflare purge skipped (set CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN in scripts/release.env).');
    return;
  }

  const downloadPath = new URL(`${apiUrl}/downloads/${config.APK_REMOTE_FILENAME}`).pathname;
  console.log(`\n☁️ Purging Cloudflare cache for ${downloadPath}`);

  if (options.dryRun) {
    return;
  }

  const payload = JSON.stringify({ files: [downloadPath] });
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

function commitVersionBump(versionData, options = {}) {
  const files = ['apps/mobile/version.json', 'apps/mobile/app.json'];
  const message = `chore(mobile): release v${versionData.versionName}`;

  console.log(`\n📝 Committing version bump: ${message}`);
  if (options.dryRun) {
    return;
  }

  run(`git add ${files.join(' ')}`);

  const diffResult = spawnSync('git', ['diff', '--staged', '--quiet'], {
    cwd: rootDir,
    encoding: 'utf-8'
  });

  if (diffResult.status === 0) {
    console.log('ℹ️ No version file changes to commit.');
    return;
  }

  run(`git -c user.name="github-actions[bot]" -c user.email="41898282+github-actions[bot]@users.noreply.github.com" commit -m "${message.replace(/"/g, '\\"')}"`);
  run('git push');
  console.log('✓ Version bump committed and pushed.');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadReleaseEnv();

  if (!fs.existsSync(releaseEnvPath) && !args.skipUpload) {
    console.warn(`⚠️ scripts/release.env not found. Copy scripts/release.env.example and adjust values.`);
    console.warn('   Continuing with defaults from context.md / release.env.example.');
  }

  console.log('\n🚢 SplitSaathi mobile release pipeline');
  console.log(`• Bump: ${args.skipBump ? 'skipped' : args.bumpType}`);
  console.log(`• Upload: ${args.skipUpload ? 'skipped' : 'enabled'}`);
  console.log(`• Broadcast: ${args.skipBroadcast ? 'skipped' : 'enabled'}`);
  console.log(`• Commit version: ${args.commitVersion ? 'enabled' : 'skipped'}`);

  if (!args.skipBump) {
    const bumpArgs = [args.bumpType];
    if (args.releaseNotes) {
      bumpArgs.push(args.releaseNotes);
    }
    runNodeScript(path.join(__dirname, 'bump-version.js'), bumpArgs, { dryRun: args.dryRun });
  } else if (args.releaseNotes) {
    const versionData = readVersionJson();
    versionData.releaseNotes = args.releaseNotes;
    fs.writeFileSync(path.join(rootDir, 'apps/mobile/version.json'), JSON.stringify(versionData, null, 2) + '\n');
    console.log(`✓ Updated release notes in apps/mobile/version.json`);
  }

  const versionData = readVersionJson();
  console.log(`\n📌 Release target: v${versionData.versionName} (versionCode=${versionData.versionCode})`);

  runNodeScript(path.join(__dirname, 'build-apk.js'), ['prod'], { dryRun: args.dryRun });

  if (args.dryRun) {
    console.log('\n✓ Dry run complete.');
    return;
  }

  if (!fs.existsSync(localApkPath)) {
    throw new Error(`Expected APK missing at ${localApkPath}`);
  }

  if (!args.skipUpload) {
    const remoteTmpPath = `/tmp/${config.APK_REMOTE_FILENAME}`;
    const remoteFinalPath = `${config.APK_REMOTE_DIR}/${config.APK_REMOTE_FILENAME}`;
    const scpTarget = `${config.GCP_USER}@${config.GCP_INSTANCE}:${remoteTmpPath}`;
    const sshBase = `gcloud compute ssh ${config.GCP_USER}@${config.GCP_INSTANCE} --zone=${config.GCP_ZONE} --project=${config.GCP_PROJECT}`;

    run(
      `gcloud compute scp "${localApkPath}" ${scpTarget} --zone=${config.GCP_ZONE} --project=${config.GCP_PROJECT}`
    );

    run(
      `${sshBase} --command="sudo mkdir -p ${config.APK_REMOTE_DIR} && sudo cp ${remoteTmpPath} ${remoteFinalPath} && sudo chmod 644 ${remoteFinalPath}"`
    );

    purgeCloudflareCache(config, config.API_URL);
    verifyLiveApk(config.API_URL, {
      versionCode: versionData.versionCode,
      versionName: versionData.versionName
    });
  }

  if (!args.skipBroadcast) {
    await broadcastUpdate(config, versionData, { dryRun: args.dryRun });
  }

  if (args.commitVersion) {
    commitVersionBump(versionData, { dryRun: args.dryRun });
  }

  console.log('\n✅ Release complete.');
  console.log(`Users below versionCode ${versionData.versionCode} will be prompted to update.`);
  console.log(`Download URL: ${config.API_URL}/downloads/${config.APK_REMOTE_FILENAME}`);
}

main().catch((error) => {
  console.error(`\n❌ Release failed: ${error.message}`);
  process.exit(1);
});
