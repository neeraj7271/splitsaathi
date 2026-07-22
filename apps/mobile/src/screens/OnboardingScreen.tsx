import React, { useEffect, useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import * as WebBrowser from "expo-web-browser";
import { Bell, Check, EnvelopeSimple, Key, LinkSimple, Phone, ShieldCheck, UsersThree } from "phosphor-react-native";
import { useMutation } from "@tanstack/react-query";

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

function shouldSkipOnboarding(response: {
  needsOnboarding?: boolean;
  needsPhoneLink?: boolean;
  user: { displayName: string };
}) {
  if (response.needsPhoneLink) {
    return false;
  }
  if (response.needsOnboarding === false) {
    return true;
  }
  if (response.needsOnboarding === true) {
    return false;
  }
  return Boolean(response.user.displayName) && !/^User \d{4}$/.test(response.user.displayName);
}

function nextStepAfterAuth(response: {
  needsOnboarding?: boolean;
  needsPhoneLink?: boolean;
  user: { displayName: string };
}): OnboardingStep | "done" {
  if (response.needsPhoneLink) {
    return "phone";
  }
  if (shouldSkipOnboarding(response)) {
    return "done";
  }
  return "profile";
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
      const next = nextStepAfterAuth(response);
      if (next === "done") {
        await markLoggedInBefore();
        onAuthenticated();
        return;
      }
      setDisplayName(response.user.displayName.startsWith("User ") ? "" : response.user.displayName);
      setStep(next);
    }
  });

  const loginWithGoogle = useMutation({
    mutationFn: (idToken: string) => apiClient.loginWithGoogle(idToken),
    onSuccess: async (response) => {
      setOtpVerified(true);
      const next = nextStepAfterAuth(response);
      if (next === "phone") {
        setLinkingPhone(true);
        setStep("phone");
        return;
      }
      if (next === "done") {
        await markLoggedInBefore();
        onAuthenticated();
        return;
      }
      setDisplayName(response.user.displayName);
      setStep(next);
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
      if (shouldSkipOnboarding(response)) {
        await markLoggedInBefore();
        onAuthenticated();
        return;
      }
      setDisplayName(response.user.displayName);
      setStep("profile");
    }
  });

  const loginWithEmail = useMutation({
    mutationFn: () => apiClient.loginWithEmailPassword(email.trim(), password),
    onSuccess: async (response) => {
      setOtpVerified(true);
      if (shouldSkipOnboarding(response)) {
        await markLoggedInBefore();
        onAuthenticated();
        return;
      }
      setDisplayName(response.user.displayName);
      setStep("profile");
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
      if (!otpVerified) {
        throw new Error("Verify your phone number before finishing setup.");
      }
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
      if (url && /\/join\/|groups\/invites\//.test(url)) {
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
      <View style={[styles.panel, { paddingHorizontal: theme.spacing.screen, gap: theme.spacing.sectionGap }]}>
        {step === "welcome" ? (
          <>
            <View style={styles.heroBrand}>
              <View style={[styles.brandCard, { backgroundColor: "#FFFFFF", borderRadius: theme.radius.lg }]}>
                <BrandLogo variant="lockup" size={148} />
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
            body="Enter your +91 mobile number. We'll send a one-time code so friends can find you in SplitSaathi."
            icon={<Phone size={24} color={theme.colors.confirmed} weight="duotone" />}
          >
            <InputField label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            {startOtp.error ? <InlineNotice title="OTP could not start" body={startOtp.error.message} tone="owe" /> : null}
            <Button
              label="Send OTP"
              onPress={() => {
                setLinkingPhone(true);
                sendOtp();
              }}
              loading={startOtp.isPending}
              disabled={phone.length < 8}
            />
            <Button
              label="Skip for now"
              variant="ghost"
              onPress={() => {
                setLinkingPhone(false);
                setStep("profile");
              }}
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
            <Button label="Back to OTP" variant="ghost" onPress={returnToOtpStep} />
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
            <Button label="Finish setup" onPress={() => finishSetup.mutate()} loading={finishSetup.isPending} disabled={!otpVerified || !displayName.trim()} />
            <Button label="Back to OTP" variant="ghost" onPress={returnToOtpStep} />
          </AuthPanel>
        ) : null}

        {step === "join" ? (
          <AuthPanel title="Join or claim guest" body="Paste an invite link or QR payload, then verify by phone if the group owner requires it." icon={<LinkSimple size={24} color={theme.colors.confirmed} weight="duotone" />}>
            <InputField label="Invite link or token" value={inviteLink} onChangeText={setInviteLink} autoCapitalize="none" />
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
            {isWeb ? <InlineNotice title="Desktop preview" body="QR scanning is available on phone builds. Paste the invite link or token here when testing in the browser." tone="info" /> : null}
            <Button
              label={isWeb ? "QR scan is phone-only" : "Scan QR"}
              variant="secondary"
              disabled={isWeb}
              onPress={async () => {
                if (!cameraPermission?.granted) {
                  const requested = await requestCameraPermission();
                  if (!requested.granted) return;
                }
                setScanningInvite((value) => !value);
              }}
            />
            <Button label="Continue with phone OTP" onPress={() => setStep("phone")} disabled={!inviteLink.trim()} />
            <Button label="Back" variant="secondary" onPress={() => setStep("welcome")} />
          </AuthPanel>
        ) : null}
      </View>
    </View>
  );
}

function AuthPanel({ title, body, icon, children }: { title: string; body: string; icon: React.ReactNode; children: React.ReactNode }) {
  const theme = useTheme();

  return (
    <View style={[styles.authPanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.hairline, borderRadius: theme.radius.lg, padding: theme.spacing.cardPadding }]}>
      <View style={styles.authBrand}>
        <View style={styles.authMarkClip}>
          <BrandLogo variant="mark" size={36} />
        </View>
        <View style={styles.authWordmarkChip}>
          <BrandLogo variant="wordmark" size={16} />
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
  gradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "44%",
    opacity: 0.92
  },
  panel: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: 48
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center"
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
  stack: {
    gap: 12
  },
  authPanel: {
    gap: 18,
    borderWidth: 1
  },
  authBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  authMarkClip: {
    borderRadius: 10,
    overflow: "hidden"
  },
  authWordmarkChip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E4E7EF"
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
    height: 180
  },
  camera: {
    flex: 1
  }
});
