import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, BackHandler, Linking, StyleSheet, View } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { House, Scales, UsersThree, UserCircle } from "phosphor-react-native";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono";
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";

import { BottomTabs } from "./src/components/BottomTabs";
import { AnimatedBrandLoader } from "./src/components/AnimatedBrandLoader";
import { AppUpdateModal } from "./src/components/AppUpdateModal";
import { AppDialogProvider, useAppDialog } from "./src/components/AppDialog";
import { SettlementDetailModalProvider } from "./src/components/SettlementDetailModalProvider";
import { BiometricGate } from "./src/components/BiometricGate";
import { ThemeProvider, useTheme } from "./src/theme";
import { clearTokens } from "./src/auth/tokenStore";
import { clearCachedBiometricPrefs } from "./src/auth/biometricPrefsCache";
import { restoreSession } from "./src/auth/session";
import { signOutFromGoogle } from "./src/auth/GoogleSignInButton";
import { apiClient, extractInviteToken } from "./src/api/client";
import { initOutbox } from "./src/offline/outbox";
import { configurePushNotifications } from "./src/notifications/configurePush";
import { AllExpensesScreen } from "./src/screens/AllExpensesScreen";

import { AuditScreen } from "./src/screens/AuditScreen";
import { BalancesScreen } from "./src/screens/BalancesScreen";
import { ExpenseEntryScreen } from "./src/screens/ExpenseEntryScreen";
import { FriendDetailScreen } from "./src/screens/FriendDetailScreen";
import { FriendsScreen } from "./src/screens/FriendsScreen";
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

const TAB_ROUTES: AppRoute[] = ["home", "groups", "friends", "settlement"];

/** Keep branded splash on screen long enough for the intro animation (not just boot I/O). */
const MIN_SPLASH_MS = 3200;

