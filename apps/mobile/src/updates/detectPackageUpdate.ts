import * as Application from "expo-application";
import { AppState, BackHandler, Platform } from "react-native";

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

  // Native version constants only refresh after a full app restart.
  if (Platform.OS === "android") {
    BackHandler.exitApp();
  }
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
