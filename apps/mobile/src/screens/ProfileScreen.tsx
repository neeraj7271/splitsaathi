import React, { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ImageSquare, Trash, Bell, ShieldCheck, Palette, Star, Headset, SealCheck, PencilSimple, EnvelopeSimple, CurrencyInr, Phone, Gear } from "phosphor-react-native";

import { apiClient } from "../api/client";
import { ActionSheet } from "../components/ActionSheet";
import { BrandLogo } from "../components/BrandLogo";
import { Button } from "../components/Button";
import { DataSurface } from "../components/DataSurface";
import { InlineNotice } from "../components/InlineNotice";
import { InputField } from "../components/InputField";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { SettingsLinkRow } from "../components/SettingsLinkRow";
import { ThemedText } from "../components/ThemedText";
import { UserAvatar } from "../components/UserAvatar";
import { colorWithAlpha, useTheme } from "../theme";
import { AppNavigation } from "../types/navigation";
import { pickAndCompressAvatar } from "../utils/avatarUpload";
import { clearAuthenticatedImageCache } from "../utils/authenticatedImage";
import { normalizePhoneE164 } from "../utils/phoneHash";

export function ProfileScreen({ navigation }: { navigation: AppNavigation }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const profileQuery = useQuery({ queryKey: ["me"], queryFn: () => apiClient.getMe() });
  const [displayName, setDisplayName] = useState("");
  const [savedDisplayName, setSavedDisplayName] = useState("");
  const [upiVpa, setUpiVpa] = useState("");
  const [savedUpiVpa, setSavedUpiVpa] = useState("");
  const [phoneE164, setPhoneE164] = useState("");
  const [savedPhoneE164, setSavedPhoneE164] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);
  const [avatarSheetVisible, setAvatarSheetVisible] = useState(false);

  useEffect(() => {
    if (profileQuery.data?.displayName) {
      setDisplayName(profileQuery.data.displayName);
      setSavedDisplayName(profileQuery.data.displayName);
      setUpiVpa(profileQuery.data.upiVpa ?? "");
      setSavedUpiVpa(profileQuery.data.upiVpa ?? "");
      const phone = profileQuery.data.phoneE164 ?? "";
      setPhoneE164(phone);
      setSavedPhoneE164(phone);
    }
  }, [profileQuery.data?.displayName, profileQuery.data?.upiVpa, profileQuery.data?.phoneE164]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      const nextPhone = normalizePhoneE164(phoneE164.trim()) || phoneE164.trim();
      const phoneChanged = nextPhone !== savedPhoneE164;
      if (phoneChanged) {
        if (!nextPhone || nextPhone.replace(/\D/g, "").length < 10) {
          throw new Error("Enter a valid phone number with country code, e.g. +9198XXXXXXXX.");
        }
        await apiClient.linkPhone(nextPhone, displayName.trim() || undefined);
      }
      return apiClient.updateMe({
        displayName: displayName.trim(),
        upiVpa: upiVpa.trim() || null
      });
    },
    onSuccess: async (profile) => {
      const refreshed = await apiClient.getMe().catch(() => profile);
      queryClient.setQueryData(["me"], refreshed);
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      void queryClient.invalidateQueries({ queryKey: ["groups"] });
      setDisplayName(refreshed.displayName);
      setSavedDisplayName(refreshed.displayName);
      setUpiVpa(refreshed.upiVpa ?? "");
      setSavedUpiVpa(refreshed.upiVpa ?? "");
      setPhoneE164(refreshed.phoneE164 ?? "");
      setSavedPhoneE164(refreshed.phoneE164 ?? "");
      setIsEditing(false);
    }
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: { uri: string; mimeType: string; name?: string }) => {
      setAvatarError(null);
      const attachment = await apiClient.uploadAvatar(file);
      return apiClient.updateMe({ avatarAttachmentId: attachment.id });
    },
    onSuccess: async (profile) => {
      if (profile) {
        await clearAuthenticatedImageCache(profile.avatarUrl);
        queryClient.setQueryData(["me"], profile);
        queryClient.invalidateQueries({ queryKey: ["me"] });
      }
    },
    onError: (error: Error) => {
      setAvatarError(error.message);
    }
  });

  const removeAvatar = useMutation({
    mutationFn: () => apiClient.updateMe({ avatarAttachmentId: null }),
    onSuccess: async (profile) => {
      setLocalAvatarUri(null);
      if (profile) {
        await clearAuthenticatedImageCache(profile.avatarUrl);
        queryClient.setQueryData(["me"], profile);
        queryClient.invalidateQueries({ queryKey: ["me"] });
      }
    },
    onError: (error: Error) => {
      setAvatarError(error.message);
    }
  });

  const profile = profileQuery.data;
  const normalizedDraftPhone = normalizePhoneE164(phoneE164.trim()) || phoneE164.trim();
  const hasChanges =
    displayName.trim() !== savedDisplayName ||
    upiVpa.trim() !== savedUpiVpa ||
    normalizedDraftPhone !== savedPhoneE164;
  const hasAvatar = Boolean(localAvatarUri || profile?.avatarUrl);

  async function pickAndUploadAvatar() {
    const file = await pickAndCompressAvatar();
    if (!file) {
      return;
    }
    setLocalAvatarUri(file.uri);
    uploadAvatar.mutate(file);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.back() || navigation.go("home")} style={[styles.iconButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.hairline }]}>
          <ArrowLeft size={20} color={theme.colors.ink} />
        </Pressable>
        <View style={styles.titleBlock}>
          <ThemedText variant="caption" tone="confirmed">
            Account
          </ThemedText>
          <ThemedText variant="title">Profile</ThemedText>
        </View>
      </View>

      {profileQuery.error ? <InlineNotice title="Profile could not load" body={profileQuery.error.message} tone="owe" /> : null}

      <DataSurface>
        <View style={styles.profileBlock}>
          <UserAvatar
            displayName={profile?.displayName ?? displayName}
            avatarUrl={profile?.avatarUrl}
            localUri={localAvatarUri}
            size={86}
            editable
            loading={uploadAvatar.isPending || removeAvatar.isPending}
            onPress={() => setAvatarSheetVisible(true)}
          />
          <View style={styles.identity}>
            <View style={styles.nameRow}>
              <View style={styles.nameWrapper}>
                <ThemedText variant="title" numberOfLines={1} style={{ flexShrink: 1 }}>{profile?.displayName ?? "Your profile"}</ThemedText>
                <SealCheck size={20} color={theme.colors.confirmed} weight="fill" />
              </View>
              <Pressable
                style={[styles.editButton, { borderColor: theme.colors.confirmed }]}
                onPress={() => {
                  if (isEditing) {
                    setDisplayName(savedDisplayName);
                    setUpiVpa(savedUpiVpa);
                    setPhoneE164(savedPhoneE164);
                  }
                  setIsEditing((value) => !value);
                }}
              >
                <PencilSimple size={14} color={theme.colors.confirmed} />
                <ThemedText variant="bodySm" tone="confirmed">
                  {isEditing ? "Cancel" : "Edit profile"}
                </ThemedText>
              </Pressable>
            </View>
            <View style={[styles.activeTag, { backgroundColor: colorWithAlpha(theme.colors.confirmed, 0.15) }]}>
              <View style={[styles.activeDot, { backgroundColor: theme.colors.confirmed }]} />
              <ThemedText variant="bodySm" tone="confirmed">Active</ThemedText>
            </View>
            <View style={styles.infoRow}>
              <EnvelopeSimple size={16} color={theme.colors.inkMuted} />
              <ThemedText variant="bodySm" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
                {profile?.email ?? "Email unavailable"}
              </ThemedText>
            </View>
            <View style={styles.infoRow}>
              <CurrencyInr size={16} color={theme.colors.info} />
              <ThemedText variant="bodySm" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
                {savedUpiVpa || "Not set"}
              </ThemedText>
              <View style={[styles.badge, { backgroundColor: colorWithAlpha(theme.colors.confirmed, 0.15) }]}>
                <ThemedText variant="caption" tone="confirmed">Default UPI</ThemedText>
              </View>
            </View>
          </View>
        </View>
      </DataSurface>

      {avatarError ? (
        <View style={styles.retryBlock}>
          <InlineNotice title="Avatar upload failed" body={avatarError} tone="owe" />
          <Button label="Retry upload" variant="secondary" onPress={() => setAvatarSheetVisible(true)} />
        </View>
      ) : null}

      {isEditing ? (
        <DataSurface>
          <View style={styles.formBlock}>
            <InputField
              label="Display name"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="How you appear in groups"
            />
            <InputField
              label="Phone number"
              value={phoneE164}
              onChangeText={setPhoneE164}
              placeholder="+9198XXXXXXXX"
              keyboardType="phone-pad"
              autoCapitalize="none"
            />
            <ThemedText variant="bodySm" tone="muted">
              Used so friends can find you and add you to groups. Include +91 for Indian numbers.
            </ThemedText>
            <InputField
              label="Default receive UPI ID"
              value={upiVpa}
              onChangeText={setUpiVpa}
              placeholder="name@okaxis"
              autoCapitalize="none"
            />
            <ThemedText variant="bodySm" tone="muted">
              Friends paying you can use this automatically — they won&apos;t need to ask for your UPI ID.
            </ThemedText>
            <ThemedText variant="bodySm" tone="muted">
              Default currency: {profile?.defaultCurrencyCode ?? "INR"}
            </ThemedText>
            <Button
              label="Save profile"
              onPress={() => saveProfile.mutate()}
              loading={saveProfile.isPending}
              disabled={!displayName.trim() || !hasChanges}
            />
            {saveProfile.error ? <InlineNotice title="Save failed" body={saveProfile.error.message} tone="owe" /> : null}
          </View>
        </DataSurface>
      ) : (
        <View>
          <DataSurface>
            <View style={styles.contactCard}>
              <View style={styles.contactItemRow}>
                <View style={[styles.contactIcon, { backgroundColor: colorWithAlpha(theme.colors.confirmed, 0.15) }]}>
                  <Phone size={18} color={theme.colors.confirmed} weight="fill" />
                </View>
                <View style={styles.contactText}>
                  <ThemedText variant="caption" tone="muted">Phone number</ThemedText>
                  <ThemedText variant="bodySm">{savedPhoneE164 || profile?.phoneMasked || "Not set"}</ThemedText>
                </View>
              </View>
              <View style={[styles.contactDividerHorizontal, { backgroundColor: theme.colors.hairline }]} />
              <View style={styles.contactItemRow}>
                <View style={[styles.contactIcon, { backgroundColor: colorWithAlpha(theme.colors.info, 0.15) }]}>
                  <CurrencyInr size={18} color={theme.colors.info} weight="bold" />
                </View>
                <View style={styles.contactText}>
                  <ThemedText variant="caption" tone="muted">Default receive UPI ID</ThemedText>
                  <ThemedText variant="bodySm">{savedUpiVpa || "Not set"}</ThemedText>
                </View>
                <Pressable
                  style={[styles.changeButton, { borderColor: theme.colors.hairline }]}
                  onPress={() => setIsEditing(true)}
                >
                  <ThemedText variant="bodySm" tone="confirmed">Change</ThemedText>
                </Pressable>
              </View>
            </View>
          </DataSurface>
          <ThemedText variant="bodySm" tone="muted" style={styles.contactFooterText}>
            Used automatically when someone pays you on Settle.
          </ThemedText>
        </View>
      )}

      <View style={styles.section}>
        <SectionHeader title="Preferences" />
        <DataSurface>
          <View style={styles.menuBlock}>
            <SettingsLinkRow 
              label="Notifications" 
              subtitle="Manage your alerts and updates"
              icon={<Bell size={20} color={theme.colors.confirmed} weight="fill" />} 
              iconTone="confirmed" 
              onPress={() => navigation.go("notificationSettings")} 
            />
            <SettingsLinkRow 
              label="Security" 
              subtitle="Password, biometrics and privacy"
              icon={<ShieldCheck size={20} color={theme.colors.info} weight="fill" />} 
              iconTone="info" 
              onPress={() => navigation.go("securitySettings")} 
            />
            <SettingsLinkRow 
              label="Appearance" 
              subtitle="Theme, language and display"
              icon={<Palette size={20} color={theme.colors.info} weight="fill" />} 
              iconTone="info" 
              onPress={() => navigation.go("appearanceSettings")} 
            />
          </View>
        </DataSurface>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Support" />
        <DataSurface>
          <View style={styles.menuBlock}>
            <SettingsLinkRow
              label="Rate SplitSaathi"
              subtitle="Share your experience with us"
              icon={<Star size={20} color={theme.colors.pending} weight="fill" />}
              iconTone="pending"
              onPress={() =>
                Linking.openURL("market://details?id=in.splitsaathi.mobile").catch(() =>
                  Linking.openURL("https://play.google.com/store/apps/details?id=in.splitsaathi.mobile")
                )
              }
            />
            <SettingsLinkRow
              label="Contact support"
              subtitle="Get help from our team"
              icon={<Headset size={20} color={theme.colors.confirmed} weight="fill" />}
              iconTone="confirmed"
              onPress={() => Linking.openURL("mailto:support@splitsaathi.com?subject=SplitSaathi+support")}
            />
          </View>
        </DataSurface>
      </View>

      <Button label="Log out" variant="destructive" onPress={() => navigation.signOut()} />

      <View style={styles.brandFooter}>
        <View style={styles.brandMarkClip}>
          <BrandLogo variant="mark" size={28} />
        </View>
        <View style={styles.brandWordmarkChip}>
          <BrandLogo variant="wordmark" size={16} />
        </View>
        <ThemedText variant="caption" tone="muted">Version 1.0.0</ThemedText>
      </View>

      <Button label="Back to home" variant="ghost" onPress={() => navigation.go("home")} />

      <ActionSheet
        visible={avatarSheetVisible}
        title="Profile picture"
        message="Update how you appear across groups."
        onClose={() => setAvatarSheetVisible(false)}
        actions={[
          {
            key: "gallery",
            label: "Choose from gallery",
            subtitle: "Pick an existing photo",
            icon: <ImageSquare size={20} color={theme.colors.confirmed} weight="duotone" />,
            tone: "confirmed",
            onPress: () => void pickAndUploadAvatar()
          },
          ...(hasAvatar
            ? [
                {
                  key: "remove",
                  label: "Remove photo",
                  subtitle: "Use your initials instead",
                  icon: <Trash size={20} color={theme.colors.owe} weight="duotone" />,
                  tone: "destructive" as const,
                  onPress: () => removeAvatar.mutate()
                }
              ]
            : [])
        ]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  titleBlock: {
    flex: 1,
    gap: 0
  },
  profileBlock: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    padding: 16
  },
  identity: {
    flex: 1,
    gap: 8,
    marginTop: 2
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  nameWrapper: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 6
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    flexShrink: 0
  },
  activeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flexShrink: 0
  },
  formBlock: {
    gap: 12,
    padding: 14
  },
  contactCard: {
    flexDirection: "column",
    padding: 12,
    gap: 12
  },
  contactItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  contactIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  contactText: {
    flex: 1,
    gap: 2
  },
  contactDividerHorizontal: {
    height: 1,
    width: "100%"
  },
  changeButton: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8
  },
  contactFooterText: {
    marginTop: 8,
    paddingHorizontal: 4
  },
  section: {
    gap: 10,
    marginTop: 16
  },
  menuBlock: {
    gap: 2,
    padding: 6
  },
  retryBlock: {
    gap: 10
  },
  brandFooter: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 16
  },
  brandMarkClip: {
    borderRadius: 8,
    overflow: "hidden"
  },
  brandWordmarkChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4
  }
});
