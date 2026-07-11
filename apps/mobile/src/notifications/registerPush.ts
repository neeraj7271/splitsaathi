import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { apiClient } from "../api/client";

type NotificationPermissionShape = {
  granted?: boolean;
  status?: string;
  ios?: { status?: number };
};

function allowsNotifications(permission: NotificationPermissionShape) {
  return Boolean(permission.granted) || permission.status === "granted" || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export async function registerPushIfPossible() {
  if (Platform.OS === "web") {
    return { status: "skipped" as const, reason: "push_not_supported_on_web_preview" };
  }

  const permissions = await Notifications.getPermissionsAsync();
  const granted = allowsNotifications(permissions as NotificationPermissionShape) ? permissions : await Notifications.requestPermissionsAsync();
  if (!allowsNotifications(granted as NotificationPermissionShape)) {
    return { status: "skipped" as const, reason: "permission_denied" };
  }
  try {
    const token = await Notifications.getExpoPushTokenAsync();
    await apiClient.registerDeviceInstallation({
      platform: Platform.OS === "ios" ? "ios" : "android",
      appVersion: "development",
      pushToken: token.data
    });
    return { status: "registered" as const, pushToken: token.data };
  } catch (error) {
    return { status: "skipped" as const, reason: error instanceof Error ? error.message : String(error) };
  }
}
