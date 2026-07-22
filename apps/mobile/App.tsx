import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, BackHandler, Linking, StyleSheet, View } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { House, Scales, UsersThree, CloudArrowUp } from "phosphor-react-native";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono";
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";

import { BottomTabs } from "./src/components/BottomTabs";
import { AnimatedBrandLoader } from "./src/components/AnimatedBrandLoader";
import { BiometricGate } from "./src/components/BiometricGate";
import { ThemeProvider, useTheme } from "./src/theme";
import { clearTokens } from "./src/auth/tokenStore";
import { restoreSession } from "./src/auth/session";
import { apiClient, extractInviteToken } from "./src/api/client";
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
      staleTime: 20_000,
      refetchOnReconnect: true
    }
  }
});

const SETTINGS_ROUTES: AppRoute[] = [
  "expense",
  "balances",
  "audit",
  "recurring",
  "importExport",
  "profile",
  "settings",
  "securitySettings",
  "notificationSettings",
  "appearanceSettings",
  "contactsSettings",
  "groupDetail"
];

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
  const [inviteBusy, setInviteBusy] = useState(false);

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
  }, [authenticated, theme]);

  const claimInviteFromUrl = useCallback(
    async (url: string | null) => {
      if (!url || !authenticated || inviteBusy) {
        return;
      }
      const token = extractInviteToken(url);
      if (!token) {
        return;
      }
      setInviteBusy(true);
      try {
        const group = await apiClient.claimInvite(token);
        setSelectedGroupId(group.id);
        setRoute("groupDetail");
        await queryClient.invalidateQueries({ queryKey: ["groups"] });
        Alert.alert("Joined group", `You're now in ${group.name}.`);
      } catch (error) {
        Alert.alert("Invite failed", error instanceof Error ? error.message : "Could not join this group.");
      } finally {
        setInviteBusy(false);
      }
    },
    [authenticated, inviteBusy]
  );

  useEffect(() => {
    if (!authenticated) {
      return;
    }
    Linking.getInitialURL().then((url) => void claimInviteFromUrl(url));
    const sub = Linking.addEventListener("url", ({ url }) => void claimInviteFromUrl(url));
    return () => sub.remove();
  }, [authenticated, claimInviteFromUrl]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (SETTINGS_ROUTES.includes(route)) {
        if (route === "groupDetail") {
          setRoute("groups");
          return true;
        }
        if (
          route === "securitySettings" ||
          route === "notificationSettings" ||
          route === "appearanceSettings" ||
          route === "contactsSettings"
        ) {
          setRoute("settings");
          return true;
        }
        setRoute("home");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [route]);

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
    return <AnimatedBrandLoader />;
  }

  if (!authenticated) {
    return <OnboardingScreen onAuthenticated={() => setAuthenticated(true)} />;
  }

  return (
    <BiometricGate enabled>
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
            : SETTINGS_ROUTES.includes(route)
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
    </BiometricGate>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  }
});
