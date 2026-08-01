import { Platform, PermissionsAndroid } from "react-native";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { apiClient } from "../api/client";
import { configurePushNotifications } from "./configurePush";

const PUSH_ASKED_KEY = "splitsaathi.pushPermissionAsked.v1";

type NotificationPermissionShape = {
  granted?: boolean;
  status?: string;
  canAskAgain?: boolean;
  ios?: { status?: number };
};

export type PushRegistrationResult =
  | { status: "registered"; pushToken: string; provider: string }
  | { status: "skipped"; reason: string };

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

async function ensureAndroidNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== "android" || Number(Platform.Version) < 33) {
    return true;
  }
  const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  const alreadyGranted = await PermissionsAndroid.check(permission);
  if (alreadyGranted) {
    return true;
  }
  const result = await PermissionsAndroid.request(permission);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

function resolveExpoProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/**
 * Registers the native FCM (Android) / APNs (iOS) device token with the API.
 */
export async function registerPushIfPossible(options?: { forcePrompt?: boolean }): Promise<PushRegistrationResult> {
  if (Platform.OS === "web") {
    return { status: "skipped", reason: "push_not_supported_on_web_preview" };
  }

  if (isExpoGo()) {
    return { status: "skipped", reason: "push_not_supported_in_expo_go" };
  }

  try {
    await configurePushNotifications();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "configure_push_failed";
    console.warn("[SplitSaathi] configurePushNotifications failed", error);
    return { status: "skipped", reason };
  }

  const androidGranted = await ensureAndroidNotificationPermission();
  if (!androidGranted) {
    return { status: "skipped", reason: "android_post_notifications_denied" };
  }

  let permissions = await Notifications.getPermissionsAsync();

  if (!allowsNotifications(permissions as NotificationPermissionShape, Notifications.IosAuthorizationStatus)) {
    const previouslyAsked = await getFlag(PUSH_ASKED_KEY);
    const undetermined = permissions.status === "undetermined" || permissions.status === undefined;
    const canAsk = permissions.canAskAgain !== false;

    if (!options?.forcePrompt && (previouslyAsked || !undetermined || !canAsk)) {
      return { status: "skipped", reason: "permission_previously_decided" };
    }

    permissions = await Notifications.requestPermissionsAsync();
    await setFlag(PUSH_ASKED_KEY);
    if (!allowsNotifications(permissions as NotificationPermissionShape, Notifications.IosAuthorizationStatus)) {
      return { status: "skipped", reason: "permission_denied" };
    }
  } else {
    await setFlag(PUSH_ASKED_KEY);
  }

  try {
    let pushToken: string | undefined;
    let tokenType = "unknown";
    const tokenErrors: string[] = [];

    try {
      const deviceToken = await Notifications.getDevicePushTokenAsync();
      tokenType = deviceToken.type;
      pushToken = typeof deviceToken.data === "string" ? deviceToken.data : JSON.stringify(deviceToken.data);
    } catch (tokenErr) {
      const message = tokenErr instanceof Error ? tokenErr.message : String(tokenErr);
      tokenErrors.push(`fcm:${message}`);
      console.warn("[SplitSaathi] getDevicePushTokenAsync failed", tokenErr);
    }

    if (!pushToken) {
      try {
        const projectId = resolveExpoProjectId();
        const expoToken = projectId
          ? await Notifications.getExpoPushTokenAsync({ projectId })
          : await Notifications.getExpoPushTokenAsync();
        tokenType = "expo";
        pushToken = expoToken.data;
      } catch (expoErr) {
        const message = expoErr instanceof Error ? expoErr.message : String(expoErr);
        tokenErrors.push(`expo:${message}`);
        console.warn("[SplitSaathi] getExpoPushTokenAsync failed", expoErr);
      }
    }

    if (!pushToken || typeof pushToken !== "string") {
      return {
        status: "skipped",
        reason: tokenErrors.length ? tokenErrors.join(" | ") : "empty_device_push_token"
      };
    }

    await apiClient.registerDeviceInstallation({
      platform: Platform.OS === "ios" ? "ios" : "android",
      appVersion: Constants.expoConfig?.version ?? "0.1.0",
      pushToken
    });
    console.log("[SplitSaathi] push token registered", { provider: tokenType, tokenPrefix: pushToken.slice(0, 16) });
    return { status: "registered", pushToken, provider: tokenType };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn("[SplitSaathi] push registration failed", error);
    return { status: "skipped", reason };
  }
}

export async function unregisterPushIfPossible(): Promise<void> {
  if (Platform.OS === "web" || isExpoGo()) {
    return;
  }

  try {
    const deviceToken = await Notifications.getDevicePushTokenAsync();
    const pushToken = typeof deviceToken.data === "string" ? deviceToken.data : JSON.stringify(deviceToken.data);
    if (pushToken) {
      await apiClient.unregisterDevicePush(pushToken);
      return;
    }
  } catch {
    // Fall back to removing all installations for this user.
  }

  await apiClient.unregisterDevicePush();
}
