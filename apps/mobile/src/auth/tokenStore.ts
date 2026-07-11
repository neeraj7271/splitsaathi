import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const ACCESS_TOKEN_KEY = "splitsaathi.accessToken";
const REFRESH_TOKEN_KEY = "splitsaathi.refreshToken";

let memoryAccessToken: string | null = null;

export async function setTokens(accessToken: string, refreshToken: string) {
  memoryAccessToken = accessToken;
  if (Platform.OS === "web") {
    webStorageSet(ACCESS_TOKEN_KEY, accessToken);
    webStorageSet(REFRESH_TOKEN_KEY, refreshToken);
    return;
  }
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export async function getAccessToken() {
  if (memoryAccessToken) {
    return memoryAccessToken;
  }

  memoryAccessToken = Platform.OS === "web" ? webStorageGet(ACCESS_TOKEN_KEY) : await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  return memoryAccessToken;
}

export async function getRefreshToken() {
  if (Platform.OS === "web") {
    return webStorageGet(REFRESH_TOKEN_KEY);
  }
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearTokens() {
  memoryAccessToken = null;
  if (Platform.OS === "web") {
    webStorageDelete(ACCESS_TOKEN_KEY);
    webStorageDelete(REFRESH_TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

function webStorageGet(key: string) {
  return typeof window === "undefined" ? null : window.localStorage.getItem(key);
}

function webStorageSet(key: string, value: string) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(key, value);
  }
}

function webStorageDelete(key: string) {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(key);
  }
}
