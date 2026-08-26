export type DistributionChannel = "play" | "sideload";

/** Set at build time: `play` for Play Store AAB, `sideload` for direct APK. */
export function getDistributionChannel(): DistributionChannel {
  return process.env.EXPO_PUBLIC_DISTRIBUTION_CHANNEL === "play" ? "play" : "sideload";
}

export function isPlayStoreBuild(): boolean {
  return getDistributionChannel() === "play";
}
