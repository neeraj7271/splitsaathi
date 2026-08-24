import React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowsClockwise,
  CaretRight,
  FileArrowDown,
  FileCsv,
  Lightning,
  ShieldCheck,
  Sparkle,
  X
} from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme";
import { ThemedText } from "./ThemedText";

interface ImportComingSoonModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ImportComingSoonModal({ visible, onClose }: ImportComingSoonModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = theme.mode === "dark";

  if (!visible) return null;

  const cardBg = isDark ? "#111622" : "#FFFFFF";
  const cardBorder = isDark ? "rgba(255, 255, 255, 0.1)" : "#E2E8F0";
  const itemBg = isDark ? "#161D2C" : "#FAFAFC";
  const itemBorder = isDark ? "rgba(255, 255, 255, 0.07)" : "#F1F5F9";
  const titleColor = isDark ? "#F8FAFC" : "#0F172A";
  const subtitleColor = isDark ? "#94A3B8" : "#64748B";

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.card,
            {
              backgroundColor: cardBg,
              borderColor: cardBorder,
              marginBottom: Math.max(insets.bottom, 12) + 8
            }
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <Pressable
            style={[
              styles.closeBtn,
              { backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(100, 116, 139, 0.1)" }
            ]}
            onPress={onClose}
            hitSlop={10}
          >
            <X size={16} color={isDark ? "#94A3B8" : "#64748B"} weight="bold" />
          </Pressable>

          {/* Hero Decorative Icon Container */}
          <View style={styles.heroWrap}>
            {/* Floating Sparkle Stars */}
            <View style={[styles.star, { top: 0, left: 24 }]}>
              <Sparkle size={12} color="#F59E0B" weight="fill" />
            </View>
            <View style={[styles.star, { top: -2, right: 32 }]}>
              <Sparkle size={14} color="#A78BFA" weight="fill" />
            </View>
            <View style={[styles.star, { bottom: 8, left: 30 }]}>
              <Sparkle size={12} color="#2DD4BF" weight="fill" />
            </View>
            <View style={[styles.star, { bottom: 6, right: 28 }]}>
              <Sparkle size={10} color="#F59E0B" weight="fill" />
            </View>

            {/* Glowing Icon Well */}
            <View style={[styles.iconHalo, { backgroundColor: isDark ? "rgba(139, 92, 246, 0.15)" : "rgba(243, 232, 255, 0.7)" }]}>
              <View style={[styles.iconCore, { backgroundColor: isDark ? "#1E1A38" : "#F3E8FF" }]}>
                <FileArrowDown size={26} color={isDark ? "#C084FC" : "#7C3AED"} weight="duotone" />
              </View>
            </View>

            {/* Coming Soon Pill Tag */}
            <View
              style={[
                styles.comingSoonTag,
                {
                  backgroundColor: isDark ? "rgba(139, 92, 246, 0.2)" : "#F3E8FF",
                  borderColor: isDark ? "rgba(168, 85, 247, 0.3)" : "#E9D5FF"
                }
              ]}
            >
              <Sparkle size={11} color={isDark ? "#C084FC" : "#7C3AED"} weight="fill" />
              <ThemedText style={[styles.tagText, { color: isDark ? "#C084FC" : "#7C3AED" }]}>
                COMING SOON
              </ThemedText>
            </View>
          </View>

          {/* Header Title & Description */}
          <View style={styles.headerTextWrap}>
            <ThemedText style={[styles.title, { color: titleColor }]} align="center">
              Import Expenses & Balances
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: subtitleColor }]} align="center">
              Migrate your groups, friends, and balances into SplitSaathi.
            </ThemedText>
          </View>

          {/* Feature Highlight Cards */}
          <View style={styles.featureList}>
            {/* Feature 1: Splitwise */}
            <View
              style={[
                styles.featureItem,
                {
                  backgroundColor: itemBg,
                  borderColor: itemBorder,
                  borderLeftColor: "#6366F1"
                }
              ]}
            >
              <View style={[styles.featureIconBox, { backgroundColor: isDark ? "rgba(99, 102, 241, 0.18)" : "#EEF2FF" }]}>
                <ArrowsClockwise size={20} color={isDark ? "#818CF8" : "#4F46E5"} weight="bold" />
              </View>
              <View style={styles.featureTextWrap}>
                <ThemedText style={[styles.featureTitle, { color: titleColor }]}>
                  1-Click Splitwise Migration
                </ThemedText>
                <ThemedText style={[styles.featureBody, { color: subtitleColor }]}>
                  Import active groups, members, and balances directly.
                </ThemedText>
              </View>
              <CaretRight size={16} color={isDark ? "#475569" : "#94A3B8"} weight="bold" />
            </View>

            {/* Feature 2: CSV & Excel */}
            <View
              style={[
                styles.featureItem,
                {
                  backgroundColor: itemBg,
                  borderColor: itemBorder,
                  borderLeftColor: "#10B981"
                }
              ]}
            >
              <View style={[styles.featureIconBox, { backgroundColor: isDark ? "rgba(16, 185, 129, 0.18)" : "#ECFDF5" }]}>
                <FileCsv size={20} color={isDark ? "#34D399" : "#059669"} weight="bold" />
              </View>
              <View style={styles.featureTextWrap}>
                <ThemedText style={[styles.featureTitle, { color: titleColor }]}>
                  CSV & Excel Upload
                </ThemedText>
                <ThemedText style={[styles.featureBody, { color: subtitleColor }]}>
                  Parse bill dumps, statements, and spreadsheets automatically.
                </ThemedText>
              </View>
              <CaretRight size={16} color={isDark ? "#475569" : "#94A3B8"} weight="bold" />
            </View>

            {/* Feature 3: Zero Setup */}
            <View
              style={[
                styles.featureItem,
                {
                  backgroundColor: itemBg,
                  borderColor: itemBorder,
                  borderLeftColor: "#F59E0B"
                }
              ]}
            >
              <View style={[styles.featureIconBox, { backgroundColor: isDark ? "rgba(245, 158, 11, 0.18)" : "#FFFBEB" }]}>
                <Lightning size={20} color={isDark ? "#FBBF24" : "#D97706"} weight="bold" />
              </View>
              <View style={styles.featureTextWrap}>
                <ThemedText style={[styles.featureTitle, { color: titleColor }]}>
                  Zero Manual Setup
                </ThemedText>
                <ThemedText style={[styles.featureBody, { color: subtitleColor }]}>
                  Auto-map members and maintain 100% accurate balances.
                </ThemedText>
              </View>
              <CaretRight size={16} color={isDark ? "#475569" : "#94A3B8"} weight="bold" />
            </View>
          </View>

          {/* Footer Security Badge */}
          <View style={styles.trustWrap}>
            <View style={[styles.dividerLine, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#E2E8F0" }]} />
            <View style={styles.trustBadge}>
              <ShieldCheck size={14} color={isDark ? "#34D399" : "#059669"} weight="bold" />
              <ThemedText style={[styles.trustText, { color: isDark ? "#94A3B8" : "#64748B" }]}>
                Your data is safe & secure
              </ThemedText>
            </View>
            <View style={[styles.dividerLine, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#E2E8F0" }]} />
          </View>

          {/* Primary Gradient CTA Button */}
          <Pressable onPress={onClose} style={styles.ctaPressable}>
            <LinearGradient
              colors={["#6366F1", "#0D9488"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientBtn}
            >
              <ThemedText style={styles.btnText}>Got it! ✨</ThemedText>
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    gap: 12,
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center"
  },
  heroWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    marginBottom: 0,
    position: "relative"
  },
  star: {
    position: "absolute",
    zIndex: 2
  },
  iconHalo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6
  },
  iconCore: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center"
  },
  comingSoonTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 3.5,
    borderRadius: 16,
    borderWidth: 1
  },
  tagText: {
    fontSize: 10.5,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5
  },
  headerTextWrap: {
    gap: 4,
    paddingHorizontal: 6
  },
  title: {
    fontSize: 19,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 16
  },
  featureList: {
    gap: 9,
    marginVertical: 2
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4
  },
  featureIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },
  featureTextWrap: {
    flex: 1,
    gap: 2
  },
  featureTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 13.5
  },
  featureBody: {
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 15
  },
  trustWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 2
  },
  dividerLine: {
    flex: 1,
    height: 1
  },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  trustText: {
    fontSize: 11.5,
    fontFamily: "Inter_500Medium"
  },
  ctaPressable: {
    marginTop: 2,
    borderRadius: 18,
    overflow: "hidden"
  },
  gradientBtn: {
    height: 46,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  btnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_700Bold"
  }
});
