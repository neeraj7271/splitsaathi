import React, { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ImageSquare, Trash } from "phosphor-react-native";

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
import { useTheme } from "../theme";
import { AppNavigation } from "../types/navigation";
import { pickAndCompressAvatar } from "../utils/avatarUpload";
import { clearAuthenticatedImageCache } from "../utils/authenticatedImage";

export function ProfileScreen({ navigation }: { navigation: AppNavigation }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const profileQuery = useQuery({ queryKey: ["me"], queryFn: () => apiClient.getMe() });
  const [displayName, setDisplayName] = useState("");
  const [savedDisplayName, setSavedDisplayName] = useState("");
  const [upiVpa, setUpiVpa] = useState("");
  const [savedUpiVpa, setSavedUpiVpa] = useState("");
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
    }
  }, [profileQuery.data?.displayName, profileQuery.data?.upiVpa]);

  const saveProfile = useMutation({
    mutationFn: () => apiClient.updateMe({ displayName: displayName.trim(), upiVpa: upiVpa.trim() || null }),
    onSuccess: (profile) => {
      queryClient.setQueryData(["me"], profile);
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setDisplayName(profile.displayName);
      setSavedDisplayName(profile.displayName);
      setUpiVpa(profile.upiVpa ?? "");
      setSavedUpiVpa(profile.upiVpa ?? "");
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
  const hasChanges = displayName.trim() !== savedDisplayName || upiVpa.trim() !== savedUpiVpa;
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
        <Pressable onPress={() => navigation.go("home")} style={styles.backButton}>
          <ArrowLeft size={22} color={theme.colors.ink} />
        </Pressable>
        <View style={styles.titleBlock}>
          <ThemedText variant="caption" tone="muted">
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
            size={72}
            editable
            loading={uploadAvatar.isPending || removeAvatar.isPending}
            onPress={() => setAvatarSheetVisible(true)}
          />
          <View style={styles.identity}>
            <ThemedText variant="title">{profile?.displayName ?? "Your profile"}</ThemedText>
            <ThemedText variant="bodySm" tone="muted">
              {profile?.phoneMasked ?? "Phone number unavailable"}
            </ThemedText>
          </View>
          <Pressable onPress={() => setIsEditing((value) => !value)}>
            <ThemedText variant="bodySm" tone="confirmed">
              {isEditing ? "Cancel" : "Edit"}
            </ThemedText>
          </Pressable>
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
            <InputField label="Display name" value={displayName} onChangeText={setDisplayName} placeholder="How you appear in groups" />
            <InputField label="UPI ID" value={upiVpa} onChangeText={setUpiVpa} placeholder="name@bank" autoCapitalize="none" />
            <ThemedText variant="bodySm" tone="muted">
              Default currency: {profile?.defaultCurrencyCode ?? "INR"}
            </ThemedText>
            <Button label="Save profile" onPress={() => saveProfile.mutate()} loading={saveProfile.isPending} disabled={!displayName.trim() || !hasChanges} />
            {saveProfile.error ? <InlineNotice title="Save failed" body={saveProfile.error.message} tone="owe" /> : null}
          </View>
        </DataSurface>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title="Preferences" />
        <DataSurface>
          <View style={styles.menuBlock}>
            <SettingsLinkRow label="Email settings" onPress={() => navigation.go("notificationSettings")} />
            <SettingsLinkRow label="Security" onPress={() => navigation.go("securitySettings")} />
            <SettingsLinkRow label="Appearance" onPress={() => navigation.go("appearanceSettings")} />
          </View>
        </DataSurface>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Support" />
        <DataSurface>
          <View style={styles.menuBlock}>
            <SettingsLinkRow
              label="Rate SplitSaathi"
              onPress={() =>
                Linking.openURL("market://details?id=in.splitsaathi.mobile").catch(() =>
                  Linking.openURL("https://play.google.com/store/apps/details?id=in.splitsaathi.mobile")
                )
              }
            />
            <SettingsLinkRow
              label="Contact support"
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
    gap: 12
  },
  backButton: {
    padding: 4
  },
  titleBlock: {
    flex: 1,
    gap: 4
  },
  profileBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14
  },
  identity: {
    flex: 1,
    gap: 4
  },
  formBlock: {
    gap: 12,
    padding: 14
  },
  section: {
    gap: 10
  },
  menuBlock: {
    gap: 8,
    padding: 8
  },
  retryBlock: {
    gap: 10
  },
  brandFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 8
  },
  brandMarkClip: {
    borderRadius: 8,
    overflow: "hidden"
  },
  brandWordmarkChip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4
  }
});
