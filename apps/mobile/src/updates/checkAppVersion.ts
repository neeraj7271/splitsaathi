import versionConfig from "../../version.json";
import { getAppVersionCode } from "../utils/appVersion";
import { isPlayStoreBuild } from "../utils/distributionChannel";
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

export async function fetchAppVersionInfo(): Promise<AppVersionInfo | null> {
  const currentCode = getAppVersionCode();
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

  const dismissedCode = await getDismissedVersionCode();
  if (dismissedCode !== null && dismissedCode >= data.latestVersionCode) {
    return null;
  }

  return data;
}

export function resolveUpdateTargetUrl(info: Pick<AppVersionInfo, "directApkUrl" | "playStoreUrl">): string {
  if (isPlayStoreBuild()) {
    return info.playStoreUrl || versionConfig.playStoreUrl;
  }
  return info.directApkUrl || versionConfig.directApkUrl || versionConfig.playStoreUrl;
}

export function getDirectApkDownloadUrl(fallbackUrl?: string) {
  if (isPlayStoreBuild()) {
    return versionConfig.playStoreUrl;
  }
  return fallbackUrl || versionConfig.directApkUrl || versionConfig.playStoreUrl;
}

export function getUpdateActionLabel(): string {
  return isPlayStoreBuild() ? "Update on Play Store" : "Download & Install Update";
}

export function getManualUpdateCheckSubtitle(): string {
  return isPlayStoreBuild() ? "Open Google Play Store" : "Download the latest SplitSaathi APK";
}
