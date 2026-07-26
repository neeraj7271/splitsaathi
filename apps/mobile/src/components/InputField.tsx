import React, { useState } from "react";
import { StyleSheet, TextInput, TextInputProps, View } from "react-native";

import { useTheme } from "../theme";
import { ThemedText } from "./ThemedText";

type FieldIcon = React.ComponentType<{
  size?: number;
  color?: string;
  weight?: "duotone" | "bold" | "fill" | "regular";
}>;

interface InputFieldProps extends TextInputProps {
  label: string;
  amount?: boolean;
  Icon?: FieldIcon;
}

export function InputField({ label, amount = false, Icon, style, ...props }: InputFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = focused ? theme.colors.confirmed : theme.colors.hairline;

  return (
    <View style={styles.wrap}>
      <ThemedText variant="bodyMedium">{label}</ThemedText>
      <View
        style={[
          styles.field,
          {
            backgroundColor: theme.colors.surface,
            borderColor,
            borderRadius: theme.radius.lg
          }
        ]}
      >
        {Icon ? <Icon size={18} color={theme.colors.inkMuted} weight="duotone" /> : null}
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
              color: theme.colors.ink,
              textAlign: amount ? "right" : "left"
            },
            style
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8
  },
  field: {
    minHeight: 52,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  input: {
    flex: 1,
    minHeight: 52,
    paddingVertical: 0
  }
});
