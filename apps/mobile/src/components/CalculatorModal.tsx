import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { X } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colorWithAlpha, useTheme } from "../theme";
import { ThemedText } from "./ThemedText";
import { Button } from "./Button";

type Operator = "+" | "-" | "×" | "÷";

type CalculatorModalProps = {
  visible: boolean;
  initialValue?: string;
  onClose: () => void;
  onApply: (value: string) => void;
};

function sanitizeSeed(value?: string) {
  const cleaned = (value ?? "").replace(/[^0-9.]/g, "");
  if (!cleaned || cleaned === ".") {
    return "0";
  }
  return cleaned;
}

function formatDisplay(value: string) {
  if (!value || value === "-") {
    return "0";
  }
  return value;
}

function trimTrailingZeros(value: string) {
  if (!value.includes(".")) {
    return value;
  }
  return value.replace(/\.?0+$/, "") || "0";
}

function toAmountInput(value: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }
  const rounded = Math.round(value * 100) / 100;
  return trimTrailingZeros(rounded.toFixed(2));
}

function compute(left: number, right: number, operator: Operator) {
  switch (operator) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "×":
      return left * right;
    case "÷":
      return right === 0 ? NaN : left / right;
  }
}

export function CalculatorModal({ visible, initialValue, onClose, onApply }: CalculatorModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [display, setDisplay] = useState("0");
  const [expression, setExpression] = useState("");
  const [stored, setStored] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [fresh, setFresh] = useState(true);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const seed = sanitizeSeed(initialValue);
    setDisplay(seed);
    setExpression("");
    setStored(null);
    setOperator(null);
    setFresh(true);
  }, [visible, initialValue]);

  function currentNumber() {
    const parsed = Number.parseFloat(display);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function pushDigit(digit: string) {
    setDisplay((current) => {
      if (fresh || current === "0" || current === "Error") {
        return digit;
      }
      if (current.replace("-", "").replace(".", "").length >= 12) {
        return current;
      }
      return `${current}${digit}`;
    });
    setFresh(false);
  }

  function pushDecimal() {
    setDisplay((current) => {
      if (fresh || current === "Error") {
        return "0.";
      }
      if (current.includes(".")) {
        return current;
      }
      return `${current}.`;
    });
    setFresh(false);
  }

  function clearAll() {
    setDisplay("0");
    setExpression("");
    setStored(null);
    setOperator(null);
    setFresh(true);
  }

  function backspace() {
    if (fresh || display === "Error") {
      clearAll();
      return;
    }
    setDisplay((current) => {
      const next = current.slice(0, -1);
      if (!next || next === "-") {
        return "0";
      }
      return next;
    });
  }

  function applyPercent() {
    const value = currentNumber() / 100;
    if (!Number.isFinite(value)) {
      setDisplay("Error");
      setFresh(true);
      return;
    }
    setDisplay(trimTrailingZeros(String(value)));
    setFresh(true);
  }

  function applyOperator(nextOp: Operator) {
    const value = currentNumber();
    if (display === "Error") {
      return;
    }

    if (stored !== null && operator && !fresh) {
      const result = compute(stored, value, operator);
      if (!Number.isFinite(result)) {
        setDisplay("Error");
        setExpression("");
        setStored(null);
        setOperator(null);
        setFresh(true);
        return;
      }
      const shown = trimTrailingZeros(String(Math.round(result * 1e8) / 1e8));
      setDisplay(shown);
      setStored(result);
      setExpression(`${shown} ${nextOp}`);
    } else {
      setStored(value);
      setExpression(`${formatDisplay(display)} ${nextOp}`);
    }

    setOperator(nextOp);
    setFresh(true);
  }

  function applyEquals() {
    if (stored === null || !operator || display === "Error") {
      return;
    }
    const result = compute(stored, currentNumber(), operator);
    if (!Number.isFinite(result)) {
      setDisplay("Error");
      setExpression("");
      setStored(null);
      setOperator(null);
      setFresh(true);
      return;
    }
    const shown = trimTrailingZeros(String(Math.round(result * 1e8) / 1e8));
    setExpression(`${formatDisplay(String(stored))} ${operator} ${formatDisplay(display)} =`);
    setDisplay(shown);
    setStored(null);
    setOperator(null);
    setFresh(true);
  }

  function handleApply() {
    if (display === "Error") {
      return;
    }
    onApply(toAmountInput(currentNumber()));
    onClose();
  }

  const keys: Array<{ id: string; label: string; kind: "digit" | "op" | "fn" | "eq"; onPress: () => void; span?: number }> = [
    { id: "c", label: "C", kind: "fn", onPress: clearAll },
    { id: "bs", label: "⌫", kind: "fn", onPress: backspace },
    { id: "%", label: "%", kind: "fn", onPress: applyPercent },
    { id: "÷", label: "÷", kind: "op", onPress: () => applyOperator("÷") },
    { id: "7", label: "7", kind: "digit", onPress: () => pushDigit("7") },
    { id: "8", label: "8", kind: "digit", onPress: () => pushDigit("8") },
    { id: "9", label: "9", kind: "digit", onPress: () => pushDigit("9") },
    { id: "×", label: "×", kind: "op", onPress: () => applyOperator("×") },
    { id: "4", label: "4", kind: "digit", onPress: () => pushDigit("4") },
    { id: "5", label: "5", kind: "digit", onPress: () => pushDigit("5") },
    { id: "6", label: "6", kind: "digit", onPress: () => pushDigit("6") },
    { id: "-", label: "−", kind: "op", onPress: () => applyOperator("-") },
    { id: "1", label: "1", kind: "digit", onPress: () => pushDigit("1") },
    { id: "2", label: "2", kind: "digit", onPress: () => pushDigit("2") },
    { id: "3", label: "3", kind: "digit", onPress: () => pushDigit("3") },
    { id: "+", label: "+", kind: "op", onPress: () => applyOperator("+") },
    { id: "0", label: "0", kind: "digit", onPress: () => pushDigit("0"), span: 2 },
    { id: ".", label: ".", kind: "digit", onPress: pushDecimal },
    { id: "=", label: "=", kind: "eq", onPress: applyEquals }
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss calculator"
          onPress={onClose}
          style={[styles.backdrop, { backgroundColor: colorWithAlpha("#000000", theme.mode === "dark" ? 0.55 : 0.35) }]}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.hairline,
              paddingBottom: Math.max(insets.bottom, 16),
              borderRadius: theme.radius.lg
            },
            theme.cardShadow
          ]}
        >
          <View style={styles.header}>
            <ThemedText variant="title">Calculator</ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close calculator"
              onPress={onClose}
              hitSlop={8}
              style={[styles.closeBtn, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.hairline }]}
            >
              <X size={16} color={theme.colors.inkMuted} weight="bold" />
            </Pressable>
          </View>

          <View style={[styles.displayWell, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.hairline, borderRadius: theme.radius.md }]}>
            <ThemedText variant="caption" tone="muted" numberOfLines={1} style={styles.expression}>
              {expression || " "}
            </ThemedText>
            <ThemedText variant="balanceHero" numberOfLines={1} adjustsFontSizeToFit style={styles.display}>
              {formatDisplay(display)}
            </ThemedText>
          </View>

          <View style={styles.pad}>
            {[0, 1, 2, 3, 4].map((row) => (
              <View key={`row-${row}`} style={styles.padRow}>
                {keys.slice(row * 4, row * 4 + 4).map((key) => {
                  const activeOp = key.kind === "op" && operator === key.id;
                  const isOpKey = key.kind === "op" || key.kind === "eq";
                  const bg =
                    key.kind === "eq"
                      ? theme.colors.confirmed
                      : key.kind === "op"
                        ? colorWithAlpha(theme.colors.confirmed, theme.mode === "dark" ? 0.22 : 0.12)
                        : key.kind === "fn"
                          ? theme.colors.neutralChipBg
                          : theme.colors.surfaceRaised;
                  const color =
                    key.kind === "eq"
                      ? theme.mode === "dark"
                        ? theme.colors.ink
                        : "#FFFFFF"
                      : key.kind === "op"
                        ? theme.colors.confirmed
                        : theme.colors.ink;

                  return (
                    <Pressable
                      key={key.id}
                      accessibilityRole="button"
                      accessibilityLabel={key.label === "⌫" ? "Backspace" : key.label}
                      onPress={key.onPress}
                      style={({ pressed }) => [
                        styles.key,
                        key.span === 2 ? styles.keyWide : null,
                        {
                          backgroundColor: bg,
                          borderColor: activeOp ? theme.colors.confirmed : theme.colors.hairline,
                          borderRadius: theme.radius.md,
                          opacity: pressed ? 0.82 : 1
                        }
                      ]}
                    >
                      <ThemedText variant={isOpKey ? "title" : "bodyMedium"} style={{ color }}>
                        {key.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          <Button label="Use this amount" onPress={handleApply} disabled={display === "Error"} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end"
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject
  },
  sheet: {
    marginHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    padding: 16,
    gap: 14
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  displayWell: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
    minHeight: 84,
    justifyContent: "flex-end"
  },
  expression: {
    textAlign: "right",
    minHeight: 16
  },
  display: {
    textAlign: "right"
  },
  pad: {
    gap: 8
  },
  padRow: {
    flexDirection: "row",
    gap: 8
  },
  key: {
    flex: 1,
    minHeight: 52,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  keyWide: {
    flex: 2
  }
});
