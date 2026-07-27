import React from "react";
import { StyleSheet, View } from "react-native";
import { Check, PencilSimple, DeviceMobile, FileText, CheckCircle, DownloadSimple } from "phosphor-react-native";

import { colorWithAlpha, useTheme } from "../theme";
import { SettlementState } from "../types/domain";
import { ThemedText } from "./ThemedText";

type StepIcon = React.ComponentType<{ size?: number; color?: string; weight?: "duotone" | "bold" | "fill" | "regular" }>;

const steps: Array<{ label: string; states: readonly string[]; Icon: StepIcon }> = [
  { label: "Intent", states: ["intent_created", "intent_generated"], Icon: PencilSimple },
  { label: "UPI opened", states: ["payer_opened_upi_app"], Icon: DeviceMobile },
  { label: "Proof", states: ["proof_submitted", "auto_matched", "awaiting_receiver_confirmation"], Icon: FileText },
  { label: "Confirmed", states: ["confirmed"], Icon: CheckCircle },
  { label: "Posted", states: ["ledger_posted"], Icon: DownloadSimple }
];

function stepIndexFor(state: SettlementState | undefined) {
  if (!state || state === "suggested") {
    return -1;
  }

  const index = steps.findIndex((step) => step.states.includes(state));
  return index >= 0 ? index : state === "reversed" || state === "refunded" ? steps.length - 1 : index;
}

export function SettlementStepper({ state }: { state?: SettlementState }) {
  const theme = useTheme();
  const currentIndex = stepIndexFor(state);
  const onColor = theme.mode === "dark" ? theme.colors.ink : theme.colors.surface;

  return (
    <View style={styles.wrap}>
      <View style={styles.railContainer}>
        {steps.slice(0, -1).map((_, index) => (
          <View
            key={index}
            style={[
              styles.railSegment,
              { backgroundColor: index < currentIndex ? theme.colors.confirmed : theme.colors.hairline }
            ]}
          />
        ))}
      </View>

      {steps.map((step, index) => {
        const complete = index <= currentIndex;
        const StepIcon = step.Icon;
        return (
          <View key={step.label} style={styles.step}>
            <View
              style={[
                styles.node,
                {
                  borderColor: complete ? theme.colors.confirmed : theme.colors.inkFaint,
                  backgroundColor: complete ? theme.colors.confirmed : theme.colors.canvas
                }
              ]}
            >
              {complete ? (
                <StepIcon size={16} color={onColor} weight="bold" />
              ) : (
                <StepIcon size={16} color={theme.colors.inkFaint} weight="regular" />
              )}
            </View>
            <ThemedText variant="caption" tone={complete ? "confirmed" : "muted"} align="center" numberOfLines={1}>
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
    alignItems: "flex-start",
    position: "relative"
  },
  railContainer: {
    position: "absolute",
    top: 15,
    left: "10%",
    right: "10%",
    height: 2,
    flexDirection: "row"
  },
  railSegment: {
    flex: 1,
    height: "100%"
  },
  step: {
    flex: 1,
    alignItems: "center",
    gap: 8
  },
  node: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center"
  }
});
