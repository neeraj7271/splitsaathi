import * as FileSystem from "expo-file-system/legacy";

import { apiClient } from "../api/client";
import { getAccessToken } from "../auth/tokenStore";

const MIN_CACHED_IMAGE_BYTES = 200;

function isLocalUri(uri: string) {
  return uri.startsWith("file://") || uri.startsWith("content://");
}

function cachePathForUrl(url: string) {
  const safeKey = url.replace(/[^a-zA-Z0-9]/g, "_").slice(-96);
  const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!baseDir) {
    throw new Error("No writable cache directory is available.");
  }
  return `${baseDir}auth-image-${safeKey}.jpg`;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return globalThis.btoa(binary);
}

function isPublicAvatarUrl(url: string) {
  return url.includes("/public/avatars/");
}

async function downloadImage(url: string, localPath: string) {
  const headers: Record<string, string> = {};
  if (!isPublicAvatarUrl(url)) {
    const token = await getAccessToken();
    if (!token) {
      throw new Error("Missing auth token for image download.");
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, Object.keys(headers).length > 0 ? { headers } : undefined);

  if (!response.ok) {
    throw new Error(`Image download failed with status ${response.status}.`);
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength < MIN_CACHED_IMAGE_BYTES) {
    throw new Error("Downloaded image was unexpectedly small.");
  }

  const base64 = arrayBufferToBase64(arrayBuffer);
  await FileSystem.writeAsStringAsync(localPath, base64, {
    encoding: FileSystem.EncodingType.Base64
  });

  return localPath;
}

export async function resolveAuthenticatedImageUri(source?: string | null): Promise<string | null> {
  if (!source) {
    return null;
  }

  if (isLocalUri(source)) {
    return source;
  }

  const url = source.startsWith("http://") || source.startsWith("https://") ? source : apiClient.resolveUrl(source);
  if (!url) {
    return null;
  }

  const localPath = cachePathForUrl(url);
  const existing = await FileSystem.getInfoAsync(localPath);
  if (existing.exists && typeof existing.size === "number" && existing.size >= MIN_CACHED_IMAGE_BYTES) {
    return localPath;
  }

  if (existing.exists) {
    await FileSystem.deleteAsync(localPath, { idempotent: true });
  }

  return downloadImage(url, localPath);
}

export async function clearAuthenticatedImageCache(source?: string | null) {
  if (!source || isLocalUri(source)) {
    return;
  }

  const url = source.startsWith("http://") || source.startsWith("https://") ? source : apiClient.resolveUrl(source);
  if (!url) {
    return;
  }

  const localPath = cachePathForUrl(url);
  const existing = await FileSystem.getInfoAsync(localPath);
  if (existing.exists) {
    await FileSystem.deleteAsync(localPath, { idempotent: true });
  }
}
