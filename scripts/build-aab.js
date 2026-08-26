#!/usr/bin/env node
/**
 * Build a signed Android App Bundle (.aab) for Google Play upload.
 *
 * Usage:
 *   node scripts/build-aab.js
 *   node scripts/build-aab.js --skip-verify
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { readVersionJson, syncAppJsonFromVersionJson } = require('./version-utils');

const skipVerify = process.argv.includes('--skip-verify');
const rootDir = path.join(__dirname, '..');
const mobileDir = path.join(rootDir, 'apps/mobile');
const androidDir = path.join(mobileDir, 'android');
const mobileEnvPath = path.join(mobileDir, '.env');
const deployDir = path.join(rootDir, 'deploy');

const config = {
  apiUrl: 'https://api.thesplitsaathi.com',
  distributionChannel: 'play',
  gradleTask: 'bundleRelease',
  sourceAab: 'app/build/outputs/bundle/release/app-release.aab',
  targetAab: 'deploy/SplitSaathi.aab'
};

const versionConfig = readVersionJson();
if (syncAppJsonFromVersionJson(versionConfig)) {
  console.log('✓ Synchronized apps/mobile/app.json from version.json');
}

console.log(`\n🚀 Starting SplitSaathi Play Store AAB build`);
console.log(`• Target version: ${versionConfig.versionName} (versionCode=${versionConfig.versionCode})`);
console.log(`• Target API URL: ${config.apiUrl}`);
console.log(`• Distribution channel: ${config.distributionChannel}`);
console.log(`• Gradle Task: ${config.gradleTask}`);
console.log(`• Destination: ${config.targetAab}\n`);

const googleClientId = '484458958680-bknfe7jd293kjaobf8qjeleerg820apm.apps.googleusercontent.com';
const envContent = `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=${googleClientId}\nEXPO_PUBLIC_API_URL=${config.apiUrl}\nEXPO_PUBLIC_DISTRIBUTION_CHANNEL=${config.distributionChannel}\n`;
fs.writeFileSync(mobileEnvPath, envContent);
console.log(`✓ Updated apps/mobile/.env`);

const defaultJavaHome = process.env.CI ? undefined : '/usr/lib/jvm/java-17-openjdk-amd64';
const defaultAndroidHome = process.env.CI ? undefined : '/home/neeraj/Android/Sdk';
const javaHome = process.env.JAVA_HOME || defaultJavaHome;
const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || defaultAndroidHome;

if (!javaHome || !androidHome) {
  console.error('❌ JAVA_HOME and ANDROID_HOME (or ANDROID_SDK_ROOT) must be set.');
  process.exit(1);
}

const envVars = {
  ...process.env,
  EXPO_PUBLIC_API_URL: config.apiUrl,
  EXPO_PUBLIC_DISTRIBUTION_CHANNEL: config.distributionChannel,
  JAVA_HOME: javaHome,
  ANDROID_HOME: androidHome,
  ANDROID_SDK_ROOT: androidHome
};

envVars.PATH = `${envVars.JAVA_HOME}/bin:${envVars.ANDROID_HOME}/platform-tools:${envVars.PATH}`;

for (const cachePath of [
  path.join(mobileDir, '.expo'),
  path.join(rootDir, 'node_modules/.cache/metro'),
  path.join(androidDir, 'app/build/generated/assets/createBundleReleaseJsAndAssets')
]) {
  if (fs.existsSync(cachePath)) {
    fs.rmSync(cachePath, { recursive: true, force: true });
    console.log(`✓ Cleared cache: ${cachePath}`);
  }
}

for (const cachePath of [
  path.join(androidDir, 'app/.cxx'),
  path.join(androidDir, 'app/build/generated/autolinking'),
  path.join(androidDir, 'app/build/generated/res/createBundleReleaseJsAndAssets'),
  path.join(androidDir, 'app/build/generated/sourcemaps/react/release'),
  path.join(androidDir, '.gradle')
]) {
  if (fs.existsSync(cachePath)) {
    fs.rmSync(cachePath, { recursive: true, force: true });
    console.log(`✓ Cleared native cache: ${cachePath}`);
  }
}

function runGradle(task, label) {
  console.log(`\n⚙️ Running Gradle: ./gradlew ${task}${label ? ` (${label})` : ''}...`);
  execSync(`./gradlew ${task}`, {
    cwd: androidDir,
    env: envVars,
    stdio: 'inherit'
  });
}

try {
  runGradle(
    ':app:generateCodegenSchemaFromJavaScript :app:generateCodegenArtifactsFromSchema',
    'codegen'
  );
  runGradle(config.gradleTask);
  console.log('\n✓ Gradle bundleRelease completed successfully!');
} catch (error) {
  console.error('\n❌ AAB build failed.');
  process.exit(1);
}

const sourceAabPath = path.join(androidDir, config.sourceAab);
const targetAabPath = path.join(rootDir, config.targetAab);

if (!fs.existsSync(deployDir)) {
  fs.mkdirSync(deployDir, { recursive: true });
}

if (!fs.existsSync(sourceAabPath)) {
  console.error(`⚠️ Built AAB file not found at expected path: ${sourceAabPath}`);
  process.exit(1);
}

fs.copyFileSync(sourceAabPath, targetAabPath);
const sizeMb = (fs.statSync(targetAabPath).size / (1024 * 1024)).toFixed(2);
console.log(`\n📦 Successfully created ${config.targetAab} (${sizeMb} MB)`);
console.log('Upload deploy/SplitSaathi.aab to Google Play Console → Internal testing.');

if (!skipVerify) {
  const keystoreProps = path.join(androidDir, 'keystore.properties');
  if (!fs.existsSync(keystoreProps)) {
    console.warn('\n⚠️ keystore.properties missing — run: npm run keystore:generate');
  } else {
    console.log('✓ Release keystore configuration found.');
  }
}
