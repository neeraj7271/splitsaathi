import React from "react";
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { colorWithAlpha, useTheme } from "../theme";
import { ThemedText } from "./ThemedText";

type ButtonIcon = React.ComponentType<{
  size?: number;
  color?: string;
  weight?: "duotone" | "bold" | "fill" | "regular";
}>;

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "soft" | "destructive" | "ghost";
  tone?: "ink" | "confirmed" | "info";
  Icon?: ButtonIcon;
  size?: "default" | "compact";
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  tone = "ink",
  Icon,
  size = "default",
  disabled = false,
  loading = false,
  style
}: ButtonProps) {
  const theme = useTheme();
  const isPrimary = variant === "primary";
  const isSoft = variant === "soft";
  const isCompact = size === "compact";
  const isDisabled = disabled || loading;
  const onGradient = theme.mode === "dark" ? theme.colors.ink : theme.colors.surface;
  const accent = tone === "confirmed" ? theme.colors.confirmed : tone === "info" ? theme.colors.info : theme.colors.ink;
  const sizeStyle = isCompact ? styles.compact : styles.base;

  const labelColor = isPrimary
    ? onGradient
    : variant === "destructive"
      ? theme.colors.owe
      : isSoft
        ? theme.colors.confirmed
        : accent;

  const content = (
    <>
      {loading ? <ActivityIndicator color={isPrimary ? onGradient : labelColor} /> : null}
      {!loading && Icon ? <Icon size={isCompact ? 14 : 18} color={labelColor} weight="duotone" /> : null}
      <ThemedText
        variant={isCompact ? "bodySm" : "button"}
        numberOfLines={1}
        style={[{ color: labelColor, flexShrink: 1 }, isDisabled ? styles.disabledText : null]}
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
          style={[sizeStyle, { borderRadius: theme.radius.full, borderWidth: 0 }]}
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
        sizeStyle,
        {
          borderRadius: theme.radius.full,
          borderColor:
            variant === "destructive"
              ? theme.colors.owe
              : variant === "ghost"
                ? "transparent"
                : isSoft
                  ? "transparent"
                  : tone === "ink"
                    ? theme.colors.hairline
                    : accent,
          backgroundColor: isDisabled
            ? theme.colors.inkFaint
            : isSoft
              ? colorWithAlpha(theme.colors.confirmed, theme.mode === "dark" ? 0.18 : 0.12)
              : "transparent",
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
  compact: {
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    borderWidth: 1
  },
  disabledText: {
    opacity: 0.8
  },
  pressed: {
    opacity: 0.82
  }
});
