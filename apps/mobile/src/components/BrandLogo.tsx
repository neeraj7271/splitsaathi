import React from "react";
import { Image, ImageStyle, StyleProp, StyleSheet, View, ViewStyle } from "react-native";

const brandAssets = {
  mark: require("../../assets/brand/logo-mark.png"),
  wordmark: require("../../assets/brand/logo-wordmark.png"),
  lockup: require("../../assets/brand/logo-lockup.png")
} as const;

export type BrandLogoVariant = keyof typeof brandAssets;

type BrandLogoProps = {
  variant?: BrandLogoVariant;
  /** Mark edge length, or wordmark/lockup height. */
  size?: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
};

const ASPECT = {
  mark: 1,
  wordmark: 1697 / 392,
  lockup: 1
} as const;

export function BrandLogo({ variant = "mark", size, style, imageStyle }: BrandLogoProps) {
  const height = size ?? (variant === "mark" ? 40 : variant === "wordmark" ? 28 : 160);
  const width = height * ASPECT[variant];

  return (
    <View style={[styles.wrap, style]} accessibilityRole="image" accessibilityLabel="SplitSaathi">
      <Image source={brandAssets[variant]} style={[{ width, height }, imageStyle]} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center"
  }
});
