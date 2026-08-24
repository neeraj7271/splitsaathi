#!/usr/bin/env node
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const envFlag = (process.argv[2] || 'debug').toLowerCase();

const ENV_CONFIGS = {
  debug: {
    apiUrl: 'https://api-dev.thesplitsaathi.com',
    gradleTask: 'assembleDebug',
    sourceApk: 'app/build/outputs/apk/debug/app-debug.apk',
    targetApk: 'deploy/SplitSaathi-debug.apk'
  },
  dev: {
    apiUrl: 'https://api-dev.thesplitsaathi.com',
    gradleTask: 'assembleRelease',
    sourceApk: 'app/build/outputs/apk/release/app-release.apk',
    targetApk: 'deploy/SplitSaathi-dev.apk'
  },
  prod: {
    apiUrl: 'https://api.thesplitsaathi.com',
    gradleTask: 'assembleRelease',
    sourceApk: 'app/build/outputs/apk/release/app-release.apk',
    targetApk: 'deploy/SplitSaathi.apk'
  }
};

if (!ENV_CONFIGS[envFlag]) {
  console.error(`Invalid environment flag: "${envFlag}". Use "debug", "dev", or "prod".`);
  process.exit(1);
}

const config = ENV_CONFIGS[envFlag];
const rootDir = path.join(__dirname, '..');
const mobileDir = path.join(rootDir, 'apps/mobile');
const androidDir = path.join(mobileDir, 'android');
const mobileEnvPath = path.join(mobileDir, '.env');
const deployDir = path.join(rootDir, 'deploy');

console.log(`\n🚀 Starting SplitSaathi APK Build for environment: [${envFlag.toUpperCase()}]`);
console.log(`• Target API URL: ${config.apiUrl}`);
console.log(`• Gradle Task: ${config.gradleTask}`);
console.log(`• Destination: ${config.targetApk}\n`);

// 1. Update apps/mobile/.env with the environment's EXPO_PUBLIC_API_URL
const googleClientId = '484458958680-bknfe7jd293kjaobf8qjeleerg820apm.apps.googleusercontent.com';
const envContent = `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=${googleClientId}\nEXPO_PUBLIC_API_URL=${config.apiUrl}\n`;
fs.writeFileSync(mobileEnvPath, envContent);
console.log(`✓ Updated apps/mobile/.env with EXPO_PUBLIC_API_URL=${config.apiUrl}`);

// 2. Set environment variables for Java & Android SDK
const envVars = {
  ...process.env,
  EXPO_PUBLIC_API_URL: config.apiUrl,
  JAVA_HOME: process.env.JAVA_HOME || '/usr/lib/jvm/java-17-openjdk-amd64',
  ANDROID_HOME: process.env.ANDROID_HOME || '/home/neeraj/Android/Sdk'
};

envVars.PATH = `${envVars.JAVA_HOME}/bin:${envVars.ANDROID_HOME}/platform-tools:${envVars.PATH}`;

// 3. Clean Metro bundle assets to force re-bundling with target EXPO_PUBLIC_API_URL
const expoCachePath = path.join(mobileDir, '.expo');
const bundleAssetsPath = path.join(androidDir, 'app/build/generated/assets/createBundleReleaseJsAndAssets');
if (fs.existsSync(expoCachePath)) {
  fs.rmSync(expoCachePath, { recursive: true, force: true });
  console.log(`✓ Cleared Expo bundler cache (.expo)`);
}
if (fs.existsSync(bundleAssetsPath)) {
  fs.rmSync(bundleAssetsPath, { recursive: true, force: true });
  console.log(`✓ Cleared JS bundle asset cache (${bundleAssetsPath})`);
}

try {
  console.log(`\n⚙️ Running Gradle build: ./gradlew ${config.gradleTask}...`);
  execSync(`./gradlew ${config.gradleTask}`, {
    cwd: androidDir,
    env: envVars,
    stdio: 'inherit'
  });
  console.log(`\n✓ Gradle build completed successfully!`);
} catch (error) {
  console.error(`\n❌ Gradle build failed for ${envFlag}.`);
  process.exit(1);
}

// 4. Copy APK to deploy directory
const sourceApkPath = path.join(androidDir, config.sourceApk);
const targetApkPath = path.join(rootDir, config.targetApk);

if (!fs.existsSync(deployDir)) {
  fs.mkdirSync(deployDir, { recursive: true });
}

if (fs.existsSync(sourceApkPath)) {
  fs.copyFileSync(sourceApkPath, targetApkPath);
  const sizeMb = (fs.statSync(targetApkPath).size / (1024 * 1024)).toFixed(2);
  console.log(`\n📦 Successfully created ${config.targetApk} (${sizeMb} MB)`);
} else {
  console.error(`⚠️ Built APK file not found at expected path: ${sourceApkPath}`);
}
