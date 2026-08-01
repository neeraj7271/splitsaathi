import React, { useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { CaretDown, Check } from "phosphor-react-native";

import { ThemedText } from "./ThemedText";
import { cardShadow, colorWithAlpha, useTheme } from "../theme";

type SelectIcon = React.ComponentType<{
  size?: number;
  color?: string;
  weight?: "duotone" | "bold" | "fill" | "regular";
}>;

export type SearchableSelectOption<T extends string> = {
  label: string;
  value: T;
  subtitle?: string;
  Icon?: SelectIcon;
  iconColor?: string;
};

interface SearchableSelectProps<T extends string> {
  value: T;
  options: SearchableSelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  onOpenChange?: (open: boolean) => void;
  compact?: boolean;
  maxListHeight?: number;
};

type AnchorRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function OptionIcon({
  Icon,
  color,
  themeMode
}: {
  Icon: SelectIcon;
  color: string;
  themeMode: "dark" | "light";
}) {
  return (
    <View style={[styles.iconBadge, { backgroundColor: colorWithAlpha(color, themeMode === "dark" ? 0.24 : 0.12) }]}>
      <Icon size={16} color={color} weight="duotone" />
    </View>
  );
}

export function SearchableSelect<T extends string>({
  value,
  options,
  onChange,
  placeholder = "Select",
  onOpenChange,
  compact = false,
  maxListHeight = 220
}: SearchableSelectProps<T>) {
  const theme = useTheme();
  const triggerRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);

  const selectedOption = options.find((option) => option.value === value);
  const selectedLabel = selectedOption?.label ?? placeholder;
  const SelectedIcon = selectedOption?.Icon;

  function setExpanded(nextOpen: boolean) {
    setOpen(nextOpen);
    onOpenChange?.(nextOpen);
    if (!nextOpen) {
      setAnchor(null);
    }
  }

  function openDropdown() {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setExpanded(true);
    });
  }

  function toggleDropdown() {
    if (open) {
      setExpanded(false);
      return;
    }
    openDropdown();
  }

  function selectOption(nextValue: T) {
    onChange(nextValue);
    setExpanded(false);
  }

  const triggerBorder = open ? theme.colors.confirmed : theme.colors.hairline;
  const panelRadius = compact ? theme.radius.md : theme.radius.lg;

  return (
    <View style={[styles.root, compact ? styles.rootCompact : null, open ? styles.rootOpen : null]}>
      <View ref={triggerRef} collapsable={false} style={compact ? styles.triggerWrapCompact : styles.triggerWrap}>
        <Pressable
          onPress={toggleDropdown}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={selectedLabel}
          style={[
            styles.trigger,
            compact ? styles.triggerCompact : null,
            {
              backgroundColor: theme.colors.surface,
              borderColor: triggerBorder,
              borderRadius: panelRadius
            }
          ]}
        >
          {SelectedIcon ? (
            <OptionIcon Icon={SelectedIcon} color={selectedOption?.iconColor ?? theme.colors.confirmed} themeMode={theme.mode} />
          ) : null}
          <ThemedText variant="bodyMedium" numberOfLines={1} ellipsizeMode="tail" style={styles.triggerLabel}>
            {selectedLabel}
          </ThemedText>
          <CaretDown size={14} color={theme.colors.inkMuted} weight="bold" style={open ? styles.caretOpen : undefined} />
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setExpanded(false)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={() => setExpanded(false)}
          style={[styles.backdrop, { backgroundColor: colorWithAlpha("#000000", theme.mode === "dark" ? 0.2 : 0.08) }]}
        />
        {anchor ? (
          <View
            pointerEvents="box-none"
            style={[
              styles.floatingPanel,
              cardShadow(theme.mode),
              {
                top: anchor.y + anchor.height + 4,
                left: anchor.x,
                width: anchor.width,
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.hairline,
                borderRadius: panelRadius
              }
            ]}
          >
            <ScrollView
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              bounces={false}
              style={{ maxHeight: maxListHeight }}
              contentContainerStyle={styles.optionsContent}
            >
              {options.map((item, index) => {
                const active = item.value === value;
                const iconColor = item.iconColor ?? theme.colors.confirmed;
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => selectOption(item.value)}
                    style={({ pressed }) => [
                      styles.optionRow,
                      compact ? styles.optionRowCompact : null,
                      index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.hairline } : null,
                      pressed ? styles.pressed : null,
                      active ? { backgroundColor: colorWithAlpha(theme.colors.confirmed, theme.mode === "dark" ? 0.12 : 0.06) } : null
                    ]}
                  >
                    {item.Icon ? <OptionIcon Icon={item.Icon} color={iconColor} themeMode={theme.mode} /> : null}
                    <ThemedText variant={compact ? "bodySm" : "bodyMedium"} numberOfLines={2} style={styles.optionLabel}>
                      {item.label}
                    </ThemedText>
                    {active ? <Check size={16} color={theme.colors.confirmed} weight="bold" /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
    minWidth: 0
  },
  rootCompact: {
    flex: 1,
    width: undefined
  },
  rootOpen: {
    zIndex: 30
  },
  triggerWrap: {
    width: "100%"
  },
  triggerWrapCompact: {
    flex: 1,
    minWidth: 0
  },
  trigger: {
    minHeight: 48,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 14
  },
  triggerCompact: {
    minHeight: 44,
    paddingHorizontal: 8,
    gap: 6
  },
  triggerLabel: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1
  },
  caretOpen: {
    transform: [{ rotate: "180deg" }]
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject
  },
  floatingPanel: {
    position: "absolute",
    borderWidth: 1,
    overflow: "hidden"
  },
  optionsContent: {
    flexGrow: 0
  },
  optionRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  optionRowCompact: {
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },
  optionLabel: {
    flex: 1,
    minWidth: 0
  },
  pressed: {
    opacity: 0.86
  }
});
