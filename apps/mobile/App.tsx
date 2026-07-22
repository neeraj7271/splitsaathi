import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { House, Scales, UsersThree, CloudArrowUp } from "phosphor-react-native";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono";
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";

import { BottomTabs } from "./src/components/BottomTabs";
import { BrandLogo } from "./src/components/BrandLogo";
import { ThemedText } from "./src/components/ThemedText";
import { ThemeProvider, useTheme } from "./src/theme";
import { clearTokens } from "./src/auth/tokenStore";
import { restoreSession } from "./src/auth/session";
import { apiClient } from "./src/api/client";
import { initOutbox } from "./src/offline/outbox";
import { AuditScreen } from "./src/screens/AuditScreen";
import { BalancesScreen } from "./src/screens/BalancesScreen";
import { ExpenseEntryScreen } from "./src/screens/ExpenseEntryScreen";
import { GroupCreateScreen } from "./src/screens/GroupCreateScreen";
import { GroupDetailScreen } from "./src/screens/GroupDetailScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { ImportExportScreen } from "./src/screens/ImportExportScreen";
import { OfflineSyncScreen } from "./src/screens/OfflineSyncScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { SecuritySettingsScreen } from "./src/screens/SecuritySettingsScreen";
import { NotificationSettingsScreen } from "./src/screens/NotificationSettingsScreen";
import { AppearanceSettingsScreen } from "./src/screens/AppearanceSettingsScreen";
import { ContactsSettingsScreen } from "./src/screens/ContactsSettingsScreen";
import { RecurringScreen } from "./src/screens/RecurringScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { SettlementScreen } from "./src/screens/SettlementScreen";
import { AppNavigation, AppRoute } from "./src/types/navigation";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 20_000
    }
  }
});

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium
  });

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AppBootstrap fontsLoaded={fontsLoaded || Boolean(fontError)} />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function AppBootstrap({ fontsLoaded }: { fontsLoaded: boolean }) {
  const theme = useTheme();
  const [booted, setBooted] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [route, setRoute] = useState<AppRoute>("home");
  const [selectedGroupId, setSelectedGroupId] = useState<string>();
  const [selectedExpenseId, setSelectedExpenseId] = useState<string>();

  useEffect(() => {
    async function boot() {
      await initOutbox();
      const sessionActive = await restoreSession();
      setAuthenticated(sessionActive);
      setBooted(true);
    }

    boot().catch(async () => {
      await clearTokens();
      setAuthenticated(false);
      setBooted(true);
    });
  }, []);

  useEffect(() => {
    if (!authenticated) {
      return;
    }
    apiClient
      .getPreferences()
      .then((preferences) => theme.setRequestedMode(preferences.appearance))
      .catch(() => undefined);
  }, [authenticated]);

  const navigation = useMemo<AppNavigation>(
    () => ({
      route,
      selectedGroupId,
      selectedExpenseId,
      setSelectedGroupId,
      setSelectedExpenseId,
      go: setRoute,
      signOut: () => {
        apiClient
          .logout()
          .catch(() => undefined)
          .finally(() => {
            setAuthenticated(false);
            setRoute("home");
            setSelectedGroupId(undefined);
            setSelectedExpenseId(undefined);
            queryClient.clear();
          });
      }
    }),
    [route, selectedExpenseId, selectedGroupId]
  );

  if (!fontsLoaded || !booted) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.colors.canvas }]}>
        <View style={styles.loadingBrand}>
          <BrandLogo variant="lockup" size={168} />
        </View>
        <ActivityIndicator color={theme.colors.confirmed} />
        <ThemedText variant="caption" tone="muted">
          Loading your ledger
        </ThemedText>
      </View>
    );
  }

  if (!authenticated) {
    return <OnboardingScreen onAuthenticated={() => setAuthenticated(true)} />;
  }

  return (
    <View style={styles.root}>
      {route === "home" ? <HomeScreen navigation={navigation} /> : null}
      {route === "groups" ? <GroupCreateScreen navigation={navigation} /> : null}
      {route === "groupDetail" ? <GroupDetailScreen navigation={navigation} /> : null}
      {route === "expense" ? <ExpenseEntryScreen navigation={navigation} /> : null}
      {route === "balances" ? <BalancesScreen navigation={navigation} /> : null}
      {route === "settlement" ? <SettlementScreen navigation={navigation} /> : null}
      {route === "audit" ? <AuditScreen navigation={navigation} /> : null}
      {route === "recurring" ? <RecurringScreen navigation={navigation} /> : null}
      {route === "importExport" ? <ImportExportScreen navigation={navigation} /> : null}
      {route === "offline" ? <OfflineSyncScreen /> : null}
      {route === "profile" ? <ProfileScreen navigation={navigation} /> : null}
      {route === "settings" ? <SettingsScreen navigation={navigation} /> : null}
      {route === "securitySettings" ? <SecuritySettingsScreen navigation={navigation} /> : null}
      {route === "notificationSettings" ? <NotificationSettingsScreen navigation={navigation} /> : null}
      {route === "appearanceSettings" ? <AppearanceSettingsScreen navigation={navigation} /> : null}
      {route === "contactsSettings" ? <ContactsSettingsScreen navigation={navigation} /> : null}

      <BottomTabs
        value={
          route === "groupDetail"
            ? "groups"
            : route === "expense" || route === "balances" || route === "audit" || route === "recurring" || route === "importExport" || route === "profile" || route === "settings" || route === "securitySettings" || route === "notificationSettings" || route === "appearanceSettings" || route === "contactsSettings"
              ? "home"
              : route
        }
        onChange={setRoute}
        onFab={() => setRoute("expense")}
        tabs={[
          { label: "Home", value: "home", icon: House },
          { label: "Groups", value: "groups", icon: UsersThree },
          { label: "Settle", value: "settlement", icon: Scales },
          { label: "Sync", value: "offline", icon: CloudArrowUp }
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12
  },
  loadingBrand: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 8
  }
});
