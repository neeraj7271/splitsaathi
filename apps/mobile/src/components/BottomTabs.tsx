import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Plus } from "phosphor-react-native";

import { useTheme } from "../theme";
import { ThemedText } from "./ThemedText";

type IconComponent = React.ComponentType<{ size?: number; color?: string; weight?: "duotone" | "bold" | "regular" | "fill" }>;

export interface TabItem<T extends string> {
  label: string;
  value: T;
  icon: IconComponent;
}

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
  const onGradient = theme.mode === "dark" ? theme.colors.ink : theme.colors.surface;

  return (
    <View style={[styles.wrap, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.hairline }]}>
      {tabs.map((tab, index) => {
        const active = tab.value === value;
        const Icon = tab.icon;
        const insertSpace = index === Math.floor(tabs.length / 2);
        return (
          <React.Fragment key={tab.value}>
            {insertSpace ? <View style={styles.fabSpace} /> : null}
            <Pressable onPress={() => onChange(tab.value)} style={styles.tab}>
              <Icon size={22} color={active ? theme.colors.confirmed : theme.colors.inkMuted} weight={active ? "bold" : "duotone"} />
              <ThemedText variant="caption" tone={active ? "confirmed" : "muted"}>
                {tab.label}
              </ThemedText>
            </Pressable>
          </React.Fragment>
        );
      })}
      <Pressable onPress={onFab} style={styles.fabWrap}>
        <LinearGradient
          colors={[theme.gradients.current.start, theme.gradients.current.end]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fab}
        >
          <Plus color={onGradient} size={28} weight="bold" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    minHeight: 76,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingBottom: 8,
    paddingTop: 8
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4
  },
  fabSpace: {
    width: 72
  },
  fabWrap: {
    position: "absolute",
    top: -28,
    alignSelf: "center"
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
  }
});
