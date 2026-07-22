import React, { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes
} from "@react-native-google-signin/google-signin";

import { AuthIconButton } from "../components/AuthIconButton";
import { Button } from "../components/Button";
import { InlineNotice } from "../components/InlineNotice";

function resolveWebClientId(): string | null {
  return process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || null;
}

export function isGoogleSignInConfigured() {
  return Boolean(resolveWebClientId());
}

type Props = {
  onIdToken: (idToken: string) => void;
  pending?: boolean;
  errorMessage?: string;
  variant?: "button" | "icon";
};

/**
 * Native Google Sign-In (ID token → API /v1/auth/google).
 * Requires a dev/release build with the Google Sign-In native module — not Expo Go.
 */
export function GoogleSignInButton({ onIdToken, pending, errorMessage, variant = "button" }: Props) {
  const webClientId = resolveWebClientId();
  const [localError, setLocalError] = useState<string>();
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    if (!webClientId) {
      return;
    }
    try {
      GoogleSignin.configure({
        webClientId,
        offlineAccess: false,
        forceCodeForRefreshToken: false
      });
      setConfigured(true);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Google Sign-In could not be configured.");
    }
  }, [webClientId]);

  const signIn = useCallback(async () => {
    if (!webClientId || pending) {
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
  }, [webClientId, pending, onIdToken]);

  if (!webClientId) {
    return null;
  }

  const disabled = !configured || pending;
  const shownError = localError || errorMessage;

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
      <Button label="Continue with Google" variant="secondary" onPress={() => void signIn()} disabled={disabled} />
      {shownError ? <InlineNotice title="Google sign-in failed" body={shownError} tone="owe" /> : null}
    </>
  );
}
