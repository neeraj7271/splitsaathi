import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  View
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import * as WebBrowser from "expo-web-browser";
import { Svg, Path, Circle } from "react-native-svg";
import {
  Bell,
  Check,
  CaretLeft,
  CaretRight,
  EnvelopeSimple,
  Key,
  LinkSimple,
  Phone,
  ShieldCheck,
  UsersThree,
  Lightbulb,
  QrCode,
  LockSimple,
  ShareNetwork,
  Sparkle,
  X
} from "phosphor-react-native";
import { useMutation } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiClient } from "../api/client";
import { isGoogleSignInConfigured } from "../auth/GoogleSignInButton";
import { markLoggedInBefore, hasLoggedInBefore } from "../auth/loginStore";
import { clearTokens } from "../auth/tokenStore";
import type { ResumeSetupState } from "../auth/session";
import { AuthIconButton } from "../components/AuthIconButton";
import { BrandLogo } from "../components/BrandLogo";
import { Button } from "../components/Button";
import { InlineNotice } from "../components/InlineNotice";
import { InputField } from "../components/InputField";
import { ThemedText } from "../components/ThemedText";
import { WelcomeLoginScreen } from "../components/WelcomeLoginScreen";
import { registerPushIfPossible } from "../notifications/registerPush";
import { ensureContactsAccess, syncDeviceContacts } from "../utils/contactDiscovery";
import { detectDevicePhoneNumbers } from "../utils/detectDevicePhoneNumbers";
import { isPhoneNumberHintAvailable, requestPhoneNumberHint } from "../utils/phoneNumberHint";
import { validatePhoneNumber } from "../utils/phoneValidation";
import { useTheme } from "../theme";

WebBrowser.maybeCompleteAuthSession();

// Helper: Subtle curved arc for header decoration
function SvgArc({ color = "rgba(255,255,255,0.12)" }: { color?: string }) {
  return (
    <Svg width="100%" height={80} viewBox="0 0 400 80" preserveAspectRatio="none" style={{ position: "absolute", bottom: -40, left: 0 }}>
      <Path
        d="M0,80 Q200,0 400,80"
        stroke={color}
        strokeWidth={2}
        fill="none"
      />
    </Svg>
  );
}

