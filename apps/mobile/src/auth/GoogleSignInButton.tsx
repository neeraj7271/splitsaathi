import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from "react-native";
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
    forceCodeForRefreshToken: false
  });
  googleSignInConfigured = true;
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
};

export function GoogleSignInButton({
  onIdToken,
  pending,
  errorMessage,
  variant = "button",
  label = "Continue with Google",
  disabled: disabledProp,
  beforeSignIn,
  style
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
            borderColor: isLight ? "rgba(15,23,42,0.08)" : "transparent",
            borderWidth: isLight ? 1 : 0,
            opacity: disabled ? 0.55 : pressed ? 0.92 : 1
          }
        ]}
      >
        {pending ? <ActivityIndicator color={WELCOME_BRAND.GOOGLE_TEXT} /> : <GoogleMark size={22} />}
        <Text style={styles.googleLabel}>{label}</Text>
      </Pressable>
      {shownError ? <InlineNotice title="Google sign-in failed" body={shownError} tone="owe" /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  googleBtn: {
    height: 56,
    borderRadius: 28,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    width: "100%",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4
  },
  googleLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    lineHeight: 22,
    color: WELCOME_BRAND.GOOGLE_TEXT
  }
});
