import React, { useCallback, useEffect, useState } from "react";
import { AppState, Linking, Modal, Pressable, StyleSheet, View } from "react-native";
import { DownloadSimple, Warning } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme";
import { Button } from "./Button";
import { ThemedText } from "./ThemedText";
import { AppVersionInfo, getDirectApkDownloadUrl, resolveAppUpdatePrompt } from "../updates/checkAppVersion";
import { subscribeUpdateCheck } from "../updates/updateCheckEvents";
import { watchForPackageUpdateAfterDownload } from "../updates/detectPackageUpdate";
import { setDismissedVersionCode } from "../updates/updateDismissCache";

export function AppUpdateModal() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [versionInfo, setVersionInfo] = useState<AppVersionInfo | null>(null);

  const refreshUpdateState = useCallback(async () => {
    try {
      const nextPrompt = await resolveAppUpdatePrompt();
      setVersionInfo(nextPrompt);
    } catch {
      // Silently ignore version check network errors
    }
  }, []);

  useEffect(() => {
    void refreshUpdateState();

    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshUpdateState();
      }
    });

    const unsubscribeUpdateCheck = subscribeUpdateCheck(() => {
      void refreshUpdateState();
    });

    return () => {
      appStateSub.remove();
      unsubscribeUpdateCheck();
    };
  }, [refreshUpdateState]);

  if (!versionInfo) {
    return null;
  }

  const handleUpdate = () => {
    const targetUrl = getDirectApkDownloadUrl(versionInfo.directApkUrl);
    if (targetUrl) {
      watchForPackageUpdateAfterDownload();
      void Linking.openURL(targetUrl);
    }
  };

  const handleRemindLater = () => {
    void setDismissedVersionCode(versionInfo.latestVersionCode).finally(() => {
      setVersionInfo(null);
    });
  };

  return (
    <Modal visible={true} animationType="fade" transparent={true} onRequestClose={() => {}}>
      <Pressable style={styles.backdrop}>
        <Pressable
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.hairline,
              marginBottom: Math.max(insets.bottom, 16) + 12
            }
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.badgeContainer}>
            <View style={[styles.iconWell, { backgroundColor: "rgba(239,68,68,0.12)" }]}>
              <Warning size={32} color="#EF4444" weight="duotone" />
            </View>
            <View style={[styles.tag, { backgroundColor: "rgba(239,68,68,0.15)" }]}>
              <ThemedText style={[styles.tagText, { color: "#EF4444" }]}>UPDATE REQUIRED</ThemedText>
            </View>
          </View>

          <View style={styles.headerTextWrap}>
            <ThemedText variant="title" align="center" style={styles.title}>
              Update Required to Continue
            </ThemedText>
            <ThemedText variant="bodySm" tone="muted" align="center" style={styles.subtitle}>
              Version {versionInfo.latestVersionName} must be installed to keep using SplitSaathi.
            </ThemedText>
            <ThemedText variant="caption" tone="muted" align="center" style={styles.subtitle}>
              After installing, SplitSaathi will close automatically. Open it again from your home screen.
            </ThemedText>
          </View>

          {versionInfo.releaseNotes ? (
            <View style={[styles.notesContainer, { backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(248,250,252,0.8)" }]}>
              <ThemedText variant="caption" style={{ fontWeight: "700", marginBottom: 4 }}>
                What's New:
              </ThemedText>
              <ThemedText variant="caption" tone="muted" style={{ lineHeight: 18 }}>
                {versionInfo.releaseNotes}
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.actionsWrap}>
            <Button label="Download & Install Update" onPress={handleUpdate} Icon={DownloadSimple} style={styles.primaryBtn} />
            <Button label="Remind Me Later" variant="ghost" onPress={handleRemindLater} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20
  },
  card: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    gap: 14,
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10
  },
  badgeContainer: {
    alignItems: "center",
    gap: 8,
    marginTop: 4
  },
  iconWell: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center"
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12
  },
  tagText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5
  },
  headerTextWrap: {
    gap: 6
  },
  title: {
    fontSize: 20,
    fontWeight: "700"
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18
  },
  notesContainer: {
    padding: 12,
    borderRadius: 12,
    marginVertical: 4
  },
  actionsWrap: {
    gap: 8,
    marginTop: 4
  },
  primaryBtn: {
    borderRadius: 20,
    paddingVertical: 14
  }
});