// SafeSecureIllustration: Clean modern 2D vector illustration (3 users + security shield checkmark)
export function SafeSecureIllustration({ width = 72, height = 72 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 72 72" fill="none">
      {/* Background Soft Aura */}
      <Circle cx={36} cy={36} r={32} fill="#F0FDF4" />
      <Circle cx={36} cy={36} r={28} fill="#CCFBF1" opacity={0.4} />

      {/* Decorative Accent Dots */}
      <Circle cx={14} cy={18} r={2} fill="#0D9488" opacity={0.4} />
      <Circle cx={58} cy={16} r={1.5} fill="#6366F1" opacity={0.5} />
      <Circle cx={60} cy={46} r={2} fill="#0D9488" opacity={0.3} />

      {/* User Group */}
      {/* Center-Top User (Indigo/Purple) */}
      <Circle cx={36} cy={19} r={6.5} fill="#4F46E5" />
      <Path d="M26 33 C26 27.5 30.5 26 36 26 C41.5 26 46 27.5 46 33 Z" fill="#6366F1" />

      {/* Left User (Teal) */}
      <Circle cx={22} cy={25} r={5.5} fill="#0D9488" />
      <Path d="M13.5 38 C13.5 33 17.5 31.5 22 31.5 C26.5 31.5 30.5 33 30.5 38 Z" fill="#2DD4BF" />

      {/* Right User (Teal) */}
      <Circle cx={50} cy={25} r={5.5} fill="#0D9488" />
      <Path d="M41.5 38 C41.5 33 45.5 31.5 50 31.5 C54.5 31.5 58.5 33 58.5 38 Z" fill="#2DD4BF" />

      {/* Shield Base Shadow */}
      <Path d="M36 35 L48.5 39 C48.5 50 36 57.5 36 57.5 C36 57.5 23.5 50 23.5 39 Z" fill="#065F46" opacity={0.12} />

      {/* Shield Main Body (Teal) */}
      <Path d="M36 34 L47.5 38 C47.5 48.5 36 55.5 36 55.5 C36 55.5 24.5 48.5 24.5 38 Z" fill="#0D9488" />

      {/* Shield Inner Layer */}
      <Path d="M36 36.5 L45 39.8 C45 47.8 36 53.2 36 53.2 C36 53.2 27 47.8 27 39.8 Z" fill="#14B8A6" />

      {/* Shield Checkmark */}
      <Path d="M31 45.5 L34.5 49 L41.5 42" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

// Helper alias for backward compatibility
function SafeIllustration() {
  return <SafeSecureIllustration width={64} height={64} />;
}

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

export function OnboardingScreen({
  onAuthenticated,
  resumeSetup,
  onSignOut
}: {
  onAuthenticated: () => void;
  resumeSetup?: ResumeSetupState;
  onSignOut?: () => void;
}) {
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
  const [phoneHintAvailable, setPhoneHintAvailable] = useState(false);
  const [phoneHintLoading, setPhoneHintLoading] = useState(false);
  const phoneHintAutoShownRef = useRef(false);
  const resumeAppliedRef = useRef(false);
  const [inviteLink, setInviteLink] = useState("");
  const [scanningInvite, setScanningInvite] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const isWeb = Platform.OS === "web";
  const [consents, setConsents] = useState({
    contacts: false,
    notifications: true,
    proofStorage: true
  });
  const googleConfigured = isGoogleSignInConfigured();
  const hasSavedSession = Boolean(authSnapshot);

  async function handleSignOut() {
    await clearTokens();
    setAuthSnapshot(null);
    setLinkingPhone(false);
    setStep("welcome");
    resumeAppliedRef.current = false;
    onSignOut?.();
  }

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
      const validation = validatePhoneNumber(phone);
      if (!validation.valid) {
        throw new Error(validation.message);
      }
      const formatted = validation.phoneE164;
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
        const access = await ensureContactsAccess({ forcePrompt: true }).catch(() => ({ ok: false as const, reason: "" }));
        if (access.ok) {
          await syncDeviceContacts({ skipPermissionCheck: true }).catch(() => undefined);
        }
      }
      if (consents.notifications) {
        await registerPushIfPossible({ forcePrompt: true }).catch(() => undefined);
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

  function applyPhoneCandidate(candidate: string) {
    setPhoneCandidates((current) => (current.includes(candidate) ? current : [...current, candidate]));
    setPhone(candidate);
  }

  async function pickPhoneFromHint() {
    if (phoneHintLoading) {
      return;
    }
    setPhoneHintLoading(true);
    try {
      const selected = await requestPhoneNumberHint();
      if (selected) {
        applyPhoneCandidate(selected);
      }
    } finally {
      setPhoneHintLoading(false);
    }
  }

  useEffect(() => {
    if (!resumeSetup || resumeAppliedRef.current) {
      return;
    }
    resumeAppliedRef.current = true;
    setAuthSnapshot({
      user: resumeSetup.user,
      needsPhoneLink: resumeSetup.needsPhoneLink,
      needsOnboarding: resumeSetup.needsOnboarding
    });
    setDisplayName(isPlaceholderDisplayName(resumeSetup.user.displayName) ? "" : resumeSetup.user.displayName);

    if (resumeSetup.needsPhoneLink) {
      setLinkingPhone(true);
      setStep("phone");
      return;
    }
    if (resumeSetup.needsOnboarding && isPlaceholderDisplayName(resumeSetup.user.displayName)) {
      setStep("profile");
      return;
    }
    if (resumeSetup.needsOnboarding) {
      setStep("consent");
    }
  }, [resumeSetup]);

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
    if (step !== "phone") {
      return;
    }

    let active = true;

    void (async () => {
      const hintAvailable = await isPhoneNumberHintAvailable();
      if (!active) {
        return;
      }
      setPhoneHintAvailable(hintAvailable);

      if (hintAvailable && !phoneHintAutoShownRef.current) {
        phoneHintAutoShownRef.current = true;
        const selected = await requestPhoneNumberHint();
        if (!active) {
          return;
        }
        if (selected) {
          setPhoneCandidates((current) => (current.includes(selected) ? current : [...current, selected]));
          setPhone(selected);
          return;
        }
      }

      const detected = await detectDevicePhoneNumbers();
      if (!active) {
        return;
      }

      if (detected.length) {
        setPhoneCandidates((current) => {
          const merged = [...current];
          for (const candidate of detected) {
            if (!merged.includes(candidate)) {
              merged.push(candidate);
            }
          }
          return merged;
        });
        setPhone((current) => (current === "+91" || current.trim().length <= 3 ? detected[0] : current));
      }
    })();

    return () => {
      active = false;
    };
  }, [step]);

  useEffect(() => {
    const applyUrl = (url?: string | null) => {
      if (url && /splitsaathi:\/\/join\/|\/join\/|groups\/invites\//i.test(url)) {
        // Sanitize deep link URL
        let sanitized = url.trim();
        try {
          sanitized = decodeURIComponent(sanitized);
        } catch {
          // Use original if decoding fails
        }
        setInviteLink(sanitized);
        setStep("join");
      }
    };
    Linking.getInitialURL().then(applyUrl).catch(() => undefined);
    const subscription = Linking.addEventListener("url", (event) => applyUrl(event.url));
    return () => {
      try {
        subscription?.remove?.();
      } catch {
        // Ignore unbind edge case
      }
    };
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

  const isWelcome = step === "welcome";

  if (isWelcome) {
    return (
      <WelcomeLoginScreen
        returningUser={returningUser}
        googleConfigured={googleConfigured}
        onGoogleIdToken={(idToken) => loginWithGoogle.mutate(idToken)}
        googlePending={loginWithGoogle.isPending}
        googleError={loginWithGoogle.error?.message}
        onJoinInvite={() => setStep("join")}
      />
    );
  }

  if (step === "join") {
    return (
      <View style={styles.joinRoot}>
        <StatusBar barStyle="light-content" />
        {/* Gradient Header */}
        <LinearGradient
          colors={[theme.gradients.current.start, theme.gradients.current.end]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.joinHeaderGradient, { paddingTop: Math.max(insets.top, 16) + 16 }]}
        >
          <Sparkle size={14} color="rgba(255,255,255,0.5)" weight="fill" style={{ position: "absolute", top: "22%", left: "12%" }} />
          <Sparkle size={10} color="rgba(255,255,255,0.35)" weight="fill" style={{ position: "absolute", top: "38%", left: "7%" }} />
          <Sparkle size={14} color="rgba(255,255,255,0.5)" weight="fill" style={{ position: "absolute", top: "22%", right: "10%" }} />
          <View style={styles.joinHeaderContent}>
            <View style={styles.joinIconBadge}>
              <LinkSimple size={32} color={theme.gradients.current.end} weight="duotone" />
            </View>
            <ThemedText variant="title" align="center" style={styles.joinTitle}>
              Join with invite
            </ThemedText>
            <ThemedText variant="bodySm" tone="muted" align="center" style={styles.joinSubtext}>
              Paste a link or scan a QR code,{"\n"}then continue to sign in with Google.
            </ThemedText>
          </View>
        </LinearGradient>

        {/* White Card Body */}
        <View style={[styles.joinCard, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          {/* Invite link or token */}
          <View style={styles.joinSection}>
            <View style={styles.joinLabelRow}>
              <View style={styles.joinLabelBadge}>
                <LinkSimple size={14} color={theme.gradients.current.end} weight="duotone" />
              </View>
              <ThemedText variant="bodyMedium" style={styles.joinLabelText}>Invite link or token</ThemedText>
            </View>
            <View style={[styles.joinInputBox, { borderColor: theme.colors.hairline }]}>
              <View style={styles.joinInputIcon}>
                <LinkSimple size={14} color={theme.gradients.current.end} weight="duotone" />
              </View>
              <TextInput
                value={inviteLink}
                onChangeText={setInviteLink}
                autoCapitalize="none"
                placeholder="https://.../join/... or token"
                style={[styles.joinInput, { color: theme.colors.ink }]}
                placeholderTextColor={theme.colors.inkFaint}
              />
            </View>
          </View>

          {/* OR divider */}
          <View style={styles.joinOrRow}>
            <View style={[styles.joinOrLine, { backgroundColor: theme.colors.hairline }]} />
            <View style={styles.joinOrBadge}>
              <ThemedText variant="caption" style={styles.joinOrText}>OR</ThemedText>
            </View>
            <View style={[styles.joinOrLine, { backgroundColor: theme.colors.hairline }]} />
          </View>

          {/* QR Scan */}
          <Pressable
            style={styles.joinQrCard}
            onPress={async () => {
              if (!cameraPermission?.granted) {
                const requested = await requestCameraPermission();
                if (!requested.granted) return;
              }
              setScanningInvite(true);
            }}
          >
            <View style={styles.joinQrIcon}>
              <QrCode size={22} color={theme.gradients.current.end} weight="duotone" />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <ThemedText variant="bodyMedium" style={{ fontWeight: "600", color: "#1E293B", fontSize: 14 }}>Scan invite QR code</ThemedText>
              <ThemedText variant="caption" tone="muted" style={{ fontSize: 12 }}>Use your camera to scan</ThemedText>
            </View>
            <CaretRight size={18} color={theme.colors.inkMuted} weight="bold" />
          </Pressable>

          {/* Safe & Secure */}
          <View style={styles.joinInfoCard}>
            <View style={styles.joinInfoBadge}>
              <ShieldCheck size={18} color={theme.gradients.current.end} weight="duotone" />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <ThemedText variant="bodyMedium" style={{ fontWeight: "600", color: "#1E293B", fontSize: 13 }}>Safe & secure</ThemedText>
              <ThemedText variant="caption" tone="muted" style={{ fontSize: 11, lineHeight: 16 }}>We only join you to the group.{"\n"}No spam. No sharing.</ThemedText>
            </View>
            <SafeIllustration />
          </View>

          {/* Continue */}
          <Button
            label="Continue"
            Icon={CaretRight}
            onPress={() => {
              setScanningInvite(false);
              setStep("welcome");
            }}
            disabled={!inviteLink.trim()}
            style={styles.joinContinueBtn}
          />

          {/* Back */}
          <Pressable
            style={styles.joinBackRow}
            onPress={() => { setScanningInvite(false); setStep("welcome"); }}
          >
            <CaretLeft size={15} color={theme.colors.inkMuted} weight="bold" />
            <ThemedText variant="bodySm" tone="muted" style={{ fontWeight: "500" }}>Back to welcome</ThemedText>
          </Pressable>

          {/* Help */}
          <View style={styles.joinHelpCard}>
            <View style={styles.joinHelpBadge}>
              <Lightbulb size={16} color="#7C3AED" weight="duotone" />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <ThemedText variant="bodyMedium" style={{ fontWeight: "600", color: "#1E293B", fontSize: 13 }}>Need help?</ThemedText>
              <ThemedText variant="caption" tone="muted" style={{ fontSize: 11, lineHeight: 16 }}>Ask the group admin for a valid invite link or QR code.</ThemedText>
            </View>
          </View>
        </View>

        {/* QR Scanner Modal */}
        <Modal visible={scanningInvite} animationType="slide" transparent={false}>
          <View style={styles.qrModalRoot}>
            <StatusBar barStyle="light-content" />
            <CameraView
              style={StyleSheet.absoluteFill}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={(result: BarcodeScanningResult) => {
                let sanitized = result.data?.trim() ?? "";
                try { sanitized = decodeURIComponent(sanitized); } catch {}
                setInviteLink(sanitized);
                setScanningInvite(false);
              }}
            />
            {/* Dark overlay with square cutout */}
            <View style={styles.qrOverlay}>
              <View style={styles.qrOverlayTop} />
              <View style={styles.qrOverlayMiddle}>
                <View style={styles.qrOverlaySide} />
                <View style={styles.qrViewfinder}>
                  {/* Corner brackets */}
                  <View style={[styles.qrCorner, styles.qrCornerTL]} />
                  <View style={[styles.qrCorner, styles.qrCornerTR]} />
                  <View style={[styles.qrCorner, styles.qrCornerBL]} />
                  <View style={[styles.qrCorner, styles.qrCornerBR]} />
                </View>
                <View style={styles.qrOverlaySide} />
              </View>
              <View style={styles.qrOverlayBottom}>
                <ThemedText variant="bodyMedium" style={styles.qrScanLabel}>Point camera at QR code</ThemedText>
              </View>
            </View>
            {/* Close button */}
            <Pressable
              style={[styles.qrCloseBtn, { top: Math.max(insets.top, 16) + 8 }]}
              onPress={() => setScanningInvite(false)}
            >
              <X size={22} color="#FFFFFF" weight="bold" />
            </Pressable>
          </View>
        </Modal>
      </View>
    );
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
            styles.panelForm,
            {
              paddingHorizontal: theme.spacing.screen,
              paddingTop: Math.max(insets.top, 16) + 8,
              paddingBottom: Math.max(insets.bottom, 16) + 24,
              gap: theme.spacing.sectionGap
            }
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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
            body="Friends find you by number — this is required so they can add you to groups."
            icon={<Phone size={24} color={theme.colors.confirmed} weight="duotone" />}
          >
            {phoneHintAvailable ? (
              <Button
                label={phoneHintLoading ? "Opening number picker…" : "Use number on this device"}
                variant="secondary"
                onPress={() => void pickPhoneFromHint()}
                loading={phoneHintLoading}
                disabled={phoneHintLoading}
              />
            ) : null}
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
              disabled={!validatePhoneNumber(phone).valid}
            />
            {hasSavedSession ? (
              <Button label="Sign out" variant="ghost" onPress={() => void handleSignOut()} />
            ) : null}
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
            {hasSavedSession ? (
              <Button label="Sign out" variant="ghost" onPress={() => void handleSignOut()} />
            ) : (
              <Button label="Back" variant="ghost" onPress={() => setStep(inviteLink.trim() ? "join" : "welcome")} />
            )}
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
            {hasSavedSession && isPlaceholderDisplayName(authSnapshot?.user.displayName) ? (
              <Button label="Back" variant="ghost" onPress={() => setStep("profile")} />
            ) : null}
            {hasSavedSession ? (
              <Button label="Sign out" variant="ghost" onPress={() => void handleSignOut()} />
            ) : (
              <Button label="Back" variant="ghost" onPress={() => setStep("profile")} />
            )}
          </AuthPanel>
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
  panelForm: {
    justifyContent: "flex-start"
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

  // ===== JOIN WITH INVITE (full-screen) =====
  joinRoot: {
    flex: 1,
    backgroundColor: "#FFFFFF"
  },
  joinHeaderGradient: {
    paddingBottom: 48,
    paddingHorizontal: 24,
    alignItems: "center"
  },
  joinHeaderContent: {
    alignItems: "center",
    gap: 10
  },
  joinIconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6
  },
  joinTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  joinSubtext: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center"
  },
  joinCard: {
    flex: 1,
    marginTop: -24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 22,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4
  },
  joinSection: {
    gap: 8
  },
  joinLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  joinLabelBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(13,148,136,0.1)",
    alignItems: "center",
    justifyContent: "center"
  },
  joinLabelText: {
    fontWeight: "600",
    fontSize: 14,
    color: "#1E293B"
  },
  joinInputBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: "#F8FAFC"
  },
  joinInputIcon: {
    marginLeft: 10,
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(13,148,136,0.1)",
    alignItems: "center",
    justifyContent: "center"
  },
  joinInput: {
    flex: 1,
    paddingLeft: 10,
    paddingRight: 14,
    paddingVertical: 12,
    fontSize: 13
  },
  joinOrRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  joinOrLine: {
    flex: 1,
    height: 1
  },
  joinOrBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginHorizontal: 8
  },
  joinOrText: {
    fontWeight: "600",
    fontSize: 10,
    color: "#94A3B8"
  },
  joinQrCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DCFCE7"
  },
  joinQrIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1
  },
  joinInfoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  joinInfoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },
  joinContinueBtn: {
    borderRadius: 24,
    paddingVertical: 12
  },
  joinBackRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 4
  },
  joinHelpCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0"
  },
  joinHelpBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },

  // ===== QR Scanner Modal =====
  qrModalRoot: {
    flex: 1,
    backgroundColor: "#000"
  },
  qrOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center"
  },
  qrOverlayTop: {
    flex: 1,
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.6)"
  },
  qrOverlayMiddle: {
    flexDirection: "row",
    width: "100%"
  },
  qrOverlaySide: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)"
  },
  qrViewfinder: {
    width: Dimensions.get("window").width * 0.65,
    height: Dimensions.get("window").width * 0.65,
    borderRadius: 16,
    position: "relative"
  },
  qrCorner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: "#FFFFFF"
  },
  qrCornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 12
  },
  qrCornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 12
  },
  qrCornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 12
  },
  qrCornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 12
  },
  qrOverlayBottom: {
    flex: 1,
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    paddingTop: 28
  },
  qrScanLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    fontWeight: "500"
  },
  qrCloseBtn: {
    position: "absolute",
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center"
  }
});
