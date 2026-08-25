import * as Application from "expo-application";
import Constants from "expo-constants";

import versionConfig from "../../version.json";

function versionCodeFromName(versionName: string): number | null {
  const parts = versionName.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length < 3 || parts.some(Number.isNaN)) {
    return null;
  }

  const [major, minor, patch] = parts;
  return major * 100000 + minor * 1000 + patch * 10;
}

export function getAppVersionName(): string {
  // Prefer Android/iOS native version (matches Settings → App info).
  // version.json is baked at build time with Gradle; expoConfig can lag if app.json was stale.
  return (
    Application.nativeApplicationVersion ??
    versionConfig.versionName ??
    Constants.expoConfig?.version ??
    "0.0.0"
  );
}

export function getAppVersionCode(): number {
  const fromName = versionCodeFromName(getAppVersionName());

  const nativeBuildVersion = Application.nativeBuildVersion;
  let fromNativeBuild: number | null = null;
  if (nativeBuildVersion) {
    if (nativeBuildVersion.includes(".")) {
      fromNativeBuild = versionCodeFromName(nativeBuildVersion);
    } else {
      const parsed = Number.parseInt(nativeBuildVersion, 10);
      if (!Number.isNaN(parsed)) {
        fromNativeBuild = parsed;
      }
    }
  }

  const fromBundle = versionConfig.versionCode ?? null;
  const candidates = [fromNativeBuild, fromName, fromBundle].filter(
    (value): value is number => value !== null && value > 0
  );

  if (candidates.length === 0) {
    return 100000;
  }

  return Math.max(...candidates);
}
