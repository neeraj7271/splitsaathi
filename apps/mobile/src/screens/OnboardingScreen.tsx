import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import * as WebBrowser from "expo-web-browser";
import { Bell, Check, EnvelopeSimple, Key, LinkSimple, Phone, ShieldCheck, UsersThree } from "phosphor-react-native";
import { useMutation } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiClient } from "../api/client";
import { GoogleSignInButton, isGoogleSignInConfigured } from "../auth/GoogleSignInButton";
import { markLoggedInBefore, hasLoggedInBefore } from "../auth/loginStore";
import { AuthIconButton } from "../components/AuthIconButton";
import { BrandLogo } from "../components/BrandLogo";
import { Button } from "../components/Button";
import { InlineNotice } from "../components/InlineNotice";
import { InputField } from "../components/InputField";
import { ThemedText } from "../components/ThemedText";
import { registerPushIfPossible } from "../notifications/registerPush";
import { syncDeviceContacts } from "../utils/contactDiscovery";
import { useTheme } from "../theme";

WebBrowser.maybeCompleteAuthSession();

type OnboardingStep =
  | "welcome"
  | "phone"
  | "otp"
  | "emailGate"
  | "emailSignup"
  | "emailVerify"
  | "emailLogin"
  | "forgotPassword"
  | "resetPassword"
  | "profile"
  | "consent"
  | "join";

function isPlaceholderDisplayName(name: string | undefined) {
  const trimmed = name?.trim() ?? "";
  return !trimmed || /^User \d{4}$/.test(trimmed);
}

type AuthStepResponse = {
  needsOnboarding?: boolean;
  needsPhoneLink?: boolean;
  suggestedPhoneE164?: string | null;
  user: { displayName: string };
};

/**
 * Phone is always required when missing (so friends can find you).
 * Returning users with a phone skip name/consent.
 */
function nextStepAfterAuth(response: AuthStepResponse): OnboardingStep | "done" {
  if (response.needsPhoneLink) {
    return "phone";
  }
  if (response.needsOnboarding === false) {
    return "done";
  }
  if (isPlaceholderDisplayName(response.user.displayName)) {
    return "profile";
  }
  return "consent";
}

function formatPhoneE164(phone: string) {
  const trimmed = phone.trim().replace(/[\s()-]/g, '');
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return `+91${digits.slice(1)}`;
  }
  return digits ? `+${digits}` : trimmed;
}

