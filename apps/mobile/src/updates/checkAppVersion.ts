import versionConfig from "../../version.json";
import { clearDismissedVersionCode, getDismissedVersionCode } from "./updateDismissCache";

export interface AppVersionInfo {
  latestVersionName: string;
  latestVersionCode: number;
  minSupportedVersionCode: number;
  updateAvailable: boolean;
  forceUpdate: boolean;
  directApkUrl: string;
  playStoreUrl: string;
  releaseNotes: string;
  releasedAt?: string;
  apkSizeBytes?: number | null;
}

function getApiUrl() {
  return process.env.EXPO_PUBLIC_API_URL || "https://api-dev.thesplitsaathi.com";
}

function getCurrentVersionCode() {
  return versionConfig.versionCode ?? 100000;
}

export async function fetchAppVersionInfo(): Promise<AppVersionInfo | null> {
  const currentCode = getCurrentVersionCode();
  const res = await fetch(`${getApiUrl()}/v1/app/version?versionCode=${currentCode}`);
  if (!res.ok) {
    return null;
  }

  return (await res.json()) as AppVersionInfo;
}

export async function resolveAppUpdatePrompt(): Promise<AppVersionInfo | null> {
  const data = await fetchAppVersionInfo();
  if (!data) {
    return null;
  }

  if (!data.updateAvailable && !data.forceUpdate) {
    await clearDismissedVersionCode();
    return null;
  }

  if (!data.forceUpdate) {
    const dismissedCode = await getDismissedVersionCode();
    if (dismissedCode !== null && dismissedCode >= data.latestVersionCode) {
      return null;
    }
  }

  return data;
}

export function getDirectApkDownloadUrl(fallbackUrl?: string) {
  return fallbackUrl || versionConfig.directApkUrl || versionConfig.playStoreUrl;
}
