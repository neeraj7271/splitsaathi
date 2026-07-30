import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { apiClient } from "../api/client";
import { configurePushNotifications } from "./configurePush";

const PUSH_ASKED_KEY = "splitsaathi.pushPermissionAsked.v1";

type NotificationPermissionShape = {
  granted?: boolean;
  status?: string;
  canAskAgain?: boolean;
  ios?: { status?: number };
};

function isExpoGo() {
  return Constants.appOwnership === "expo";
}

async function getFlag(key: string) {
  if (Platform.OS === "web") {
    return typeof window !== "undefined" && window.localStorage.getItem(key) === "1";
  }
  return (await SecureStore.getItemAsync(key)) === "1";
}

async function setFlag(key: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, "1");
    }
    return;
  }
  await SecureStore.setItemAsync(key, "1");
}

function allowsNotifications(
  permission: NotificationPermissionShape,
  IosAuthorizationStatus: { PROVISIONAL?: number }
) {
  return (
    Boolean(permission.granted) ||
    permission.status === "granted" ||
    permission.ios?.status === IosAuthorizationStatus.PROVISIONAL
  );
}

/**
 * Registers the native FCM (Android) / APNs (iOS) device token with the API.
 * Only shows the system permission dialog when status is still undetermined
 * (or when `forcePrompt` is set from Settings). Never re-asks after a prior decision.
 */
export async function registerPushIfPossible(options?: { forcePrompt?: boolean }) {
  if (Platform.OS === "web") {
    return { status: "skipped" as const, reason: "push_not_supported_on_web_preview" };
  }

  if (isExpoGo()) {
    return { status: "skipped" as const, reason: "push_not_supported_in_expo_go" };
  }

  await configurePushNotifications();

  const Notifications = await import("expo-notifications");
  const permissions = await Notifications.getPermissionsAsync();

  if (!allowsNotifications(permissions as NotificationPermissionShape, Notifications.IosAuthorizationStatus)) {
    const previouslyAsked = await getFlag(PUSH_ASKED_KEY);
    const undetermined = permissions.status === "undetermined" || permissions.status === undefined;
    const canAsk = permissions.canAskAgain !== false;

    if (!options?.forcePrompt && (previouslyAsked || !undetermined || !canAsk)) {
      return { status: "skipped" as const, reason: "permission_previously_decided" };
    }

    const requested = await Notifications.requestPermissionsAsync();
    await setFlag(PUSH_ASKED_KEY);
    if (!allowsNotifications(requested as NotificationPermissionShape, Notifications.IosAuthorizationStatus)) {
      return { status: "skipped" as const, reason: "permission_denied" };
    }
  } else {
    await setFlag(PUSH_ASKED_KEY);
  }

  try {
    let pushToken: string | undefined;
    let tokenType = "unknown";
    try {
      const deviceToken = await Notifications.getDevicePushTokenAsync();
      tokenType = deviceToken.type;
      pushToken = typeof deviceToken.data === "string" ? deviceToken.data : JSON.stringify(deviceToken.data);
    } catch (tokenErr) {
      console.warn("[SplitSaathi] getDevicePushTokenAsync failed, trying getExpoPushTokenAsync", tokenErr);
      try {
        const expoToken = await Notifications.getExpoPushTokenAsync();
        tokenType = "expo";
        pushToken = expoToken.data;
      } catch (expoErr) {
        console.warn("[SplitSaathi] getExpoPushTokenAsync fallback failed as well", expoErr);
      }
    }

    if (!pushToken || typeof pushToken !== "string") {
      return { status: "skipped" as const, reason: "empty_device_push_token" };
    }

    await apiClient.registerDeviceInstallation({
      platform: Platform.OS === "ios" ? "ios" : "android",
      appVersion: Constants.expoConfig?.version ?? "0.1.0",
      pushToken
    });
    return { status: "registered" as const, pushToken, provider: tokenType };
  } catch (error) {
    console.warn("[SplitSaathi] push registration failed", error);
    return { status: "skipped" as const, reason: error instanceof Error ? error.message : String(error) };
  }
}
