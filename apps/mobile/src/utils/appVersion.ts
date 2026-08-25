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

function parseNativeBuildVersion(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  if (value.includes(".")) {
    return versionCodeFromName(value);
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function getAppVersionName(): string {
  return (
    Application.nativeApplicationVersion ??
    versionConfig.versionName ??
    Constants.expoConfig?.version ??
    "0.0.0"
  );
}

export function getAppVersionCode(): number {
  // Android versionCode from PackageManager — must not be mixed with bundled JS version.
  const fromNativeBuild = parseNativeBuildVersion(Application.nativeBuildVersion);
  if (fromNativeBuild !== null) {
    return fromNativeBuild;
  }

  const fromNativeName = versionCodeFromName(Application.nativeApplicationVersion ?? "");
  if (fromNativeName !== null) {
    return fromNativeName;
  }

  if (versionConfig.versionCode) {
    return versionConfig.versionCode;
  }

  return versionCodeFromName(getAppVersionName()) ?? 100000;
}
