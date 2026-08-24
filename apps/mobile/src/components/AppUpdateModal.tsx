import React, { useEffect, useState } from "react";
import { Linking, Modal, Pressable, StyleSheet, View } from "react-native";
import { DownloadSimple, Sparkle, Warning, X } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme";
import { Button } from "./Button";
import { ThemedText } from "./ThemedText";
import versionConfig from "../../version.json";

interface AppVersionInfo {
  latestVersionName: string;
  latestVersionCode: number;
  minSupportedVersionCode: number;
  updateAvailable: boolean;
  forceUpdate: boolean;
  directApkUrl: string;
  playStoreUrl: string;
  releaseNotes: string;
}

export function AppUpdateModal() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [versionInfo, setVersionInfo] = useState<AppVersionInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function checkVersion() {
      try {
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || "https://api-dev.thesplitsaathi.com";
        const currentCode = versionConfig.versionCode || 100;
        const res = await fetch(`${apiUrl}/v1/app/version?versionCode=${currentCode}`);
        if (res.ok) {
          const data: AppVersionInfo = await res.json();
          if (mounted) {
            // Show modal if server reports updateAvailable or forceUpdate
            if (data.updateAvailable || data.forceUpdate) {
              setVersionInfo(data);
            }
          }
        }
      } catch {
        // Silently ignore version check network errors
      }
    }

    void checkVersion();
    return () => {
      mounted = false;
    };
  }, []);

  if (!versionInfo || (dismissed && !versionInfo.forceUpdate)) {
    return null;
  }

  const handleUpdate = () => {
    const targetUrl = versionInfo.directApkUrl || versionInfo.playStoreUrl;
    if (targetUrl) {
      void Linking.openURL(targetUrl);
    }
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
          {/* Close button (only if not forced update) */}
          {!versionInfo.forceUpdate && (
            <Pressable style={styles.closeBtn} onPress={() => setDismissed(true)} hitSlop={12}>
              <X size={18} color={theme.colors.inkMuted} weight="bold" />
            </Pressable>
          )}

          {/* Icon Badge */}
          <View style={styles.badgeContainer}>
            <View style={[styles.iconWell, { backgroundColor: versionInfo.forceUpdate ? "rgba(239,68,68,0.12)" : "rgba(139,92,246,0.12)" }]}>
              {versionInfo.forceUpdate ? (
                <Warning size={32} color="#EF4444" weight="duotone" />
              ) : (
                <Sparkle size={32} color="#8B5CF6" weight="duotone" />
              )}
            </View>
            <View style={[styles.tag, { backgroundColor: versionInfo.forceUpdate ? "rgba(239,68,68,0.15)" : "rgba(139,92,246,0.15)" }]}>
              <ThemedText style={[styles.tagText, { color: versionInfo.forceUpdate ? "#EF4444" : theme.mode === "dark" ? "#A78BFA" : "#7C3AED" }]}>
                {versionInfo.forceUpdate ? "CRITICAL UPDATE REQUIRED" : `NEW VERSION v${versionInfo.latestVersionName}`}
              </ThemedText>
            </View>
          </View>

          {/* Title & Description */}
          <View style={styles.headerTextWrap}>
            <ThemedText variant="title" align="center" style={styles.title}>
              {versionInfo.forceUpdate ? "Update Required to Continue" : "SplitSaathi Update Available"}
            </ThemedText>
            <ThemedText variant="bodySm" tone="muted" align="center" style={styles.subtitle}>
              {versionInfo.forceUpdate
                ? "A critical security and feature update is required to continue using SplitSaathi."
                : `Version ${versionInfo.latestVersionName} is now available with new improvements.`}
            </ThemedText>
          </View>

          {/* Release Notes */}
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

          {/* Actions */}
          <View style={styles.actionsWrap}>
            <Button
              label={versionInfo.forceUpdate ? "Update Now" : "Download & Install Update"}
              onPress={handleUpdate}
              Icon={DownloadSimple}
              style={styles.primaryBtn}
            />
            {!versionInfo.forceUpdate && (
              <Button
                label="Remind Me Later"
                variant="ghost"
                onPress={() => setDismissed(true)}
              />
            )}
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
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(100,116,139,0.1)",
    alignItems: "center",
    justifyContent: "center"
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
