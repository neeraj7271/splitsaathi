import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { CaretRight } from "phosphor-react-native";
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes
} from "@react-native-google-signin/google-signin";

import { AuthIconButton } from "../components/AuthIconButton";
import { GoogleMark } from "../components/GoogleMark";
import { InlineNotice } from "../components/InlineNotice";
import { WELCOME_BRAND } from "../components/welcomeTokens";
import { useTheme } from "../theme";

function resolveWebClientId(): string | null {
  return process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || null;
}

let googleSignInConfigured = false;

function ensureGoogleSignInConfigured(webClientId: string) {
  if (googleSignInConfigured) {
    return;
  }
  GoogleSignin.configure({
    webClientId,
    offlineAccess: false,
    forceCodeForRefreshToken: false,
    scopes: ["email", "profile"]
  });
  googleSignInConfigured = true;
}

/**
 * Signs out from Google to clear the cached account.
 * Call this on app logout so the next sign-in shows the account chooser.
 */
export async function signOutFromGoogle(): Promise<void> {
  try {
    const webClientId = resolveWebClientId();
    if (webClientId) {
      ensureGoogleSignInConfigured(webClientId);
      await GoogleSignin.signOut();
    }
  } catch {
    // Ignore errors - Google sign-out is best effort
  }
}

/**
 * Fully revokes Google access (disconnects the app from the user's Google account).
 * Use if you need to completely disconnect, not just sign out.
 */
export async function revokeGoogleAccess(): Promise<void> {
  try {
    if (googleSignInConfigured) {
      await GoogleSignin.revokeAccess();
    }
  } catch {
    // Ignore errors
  }
}

export function isGoogleSignInConfigured() {
  return Boolean(resolveWebClientId());
}

type Props = {
  onIdToken: (idToken: string) => void;
  pending?: boolean;
  errorMessage?: string;
  variant?: "button" | "icon";
  label?: string;
  disabled?: boolean;
  beforeSignIn?: () => string | undefined;
  style?: StyleProp<ViewStyle>;
  showChevron?: boolean;
};

export function GoogleSignInButton({
  onIdToken,
  pending,
  errorMessage,
  variant = "button",
  label = "Continue with Google",
  disabled: disabledProp,
  beforeSignIn,
  style,
  showChevron = true
}: Props) {
  const theme = useTheme();
  const webClientId = resolveWebClientId();
  const [localError, setLocalError] = useState<string>();
  const [configured, setConfigured] = useState(() => {
    if (!webClientId) {
      return false;
    }
    try {
      ensureGoogleSignInConfigured(webClientId);
      return true;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!webClientId) {
      return;
    }
    try {
      ensureGoogleSignInConfigured(webClientId);
      setConfigured(true);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Google Sign-In could not be configured.");
      setConfigured(false);
    }
  }, [webClientId]);

  const signIn = useCallback(async () => {
    if (!webClientId || pending || disabledProp) {
      return;
    }
    const blockedMessage = beforeSignIn?.();
    if (blockedMessage) {
      setLocalError(blockedMessage);
      return;
    }
    setLocalError(undefined);
    try {
      if (Platform.OS === "android") {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }
      // Force account chooser dialog by clearing previous cached session
      await GoogleSignin.signOut().catch(() => {});
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) {
        return;
      }
      const tokens = await GoogleSignin.getTokens();
      const idToken = tokens.idToken || response.data.idToken;
      if (!idToken) {
        setLocalError("Google did not return an ID token. Check Web client ID configuration.");
        return;
      }
      onIdToken(idToken);
    } catch (error) {
      if (isErrorWithCode(error)) {
        if (error.code === statusCodes.SIGN_IN_CANCELLED || error.code === statusCodes.IN_PROGRESS) {
          return;
        }
        if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          setLocalError("Google Play Services is required for Google sign-in on this device.");
          return;
        }
        if (error.code === "10" || String(error.message).includes("DEVELOPER_ERROR")) {
          setLocalError(
            "Google Sign-In is misconfigured (DEVELOPER_ERROR). The Web client ID in this app must match a live Web OAuth client in Google Cloud, and Android OAuth clients must include this build's SHA-1 plus package in.splitsaathi.mobile."
          );
          return;
        }
      }
      setLocalError(error instanceof Error ? error.message : "Google sign-in failed.");
    }
  }, [webClientId, pending, disabledProp, beforeSignIn, onIdToken]);

  if (!webClientId) {
    return null;
  }

  const disabled = !configured || pending || Boolean(disabledProp);
  const shownError = localError || errorMessage;
  const isLight = theme.mode === "light";

  if (variant === "icon") {
    return (
      <>
        <AuthIconButton method="google" label="Google" onPress={() => void signIn()} disabled={disabled} />
        {shownError ? <InlineNotice title="Google sign-in failed" body={shownError} tone="owe" /> : null}
      </>
    );
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={() => void signIn()}
        style={({ pressed }) => [
          styles.googleBtn,
          style,
          {
            borderColor: isLight ? "#E2E8F0" : "transparent",
            borderWidth: isLight ? 1 : 0,
            opacity: disabled ? 0.55 : pressed ? 0.92 : 1
          }
        ]}
      >
        <View style={styles.leftBox}>
          {pending ? <ActivityIndicator color={WELCOME_BRAND.GOOGLE_TEXT} /> : <GoogleMark size={24} />}
        </View>
        <Text style={styles.googleLabel}>{label}</Text>
        {showChevron ? <CaretRight size={18} color="#0D9488" weight="bold" /> : null}
      </Pressable>
      {shownError ? <InlineNotice title="Google sign-in failed" body={shownError} tone="owe" /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  googleBtn: {
    height: 56,
    borderRadius: 20,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    width: "100%",
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  leftBox: {
    width: 32,
    alignItems: "center",
    justifyContent: "center"
  },
  googleLabel: {
    flex: 1,
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#0F172A",
    marginLeft: 8
  }
});
