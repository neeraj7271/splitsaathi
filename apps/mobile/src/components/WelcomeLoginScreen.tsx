import React, { useMemo } from "react";
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  ChartPie,
  EnvelopeSimple,
  FileText,
  Shield,
  UsersThree,
  Wallet
} from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";

import { GoogleSignInButton } from "../auth/GoogleSignInButton";
import { useTheme } from "../theme";
import { BrandLogo } from "./BrandLogo";
import { InlineNotice } from "./InlineNotice";
import { WELCOME_BRAND } from "./welcomeTokens";

export { WELCOME_BRAND } from "./welcomeTokens";

const TERMS_URL = "https://thesplitsaathi.com/terms";
const PRIVACY_URL = "https://thesplitsaathi.com/privacy";

const C = WELCOME_BRAND;
const BASE_ORBIT_R = 122;

const ORBIT_ICONS: {
  id: string;
  Icon?: typeof Wallet;
  angle: number;
  size: number;
  radius?: number;
  rupee?: boolean;
}[] = [
  { id: "pie", Icon: ChartPie, angle: 162, size: 22, radius: 114 },
  { id: "users", Icon: UsersThree, angle: -158, size: 24, radius: 128 },
  { id: "wallet", Icon: Wallet, angle: -58, size: 24, radius: 122 },
  { id: "inr", angle: -18, size: 28, radius: 126, rupee: true },
  { id: "file", Icon: FileText, angle: 48, size: 24, radius: 112 }
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function useWelcomeLayout() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return useMemo(() => {
    const compact = height < 740;
    const veryCompact = height < 660;
    const widthScale = clamp(width / 390, 0.82, 1.08);
    const heightScale = clamp(height / 844, 0.78, 1.05);
    const scale = Math.min(widthScale, heightScale);

    const heroHeight = clamp(
      height * (veryCompact ? 0.34 : compact ? 0.37 : 0.4),
      veryCompact ? 200 : 230,
      height * 0.44
    );
    const logoMarkSize = Math.round(clamp(width * 0.24, 72, 110) * (veryCompact ? 0.9 : 1));
    const logoWrapSize = Math.round(logoMarkSize * 1.42);
    const logoRadius = Math.round(logoWrapSize * 0.22);
    const orbitRadius = Math.round(clamp(logoWrapSize * 0.78, 84, BASE_ORBIT_R));
    const orbitScale = orbitRadius / BASE_ORBIT_R;
    const heroWidth = width * 1.18;
    const curveRadius = Math.round(clamp(width * 0.18, 48, 72));
    const titleSize = Math.round(clamp(34 * scale, 28, 34));
    const titleLineHeight = Math.round(titleSize * 1.12);
    const titleStraddle = Math.round(Math.max(titleLineHeight * 0.78, 28));
    const buttonHeight = Math.round(clamp(56 * scale, 48, 56));
    const horizontalPadding = Math.round(clamp(width * 0.06, 20, 28));
    const bottomInset = Math.max(insets.bottom, Platform.OS === "android" ? 28 : 16);

    const spacing = {
      xs: Math.round(8 * scale),
      sm: Math.round(12 * scale),
      md: veryCompact ? 12 : Math.round(16 * scale),
      lg: veryCompact ? 18 : Math.round(22 * scale),
      xl: veryCompact ? 20 : Math.round(28 * scale)
    };

    return {
      width,
      height,
      compact,
      veryCompact,
      scale,
      heroHeight,
      logoMarkSize,
      logoWrapSize,
      logoRadius,
      orbitRadius,
      orbitScale,
      heroWidth,
      curveRadius,
      titleSize,
      titleLineHeight,
      titleStraddle,
      titleOverlap: titleStraddle,
      buttonHeight,
      horizontalPadding,
      bottomInset,
      topInset: insets.top,
      spacing
    };
  }, [width, height, insets.bottom, insets.top]);
}

type Props = {
  returningUser: boolean;
  googleConfigured: boolean;
  onGoogleIdToken: (idToken: string) => void;
  googlePending: boolean;
  googleError?: string;
  onJoinInvite: () => void;
};

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r };
}

