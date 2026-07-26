import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from "react-native";
import { Camera } from "phosphor-react-native";

import { resolveAuthenticatedImageUri } from "../utils/authenticatedImage";
import { colorWithAlpha, useTheme } from "../theme";
import { ThemedText } from "./ThemedText";

interface UserAvatarProps {
  displayName: string;
  avatarUrl?: string | null;
  localUri?: string | null;
  size?: number;
  editable?: boolean;
  onPress?: () => void;
  loading?: boolean;
  accentColor?: string;
}

export function UserAvatar({
  displayName,
  avatarUrl,
  localUri,
  size = 56,
  editable = false,
  onPress,
  loading = false,
  accentColor
}: UserAvatarProps) {
  const theme = useTheme();
  const [resolvedUri, setResolvedUri] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const badgeSize = Math.max(22, Math.round(size * 0.36));
  const tint = accentColor ?? theme.colors.confirmed;

  useEffect(() => {
    let active = true;
    setImageFailed(false);

    if (localUri) {
      setResolvedUri(localUri);
      return () => {
        active = false;
      };
    }

    setResolvedUri(null);

    if (!avatarUrl) {
      return () => {
        active = false;
      };
    }

    resolveAuthenticatedImageUri(avatarUrl)
      .then((uri) => {
        if (active) {
          setResolvedUri(uri);
        }
      })
      .catch(() => {
        if (active) {
          setResolvedUri(null);
          setImageFailed(true);
        }
      });

    return () => {
      active = false;
    };
  }, [avatarUrl, localUri]);

  const showInitial = !resolvedUri || imageFailed;
  const showSpinner = loading || (!localUri && Boolean(avatarUrl) && !resolvedUri && !imageFailed);

  return (
    <Pressable
      disabled={!onPress || loading}
      onPress={onPress}
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          opacity: loading ? 0.85 : 1
        }
      ]}
    >
      <View
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: accentColor
              ? colorWithAlpha(tint, theme.mode === "dark" ? 0.22 : 0.14)
              : theme.colors.surfaceRaised
          }
        ]}
      >
        {showSpinner ? <ActivityIndicator size="small" color={tint} /> : null}
        {!showSpinner && !showInitial && resolvedUri ? (
          <Image
            source={{ uri: resolvedUri }}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            onError={() => setImageFailed(true)}
          />
        ) : null}
        {!showSpinner && showInitial ? (
          <ThemedText
            variant="title"
            style={{
              fontSize: Math.max(18, size * 0.36),
              color: accentColor ? tint : theme.colors.ink
            }}
          >
            {displayName.slice(0, 1).toUpperCase() || "?"}
          </ThemedText>
        ) : null}
      </View>
      {editable ? (
        <View
          style={[
            styles.cameraBadge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              backgroundColor: theme.colors.ink,
              borderColor: theme.colors.surface,
              right: -2,
              bottom: -2
            }
          ]}
        >
          <Camera size={Math.max(12, Math.round(badgeSize * 0.55))} color={theme.colors.surface} weight="fill" />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative"
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  cameraBadge: {
    position: "absolute",
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    elevation: 2
  }
});
