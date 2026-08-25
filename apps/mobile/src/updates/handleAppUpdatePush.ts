import { Linking } from "react-native";

import { getDirectApkDownloadUrl } from "./checkAppVersion";

export function isAppUpdatePush(data: Record<string, unknown> | undefined) {
  return data?.type === "APP_UPDATE";
}

export async function openAppUpdateDownload(data: Record<string, unknown> | undefined) {
  const directApkUrl = typeof data?.directApkUrl === "string" ? data.directApkUrl : undefined;
  const targetUrl = getDirectApkDownloadUrl(directApkUrl);
  if (!targetUrl) {
    return false;
  }

  await Linking.openURL(targetUrl);
  return true;
}
