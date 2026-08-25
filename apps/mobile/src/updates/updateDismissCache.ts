import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const DISMISSED_VERSION_CODE_KEY = "splitsaathi.updateDismissedVersionCode";

function webGet(key: string) {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function webSet(key: string, value: string) {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // ignore persistence failures
  }
}

function webRemove(key: string) {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // ignore
  }
}

export async function getDismissedVersionCode(): Promise<number | null> {
  const raw =
    Platform.OS === "web"
      ? webGet(DISMISSED_VERSION_CODE_KEY)
      : await SecureStore.getItemAsync(DISMISSED_VERSION_CODE_KEY);

  if (!raw) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export async function setDismissedVersionCode(versionCode: number): Promise<void> {
  const value = String(versionCode);
  if (Platform.OS === "web") {
    webSet(DISMISSED_VERSION_CODE_KEY, value);
    return;
  }

  await SecureStore.setItemAsync(DISMISSED_VERSION_CODE_KEY, value);
}

export async function clearDismissedVersionCode(): Promise<void> {
  if (Platform.OS === "web") {
    webRemove(DISMISSED_VERSION_CODE_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(DISMISSED_VERSION_CODE_KEY);
}