export function OnboardingScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [returningUser, setReturningUser] = useState(false);
  const [phone, setPhone] = useState("+91");
  const [phoneE164, setPhoneE164] = useState("");
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [challengeId, setChallengeId] = useState<string>();
  const [maskedDestination, setMaskedDestination] = useState<string>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailChallengeId, setEmailChallengeId] = useState<string>();
  const [otpVerified, setOtpVerified] = useState(false);
  const [linkingPhone, setLinkingPhone] = useState(false);
  const [authSnapshot, setAuthSnapshot] = useState<AuthStepResponse | null>(null);
  const [phoneCandidates, setPhoneCandidates] = useState<string[]>([]);
  const [inviteLink, setInviteLink] = useState("");
  const [scanningInvite, setScanningInvite] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const isWeb = Platform.OS === "web";
  const onGradient = theme.mode === "dark" ? theme.colors.ink : theme.colors.surface;
  const [consents, setConsents] = useState({
    contacts: false,
    notifications: true,
    proofStorage: true
  });
  const googleConfigured = isGoogleSignInConfigured();

  const startOtp = useMutation({
    mutationFn: (formattedPhone: string) => apiClient.startOtp(formattedPhone),
    onSuccess: (response, formattedPhone) => {
      setPhoneE164(formattedPhone);
      setChallengeId(response.challengeId);
      setMaskedDestination(response.maskedDestination);
      setCode("");
      setOtpVerified(false);
      verifyOtp.reset();
      setStep("otp");
    }
  });

  const completeAuth = async (response: { user: { displayName: string } }) => {
    if (inviteLink.trim()) {
      await apiClient.claimInvite(inviteLink, response.user.displayName).catch(() => undefined);
    }
    await markLoggedInBefore();
    onAuthenticated();
  };

  const continueAfterAuth = async (response: AuthStepResponse) => {
    setAuthSnapshot(response);
    if (response.suggestedPhoneE164) {
      setPhone(response.suggestedPhoneE164);
      setPhoneCandidates((current) =>
        current.includes(response.suggestedPhoneE164 as string)
          ? current
          : [...current, response.suggestedPhoneE164 as string]
      );
    }
    const next = nextStepAfterAuth(response);
    if (next === "phone") {
      setLinkingPhone(true);
      setStep("phone");
      return;
    }
    if (next === "done") {
      await completeAuth(response);
      return;
    }
    setDisplayName(isPlaceholderDisplayName(response.user.displayName) ? "" : response.user.displayName);
    setStep(next);
  };

  const verifyOtp = useMutation({
    mutationFn: async () => {
      if (!challengeId) {
        throw new Error("OTP challenge was not started.");
      }
      if (linkingPhone) {
        return apiClient.linkPhoneVerify(challengeId, code.trim());
      }
      // Phone OTP login is disabled for now — Google signup + post-login phone link only.
      throw new Error("Phone sign-in is temporarily disabled. Continue with Google.");
    },
    onSuccess: async (response) => {
      setOtpVerified(true);
      setLinkingPhone(false);
      await continueAfterAuth(response);
    }
  });

  const loginWithPhone = useMutation({
    mutationFn: async () => {
      const formatted = formatPhoneE164(phone);
      if (linkingPhone) {
        return apiClient.linkPhone(formatted, displayName.trim() || undefined);
      }
      return apiClient.loginWithPhone(formatted, displayName.trim() || undefined);
    },
    onSuccess: async (response) => {
      setOtpVerified(true);
      setLinkingPhone(false);
      setPhoneE164(formatPhoneE164(phone));
      await continueAfterAuth(response);
    }
  });

  const loginWithGoogle = useMutation({
    mutationFn: (idToken: string) => apiClient.loginWithGoogle(idToken),
    onSuccess: async (response) => {
      setOtpVerified(true);
      await continueAfterAuth(response);
    }
  });

  const startEmailSignup = useMutation({
    mutationFn: () => apiClient.startEmailSignup(email.trim(), password, displayName.trim() || undefined),
    onSuccess: (response) => {
      setEmailChallengeId(response.challengeId);
      setEmailCode("");
      verifyEmailSignup.reset();
      setStep("emailVerify");
    }
  });

  const verifyEmailSignup = useMutation({
    mutationFn: async () => {
      if (!emailChallengeId) throw new Error("Email verification was not started.");
      return apiClient.verifyEmailSignup(emailChallengeId, emailCode);
    },
    onSuccess: async (response) => {
      setOtpVerified(true);
      await continueAfterAuth(response);
    }
  });

  const loginWithEmail = useMutation({
    mutationFn: () => apiClient.loginWithEmailPassword(email.trim(), password),
    onSuccess: async (response) => {
      setOtpVerified(true);
      await continueAfterAuth(response);
    }
  });

  const startPasswordReset = useMutation({
    mutationFn: () => apiClient.startPasswordReset(email.trim()),
    onSuccess: (response) => {
      setEmailChallengeId(response.challengeId);
      setEmailCode("");
      resetPassword.reset();
      setStep("resetPassword");
    }
  });

  const resetPassword = useMutation({
    mutationFn: async () => {
      if (!emailChallengeId) throw new Error("Password reset was not started.");
      await apiClient.resetPassword(emailChallengeId, emailCode, newPassword);
    },
    onSuccess: () => {
      setPassword("");
      setNewPassword("");
      setEmailCode("");
      setStep("emailLogin");
    }
  });

  const finishSetup = useMutation({
    mutationFn: async () => {
      if (displayName.trim()) {
        await apiClient.updateMe({ displayName: displayName.trim() });
      }
      await Promise.allSettled([
        apiClient.recordConsent("contacts_discovery", consents.contacts),
        apiClient.recordConsent("notification_delivery", consents.notifications),
        apiClient.recordConsent("upi_proof_storage", consents.proofStorage)
      ]);
      if (consents.contacts) {
        await syncDeviceContacts().catch(() => undefined);
      }
      if (consents.notifications) {
        await registerPushIfPossible();
      }
      if (inviteLink.trim()) {
        await apiClient.claimInvite(inviteLink, displayName.trim());
      }
    },
    onSuccess: async () => {
      await markLoggedInBefore();
      onAuthenticated();
    }
  });

  useEffect(() => {
    hasLoggedInBefore()
      .then((loggedInBefore) => {
        if (loggedInBefore) {
          setReturningUser(true);
          // Stay on welcome — phone is the default primary path there.
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const applyUrl = (url?: string | null) => {
      if (url && /splitsaathi:\/\/join\/|\/join\/|groups\/invites\//i.test(url)) {
        setInviteLink(url);
        setStep("join");
      }
    };
    Linking.getInitialURL().then(applyUrl).catch(() => undefined);
    const subscription = Linking.addEventListener("url", (event) => applyUrl(event.url));
    return () => subscription.remove();
  }, []);

  function sendOtp() {
    startOtp.mutate(formatPhoneE164(phone));
  }

  function resendOtp() {
    if (phoneE164) {
      startOtp.mutate(phoneE164);
    } else {
      sendOtp();
    }
  }

  function returnToOtpStep() {
    setStep("otp");
    setCode("");
    verifyOtp.reset();
    finishSetup.reset();
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <LinearGradient
        colors={[theme.gradients.current.start, theme.gradients.current.end]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.panel,
            step === "welcome" ? styles.panelWelcome : styles.panelForm,
            {
              paddingHorizontal: theme.spacing.screen,
              paddingTop: Math.max(insets.top, 16) + (step === "welcome" ? 12 : 8),
              paddingBottom: Math.max(insets.bottom, 16) + 24,
              gap: theme.spacing.sectionGap
            }
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={step !== "welcome"}
        >
        {step === "welcome" ? (
          <>
            <View style={styles.heroBrand}>
              <View style={[styles.brandCard, { backgroundColor: "#FFFFFF", borderRadius: theme.radius.lg }]}>
                <BrandLogo variant="mark" size={112} />
              </View>
              <View style={styles.heroWordmark}>
                <BrandLogo variant="wordmark" size={28} />
              </View>
              <ThemedText variant="body" style={{ color: onGradient, opacity: 0.88, textAlign: "center" }}>
                {returningUser
                  ? "Welcome back. Continue with Google to open your groups."
                  : "Split expenses with proof-backed UPI settlements for flats, trips, and groups."}
              </ThemedText>
            </View>
            <View style={[styles.welcomeCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.hairline, borderRadius: theme.radius.lg }]}>
              {googleConfigured ? (
                <GoogleSignInButton
                  variant="button"
                  onIdToken={(idToken) => loginWithGoogle.mutate(idToken)}
                  pending={loginWithGoogle.isPending}
                  errorMessage={loginWithGoogle.error?.message}
                />
              ) : (
                <InlineNotice
                  title="Google sign-in not configured"
                  body="Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to enable signup."
                  tone="pending"
                />
              )}

              {/* Phone OTP login / email signup temporarily disabled — Google only for signup.
              <View style={styles.welcomePhoneHeader}>
                <Phone ... />
                <InputField ... />
                <Button label="Send OTP" ... />
                <AuthIconButton method="email" ... />
              </View>
              */}

              <ThemedText variant="caption" tone="muted" style={{ textAlign: "center", marginTop: 8 }}>
                After Google sign-in we&apos;ll ask for your phone number once to help friends find you.
              </ThemedText>

              <Button label="Join with invite" variant="ghost" onPress={() => setStep("join")} />
            </View>
          </>
        ) : null}

        {/* Email auth steps kept in code but unreachable from welcome while Google-only mode is on.
        {step === "emailGate" ? ( ... ) : null}
        */}
        {false && step === "emailGate" ? (
          <AuthPanel title="Continue with email" body="Create a new account or sign in with your verified email and password." icon={<EnvelopeSimple size={24} color={theme.colors.confirmed} weight="duotone" />}>
            <Button label="Create account" onPress={() => setStep("emailSignup")} />
            <Button label="Sign in" variant="secondary" onPress={() => setStep("emailLogin")} />
            <Button label="Back" variant="ghost" onPress={() => setStep("welcome")} />
          </AuthPanel>
        ) : null}

        {step === "phone" ? (
          <AuthPanel
            title="Add your phone"
            body="Friends find you by number — this is required so they can add you to groups. No OTP for now."
            icon={<Phone size={24} color={theme.colors.confirmed} weight="duotone" />}
          >
            {phoneCandidates.length > 0 ? (
              <View style={styles.phoneCandidates}>
                <ThemedText variant="caption" tone="muted">
                  {phoneCandidates.length > 1 ? "Choose a number" : "Suggested number"}
                </ThemedText>
                <View style={styles.phoneChipRow}>
                  {phoneCandidates.map((candidate) => {
                    const selected = phone === candidate;
                    return (
                      <Pressable
                        key={candidate}
                        onPress={() => setPhone(candidate)}
                        style={[
                          styles.phoneChip,
                          {
                            borderColor: selected ? theme.colors.confirmed : theme.colors.hairline,
                            backgroundColor: selected ? theme.colors.neutralChipBg : "transparent"
                          }
                        ]}
                      >
                        <ThemedText variant="bodySm" tone={selected ? "confirmed" : "ink"}>
                          {candidate}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
            <InputField label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            {loginWithPhone.error ? <InlineNotice title="Phone could not be saved" body={loginWithPhone.error.message} tone="owe" /> : null}
            <Button
              label="Save phone and continue"
              onPress={() => {
                setLinkingPhone(true);
                loginWithPhone.mutate();
              }}
              loading={loginWithPhone.isPending}
              disabled={phone.length < 8}
            />
          </AuthPanel>
        ) : null}

        {step === "emailSignup" ? (
          <AuthPanel title="Create account" body="Verify your email, then use your password to sign in." icon={<EnvelopeSimple size={24} color={theme.colors.confirmed} weight="duotone" />}>
            <InputField label="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <InputField label="Password" value={password} onChangeText={setPassword} secureTextEntry />
            {startEmailSignup.error ? <InlineNotice title="Email signup could not start" body={startEmailSignup.error.message} tone="owe" /> : null}
            <Button label="Send verification code" onPress={() => startEmailSignup.mutate()} loading={startEmailSignup.isPending} disabled={!email.includes("@") || password.length < 8} />
            <Button label="Back" variant="ghost" onPress={() => setStep("welcome")} />
          </AuthPanel>
        ) : null}

        {step === "emailVerify" ? (
          <AuthPanel title="Verify email" body={`Enter the six digit code sent to ${email.trim()}.`} icon={<ShieldCheck size={24} color={theme.colors.confirmed} weight="duotone" />}>
            <InputField label="Verification code" value={emailCode} onChangeText={(value) => setEmailCode(value.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" maxLength={6} />
            {verifyEmailSignup.error ? <InlineNotice title="Verification failed" body={verifyEmailSignup.error.message} tone="owe" /> : null}
            <Button label="Verify email" onPress={() => verifyEmailSignup.mutate()} loading={verifyEmailSignup.isPending} disabled={emailCode.length !== 6} />
            <Button label="Resend code" variant="secondary" onPress={() => startEmailSignup.mutate()} loading={startEmailSignup.isPending} />
            <Button label="Use a different email" variant="ghost" onPress={() => setStep("emailSignup")} />
          </AuthPanel>
        ) : null}

        {step === "emailLogin" ? (
          <AuthPanel title="Welcome back" body="Sign in with your verified email and password." icon={<Key size={24} color={theme.colors.confirmed} weight="duotone" />}>
            <InputField label="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <InputField label="Password" value={password} onChangeText={setPassword} secureTextEntry />
            {loginWithEmail.error ? <InlineNotice title="Sign in failed" body={loginWithEmail.error.message} tone="owe" /> : null}
            <Button label="Sign in" onPress={() => loginWithEmail.mutate()} loading={loginWithEmail.isPending} disabled={!email.includes("@") || !password} />
            <Button label="Forgot password?" variant="secondary" onPress={() => setStep("forgotPassword")} />
            <Button label="Back" variant="ghost" onPress={() => setStep("welcome")} />
          </AuthPanel>
        ) : null}

        {step === "forgotPassword" ? (
          <AuthPanel title="Reset password" body="We will send a verification code to your email address." icon={<EnvelopeSimple size={24} color={theme.colors.confirmed} weight="duotone" />}>
            <InputField label="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            {startPasswordReset.error ? <InlineNotice title="Reset could not start" body={startPasswordReset.error.message} tone="owe" /> : null}
            <Button label="Send reset code" onPress={() => startPasswordReset.mutate()} loading={startPasswordReset.isPending} disabled={!email.includes("@")} />
            <Button label="Back to sign in" variant="ghost" onPress={() => setStep("emailLogin")} />
          </AuthPanel>
        ) : null}

        {step === "resetPassword" ? (
          <AuthPanel title="Choose a new password" body="Enter the code from your email and a new password. This signs out your other devices." icon={<Key size={24} color={theme.colors.confirmed} weight="duotone" />}>
            <InputField label="Verification code" value={emailCode} onChangeText={(value) => setEmailCode(value.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" maxLength={6} />
            <InputField label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
            {resetPassword.error ? <InlineNotice title="Password reset failed" body={resetPassword.error.message} tone="owe" /> : null}
            <Button label="Reset password" onPress={() => resetPassword.mutate()} loading={resetPassword.isPending} disabled={emailCode.length !== 6 || newPassword.length < 8} />
            <Button label="Send another code" variant="secondary" onPress={() => startPasswordReset.mutate()} loading={startPasswordReset.isPending} />
            <Button label="Back to sign in" variant="ghost" onPress={() => setStep("emailLogin")} />
          </AuthPanel>
        ) : null}

        {step === "otp" ? (
          <AuthPanel
            title={linkingPhone ? "Verify phone" : "Verify code"}
            body={
              maskedDestination
                ? `Enter the six digit code sent to ${maskedDestination}.`
                : "Enter the six digit OTP sent to your phone."
            }
            icon={<ShieldCheck size={24} color={theme.colors.confirmed} weight="duotone" />}
          >
            <InputField
              label="OTP code"
              value={code}
              onChangeText={(value) => {
                setCode(value.replace(/\D/g, "").slice(0, 6));
                if (verifyOtp.error) {
                  verifyOtp.reset();
                }
              }}
              keyboardType="number-pad"
              maxLength={6}
            />
            {verifyOtp.error ? (
              <InlineNotice title="Incorrect code" body={`${verifyOtp.error.message} Check the code and try again, or resend a new one.`} tone="owe" />
            ) : null}
            {startOtp.error ? <InlineNotice title="Resend failed" body={startOtp.error.message} tone="owe" /> : null}
            <Button
              label="Verify code"
              onPress={() => verifyOtp.mutate()}
              loading={verifyOtp.isPending}
              disabled={code.length !== 6 || !challengeId}
            />
            <Button label="Resend code" variant="secondary" onPress={resendOtp} loading={startOtp.isPending} disabled={!phoneE164 && phone.length < 8} />
            <Button
              label="Change phone number"
              variant="ghost"
              onPress={() => {
                setStep("phone");
                setCode("");
                verifyOtp.reset();
              }}
            />
          </AuthPanel>
        ) : null}

        {step === "profile" ? (
          <AuthPanel title="Profile name" body="This name appears in groups, audit history, and payment confirmations." icon={<UsersThree size={24} color={theme.colors.confirmed} weight="duotone" />}>
            <InputField label="Display name" value={displayName} onChangeText={setDisplayName} />
            <Button label="Review consent choices" onPress={() => setStep("consent")} disabled={!displayName.trim()} />
            <Button label="Back" variant="ghost" onPress={() => setStep(inviteLink.trim() ? "join" : "welcome")} />
          </AuthPanel>
        ) : null}

        {step === "consent" ? (
          <AuthPanel title="Consent choices" body="You can use core splitting without uploading contacts or linking a bank account." icon={<Bell size={24} color={theme.colors.confirmed} weight="duotone" />}>
            <ConsentRow label="Optional contacts" body="Find friends by phone hash only after explicit permission." selected={consents.contacts} onPress={() => setConsents((value) => ({ ...value, contacts: !value.contacts }))} />
            <ConsentRow
              label="Notifications"
              body="Receive proof, confirmation, and recurring bill reminders."
              selected={consents.notifications}
              onPress={() => setConsents((value) => ({ ...value, notifications: !value.notifications }))}
            />
            <ConsentRow
              label="Receipt and proof storage"
              body="Keep receipt images and payment proofs attached to the ledger."
              selected={consents.proofStorage}
              onPress={() => setConsents((value) => ({ ...value, proofStorage: !value.proofStorage }))}
            />
            {finishSetup.error ? <InlineNotice title="Setup failed" body={finishSetup.error.message} tone="owe" /> : null}
            <Button label="Finish setup" onPress={() => finishSetup.mutate()} loading={finishSetup.isPending} disabled={!displayName.trim()} />
            <Button label="Back" variant="ghost" onPress={() => setStep("profile")} />
          </AuthPanel>
        ) : null}

        {step === "join" ? (
          <View style={styles.joinShell}>
            <View style={styles.joinHero}>
              <View style={[styles.joinIconHalo, { backgroundColor: theme.colors.surface }]}>
                <LinkSimple size={28} color={theme.colors.confirmed} weight="duotone" />
              </View>
              <ThemedText variant="title" align="center">
                Join with invite
              </ThemedText>
              <ThemedText variant="bodySm" tone="muted" align="center">
                Paste a link, scan a QR, then continue with Google. We&apos;ll add you to the group after sign-in.
              </ThemedText>
            </View>

            <View
              style={[
                styles.joinCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.hairline,
                  borderRadius: theme.radius.lg
                }
              ]}
            >
              <InputField
                label="Invite link or token"
                value={inviteLink}
                onChangeText={setInviteLink}
                autoCapitalize="none"
                placeholder="https://…/join/… or token"
              />

              {scanningInvite && !isWeb ? (
                <View style={[styles.cameraBox, { borderColor: theme.colors.hairline, borderRadius: theme.radius.md }]}>
                  <CameraView
                    style={styles.camera}
                    barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                    onBarcodeScanned={(result: BarcodeScanningResult) => {
                      setInviteLink(result.data);
                      setScanningInvite(false);
                    }}
                  />
                </View>
              ) : null}

              {!isWeb ? (
                <Button
                  label={scanningInvite ? "Close scanner" : "Scan invite QR"}
                  variant="secondary"
                  onPress={async () => {
                    if (!cameraPermission?.granted) {
                      const requested = await requestCameraPermission();
                      if (!requested.granted) return;
                    }
                    setScanningInvite((value) => !value);
                  }}
                />
              ) : (
                <InlineNotice
                  title="QR on phone only"
                  body="Paste the invite link here when previewing on desktop."
                  tone="info"
                />
              )}

              <View style={[styles.joinDivider, { backgroundColor: theme.colors.hairline }]} />

              {googleConfigured ? (
                <GoogleSignInButton
                  label="Continue with Google"
                  onIdToken={(idToken) => loginWithGoogle.mutate(idToken)}
                  pending={loginWithGoogle.isPending}
                  errorMessage={loginWithGoogle.error?.message}
                  disabled={!inviteLink.trim()}
                />
              ) : (
                <InlineNotice title="Google sign-in not configured" body="Configure Google OAuth client IDs, or use phone below." tone="pending" />
              )}

              <ThemedText variant="caption" tone="muted" align="center">
                Prefer phone instead?
              </ThemedText>
              <InputField label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              {loginWithPhone.error ? <InlineNotice title="Phone sign-in failed" body={loginWithPhone.error.message} tone="owe" /> : null}
              <Button
                label="Continue with phone"
                variant="secondary"
                onPress={() => {
                  setLinkingPhone(false);
                  loginWithPhone.mutate();
                }}
                loading={loginWithPhone.isPending}
                disabled={!inviteLink.trim() || phone.length < 8}
              />
              <Button
                label="Back to welcome"
                variant="ghost"
                onPress={() => {
                  setScanningInvite(false);
                  setStep("welcome");
                }}
              />
            </View>
          </View>
        ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function AuthPanel({ title, body, icon, children }: { title: string; body: string; icon: React.ReactNode; children: React.ReactNode }) {
  const theme = useTheme();

  return (
    <View style={[styles.authPanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.hairline, borderRadius: theme.radius.lg, padding: theme.spacing.cardPadding }]}>
      <View style={styles.authBrand}>
        <View style={styles.authMarkClip}>
          <BrandLogo variant="mark" size={28} />
        </View>
        <View style={styles.authWordmarkChip}>
          <BrandLogo variant="wordmark" size={14} />
        </View>
      </View>
      <View style={styles.authHeader}>
        <View style={[styles.iconCircle, { backgroundColor: theme.colors.surfaceRaised }]}>{icon}</View>
        <View style={styles.headerText}>
          <ThemedText variant="title">{title}</ThemedText>
          <ThemedText variant="bodySm" tone="muted">
            {body}
          </ThemedText>
        </View>
      </View>
      {children}
    </View>
  );
}

function ConsentRow({ label, body, selected, onPress }: { label: string; body: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  const onColor = theme.mode === "dark" ? theme.colors.ink : theme.colors.surface;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.consentRow,
        {
          borderColor: selected ? theme.colors.confirmed : theme.colors.hairline,
          backgroundColor: theme.colors.surfaceRaised,
          borderRadius: theme.radius.md
        }
      ]}
    >
      <View style={styles.headerText}>
        <ThemedText variant="bodyMedium">{label}</ThemedText>
        <ThemedText variant="bodySm" tone="muted">
          {body}
        </ThemedText>
      </View>
      <View style={[styles.check, { backgroundColor: selected ? theme.colors.confirmed : "transparent", borderColor: selected ? theme.colors.confirmed : theme.colors.inkFaint }]}>
        {selected ? <Check size={14} color={onColor} weight="bold" /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  flex: {
    flex: 1
  },
  gradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "44%",
    opacity: 0.92
  },
  panel: {
    flexGrow: 1
  },
  panelWelcome: {
    justifyContent: "flex-end"
  },
  panelForm: {
    justifyContent: "flex-start"
  },
  heroCopy: {
    gap: 12,
    paddingBottom: 20
  },
  heroBrand: {
    gap: 16,
    paddingBottom: 12,
    alignItems: "center"
  },
  brandCard: {
    width: 148,
    height: 148,
    paddingHorizontal: 18,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    overflow: "hidden"
  },
  heroWordmark: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8
  },
  welcomeCard: {
    gap: 14,
    borderWidth: 1,
    padding: 16
  },
  welcomePhoneHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth
  },
  iconRow: {
    flexDirection: "row",
    gap: 12
  },
  phoneCandidates: {
    gap: 8
  },
  phoneChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  phoneChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  stack: {
    gap: 12
  },
  authPanel: {
    gap: 14,
    borderWidth: 1,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center"
  },
  authBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4
  },
  authMarkClip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center"
  },
  authWordmarkChip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E4E7EF",
    overflow: "hidden",
    maxWidth: "78%"
  },
  authHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center"
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
  },
  headerText: {
    flex: 1,
    gap: 4
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    padding: 12
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  cameraBox: {
    overflow: "hidden",
    borderWidth: 1,
    height: 160,
    maxHeight: 160,
    width: "100%"
  },
  camera: {
    width: "100%",
    height: 160
  },
  joinShell: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    gap: 20
  },
  joinHero: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8
  },
  joinIconHalo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4
  },
  joinCard: {
    gap: 14,
    borderWidth: 1,
    padding: 18
  },
  joinDivider: {
    height: StyleSheet.hairlineWidth,
    width: "100%",
    marginVertical: 2
  }
});
