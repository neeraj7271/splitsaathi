import React from "react";
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "../theme";
import { ThemedText } from "./ThemedText";

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "destructive" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, variant = "primary", disabled = false, loading = false, style }: ButtonProps) {
  const theme = useTheme();
  const isPrimary = variant === "primary";
  const isDisabled = disabled || loading;
  const onGradient = theme.mode === "dark" ? theme.colors.ink : theme.colors.surface;
  const content = (
    <>
      {loading ? <ActivityIndicator color={isPrimary ? onGradient : theme.colors.confirmed} /> : null}
      <ThemedText
        variant="button"
        tone={variant === "destructive" ? "owe" : isPrimary ? "ink" : "ink"}
        style={[isPrimary ? { color: onGradient } : null, isDisabled ? styles.disabledText : null]}
      >
        {label}
      </ThemedText>
    </>
  );

  if (isPrimary && !isDisabled) {
    return (
      <Pressable onPress={onPress} disabled={isDisabled} style={({ pressed }) => [styles.pressable, pressed ? styles.pressed : null, style]}>
        <LinearGradient
          colors={[theme.gradients.current.start, theme.gradients.current.end]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.base, { borderRadius: theme.radius.full }]}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          borderRadius: theme.radius.full,
          borderColor: variant === "destructive" ? theme.colors.owe : variant === "ghost" ? "transparent" : theme.colors.hairline,
          backgroundColor: isDisabled ? theme.colors.inkFaint : "transparent",
          opacity: isDisabled ? 0.4 : 1
        },
        pressed ? styles.pressed : null,
        style
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    overflow: "hidden"
  },
  base: {
    minHeight: 48,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1
  },
  disabledText: {
    opacity: 0.8
  },
  pressed: {
    opacity: 0.82
  }
});
