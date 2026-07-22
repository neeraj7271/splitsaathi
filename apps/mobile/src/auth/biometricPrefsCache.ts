import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const BIOMETRIC_ENABLED_KEY = "splitsaathi.biometricAuthEnabled";
const SESSION_TIMEOUT_KEY = "splitsaathi.sessionTimeoutSeconds";

function webGet(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function webSet(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // ignore
  }
}

function webDelete(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // ignore
  }
}

export type CachedBiometricPrefs = {
  biometricAuthEnabled: boolean;
  sessionTimeoutSeconds: number;
};

export async function readCachedBiometricPrefs(): Promise<CachedBiometricPrefs | null> {
  try {
    const enabledRaw =
      Platform.OS === "web" ? webGet(BIOMETRIC_ENABLED_KEY) : await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
    if (enabledRaw == null) {
      return null;
    }
    const timeoutRaw =
      Platform.OS === "web" ? webGet(SESSION_TIMEOUT_KEY) : await SecureStore.getItemAsync(SESSION_TIMEOUT_KEY);
    const timeout = timeoutRaw != null ? Number(timeoutRaw) : 0;
    return {
      biometricAuthEnabled: enabledRaw === "1",
      sessionTimeoutSeconds: Number.isFinite(timeout) ? timeout : 0
    };
  } catch {
    return null;
  }
}

export async function writeCachedBiometricPrefs(prefs: CachedBiometricPrefs): Promise<void> {
  const enabled = prefs.biometricAuthEnabled ? "1" : "0";
  const timeout = String(prefs.sessionTimeoutSeconds ?? 0);
  if (Platform.OS === "web") {
    webSet(BIOMETRIC_ENABLED_KEY, enabled);
    webSet(SESSION_TIMEOUT_KEY, timeout);
    return;
  }
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, enabled);
  await SecureStore.setItemAsync(SESSION_TIMEOUT_KEY, timeout);
}

export async function clearCachedBiometricPrefs(): Promise<void> {
  if (Platform.OS === "web") {
    webDelete(BIOMETRIC_ENABLED_KEY);
    webDelete(SESSION_TIMEOUT_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
  await SecureStore.deleteItemAsync(SESSION_TIMEOUT_KEY);
}
