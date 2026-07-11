import React, { useEffect, useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { ArrowRight, Bell, Check, LinkSimple, Phone, ShieldCheck, UsersThree } from "phosphor-react-native";
import { useMutation } from "@tanstack/react-query";

import { apiClient } from "../api/client";
import { Button } from "../components/Button";
import { InlineNotice } from "../components/InlineNotice";
import { InputField } from "../components/InputField";
import { ThemedText } from "../components/ThemedText";
import { registerPushIfPossible } from "../notifications/registerPush";
import { useTheme } from "../theme";

type OnboardingStep = "welcome" | "phone" | "otp" | "profile" | "consent" | "join";

export function OnboardingScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const theme = useTheme();
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [phone, setPhone] = useState("+91");
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [challengeId, setChallengeId] = useState<string>();
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

  const startOtp = useMutation({
    mutationFn: () => apiClient.startOtp(phone),
    onSuccess: (response) => {
      setChallengeId(response.challengeId);
      setStep("otp");
    }
  });

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

  const verifyOtp = useMutation({
    mutationFn: async () => {
      if (!challengeId) {
        throw new Error("OTP challenge was not started");
      }

      const response = await apiClient.verifyOtp(challengeId, code, displayName);
      await Promise.allSettled([
        apiClient.recordConsent("contacts_discovery", consents.contacts),
        apiClient.recordConsent("notification_delivery", consents.notifications),
        apiClient.recordConsent("upi_proof_storage", consents.proofStorage)
      ]);
      if (consents.notifications) {
        await registerPushIfPossible();
      }
      if (inviteLink.trim()) {
        await apiClient.claimInvite(inviteLink, displayName);
      }

      return response;
    },
    onSuccess: onAuthenticated
  });

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
            <View style={styles.heroCopy}>
              <ThemedText variant="displayLg" style={{ color: onGradient }}>
                SplitSaathi
              </ThemedText>
              <ThemedText variant="body" style={{ color: onGradient, opacity: 0.82 }}>
                A shared ledger for flats, trips, and UPI settlements where proof and confirmation stay visible.
              </ThemedText>
            </View>
            <View style={styles.stack}>
              <InlineNotice title="Phone-first account" body="Start with OTP. Contacts are optional and can be skipped." tone="confirmed" />
              <Button label="Start with phone" onPress={() => setStep("phone")} />
              <Button label="Join with invite" variant="secondary" onPress={() => setStep("join")} />
            </View>
          </>
        ) : null}

        {step === "phone" ? (
          <AuthPanel
            title="Enter phone"
            body="We use OTP for recovery and group accountability. Contact upload is not required."
            icon={<Phone size={24} color={theme.colors.confirmed} weight="duotone" />}
          >
            <InputField label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            {startOtp.error ? <InlineNotice title="OTP could not start" body={startOtp.error.message} tone="owe" /> : null}
            <Button label="Send OTP" onPress={() => startOtp.mutate()} loading={startOtp.isPending} disabled={phone.length < 8} />
          </AuthPanel>
        ) : null}

        {step === "otp" ? (
          <AuthPanel
            title="Verify code"
            body="Enter the six digit OTP before setting up profile and consent choices."
            icon={<ShieldCheck size={24} color={theme.colors.confirmed} weight="duotone" />}
          >
            <InputField label="OTP code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
            <Button label="Continue" onPress={() => setStep("profile")} disabled={code.length !== 6} />
          </AuthPanel>
        ) : null}

        {step === "profile" ? (
          <AuthPanel title="Profile name" body="This name appears in groups, audit history, and payment confirmations." icon={<UsersThree size={24} color={theme.colors.confirmed} weight="duotone" />}>
            <InputField label="Display name" value={displayName} onChangeText={setDisplayName} />
            <Button label="Review consent choices" onPress={() => setStep("consent")} disabled={!displayName.trim()} />
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
            {verifyOtp.error ? <InlineNotice title="Verification failed" body={verifyOtp.error.message} tone="owe" /> : null}
            <Button label="Finish setup" onPress={() => verifyOtp.mutate()} loading={verifyOtp.isPending} disabled={!challengeId || code.length !== 6} />
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
  stack: {
    gap: 12
  },
  authPanel: {
    gap: 18,
    borderWidth: 1
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
