import React from "react";
import { Text, TextProps } from "react-native";

import { useTheme } from "../theme";

type TextVariant =
  | "displayLg"
  | "balanceHero"
  | "title"
  | "section"
  | "body"
  | "bodyMedium"
  | "bodySm"
  | "amount"
  | "amountSm"
  | "caption"
  | "button";

interface ThemedTextProps extends TextProps {
  variant?: TextVariant;
  tone?: "ink" | "muted" | "faint" | "receive" | "owe" | "pending" | "confirmed" | "disputed" | "info";
  align?: "left" | "center" | "right";
}

export function ThemedText({ variant = "body", tone = "ink", align = "left", style, ...props }: ThemedTextProps) {
  const theme = useTheme();
  const color = tone === "ink" ? theme.colors.ink : tone === "muted" ? theme.colors.inkMuted : tone === "faint" ? theme.colors.inkFaint : theme.colors[tone];

  return <Text {...props} style={[theme.typography[variant], { color, textAlign: align, letterSpacing: 0 }, style]} />;
}
