#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const versionJsonPath = path.join(__dirname, '../apps/mobile/version.json');
const appJsonPath = path.join(__dirname, '../apps/mobile/app.json');

const bumpType = process.argv[2] || 'patch';

if (!fs.existsSync(versionJsonPath)) {
  console.error(`Error: version.json not found at ${versionJsonPath}`);
  process.exit(1);
}

const versionData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'));
const currentVersionName = versionData.versionName || '0.1.0';

let [major, minor, patch] = currentVersionName.split('.').map(Number);
major = major || 0;
minor = minor || 0;
patch = patch || 0;

if (bumpType === 'major') {
  major += 1;
  minor = 0;
  patch = 0;
} else if (bumpType === 'minor') {
  minor += 1;
  patch = 0;
} else if (bumpType === 'patch') {
  patch += 1;
} else if (/^\d+\.\d+\.\d+$/.test(bumpType)) {
  [major, minor, patch] = bumpType.split('.').map(Number);
} else {
  console.error(`Invalid bump type: "${bumpType}". Use "patch", "minor", "major", or a semver string like "1.0.0".`);
  process.exit(1);
}

const newVersionName = `${major}.${minor}.${patch}`;
// Formula: MAJOR*100000 + MINOR*1000 + PATCH*10
const newVersionCode = major * 100000 + minor * 1000 + patch * 10;

versionData.versionName = newVersionName;
versionData.versionCode = newVersionCode;
versionData.releasedAt = new Date().toISOString().split('T')[0];

const customNotes = process.argv[3];
if (customNotes) {
  versionData.releaseNotes = customNotes;
}

fs.writeFileSync(versionJsonPath, JSON.stringify(versionData, null, 2) + '\n');
console.log(`✓ Updated apps/mobile/version.json to versionName="${newVersionName}", versionCode=${newVersionCode}`);

if (fs.existsSync(appJsonPath)) {
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
  if (appJson.expo) {
    appJson.expo.version = newVersionName;
    if (appJson.expo.android) {
      appJson.expo.android.versionCode = newVersionCode;
    }
  }
  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');
  console.log(`✓ Synchronized apps/mobile/app.json`);
}

console.log(`\n🎉 Successfully bumped SplitSaathi to v${newVersionName} (versionCode: ${newVersionCode})`);
