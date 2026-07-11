import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { useTheme } from "../theme";
import { Button } from "./Button";
import { ThemedText } from "./ThemedText";

function EmptyLedgerIllustration({ color }: { color: string }) {
  return (
    <Svg width={64} height={64} viewBox="0 0 64 64" fill="none">
      <Path d="M18 14h28a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4Z" stroke={color} strokeWidth={2} />
      <Path d="M22 25h20M22 33h16M22 41h12" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={46} cy={42} r={5} stroke={color} strokeWidth={2} />
    </Svg>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: { label: string; onPress: () => void } }) {
  const theme = useTheme();

  return (
    <View style={[styles.wrap, { backgroundColor: theme.colors.surface, borderColor: theme.colors.hairline, borderRadius: theme.radius.md }]}>
      <EmptyLedgerIllustration color={theme.colors.inkMuted} />
      <View style={styles.text}>
        <ThemedText variant="section" align="center">
          {title}
        </ThemedText>
        <ThemedText variant="bodySm" tone="muted" align="center">
          {body}
        </ThemedText>
      </View>
      {action ? <Button label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    gap: 16
  },
  text: {
    gap: 8
  }
});
