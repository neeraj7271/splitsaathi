import React, { useState } from "react";
import { StyleSheet, TextInput, TextInputProps, View } from "react-native";

import { useTheme } from "../theme";
import { ThemedText } from "./ThemedText";

interface InputFieldProps extends TextInputProps {
  label: string;
  amount?: boolean;
}

export function InputField({ label, amount = false, style, ...props }: InputFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      <ThemedText variant="caption" tone="muted">
        {label}
      </ThemedText>
      <TextInput
        {...props}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        placeholderTextColor={theme.colors.inkFaint}
        style={[
          styles.input,
          amount ? theme.typography.title : theme.typography.body,
          {
            backgroundColor: theme.colors.surfaceRaised,
            borderColor: focused ? theme.colors.confirmed : "transparent",
            borderRadius: theme.radius.md,
            color: theme.colors.ink,
            textAlign: amount ? "right" : "left"
          },
          style
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8
  },
  input: {
    minHeight: 52,
    paddingHorizontal: 16,
    borderWidth: 1.5
  }
});
