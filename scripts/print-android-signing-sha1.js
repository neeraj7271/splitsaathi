#!/usr/bin/env node
/**
 * Print SHA-1 fingerprints to register as Android OAuth clients in Google Cloud.
 *
 * Usage: node scripts/print-android-signing-sha1.js
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const androidDir = path.join(rootDir, 'apps/mobile/android');
const debugKeystore = path.join(androidDir, 'app/debug.keystore');
const keystorePropsPath = path.join(androidDir, 'keystore.properties');
const releaseKeystoreRel = 'app/splitsaathi-release.jks';

function sha1FromKeystore(keystorePath, storePass, alias) {
  const out = execSync(
    `keytool -list -v -keystore "${keystorePath}" -storepass "${storePass}" -alias "${alias}"`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const match = out.match(/SHA1:\s*([0-9A-F:]+)/i);
  return match ? match[1].toUpperCase() : null;
}

console.log('\nSplitSaathi — Android OAuth SHA-1 fingerprints');
console.log('Package name for every Android OAuth client: in.splitsaathi.mobile\n');

if (fs.existsSync(debugKeystore)) {
  const debugSha1 = sha1FromKeystore(debugKeystore, 'android', 'androiddebugkey');
  console.log('1) Debug builds (local npm run build:apk:debug):');
  console.log(`   ${debugSha1 || '(could not read)'}\n`);
} else {
  console.log('1) Debug keystore not found.\n');
}

if (fs.existsSync(keystorePropsPath)) {
  const props = Object.fromEntries(
    fs
      .readFileSync(keystorePropsPath, 'utf8')
      .split('\n')
      .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
      .map((line) => {
        const idx = line.indexOf('=');
        return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
      })
  );
  const releaseKeystore = path.join(androidDir, props.storeFile || releaseKeystoreRel);
  if (fs.existsSync(releaseKeystore) && props.storePassword && props.keyAlias) {
    const releaseSha1 = sha1FromKeystore(releaseKeystore, props.storePassword, props.keyAlias);
    console.log('2) Release / sideload APK (upload keystore — matches Play upload key):');
    console.log(`   ${releaseSha1 || '(could not read)'}\n`);
  }
} else {
  console.log('2) Release keystore not configured. Run: npm run keystore:generate\n');
}

console.log('3) Play Store installs (REQUIRED for closed testing / production):');
console.log('   Play Console → Test and release → Setup → App signing');
console.log('   Copy SHA-1 under App signing key → Classical key (NOT upload key only).\n');

const { webClientId } = require('./google-oauth.config');
console.log('Web client ID in build scripts (must exist as Web OAuth client in same GCP project):');
console.log(`   ${webClientId}\n`);
