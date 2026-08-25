import * as Application from "expo-application";
import { Alert, AppState, BackHandler, Platform } from "react-native";

import { clearDismissedVersionCode } from "./updateDismissCache";

let installBaselineMs: number | null = null;
let appStateSubscription: { remove: () => void } | null = null;

async function readLastUpdateTimeMs(): Promise<number | null> {
  try {
    return await Application.getLastUpdateTimeAsync();
  } catch {
    return null;
  }
}

async function handleReturnFromInstall() {
  if (installBaselineMs === null) {
    return;
  }

  const lastUpdateMs = await readLastUpdateTimeMs();
  if (lastUpdateMs === null || lastUpdateMs <= installBaselineMs) {
    return;
  }

  stopWatchingForPackageUpdate();
  await clearDismissedVersionCode();

  Alert.alert(
    "Update installed",
    "Close SplitSaathi completely, then open it again from your home screen to finish updating.",
    [
      {
        text: "Close app",
        onPress: () => {
          if (Platform.OS === "android") {
            BackHandler.exitApp();
          }
        }
      }
    ],
    { cancelable: false }
  );
}

export function watchForPackageUpdateAfterDownload() {
  if (Platform.OS === "web") {
    return;
  }

  void readLastUpdateTimeMs().then((baseline) => {
    installBaselineMs = baseline;
  });

  if (appStateSubscription) {
    return;
  }

  appStateSubscription = AppState.addEventListener("change", (state) => {
    if (state === "active") {
      void handleReturnFromInstall();
    }
  });
}

export function stopWatchingForPackageUpdate() {
  installBaselineMs = null;
  appStateSubscription?.remove();
  appStateSubscription = null;
}
