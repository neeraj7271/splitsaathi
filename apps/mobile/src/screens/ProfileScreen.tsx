import React, { useEffect, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "phosphor-react-native";

import { apiClient } from "../api/client";
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

  const profile = profileQuery.data;
  const hasChanges = displayName.trim() !== savedDisplayName || upiVpa.trim() !== savedUpiVpa;

  async function pickAndUploadAvatar() {
    const file = await pickAndCompressAvatar();
    if (!file) {
      return;
    }
    setLocalAvatarUri(file.uri);
    uploadAvatar.mutate(file);
  }

  function promptAvatarSource() {
    Alert.alert("Profile picture", "Choose a photo from your gallery", [
      { text: "Choose photo", onPress: () => void pickAndUploadAvatar() },
      { text: "Cancel", style: "cancel" }
    ]);
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
            loading={uploadAvatar.isPending}
            onPress={promptAvatarSource}
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
          <Button label="Retry upload" variant="secondary" onPress={promptAvatarSource} />
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
              onPress={() => Linking.openURL("market://details?id=com.splitsaathi.app").catch(() => Linking.openURL("https://play.google.com/store/apps/details?id=com.splitsaathi.app"))}
            />
            <SettingsLinkRow
              label="Contact support"
              onPress={() => Linking.openURL("mailto:support@splitsaathi.com?subject=SplitSaathi+support")}
            />
          </View>
        </DataSurface>
      </View>

      <Button label="Log out" variant="destructive" onPress={() => navigation.signOut()} />

      <Button label="Back to home" variant="ghost" onPress={() => navigation.go("home")} />
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
  }
});