const SETTINGS_ROUTES: AppRoute[] = [
  "expense",
  "balances",
  "audit",
  "recurring",
  "importExport",
  "offline",
  "profile",
  "settings",
  "securitySettings",
  "notificationSettings",
  "appearanceSettings",
  "contactsSettings",
  "groupDetail",

  "friendDetail"
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
          <AppDialogProvider>
            <SettlementDetailModalProvider>
              <AppBootstrap fontsLoaded={fontsLoaded || Boolean(fontError)} />
            </SettlementDetailModalProvider>
          </AppDialogProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function AppBootstrap({ fontsLoaded }: { fontsLoaded: boolean }) {
  const theme = useTheme();
  const { showDialog } = useAppDialog();
  const [booted, setBooted] = useState(false);
  const [splashMinElapsed, setSplashMinElapsed] = useState(false);
  const [dataPreloaded, setDataPreloaded] = useState(false);
  const [preloadTimedOut, setPreloadTimedOut] = useState(false);
  const [preloadStatus, setPreloadStatus] = useState("Securing App & Syncing Data...");
  const [authenticated, setAuthenticated] = useState(false);
  const [history, setHistory] = useState<AppRoute[]>(["home"]);
  const route = history[history.length - 1] ?? "home";
  const [selectedGroupId, setSelectedGroupId] = useState<string>();
  const [selectedExpenseId, setSelectedExpenseId] = useState<string>();
  const [selectedFriendUserId, setSelectedFriendUserId] = useState<string>();
  const inviteBusyRef = useRef(false);
  const claimedInviteTokensRef = useRef(new Set<string>());
  const handledInitialInviteUrlRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setSplashMinElapsed(true), MIN_SPLASH_MS);
    const timeout = setTimeout(() => setPreloadTimedOut(true), 7500);
    return () => {
      clearTimeout(timer);
      clearTimeout(timeout);
    };
  }, []);

  const goTab = useCallback((next: AppRoute) => {
    if (!TAB_ROUTES.includes(next)) {
      return;
    }
    setHistory([next]);
  }, []);

  const go = useCallback((next: AppRoute) => {
    setHistory((prev) => {
      const current = prev[prev.length - 1];
      if (current === next) {
        return prev;
      }
      if (TAB_ROUTES.includes(next)) {
        if (TAB_ROUTES.includes(current)) {
          return [next];
        }
        return [...prev, next];
      }
      return [...prev, next];
    });
  }, []);

  const back = useCallback(() => {
    let didPop = false;
    setHistory((prev) => {
      if (prev.length <= 1) {
        return prev;
      }
      didPop = true;
      return prev.slice(0, -1);
    });
    return didPop;
  }, []);

  useEffect(() => {
    async function boot() {
      await configurePushNotifications().catch(() => undefined);
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
    const syncPush = (forcePrompt = false) => {
      void import("./src/notifications/syncPushRegistration").then(({ syncPushRegistration }) =>
        syncPushRegistration(queryClient, { forcePrompt }).then((result) => {
          if (__DEV__) {
            console.log("[SplitSaathi] push sync complete");
          }
        }).catch((error) => {
          console.warn("[SplitSaathi] push sync failed", error);
        })
      );
    };

    // Ask on login; retry whenever app returns to foreground.
    syncPush(true);
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        syncPush(false);
      }
    });

    let receivedSub: { remove: () => void } | undefined;
    let responseSub: { remove: () => void } | undefined;
    void import("expo-notifications")
      .then(async (Notifications) => {
        try {
          const { invalidateQueriesForPush } = await import("./src/notifications/invalidateOnPush");
          const { getAppVersionCode } = await import("./src/utils/appVersion");
          const {
            isAppUpdatePush,
            openAppUpdateDownload,
            parsePushVersionCode
          } = await import("./src/updates/handleAppUpdatePush");
          const { requestUpdateCheck } = await import("./src/updates/updateCheckEvents");

          async function handleAppUpdatePush(
            data: Record<string, unknown> | undefined,
            notificationId?: string
          ) {
            const pushVersionCode = parsePushVersionCode(data);
            const currentVersionCode = getAppVersionCode();
            if (pushVersionCode !== null && pushVersionCode <= currentVersionCode) {
              if (notificationId) {
                await Notifications.dismissNotificationAsync(notificationId).catch(() => undefined);
              }
              return;
            }

            requestUpdateCheck();
          }

          if (typeof Notifications.addNotificationReceivedListener === "function") {
            receivedSub = Notifications.addNotificationReceivedListener((notification) => {
              const data = notification.request.content.data as Record<string, unknown> | undefined;
              if (isAppUpdatePush(data)) {
                void handleAppUpdatePush(data, notification.request.identifier);
                return;
              }
              invalidateQueriesForPush(queryClient, data);
            });
          }
          if (typeof Notifications.addNotificationResponseReceivedListener === "function") {
            responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
              const data = response.notification.request.content.data as Record<string, unknown> | undefined;
              if (isAppUpdatePush(data)) {
                void openAppUpdateDownload(data);
                return;
              }
              invalidateQueriesForPush(queryClient, data);
            });
          }
        } catch (err) {
          console.warn("[SplitSaathi] Notification listener error ignored:", err);
        }
      })
      .catch(() => undefined);

    return () => {
      try {
        appStateSub?.remove?.();
      } catch {
        // Ignore unbind edge case
      }
      try {
        receivedSub?.remove?.();
      } catch {
        // Ignore unbind edge case
      }
      try {
        responseSub?.remove?.();
      } catch {
        // Ignore unbind edge case
      }
    };
  }, [authenticated, queryClient]);

  // Apply server appearance only after splash finishes — prevents dark→light double splash.
  useEffect(() => {
    if (!authenticated || !splashMinElapsed) {
      return;
    }
    apiClient
      .getPreferences()
      .then((preferences) => {
        if (preferences.appearance !== theme.requestedMode) {
          theme.setRequestedMode(preferences.appearance);
        }
      })
      .catch(() => undefined);
  }, [authenticated, splashMinElapsed, theme]);

  const claimInviteFromUrl = useCallback(
    async (url: string | null) => {
      if (!url || !authenticated) {
        return;
      }
      const token = extractInviteToken(url);
      if (!token || inviteBusyRef.current || claimedInviteTokensRef.current.has(token)) {
        return;
      }
      inviteBusyRef.current = true;
      claimedInviteTokensRef.current.add(token);
      try {
        const group = await apiClient.claimInvite(token);
        setSelectedGroupId(group.id);
        go("groupDetail");
        await queryClient.invalidateQueries({ queryKey: ["groups"] });
        await queryClient.invalidateQueries({ queryKey: ["friends"] });
        showDialog({
          title: "Joined group",
          message: `You're now in ${group.name}.`,
          tone: "success",
          primaryAction: { label: "Continue" }
        });
      } catch (error) {
        claimedInviteTokensRef.current.delete(token);
        showDialog({
          title: "Invite failed",
          message: error instanceof Error ? error.message : "Could not join this group.",
          tone: "error",
          primaryAction: { label: "OK" }
        });
      } finally {
        inviteBusyRef.current = false;
      }
    },
    [authenticated, go, showDialog]
  );

  useEffect(() => {
    if (!authenticated) {
      handledInitialInviteUrlRef.current = false;
      return;
    }
    if (!handledInitialInviteUrlRef.current) {
      handledInitialInviteUrlRef.current = true;
      Linking.getInitialURL().then((url) => void claimInviteFromUrl(url));
    }
    const sub = Linking.addEventListener("url", ({ url }) => void claimInviteFromUrl(url));
    return () => sub.remove();
  }, [authenticated, claimInviteFromUrl]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (back()) {
        return true;
      }
      // On a tab root: allow default (exit app / minimize).
      return false;
    });
    return () => sub.remove();
  }, [back]);

  const navigation = useMemo<AppNavigation>(
    () => ({
      route,
      selectedGroupId,
      selectedExpenseId,
      selectedFriendUserId,
      canGoBack: history.length > 1,
      setSelectedGroupId,
      setSelectedExpenseId,
      setSelectedFriendUserId,
      go,
      back,
      signOut: () => {
        apiClient
          .logout()
          .catch(() => undefined)
          .finally(() => {
            void signOutFromGoogle();
            void clearCachedBiometricPrefs();
            claimedInviteTokensRef.current.clear();
            handledInitialInviteUrlRef.current = false;
            setAuthenticated(false);
            setHistory(["home"]);
            setSelectedGroupId(undefined);
            setSelectedExpenseId(undefined);
            setSelectedFriendUserId(undefined);
            queryClient.clear();
          });
      }
    }),
    [back, go, history.length, route, selectedExpenseId, selectedFriendUserId, selectedGroupId]
  );

  // Background prefetch all primary app resources while splash screen is displaying
  useEffect(() => {
    if (!authenticated) {
      setDataPreloaded(true);
      return;
    }
    let isMounted = true;
    setPreloadStatus("Securing financial data...");

    async function warmUpAppData() {
      try {
        await Promise.allSettled([
          queryClient.prefetchQuery({ queryKey: ["me"], queryFn: () => apiClient.getMe() }),
          queryClient.prefetchQuery({ queryKey: ["groups"], queryFn: () => apiClient.listGroups() }),
          queryClient.prefetchQuery({ queryKey: ["friends"], queryFn: () => apiClient.listFriends() }),
          queryClient.prefetchQuery({ queryKey: ["myMonthlySpend"], queryFn: () => apiClient.getMyMonthlySpend() }),
          queryClient.prefetchQuery({ queryKey: ["preferences"], queryFn: () => apiClient.getPreferences() })
        ]);

        const prefs = queryClient.getQueryData<{ appearance?: "dark" | "light" | "system" }>(["preferences"]);
        if (prefs?.appearance && prefs.appearance !== theme.requestedMode) {
          theme.setRequestedMode(prefs.appearance);
        }

        if (isMounted) {
          setPreloadStatus("Ready!");
          setDataPreloaded(true);
        }
      } catch {
        if (isMounted) {
          setDataPreloaded(true);
        }
      }
    }

    void warmUpAppData();

    return () => {
      isMounted = false;
    };
  }, [authenticated, theme]);

  const showSplash = !fontsLoaded || !booted || !splashMinElapsed || (authenticated && !dataPreloaded && !preloadTimedOut);

  if (showSplash) {
    return <AnimatedBrandLoader message={preloadStatus} />;
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
        {route === "friends" ? <FriendsScreen navigation={navigation} /> : null}
        {route === "friendDetail" ? <FriendDetailScreen navigation={navigation} /> : null}
        {route === "expense" ? <ExpenseEntryScreen navigation={navigation} /> : null}
        {route === "balances" ? <BalancesScreen navigation={navigation} /> : null}
        {route === "settlement" ? <SettlementScreen navigation={navigation} /> : null}
        {route === "audit" ? <AuditScreen navigation={navigation} /> : null}
        {route === "allExpenses" ? <AllExpensesScreen navigation={navigation} /> : null}
        {route === "recurring" ? <RecurringScreen navigation={navigation} /> : null}
        {route === "importExport" ? <ImportExportScreen navigation={navigation} /> : null}
        {route === "offline" ? <OfflineSyncScreen navigation={navigation} /> : null}
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
              : route === "friendDetail"
                ? "friends"
                : SETTINGS_ROUTES.includes(route)
                  ? "home"
                  : route
          }
          onChange={goTab}
          onFab={() => {
            setSelectedExpenseId(undefined);
            go("expense");
          }}
          tabs={[
            { label: "Home", value: "home", icon: House },
            { label: "Groups", value: "groups", icon: UsersThree },
            { label: "Friends", value: "friends", icon: UserCircle },
            { label: "Settle", value: "settlement", icon: Scales }
          ]}
        />

        {showSplash ? (
          <View style={StyleSheet.absoluteFillObject} pointerEvents="auto">
            <AnimatedBrandLoader />
          </View>
        ) : null}

        <AppUpdateModal />
      </View>
    </BiometricGate>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  }
});
