import React, { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check } from "phosphor-react-native";

import { apiClient } from "../api/client";
import { DataSurface } from "../components/DataSurface";
import { InlineNotice } from "../components/InlineNotice";
import { Screen } from "../components/Screen";
import { ThemedText } from "../components/ThemedText";
import { useTheme, type ThemeMode } from "../theme";
import { AppNavigation } from "../types/navigation";

const APPEARANCE_OPTIONS: Array<{ label: string; value: ThemeMode }> = [
  { label: "Use system setting", value: "system" },
  { label: "Dark", value: "dark" },
  { label: "Light", value: "light" }
];

export function AppearanceSettingsScreen({ navigation }: { navigation: AppNavigation }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const preferencesQuery = useQuery({ queryKey: ["preferences"], queryFn: () => apiClient.getPreferences() });

  const savePreferences = useMutation({
    mutationFn: (appearance: ThemeMode) => apiClient.updatePreferences({ appearance }),
    onSuccess: (preferences) => {
      queryClient.setQueryData(["preferences"], preferences);
      theme.setRequestedMode(preferences.appearance);
    }
  });

  useEffect(() => {
    if (preferencesQuery.data?.appearance) {
      theme.setRequestedMode(preferencesQuery.data.appearance);
    }
  }, [preferencesQuery.data?.appearance]);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.go("profile")} style={styles.backButton}>
          <ArrowLeft size={22} color={theme.colors.ink} />
        </Pressable>
        <ThemedText variant="title">Appearance</ThemedText>
      </View>

      {preferencesQuery.error ? <InlineNotice title="Settings could not load" body={preferencesQuery.error.message} tone="owe" /> : null}
      {savePreferences.error ? <InlineNotice title="Save failed" body={savePreferences.error.message} tone="owe" /> : null}

      <DataSurface>
        <View style={styles.block}>
          {APPEARANCE_OPTIONS.map((option) => {
            const selected = (preferencesQuery.data?.appearance ?? theme.requestedMode) === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => savePreferences.mutate(option.value)}
                style={[styles.optionRow, { backgroundColor: theme.colors.surface }]}
              >
                <ThemedText variant="body">{option.label}</ThemedText>
                {selected ? <Check size={18} color={theme.colors.confirmed} weight="bold" /> : null}
              </Pressable>
            );
          })}
        </View>
      </DataSurface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  backButton: {
    padding: 4
  },
  block: {
    gap: 8,
    padding: 8
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14
  }
});
