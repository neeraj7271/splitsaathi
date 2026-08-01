import React from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "../components/Button";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { SectionHeader } from "../components/SectionHeader";
import { SettingsLinkRow } from "../components/SettingsLinkRow";
import { AppNavigation } from "../types/navigation";

export function SettingsScreen({ navigation }: { navigation: AppNavigation }) {
  return (
    <Screen>
      <ScreenHeader navigation={navigation} fallbackRoute="profile" title="Settings" />

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
  section: {
    gap: 10
  }
});
