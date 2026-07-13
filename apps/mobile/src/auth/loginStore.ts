import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const LOGGED_IN_BEFORE_KEY = "splitsaathi.loggedInBefore";

export async function hasLoggedInBefore() {
  if (Platform.OS === "web") {
    return typeof window !== "undefined" && window.localStorage.getItem(LOGGED_IN_BEFORE_KEY) === "1";
  }
  const value = await SecureStore.getItemAsync(LOGGED_IN_BEFORE_KEY);
  return value === "1";
}

export async function markLoggedInBefore() {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOGGED_IN_BEFORE_KEY, "1");
    }
    return;
  }
  await SecureStore.setItemAsync(LOGGED_IN_BEFORE_KEY, "1");
}
