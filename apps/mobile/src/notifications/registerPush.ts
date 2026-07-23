import { Platform } from "react-native";
import Constants from "expo-constants";
import { apiClient } from "../api/client";
import { configurePushNotifications } from "./configurePush";

type NotificationPermissionShape = {
  granted?: boolean;
  status?: string;
  ios?: { status?: number };
};

function isExpoGo() {
  return Constants.appOwnership === "expo";
}

/**
 * Registers the native FCM (Android) / APNs (iOS) device token with the API.
 * Requires a dev/production build with `google-services.json` (Android) — not Expo Go.
 */
export async function registerPushIfPossible() {
  if (Platform.OS === "web") {
    return { status: "skipped" as const, reason: "push_not_supported_on_web_preview" };
  }

  if (isExpoGo()) {
    return { status: "skipped" as const, reason: "push_not_supported_in_expo_go" };
  }

  await configurePushNotifications();

  const Notifications = await import("expo-notifications");

  function allowsNotifications(permission: NotificationPermissionShape) {
    return (
      Boolean(permission.granted) ||
      permission.status === "granted" ||
      permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    );
  }

  const permissions = await Notifications.getPermissionsAsync();
  const granted = allowsNotifications(permissions as NotificationPermissionShape)
    ? permissions
    : await Notifications.requestPermissionsAsync();
  if (!allowsNotifications(granted as NotificationPermissionShape)) {
    return { status: "skipped" as const, reason: "permission_denied" };
  }

  try {
    // Native FCM/APNs token (not Expo push token) — API delivers via FCM HTTP v1.
    const deviceToken = await Notifications.getDevicePushTokenAsync();
    const pushToken = deviceToken.data;
    if (!pushToken || typeof pushToken !== "string") {
      return { status: "skipped" as const, reason: "empty_device_push_token" };
    }

    await apiClient.registerDeviceInstallation({
      platform: Platform.OS === "ios" ? "ios" : "android",
      appVersion: Constants.expoConfig?.version ?? "0.1.0",
      pushToken
    });
    return { status: "registered" as const, pushToken, provider: deviceToken.type };
  } catch (error) {
    console.warn("[SplitSaathi] push registration failed", error);
    return { status: "skipped" as const, reason: error instanceof Error ? error.message : String(error) };
  }
}
