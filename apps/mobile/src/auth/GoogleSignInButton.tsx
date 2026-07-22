import React, { useEffect } from "react";
import * as Google from "expo-auth-session/providers/google";

import { AuthIconButton } from "../components/AuthIconButton";
import { Button } from "../components/Button";
import { InlineNotice } from "../components/InlineNotice";

type GoogleClientIds = {
  webClientId?: string;
  androidClientId?: string;
  iosClientId?: string;
};

function resolveGoogleClientIds(): GoogleClientIds | null {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || webClientId;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || webClientId;

  if (!webClientId && !process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID && !process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) {
    return null;
  }

  return { webClientId, androidClientId, iosClientId };
}

export function isGoogleSignInConfigured() {
  return resolveGoogleClientIds() !== null;
}

type Props = {
  onIdToken: (idToken: string) => void;
  pending?: boolean;
  errorMessage?: string;
  variant?: "button" | "icon";
};

/**
 * Mounted only when Google client IDs exist. Isolates useIdTokenAuthRequest
 * so missing androidClientId cannot crash the whole onboarding screen.
 */
export function GoogleSignInButton({ onIdToken, pending, errorMessage, variant = "button" }: Props) {
  const clientIds = resolveGoogleClientIds();
  if (!clientIds?.androidClientId && !clientIds?.webClientId) {
    return null;
  }

  return (
    <GoogleSignInButtonInner
      clientIds={clientIds}
      onIdToken={onIdToken}
      pending={pending}
      errorMessage={errorMessage}
      variant={variant}
    />
  );
}

function GoogleSignInButtonInner({
  clientIds,
  onIdToken,
  pending,
  errorMessage,
  variant
}: Props & { clientIds: GoogleClientIds }) {
  const [googleRequest, googleResponse, promptGoogle] = Google.useIdTokenAuthRequest({
    webClientId: clientIds.webClientId,
    androidClientId: clientIds.androidClientId,
    iosClientId: clientIds.iosClientId
  });

  useEffect(() => {
    const idToken = googleResponse?.type === "success" ? googleResponse.authentication?.idToken : undefined;
    if (idToken) {
      onIdToken(idToken);
    }
  }, [googleResponse, onIdToken]);

  const disabled = !googleRequest || pending;

  if (variant === "icon") {
    return <AuthIconButton method="google" label="Google" onPress={() => void promptGoogle()} disabled={disabled} />;
  }

  return (
    <>
      <Button label="Continue with Google" variant="secondary" onPress={() => void promptGoogle()} disabled={disabled} />
      {errorMessage ? <InlineNotice title="Google sign-in failed" body={errorMessage} tone="owe" /> : null}
    </>
  );
}