function OrbitDecorations({ float, radius, scale }: { float: string; radius: number; scale: number }) {
  const cx = radius + 4;
  const cy = radius + 4;
  const start = polar(cx, cy, 114 * scale, 162);
  const mid = polar(cx, cy, 128 * scale, -55);
  const end = polar(cx, cy, 112 * scale, 48);
  const arcPath = `M ${start.x} ${start.y} Q ${mid.x} ${mid.y - 22 * scale} ${end.x} ${end.y}`;

  return (
    <View style={styles.orbitStage} pointerEvents="none">
      <Svg width={radius * 2 + 8} height={radius * 2 + 8} style={styles.orbitRing}>
        <Path
          d={arcPath}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={1}
          strokeDasharray="3,8"
          fill="none"
        />
      </Svg>

      {ORBIT_ICONS.map((item) => {
        const r = (item.radius ?? BASE_ORBIT_R) * scale;
        const rad = (item.angle * Math.PI) / 180;
        const x = Math.cos(rad) * r;
        const y = Math.sin(rad) * r;
        const rupeeBox = 40 * scale;
        const box = item.rupee ? rupeeBox : item.size * scale;
        return (
          <View
            key={item.id}
            style={[
              styles.orbitSlot,
              {
                marginLeft: x - box / 2,
                marginTop: y - box / 2
              }
            ]}
          >
            {item.rupee ? (
              <Svg width={rupeeBox} height={rupeeBox} viewBox="0 0 40 40">
                <Circle cx="20" cy="20" r="18" fill="none" stroke={float} strokeWidth="1.5" />
                <SvgText x="20" y="27" fontSize={16 * scale} fill={float} textAnchor="middle">
                  ₹
                </SvgText>
              </Svg>
            ) : item.Icon ? (
              <item.Icon size={Math.round(item.size * scale)} color={float} weight="regular" />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export function WelcomeLoginScreen({
  returningUser,
  googleConfigured,
  onGoogleIdToken,
  googlePending,
  googleError,
  onJoinInvite
}: Props) {
  const theme = useTheme();
  const layout = useWelcomeLayout();
  const isLight = theme.mode === "light";

  const bg = isLight ? "#F6F7FB" : C.bgDark;
  const secondary = isLight ? "#5B6273" : C.textSecondary;
  const border = isLight ? "#E4E7EF" : C.border;
  const inviteText = isLight ? "#171922" : C.white;
  const float = isLight ? "rgba(255,255,255,0.4)" : C.float;
  const heroColors = (isLight ? ["#6366F1", "#0D9488"] : [C.gradientStart, C.gradientEnd]) as [string, string];
  const logoStageSize = layout.orbitRadius * 2 + Math.round(48 * layout.scale);

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <StatusBar barStyle={isLight ? "dark-content" : "light-content"} />

      <View
        style={[
          styles.heroClip,
          {
            height: layout.heroHeight,
            paddingTop: layout.topInset
          }
        ]}
      >
        <LinearGradient
          colors={heroColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.heroGradient,
            {
              width: layout.heroWidth,
              left: (layout.width - layout.heroWidth) / 2,
              borderBottomLeftRadius: layout.curveRadius,
              borderBottomRightRadius: layout.curveRadius
            }
          ]}
        />
        <View
          style={[
            styles.heroForeground,
            { paddingBottom: layout.veryCompact ? 4 : 8 }
          ]}
          pointerEvents="box-none"
        >
          <View style={{ width: logoStageSize, height: logoStageSize, alignItems: "center", justifyContent: "center" }}>
            <OrbitDecorations float={float} radius={layout.orbitRadius} scale={layout.orbitScale} />
            <View
              style={[
                styles.logoWrap,
                {
                  width: layout.logoWrapSize,
                  height: layout.logoWrapSize,
                  borderRadius: layout.logoRadius
                }
              ]}
            >
              <BrandLogo variant="mark" size={layout.logoMarkSize} />
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.contentShell, { marginTop: -layout.titleStraddle }]}>
        <Text
          style={[
            styles.title,
            {
              fontSize: layout.titleSize,
              lineHeight: layout.titleLineHeight
            }
          ]}
        >
          <Text style={{ color: C.brandGreen }}>Split</Text>
          <Text style={{ color: C.brandPurple }}>Saathi</Text>
        </Text>

        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={[
            styles.contentScrollInner,
            {
              paddingHorizontal: layout.horizontalPadding,
              paddingTop: layout.spacing.sm,
              paddingBottom: layout.spacing.sm
            }
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <Text
            style={[
              styles.subtitle,
              {
                color: secondary,
                marginTop: layout.spacing.md,
                fontSize: layout.veryCompact ? 14 : 15,
                lineHeight: layout.veryCompact ? 20 : 22
              }
            ]}
          >
            {returningUser
              ? "Welcome back. Continue with Google to\nopen your groups."
              : "Welcome. Continue with Google to\nopen your groups."}
          </Text>

          {googleConfigured ? (
            <View style={[styles.googleWrap, { marginTop: layout.spacing.xl }]}>
              <GoogleSignInButton
                variant="button"
                onIdToken={onGoogleIdToken}
                pending={googlePending}
                errorMessage={googleError}
                style={{
                  height: layout.buttonHeight,
                  borderRadius: layout.buttonHeight / 2
                }}
              />
            </View>
          ) : (
            <View style={[styles.googleWrap, { marginTop: layout.spacing.xl }]}>
              <InlineNotice
                title="Google sign-in not configured"
                body="Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to enable signup."
                tone="pending"
              />
            </View>
          )}

          <View style={[styles.noticeRow, { marginTop: layout.spacing.md }]}>
            <Shield size={16} color={C.brandGreen} weight="regular" style={{ marginTop: 2 }} />
            <Text style={[styles.noticeText, { color: secondary, fontSize: layout.veryCompact ? 12 : 13 }]}>
              After Google sign-in we&apos;ll ask for your phone number once to help friends find you.
            </Text>
          </View>

          <View style={[styles.dividerRow, { marginTop: layout.spacing.lg }]}>
            <View style={[styles.dividerLine, { backgroundColor: border }]} />
            <Text style={[styles.dividerText, { color: secondary }]}>OR</Text>
            <View style={[styles.dividerLine, { backgroundColor: border }]} />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Join with invite"
            onPress={onJoinInvite}
            style={({ pressed }) => [
              styles.inviteButton,
              {
                borderColor: border,
                height: layout.buttonHeight,
                borderRadius: layout.buttonHeight / 2,
                marginTop: layout.spacing.lg,
                marginBottom: layout.spacing.xs,
                opacity: pressed ? 0.85 : 1
              }
            ]}
          >
            <EnvelopeSimple size={18} color={C.brandGreen} weight="regular" />
            <Text style={[styles.inviteButtonText, { color: inviteText, fontSize: layout.veryCompact ? 15 : 16 }]}>
              Join with invite
            </Text>
          </Pressable>
        </ScrollView>

        <View
          style={[
            styles.legalFooter,
            {
              paddingHorizontal: layout.horizontalPadding,
              paddingBottom: layout.bottomInset,
              paddingTop: layout.spacing.sm
            }
          ]}
        >
          <Text style={[styles.legalText, { color: secondary }]}>
            By continuing, you agree to our{"\n"}
            <Text style={styles.legalLink} onPress={() => void Linking.openURL(TERMS_URL)}>
              Terms of Service
            </Text>{" "}
            and{" "}
            <Text style={styles.legalLink} onPress={() => void Linking.openURL(PRIVACY_URL)}>
              Privacy Policy
            </Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bgDark
  },
  heroClip: {
    width: "100%",
    overflow: "hidden",
    zIndex: 2
  },
  heroGradient: {
    position: "absolute",
    top: 0,
    bottom: 0
  },
  heroForeground: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "flex-end"
  },
  orbitStage: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center"
  },
  orbitRing: {
    position: "absolute"
  },
  orbitSlot: {
    position: "absolute",
    top: "50%",
    left: "50%"
  },
  logoWrap: {
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
    shadowColor: "#0B1220",
    shadowOpacity: 0.4,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 16
  },
  contentShell: {
    flex: 1,
    zIndex: 3,
    overflow: "visible"
  },
  contentScroll: {
    flex: 1
  },
  contentScrollInner: {
    flexGrow: 1,
    alignItems: "center"
  },
  title: {
    fontFamily: "SpaceGrotesk_700Bold",
    letterSpacing: -0.3,
    zIndex: 10,
    alignSelf: "center",
    textAlign: "center"
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    textAlign: "center"
  },
  googleWrap: {
    width: "100%"
  },
  noticeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 6,
    gap: 8,
    width: "100%"
  },
  noticeText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    lineHeight: 19
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%"
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth
  },
  dividerText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    marginHorizontal: 14,
    letterSpacing: 1
  },
  inviteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    borderWidth: 1,
    gap: 10,
    backgroundColor: "transparent"
  },
  inviteButtonText: {
    fontFamily: "Inter_700Bold"
  },
  legalFooter: {
    width: "100%"
  },
  legalText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18
  },
  legalLink: {
    color: C.link,
    textDecorationLine: "underline",
    fontFamily: "Inter_500Medium"
  }
});
