import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

export const DEFAULT_PUSH_CHANNEL_ID = "default";
export const APP_UPDATE_CHANNEL_ID = "app_updates";

let configured = false;

/**
 * Foreground banners + Android notification channels for FCM/Expo pushes.
 * Must run once at app bootstrap (before or when registering the device token).
 */
export async function configurePushNotifications() {
  if (configured) {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true
    })
  });

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(APP_UPDATE_CHANNEL_ID, {
      name: "App updates",
      description: "Mandatory SplitSaathi update alerts",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#EF4444",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      showBadge: true
    });

    await Notifications.setNotificationChannelAsync(DEFAULT_PUSH_CHANNEL_ID, {
      name: "SplitSaathi",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#0D9488",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC
    });
  }

  configured = true;
}
