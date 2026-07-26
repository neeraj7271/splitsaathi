import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

import type { ThemeMode } from "../theme";

const APPEARANCE_KEY = "splitsaathi.appearance";

const memory: { mode: ThemeMode | null } = { mode: null };

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
    // ignore
  }
}

function webRemove(key: string) {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // ignore
  }
}

function isThemeMode(value: string | null | undefined): value is ThemeMode {
  return value === "system" || value === "dark" || value === "light";
}

/** Sync peek of in-memory cache (filled after first hydrate). */
export function peekCachedAppearance(): ThemeMode | null {
  return memory.mode;
}

export async function loadCachedAppearance(): Promise<ThemeMode | null> {
  try {
    const raw =
      Platform.OS === "web" ? webGet(APPEARANCE_KEY) : await SecureStore.getItemAsync(APPEARANCE_KEY);
    if (!isThemeMode(raw)) {
      memory.mode = null;
      return null;
    }
    memory.mode = raw;
    return raw;
  } catch {
    return memory.mode;
  }
}

export async function cacheAppearance(mode: ThemeMode): Promise<void> {
  memory.mode = mode;
  try {
    if (Platform.OS === "web") {
      webSet(APPEARANCE_KEY, mode);
      return;
    }
    await SecureStore.setItemAsync(APPEARANCE_KEY, mode);
  } catch {
    // ignore persistence failures — memory still holds the value for this session
  }
}

export async function clearCachedAppearance(): Promise<void> {
  memory.mode = null;
  try {
    if (Platform.OS === "web") {
      webRemove(APPEARANCE_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(APPEARANCE_KEY);
  } catch {
    // ignore
  }
}
