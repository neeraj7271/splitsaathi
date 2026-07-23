import { Linking, Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

import { apiClient } from "../api/client";
import { getAccessToken } from "../auth/tokenStore";

export type DownloadedAttachment = {
  localUri: string;
  /** Prefer this when opening via Linking on Android. */
  openUri: string;
  mimeType?: string;
  isImage: boolean;
};

function resolveRemoteUrl(source: string): string | null {
  if (source.startsWith("http://") || source.startsWith("https://") || source.startsWith("file://") || source.startsWith("content://")) {
    return source;
  }
  return apiClient.resolveUrl(source);
}

function cachePathForUrl(url: string, extension: string) {
  const safeKey = url.replace(/[^a-zA-Z0-9]/g, "_").slice(-96);
  const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!baseDir) {
    throw new Error("No writable cache directory is available.");
  }
  return `${baseDir}auth-attachment-${safeKey}.${extension}`;
}

function extensionFromMime(mimeType?: string): string {
  if (!mimeType) {
    return "bin";
  }
  if (mimeType.includes("pdf")) {
    return "pdf";
  }
  if (mimeType.includes("png")) {
    return "png";
  }
  if (mimeType.includes("webp")) {
    return "webp";
  }
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
    return "jpg";
  }
  if (mimeType.startsWith("image/")) {
    return "img";
  }
  return "bin";
}

function isImageMime(mimeType?: string): boolean {
  return Boolean(mimeType?.startsWith("image/"));
}

/**
 * Downloads a private attachment with the session bearer token.
 * Never open the remote HTTPS URL in the browser — that yields 401 Missing bearer token.
 */
export async function downloadAuthenticatedAttachment(source: string): Promise<DownloadedAttachment> {
  if (source.startsWith("file://") || source.startsWith("content://")) {
    return {
      localUri: source,
      openUri: source,
      isImage: true
    };
  }

  const url = resolveRemoteUrl(source);
  if (!url) {
    throw new Error("Attachment URL is missing.");
  }

  const token = await getAccessToken();
  if (!token) {
    throw new Error("Missing auth token for attachment download.");
  }

  // Probe content-type with a lightweight authenticated HEAD/GET via download to temp.
  const probePath = cachePathForUrl(url, "tmp");
  const existing = await FileSystem.getInfoAsync(probePath);
  if (existing.exists) {
    await FileSystem.deleteAsync(probePath, { idempotent: true });
  }

  const download = await FileSystem.downloadAsync(url, probePath, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (download.status < 200 || download.status >= 300) {
    await FileSystem.deleteAsync(probePath, { idempotent: true }).catch(() => undefined);
    throw new Error(
      download.status === 401
        ? "Could not open proof (unauthorized). Try signing in again."
        : `Could not download proof (status ${download.status}).`
    );
  }

  const headerMime =
    (download.headers?.["Content-Type"] as string | undefined) ??
    (download.headers?.["content-type"] as string | undefined);
  const mimeType = headerMime?.split(";")[0]?.trim();
  const extension = extensionFromMime(mimeType);
  const finalPath = cachePathForUrl(url, extension);

  const finalInfo = await FileSystem.getInfoAsync(finalPath);
  if (finalInfo.exists) {
    await FileSystem.deleteAsync(finalPath, { idempotent: true });
  }
  await FileSystem.moveAsync({ from: download.uri, to: finalPath });

  let openUri = finalPath;
  if (Platform.OS === "android") {
    openUri = await FileSystem.getContentUriAsync(finalPath);
  }

  return {
    localUri: finalPath,
    openUri,
    mimeType,
    isImage: isImageMime(mimeType) || extension === "jpg" || extension === "png" || extension === "webp" || extension === "img"
  };
}

export async function openAuthenticatedAttachment(source: string): Promise<DownloadedAttachment> {
  const file = await downloadAuthenticatedAttachment(source);
  if (!file.isImage) {
    const canOpen = await Linking.canOpenURL(file.openUri).catch(() => true);
    if (!canOpen) {
      throw new Error("No app is available to open this proof file.");
    }
    await Linking.openURL(file.openUri);
  }
  return file;
}
