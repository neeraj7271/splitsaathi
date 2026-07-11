export const fontFamily = {
  display: "SpaceGrotesk_600SemiBold",
  displayBold: "SpaceGrotesk_700Bold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemiBold: "Inter_600SemiBold",
  amount: "JetBrainsMono_500Medium",
  amountRegular: "JetBrainsMono_400Regular"
} as const;

export const typography = {
  displayLg: {
    fontFamily: fontFamily.displayBold,
    fontSize: 40,
    lineHeight: 46
  },
  balanceHero: {
    fontFamily: fontFamily.amount,
    fontSize: 34,
    lineHeight: 40
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 22,
    lineHeight: 28
  },
  section: {
    fontFamily: fontFamily.display,
    fontSize: 17,
    lineHeight: 24
  },
  body: {
    fontFamily: fontFamily.body,
    fontSize: 15,
    lineHeight: 22
  },
  bodyMedium: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 15,
    lineHeight: 22
  },
  bodySm: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 18
  },
  amount: {
    fontFamily: fontFamily.amount,
    fontSize: 16,
    lineHeight: 20
  },
  amountSm: {
    fontFamily: fontFamily.amountRegular,
    fontSize: 13,
    lineHeight: 16
  },
  caption: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    lineHeight: 16
  },
  button: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 15,
    lineHeight: 20
  }
} as const;
