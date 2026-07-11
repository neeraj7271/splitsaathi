import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Eye, EyeSlash } from "phosphor-react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "../theme";
import { formatSignedMoney } from "../utils/money";
import { Button } from "./Button";
import { ThemedText } from "./ThemedText";

export function BalanceHeroCard({
  label,
  amountMinor,
  currencyCode,
  primaryAction,
  secondaryAction
}: {
  label: string;
  amountMinor: number;
  currencyCode: string;
  primaryAction: { label: string; onPress: () => void };
  secondaryAction: { label: string; onPress: () => void };
}) {
  const theme = useTheme();
  const [visible, setVisible] = useState(true);
  const amount = visible ? formatSignedMoney(amountMinor, currencyCode) : "INR ****";
  const onGradient = theme.mode === "dark" ? theme.colors.ink : theme.colors.surface;

  return (
    <LinearGradient
      colors={[theme.gradients.current.start, theme.gradients.current.end]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, { borderRadius: theme.radius.lg, padding: theme.spacing.cardPadding }]}
    >
      <View style={styles.header}>
        <ThemedText variant="caption" style={{ color: onGradient }}>
          {label}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? "Hide balance" : "Show balance"}
          onPress={() => setVisible((current) => !current)}
          style={styles.eye}
        >
          {visible ? <Eye size={20} color={onGradient} weight="duotone" /> : <EyeSlash size={20} color={onGradient} weight="duotone" />}
        </Pressable>
      </View>
      <ThemedText variant="balanceHero" style={{ color: onGradient }}>
        {amount}
      </ThemedText>
      <View style={styles.actions}>
        <Button label={primaryAction.label} onPress={primaryAction.onPress} variant="secondary" style={styles.heroButton} />
        <Button label={secondaryAction.label} onPress={secondaryAction.onPress} variant="secondary" style={styles.heroButton} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 16,
    minHeight: 184,
    justifyContent: "space-between",
    overflow: "hidden"
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  eye: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)"
  },
  actions: {
    flexDirection: "row",
    gap: 12
  },
  heroButton: {
    flex: 1,
    borderColor: "rgba(255,255,255,0.32)",
    backgroundColor: "rgba(255,255,255,0.12)"
  }
});
