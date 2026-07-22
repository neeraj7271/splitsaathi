import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { EnvelopeSimple, Phone } from "phosphor-react-native";

import { useTheme } from "../theme";
import { ThemedText } from "./ThemedText";

type AuthIconMethod = "phone" | "email" | "google";

type AuthIconButtonProps = {
  method: AuthIconMethod;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
};

function GoogleMark() {
  return (
    <View style={styles.googleMark}>
      <ThemedText variant="button" style={styles.googleG}>
        G
      </ThemedText>
    </View>
  );
}

export function AuthIconButton({ method, label, onPress, disabled, selected }: AuthIconButtonProps) {
  const theme = useTheme();
  const iconColor = selected ? theme.colors.confirmed : theme.colors.ink;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          borderColor: selected ? theme.colors.confirmed : theme.colors.hairline,
          backgroundColor: theme.colors.surface,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1
        }
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.surfaceRaised }]}>
        {method === "phone" ? <Phone size={22} color={iconColor} weight="duotone" /> : null}
        {method === "email" ? <EnvelopeSimple size={22} color={iconColor} weight="duotone" /> : null}
        {method === "google" ? <GoogleMark /> : null}
      </View>
      <ThemedText variant="caption" tone="muted" align="center">
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    minWidth: 88,
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
  },
  googleMark: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DADCE0"
  },
  googleG: {
    color: "#4285F4",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700"
  }
});
