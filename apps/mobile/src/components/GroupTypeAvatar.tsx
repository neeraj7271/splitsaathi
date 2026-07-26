import React from "react";
import { StyleSheet, View } from "react-native";
import { Briefcase, CalendarBlank, Heart, House, Suitcase, UsersThree } from "phosphor-react-native";

import { GroupType } from "../types/domain";
import { colorWithAlpha, useTheme } from "../theme";
import { UserAvatar } from "./UserAvatar";

const TYPE_META: Record<
  GroupType,
  {
    icon: React.ComponentType<{ size?: number; color?: string; weight?: "duotone" | "bold" | "fill" | "regular" }>;
    tint: string;
  }
> = {
  trip: { icon: Suitcase, tint: "#8B5CF6" },
  couple: { icon: Heart, tint: "#F043A7" },
  home: { icon: House, tint: "#0D9488" },
  event: { icon: CalendarBlank, tint: "#F59E0B" },
  business: { icon: Briefcase, tint: "#6366F1" },
  other: { icon: UsersThree, tint: "#64748B" }
};

export function groupTypeAccent(groupType?: GroupType | null): string {
  return TYPE_META[groupType ?? "other"]?.tint ?? TYPE_META.other.tint;
}

export function groupTypeIcon(groupType?: GroupType | null) {
  return (TYPE_META[groupType ?? "other"] ?? TYPE_META.other).icon;
}

export function GroupTypeAvatar({
  groupType,
  imageUrl,
  size = 44
}: {
  groupType?: GroupType | null;
  imageUrl?: string | null;
  size?: number;
}) {
  const theme = useTheme();
  const meta = TYPE_META[groupType ?? "other"] ?? TYPE_META.other;
  const Icon = meta.icon;

  if (imageUrl) {
    return <UserAvatar displayName="Group" avatarUrl={imageUrl} size={size} />;
  }

  return (
    <View
      style={[
        styles.well,
        {
          width: size,
          height: size,
          borderRadius: size * 0.28,
          backgroundColor: colorWithAlpha(meta.tint, theme.mode === "dark" ? 0.22 : 0.14)
        }
      ]}
    >
      <Icon size={Math.round(size * 0.48)} color={meta.tint} weight="duotone" />
    </View>
  );
}

const styles = StyleSheet.create({
  well: {
    alignItems: "center",
    justifyContent: "center"
  }
});
