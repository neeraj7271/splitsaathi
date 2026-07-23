import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

export const DEFAULT_PUSH_CHANNEL_ID = "default";

let configured = false;

/**
 * Foreground banners + Android notification channel for FCM/Expo pushes.
 * Must run once at app bootstrap (before or when registering the device token).
 */
export async function configurePushNotifications() {
  if (configured) {
    return;
  }
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true
    })
  });

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(DEFAULT_PUSH_CHANNEL_ID, {
      name: "SplitSaathi",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#0D9488",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC
    });
  }
}
