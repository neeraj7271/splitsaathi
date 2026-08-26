#!/usr/bin/env node
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { readVersionJson, syncAppJsonFromVersionJson, verifyApkVersion } = require('./version-utils');

const envFlag = (process.argv[2] || 'debug').toLowerCase();
const skipVerify = process.argv.includes('--skip-verify');

const ENV_CONFIGS = {
  debug: {
    apiUrl: 'https://api-dev.thesplitsaathi.com',
    gradleTask: 'assembleDebug',
    sourceApk: 'app/build/outputs/apk/debug/app-debug.apk',
    targetApk: 'deploy/SplitSaathi-debug.apk',
    clean: false
  },
  dev: {
    apiUrl: 'https://api-dev.thesplitsaathi.com',
    gradleTask: 'assembleRelease',
    sourceApk: 'app/build/outputs/apk/release/app-release.apk',
    targetApk: 'deploy/SplitSaathi-dev.apk',
    safeNativeClean: true
  },
  prod: {
    apiUrl: 'https://api.thesplitsaathi.com',
    distributionChannel: 'sideload',
    gradleTask: 'assembleRelease',
    sourceApk: 'app/build/outputs/apk/release/app-release.apk',
    targetApk: 'deploy/SplitSaathi.apk',
    safeNativeClean: true
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
const versionConfig = readVersionJson();
if (syncAppJsonFromVersionJson(versionConfig)) {
  console.log(`✓ Synchronized apps/mobile/app.json from version.json`);
}

console.log(`\n🚀 Starting SplitSaathi APK Build for environment: [${envFlag.toUpperCase()}]`);
console.log(`• Target version: ${versionConfig.versionName} (versionCode=${versionConfig.versionCode})`);
console.log(`• Target API URL: ${config.apiUrl}`);
console.log(`• Gradle Task: ${config.gradleTask}`);
console.log(`• Destination: ${config.targetApk}\n`);

// 1. Update apps/mobile/.env with the environment's EXPO_PUBLIC_API_URL
const googleClientId = '484458958680-bknfe7jd293kjaobf8qjeleerg820apm.apps.googleusercontent.com';
const distributionChannel = config.distributionChannel || 'sideload';
const envContent = `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=${googleClientId}\nEXPO_PUBLIC_API_URL=${config.apiUrl}\nEXPO_PUBLIC_DISTRIBUTION_CHANNEL=${distributionChannel}\n`;
fs.writeFileSync(mobileEnvPath, envContent);
console.log(`✓ Updated apps/mobile/.env with EXPO_PUBLIC_API_URL=${config.apiUrl}, channel=${distributionChannel}`);

// 2. Set environment variables for Java & Android SDK
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
  EXPO_PUBLIC_DISTRIBUTION_CHANNEL: distributionChannel,
  JAVA_HOME: javaHome,
  ANDROID_HOME: androidHome,
  ANDROID_SDK_ROOT: androidHome
};

envVars.PATH = `${envVars.JAVA_HOME}/bin:${envVars.ANDROID_HOME}/platform-tools:${envVars.PATH}`;

// 3. Clean Metro bundle assets to force re-bundling with target EXPO_PUBLIC_API_URL
const expoCachePath = path.join(mobileDir, '.expo');
const metroCachePath = path.join(rootDir, 'node_modules/.cache/metro');
const bundleAssetsPath = path.join(androidDir, 'app/build/generated/assets/createBundleReleaseJsAndAssets');

for (const cachePath of [expoCachePath, metroCachePath, bundleAssetsPath]) {
  if (fs.existsSync(cachePath)) {
    fs.rmSync(cachePath, { recursive: true, force: true });
    console.log(`✓ Cleared cache: ${cachePath}`);
  }
}

// Do NOT run `./gradlew clean` on RN New Architecture — it deletes codegen JNI dirs
// and CMake clean fails with "add_subdirectory ... which is not an existing directory".
if (config.safeNativeClean) {
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
}

const gradleCommand = config.gradleTask;

function runGradle(task, label) {
  console.log(`\n⚙️ Running Gradle: ./gradlew ${task}${label ? ` (${label})` : ''}...`);
  execSync(`./gradlew ${task}`, {
    cwd: androidDir,
    env: envVars,
    stdio: 'inherit'
  });
}

try {
  if (config.gradleTask === 'assembleRelease') {
    // Restore JNI codegen removed by a prior `./gradlew clean` (breaks New Architecture builds).
    runGradle(
      ':app:generateCodegenSchemaFromJavaScript :app:generateCodegenArtifactsFromSchema',
      'codegen'
    );
  }

  runGradle(gradleCommand);
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

if (!fs.existsSync(sourceApkPath)) {
  console.error(`⚠️ Built APK file not found at expected path: ${sourceApkPath}`);
  process.exit(1);
}

fs.copyFileSync(sourceApkPath, targetApkPath);
const sizeMb = (fs.statSync(targetApkPath).size / (1024 * 1024)).toFixed(2);
console.log(`\n📦 Successfully created ${config.targetApk} (${sizeMb} MB)`);

if (!skipVerify) {
  try {
    const verified = verifyApkVersion(targetApkPath, {
      versionCode: versionConfig.versionCode,
      versionName: versionConfig.versionName
    }, { androidHome: envVars.ANDROID_HOME });
    console.log(`✓ Verified APK versionCode=${verified.versionCode}, versionName=${verified.versionName}`);
  } catch (error) {
    console.error(`\n❌ APK verification failed: ${error.message}`);
    process.exit(1);
  }
}
