import { Platform } from "react-native";
import Constants from "expo-constants";
import { apiClient } from "../api/client";

type NotificationPermissionShape = {
  granted?: boolean;
  status?: string;
  ios?: { status?: number };
};

function isExpoGo() {
  return Constants.appOwnership === "expo";
}

export async function registerPushIfPossible() {
  if (Platform.OS === "web") {
    return { status: "skipped" as const, reason: "push_not_supported_on_web_preview" };
  }

  // Remote push was removed from Expo Go on Android in SDK 53+.
  // Skip entirely in Expo Go so onboarding does not surface a hard error.
  if (isExpoGo()) {
    return { status: "skipped" as const, reason: "push_not_supported_in_expo_go" };
  }

  // Lazy-load so Expo Go never evaluates the expo-notifications native path.
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
    const token = await Notifications.getExpoPushTokenAsync();
    await apiClient.registerDeviceInstallation({
      platform: Platform.OS === "ios" ? "ios" : "android",
      appVersion: Constants.expoConfig?.version ?? "0.1.0",
      pushToken: token.data
    });
    return { status: "registered" as const, pushToken: token.data };
  } catch (error) {
    return { status: "skipped" as const, reason: error instanceof Error ? error.message : String(error) };
  }
}
