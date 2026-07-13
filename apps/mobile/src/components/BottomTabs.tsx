import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus } from "phosphor-react-native";

import { useTheme } from "../theme";
import { ThemedText } from "./ThemedText";

type IconComponent = React.ComponentType<{ size?: number; color?: string; weight?: "duotone" | "bold" | "regular" | "fill" }>;

export interface TabItem<T extends string> {
  label: string;
  value: T;
  icon: IconComponent;
}

const FAB_SIZE = 56;
// How many pixels the FAB protrudes above the tab bar top border.
// Keeps it close to the bar so it reads as part of navigation, not floating.
const FAB_PROTRUDE = 20;

export function BottomTabs<T extends string>({
  tabs,
  value,
  onChange,
  onFab
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  onFab: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const onGradient = theme.mode === "dark" ? theme.colors.ink : theme.colors.surface;

  // Half the tabs go left of center, half go right
  const mid = Math.ceil(tabs.length / 2);
  const leftTabs = tabs.slice(0, mid);
  const rightTabs = tabs.slice(mid);

  const paddingBottom = Math.max(8, insets.bottom);

  return (
    // Outer wrapper adds top-padding equal to protrusion so nothing is clipped
    <View style={[styles.outer, { paddingTop: FAB_PROTRUDE }]}>
      {/* Tab bar strip */}
      <View
        style={[
          styles.bar,
          {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.hairline,
            paddingBottom
          }
        ]}
      >
        {/* Left tabs */}
        {leftTabs.map((tab) => (
          <TabButton key={tab.value} tab={tab} active={tab.value === value} onPress={() => onChange(tab.value)} theme={theme} />
        ))}

        {/* Center gap where FAB sits */}
        <View style={styles.centerGap} />

        {/* Right tabs */}
        {rightTabs.map((tab) => (
          <TabButton key={tab.value} tab={tab} active={tab.value === value} onPress={() => onChange(tab.value)} theme={theme} />
        ))}
      </View>

      {/* FAB — absolutely centered, protruding above the bar */}
      <Pressable
        onPress={onFab}
        style={[
          styles.fabWrap,
          {
            top: 0, // sits at the very top of the outer wrapper = FAB_PROTRUDE px above bar
            borderColor: theme.colors.canvas
          }
        ]}
      >
        <LinearGradient
          colors={[theme.gradients.current.start, theme.gradients.current.end]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fab}
        >
          <Plus color={onGradient} size={26} weight="bold" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function TabButton<T extends string>({
  tab,
  active,
  onPress,
  theme
}: {
  tab: TabItem<T>;
  active: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const Icon = tab.icon;
  return (
    <Pressable onPress={onPress} style={styles.tab}>
      <Icon size={22} color={active ? theme.colors.confirmed : theme.colors.inkMuted} weight={active ? "bold" : "duotone"} />
      <ThemedText variant="caption" tone={active ? "confirmed" : "muted"}>
        {tab.label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0
  },
  bar: {
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    minHeight: 60
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3
  },
  centerGap: {
    width: FAB_SIZE + 16 // breathing room around FAB
  },
  fabWrap: {
    position: "absolute",
    alignSelf: "center",
    borderRadius: 999,
    borderWidth: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
  }
});
