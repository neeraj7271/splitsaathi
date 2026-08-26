import { Linking } from "react-native";

import { resolveUpdateTargetUrl } from "./checkAppVersion";

function versionCodeFromName(versionName: string): number | null {
  const parts = versionName.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length < 3 || parts.some(Number.isNaN)) {
    return null;
  }

  const [major, minor, patch] = parts;
  return major * 100000 + minor * 1000 + patch * 10;
}

export function parsePushVersionCode(data: Record<string, unknown> | undefined): number | null {
  const raw = data?.versionCode;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }

  if (typeof raw === "string") {
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  if (typeof data?.versionName === "string") {
    return versionCodeFromName(data.versionName);
  }

  return null;
}

export function isAppUpdatePush(data: Record<string, unknown> | undefined) {
  return data?.type === "APP_UPDATE";
}

export async function openAppUpdateDownload(data: Record<string, unknown> | undefined) {
  const directApkUrl = typeof data?.directApkUrl === "string" ? data.directApkUrl : undefined;
  const playStoreUrl = typeof data?.playStoreUrl === "string" ? data.playStoreUrl : undefined;
  const targetUrl = resolveUpdateTargetUrl({
    directApkUrl: directApkUrl ?? "",
    playStoreUrl: playStoreUrl ?? ""
  });
  if (!targetUrl) {
    return false;
  }

  await Linking.openURL(targetUrl);
  return true;
}
