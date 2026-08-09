import React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import {
  ArrowsClockwise,
  CheckCircle,
  FileArrowDown,
  FileCsv,
  Lightning,
  Sparkle,
  X
} from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme";
import { Button } from "./Button";
import { ThemedText } from "./ThemedText";

interface ImportComingSoonModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ImportComingSoonModal({ visible, onClose }: ImportComingSoonModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
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
          {/* Close button */}
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
            <X size={18} color={theme.colors.inkMuted} weight="bold" />
          </Pressable>

          {/* Icon Badge */}
          <View style={styles.badgeContainer}>
            <View style={styles.iconWell}>
              <FileArrowDown size={32} color="#F59E0B" weight="duotone" />
            </View>
            <View style={styles.comingSoonTag}>
              <Sparkle size={12} color="#F59E0B" weight="fill" />
              <ThemedText style={styles.tagText}>COMING SOON</ThemedText>
            </View>
          </View>

          {/* Title & Subtitle */}
          <View style={styles.headerTextWrap}>
            <ThemedText variant="title" align="center" style={styles.title}>
              Import Expenses & Balances
            </ThemedText>
            <ThemedText variant="bodySm" tone="muted" align="center" style={styles.subtitle}>
              Effortlessly migrate your groups, friend lists, and ledger history into SplitSaathi.
            </ThemedText>
          </View>

          {/* Feature Details List */}
          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <View style={[styles.featureIconBox, { backgroundColor: "rgba(139,92,246,0.12)" }]}>
                <ArrowsClockwise size={18} color="#8B5CF6" weight="duotone" />
              </View>
              <View style={styles.featureTextWrap}>
                <ThemedText variant="bodyMedium" style={styles.featureTitle}>
                  1-Click Splitwise Migration
                </ThemedText>
                <ThemedText variant="caption" tone="muted">
                  Import your active groups, members, and pending balances directly without starting from scratch.
                </ThemedText>
              </View>
            </View>

            <View style={styles.featureItem}>
              <View style={[styles.featureIconBox, { backgroundColor: "rgba(16,185,129,0.12)" }]}>
                <FileCsv size={18} color="#10B981" weight="duotone" />
              </View>
              <View style={styles.featureTextWrap}>
                <ThemedText variant="bodyMedium" style={styles.featureTitle}>
                  CSV & Excel Upload
                </ThemedText>
                <ThemedText variant="caption" tone="muted">
                  Parse custom bill dumps, bank statements, or spreadsheet exports automatically into expense items.
                </ThemedText>
              </View>
            </View>

            <View style={styles.featureItem}>
              <View style={[styles.featureIconBox, { backgroundColor: "rgba(245,158,11,0.12)" }]}>
                <Lightning size={18} color="#F59E0B" weight="duotone" />
              </View>
              <View style={styles.featureTextWrap}>
                <ThemedText variant="bodyMedium" style={styles.featureTitle}>
                  Zero Manual Setup
                </ThemedText>
                <ThemedText variant="caption" tone="muted">
                  Auto-map member names, preserve audit logs, and maintain 100% accurate balances.
                </ThemedText>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsWrap}>
            <Button
              label="Got it!"
              onPress={onClose}
              style={styles.primaryBtn}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
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
    gap: 16,
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
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
    backgroundColor: "rgba(245,158,11,0.12)",
    alignItems: "center",
    justifyContent: "center"
  },
  comingSoonTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(245,158,11,0.15)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.3)"
  },
  tagText: {
    color: "#D97706",
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
  featureList: {
    gap: 12,
    marginVertical: 4
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 10,
    borderRadius: 14,
    backgroundColor: "rgba(248,250,252,0.6)"
  },
  featureIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },
  featureTextWrap: {
    flex: 1,
    gap: 2
  },
  featureTitle: {
    fontWeight: "600",
    fontSize: 14,
    color: "#1E293B"
  },
  actionsWrap: {
    gap: 8,
    marginTop: 4
  },
  primaryBtn: {
    borderRadius: 24,
    paddingVertical: 14
  }
});
