#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const VERSION_JSON_PATH = path.join(__dirname, '../apps/mobile/version.json');
const APP_JSON_PATH = path.join(__dirname, '../apps/mobile/app.json');

/**
 * Deterministic Android versionCode:
 * (MAJOR * 100000) + (MINOR * 1000) + (PATCH * 10)
 */
function versionCodeFromName(versionName) {
  const parts = versionName.split('.').map((part) => Number.parseInt(part, 10));
  if (parts.length < 3 || parts.some(Number.isNaN)) {
    return null;
  }

  const [major, minor, patch] = parts;
  return major * 100000 + minor * 1000 + patch * 10;
}

function parseVersionCode(versionStr, fallback) {
  const fromName = versionCodeFromName(versionStr);
  if (fromName !== null) {
    return fromName;
  }

  const parsed = Number.parseInt(String(versionStr).replace(/\D/g, ''), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function readVersionJson() {
  if (!fs.existsSync(VERSION_JSON_PATH)) {
    throw new Error(`version.json not found at ${VERSION_JSON_PATH}`);
  }

  return JSON.parse(fs.readFileSync(VERSION_JSON_PATH, 'utf-8'));
}

/** Keep app.json in sync with version.json so Metro embeds the correct expo.version. */
function syncAppJsonFromVersionJson(versionData = readVersionJson()) {
  if (!fs.existsSync(APP_JSON_PATH)) {
    return false;
  }

  const appJson = JSON.parse(fs.readFileSync(APP_JSON_PATH, 'utf-8'));
  if (!appJson.expo) {
    return false;
  }

  let changed = false;

  if (appJson.expo.version !== versionData.versionName) {
    appJson.expo.version = versionData.versionName;
    changed = true;
  }

  if (!appJson.expo.android) {
    appJson.expo.android = {};
  }

  if (appJson.expo.android.versionCode !== versionData.versionCode) {
    appJson.expo.android.versionCode = versionData.versionCode;
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(APP_JSON_PATH, JSON.stringify(appJson, null, 2) + '\n');
  }

  return changed;
}

function findAapt(androidHome = process.env.ANDROID_HOME) {
  if (!androidHome || !fs.existsSync(androidHome)) {
    return null;
  }

  const buildToolsDir = path.join(androidHome, 'build-tools');
  if (!fs.existsSync(buildToolsDir)) {
    return null;
  }

  const versions = fs
    .readdirSync(buildToolsDir)
    .filter((entry) => fs.statSync(path.join(buildToolsDir, entry)).isDirectory())
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

  for (const version of versions) {
    for (const binary of ['aapt', 'aapt2']) {
      const candidate = path.join(buildToolsDir, version, binary);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function parseAaptBadging(output) {
  const packageLine = output.split('\n').find((line) => line.startsWith('package:'));
  if (!packageLine) {
    return null;
  }

  const versionCodeMatch = packageLine.match(/\bversionCode='(\d+)'/);
  const versionNameMatch = packageLine.match(/\bversionName='([^']+)'/);

  if (!versionCodeMatch || !versionNameMatch) {
    return null;
  }

  return {
    versionCode: Number.parseInt(versionCodeMatch[1], 10),
    versionName: versionNameMatch[1]
  };
}

function verifyApkVersion(apkPath, expected, options = {}) {
  if (!fs.existsSync(apkPath)) {
    throw new Error(`APK not found: ${apkPath}`);
  }

  const aapt = options.aaptPath || findAapt(options.androidHome);
  if (!aapt) {
    throw new Error('aapt not found. Set ANDROID_HOME or install Android build-tools.');
  }

  const output = execSync(`"${aapt}" dump badging "${apkPath}"`, {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const parsed = parseAaptBadging(output);
  if (!parsed) {
    throw new Error(`Unable to parse aapt output for ${apkPath}`);
  }

  const expectedCode = expected.versionCode;
  const expectedName = expected.versionName;

  if (parsed.versionCode !== expectedCode || parsed.versionName !== expectedName) {
    throw new Error(
      `APK version mismatch. Expected versionCode=${expectedCode}, versionName=${expectedName}; ` +
        `got versionCode=${parsed.versionCode}, versionName=${parsed.versionName}.`
    );
  }

  return parsed;
}

function resolveAndroidHome() {
  const defaultAndroidHome = process.env.CI ? undefined : '/home/neeraj/Android/Sdk';
  return process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || defaultAndroidHome;
}

module.exports = {
  VERSION_JSON_PATH,
  APP_JSON_PATH,
  versionCodeFromName,
  parseVersionCode,
  readVersionJson,
  syncAppJsonFromVersionJson,
  resolveAndroidHome,
  findAapt,
  parseAaptBadging,
  verifyApkVersion
};
