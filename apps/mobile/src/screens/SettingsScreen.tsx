import React from "react";
import { StyleSheet, View } from "react-native";
import { ArrowLeft } from "phosphor-react-native";
import { Pressable } from "react-native";

import { Button } from "../components/Button";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { SettingsLinkRow } from "../components/SettingsLinkRow";
import { ThemedText } from "../components/ThemedText";
import { useTheme } from "../theme";
import { AppNavigation } from "../types/navigation";

export function SettingsScreen({ navigation }: { navigation: AppNavigation }) {
  const theme = useTheme();

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.go("profile")} style={styles.backButton}>
          <ArrowLeft size={22} color={theme.colors.ink} />
        </Pressable>
        <ThemedText variant="title">Settings</ThemedText>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Account" />
        <SettingsLinkRow label="Edit profile" onPress={() => navigation.go("profile")} />
        <SettingsLinkRow label="Email settings" onPress={() => navigation.go("notificationSettings")} />
        <SettingsLinkRow label="Security" onPress={() => navigation.go("securitySettings")} />
        <SettingsLinkRow label="Contacts" onPress={() => navigation.go("contactsSettings")} />
        <SettingsLinkRow label="Appearance" onPress={() => navigation.go("appearanceSettings")} />
        <Button label="Sign out" variant="destructive" onPress={() => navigation.signOut()} />
      </View>
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
  section: {
    gap: 10
  }
});
