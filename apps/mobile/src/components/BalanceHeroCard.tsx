import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowRight, Eye, EyeSlash } from "phosphor-react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";

import { fontFamily } from "../theme/typography";
import { useTheme } from "../theme";
import { formatSignedMoney } from "../utils/money";
import { ThemedText } from "./ThemedText";

export function BalanceHeroCard({
  label,
  amountMinor,
  currencyCode,
  subtitle,
  primaryAction,
  secondaryAction
}: {
  label: string;
  amountMinor: number;
  currencyCode: string;
  subtitle?: string;
  primaryAction: { label: string; onPress: () => void };
  secondaryAction: { label: string; onPress: () => void };
}) {
  const theme = useTheme();
  const [visible, setVisible] = useState(true);
  const amount = visible ? formatSignedMoney(amountMinor, currencyCode) : "₹••••";
  const onGradient = "#FFFFFF";
  // White pill sits on the brand gradient — keep label dark in both themes.
  const solidBtnText = "#171922";

  return (
    <View style={[{ borderRadius: theme.radius.md }, theme.cardShadow]}>
      <LinearGradient
        colors={[theme.gradients.current.start, theme.gradients.current.end]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, { borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 12 }]}
      >
        <View pointerEvents="none" style={styles.waveWrap}>
          <Svg width="180" height="90" viewBox="0 0 220 120">
            <Path
              d="M10 70C40 40 70 95 110 60C150 25 180 75 210 45"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="2"
              fill="none"
            />
            <Path
              d="M20 95C55 65 85 110 125 80C165 50 190 95 220 70"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="2"
              fill="none"
            />
          </Svg>
        </View>

        <View style={styles.header}>
          <ThemedText variant="caption" style={{ color: "rgba(255,255,255,0.88)" }}>
            {label}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? "Hide balance" : "Show balance"}
            onPress={() => setVisible((current) => !current)}
            style={styles.eye}
            hitSlop={8}
          >
            {visible ? <Eye size={18} color={onGradient} weight="regular" /> : <EyeSlash size={18} color={onGradient} weight="regular" />}
          </Pressable>
        </View>

        <View style={styles.amountBlock}>
          <ThemedText variant="balanceHero" style={{ color: onGradient, fontSize: 28, lineHeight: 34 }}>
            {amount}
          </ThemedText>
          {subtitle ? (
            <ThemedText variant="caption" style={{ color: "rgba(255,255,255,0.82)" }}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={primaryAction.onPress}
            style={({ pressed }) => [styles.primaryBtn, pressed ? styles.pressed : null]}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              style={[styles.btnLabel, { color: solidBtnText }]}
            >
              {primaryAction.label}
            </Text>
            <ArrowRight size={14} color={solidBtnText} weight="bold" />
          </Pressable>
          <Pressable
            onPress={secondaryAction.onPress}
            style={({ pressed }) => [styles.secondaryBtn, pressed ? styles.pressed : null]}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              style={[styles.btnLabel, { color: onGradient }]}
            >
              {secondaryAction.label}
            </Text>
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    overflow: "hidden"
  },
  waveWrap: {
    position: "absolute",
    right: -16,
    top: -10
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  eye: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)"
  },
  amountBlock: {
    gap: 2
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2
  },
  primaryBtn: {
    flex: 1,
    minHeight: 36,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 10
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  btnLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    lineHeight: 16,
    flexShrink: 1
  },
  pressed: {
    opacity: 0.86
  }
});
