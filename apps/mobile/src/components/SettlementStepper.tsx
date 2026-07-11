import React from "react";
import { StyleSheet, View } from "react-native";
import { Check } from "phosphor-react-native";

import { useTheme } from "../theme";
import { SettlementState } from "../types/domain";
import { ThemedText } from "./ThemedText";

const steps = [
  { label: "Intent", states: ["intent_created", "intent_generated"] },
  { label: "UPI opened", states: ["payer_opened_upi_app"] },
  { label: "Proof", states: ["proof_submitted", "auto_matched", "awaiting_receiver_confirmation"] },
  { label: "Confirmed", states: ["confirmed"] },
  { label: "Posted", states: ["ledger_posted"] }
] as const;

function stepIndexFor(state: SettlementState | undefined) {
  if (!state || state === "suggested") {
    return -1;
  }

  const index = steps.findIndex((step) => (step.states as readonly string[]).includes(state));
  return index >= 0 ? index : state === "reversed" || state === "refunded" ? steps.length - 1 : index;
}

export function SettlementStepper({ state }: { state?: SettlementState }) {
  const theme = useTheme();
  const currentIndex = stepIndexFor(state);
  const onColor = theme.mode === "dark" ? theme.colors.ink : theme.colors.surface;

  return (
    <View style={styles.wrap}>
      {steps.map((step, index) => {
        const complete = index <= currentIndex;
        return (
          <View key={step.label} style={styles.step}>
            <View style={styles.railWrap}>
              <View
                style={[
                  styles.node,
                  {
                    borderColor: complete ? theme.colors.confirmed : theme.colors.inkFaint,
                    backgroundColor: complete ? theme.colors.confirmed : theme.colors.canvas
                  }
                ]}
              >
                {complete ? <Check size={12} color={onColor} weight="bold" /> : null}
              </View>
              {index < steps.length - 1 ? <View style={[styles.line, { backgroundColor: index < currentIndex ? theme.colors.confirmed : theme.colors.hairline }]} /> : null}
            </View>
            <ThemedText variant="caption" tone={complete ? "confirmed" : "muted"} align="center">
              {step.label}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start"
  },
  step: {
    flex: 1,
    alignItems: "center",
    gap: 8
  },
  railWrap: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%"
  },
  node: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center"
  },
  line: {
    flex: 1,
    height: 2
  }
});
