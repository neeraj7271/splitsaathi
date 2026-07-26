import React from "react";
import {
  Dimensions,
  Linking,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  ChartPie,
  CreditCard,
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

const { width: SCREEN_W } = Dimensions.get("window");

const TERMS_URL = "https://thesplitsaathi.com/terms";
const PRIVACY_URL = "https://thesplitsaathi.com/privacy";

const C = WELCOME_BRAND;
const ORBIT_R = 122;
/**
 * Semi-arc around the logo — intentionally uneven spacing (matches mockup,
 * not a perfect mathematical distribution).
 */
const ORBIT_ICONS: {
  id: string;
  Icon?: typeof Wallet;
  angle: number;
  size: number;
  radius?: number;
  rupee?: boolean;
}[] = [
  // Wider gap on the left/top, tighter cluster toward top-right (organic, not even)
  { id: "pie", Icon: ChartPie, angle: 162, size: 22, radius: 114 },
  { id: "users", Icon: UsersThree, angle: -158, size: 24, radius: 128 },
  { id: "wallet", Icon: Wallet, angle: -58, size: 24, radius: 122 },
  { id: "inr", angle: -18, size: 28, radius: 126, rupee: true },
  { id: "file", Icon: FileText, angle: 48, size: 24, radius: 112 }
];

type Props = {
  returningUser: boolean;
  googleConfigured: boolean;
  onGoogleIdToken: (idToken: string) => void;
  googlePending: boolean;
  googleError?: string;
  onJoinInvite: () => void;
};

/** Faint icons on a dashed semi-arc around the top/sides of the logo. */
function OrbitDecorations({ float }: { float: string }) {
  const cx = ORBIT_R + 4;
  const cy = ORBIT_R + 4;
  // Soft arc — slightly irregular endpoints to feel less mechanical
  const start = polar(cx, cy, 114, 162);
  const mid = polar(cx, cy, 128, -55);
  const end = polar(cx, cy, 112, 48);
  const arcPath = `M ${start.x} ${start.y} Q ${mid.x} ${mid.y - 22} ${end.x} ${end.y}`;

  return (
    <View style={styles.orbitStage} pointerEvents="none">
      <Svg width={ORBIT_R * 2 + 8} height={ORBIT_R * 2 + 8} style={styles.orbitRing}>
        <Path
          d={arcPath}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={1}
          strokeDasharray="3,8"
          fill="none"
        />
      </Svg>

      {ORBIT_ICONS.map((item) => {
        const r = item.radius ?? ORBIT_R;
        const rad = (item.angle * Math.PI) / 180;
        const x = Math.cos(rad) * r;
        const y = Math.sin(rad) * r;
        const box = item.rupee ? 40 : item.size;
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
              <Svg width={40} height={40} viewBox="0 0 40 40">
                <Circle cx="20" cy="20" r="18" fill="none" stroke={float} strokeWidth="1.5" />
                <SvgText x="20" y="27" fontSize="16" fill={float} textAnchor="middle">
                  ₹
                </SvgText>
              </Svg>
            ) : item.Icon ? (
              <item.Icon size={item.size} color={float} weight="regular" />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r };
}

/**
 * Login UI from the Calm Precision welcome reference:
 * 47% indigo→teal hero with borderBottomRadius 160 + dark content below.
 */
export function WelcomeLoginScreen({
  returningUser,
  googleConfigured,
  onGoogleIdToken,
  googlePending,
  googleError,
  onJoinInvite
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isLight = theme.mode === "light";

  const bg = isLight ? "#F6F7FB" : C.bgDark;
  const secondary = isLight ? "#5B6273" : C.textSecondary;
  const border = isLight ? "#E4E7EF" : C.border;
  const inviteText = isLight ? "#171922" : C.white;
  const float = isLight ? "rgba(255,255,255,0.4)" : C.float;
  const heroColors = (isLight ? ["#6366F1", "#0D9488"] : [C.gradientStart, C.gradientEnd]) as [
    string,
    string
  ];

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <StatusBar barStyle={isLight ? "dark-content" : "light-content"} />

      {/* Shallow bowl curve — logo stays above the arc; name straddles it */}
      <View style={[styles.heroClip, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={heroColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGradient}
        />
        <View style={styles.heroForeground} pointerEvents="box-none">
          <View style={styles.logoStage}>
            <OrbitDecorations float={float} />
            <View style={styles.logoWrap}>
              <BrandLogo variant="mark" size={110} />
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Text style={styles.title}>
          <Text style={{ color: C.brandGreen }}>Split</Text>
          <Text style={{ color: C.brandPurple }}>Saathi</Text>
        </Text>

        <Text style={[styles.subtitle, { color: secondary }]}>
          {returningUser
            ? "Welcome back. Continue with Google to\nopen your groups."
            : "Welcome. Continue with Google to\nopen your groups."}
        </Text>

        {googleConfigured ? (
          <View style={styles.googleWrap}>
            <GoogleSignInButton
              variant="button"
              onIdToken={onGoogleIdToken}
              pending={googlePending}
              errorMessage={googleError}
            />
          </View>
        ) : (
          <View style={styles.googleWrap}>
            <InlineNotice
              title="Google sign-in not configured"
              body="Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to enable signup."
              tone="pending"
            />
          </View>
        )}

        <View style={styles.noticeRow}>
          <Shield size={16} color={C.brandGreen} weight="regular" style={{ marginTop: 2 }} />
          <Text style={[styles.noticeText, { color: secondary }]}>
            After Google sign-in we&apos;ll ask for your phone number once to help friends find you.
          </Text>
        </View>

        <View style={styles.dividerRow}>
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
            { borderColor: border, opacity: pressed ? 0.85 : 1 }
          ]}
        >
          <EnvelopeSimple size={18} color={C.brandGreen} weight="regular" />
          <Text style={[styles.inviteButtonText, { color: inviteText }]}>Join with invite</Text>
        </Pressable>

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
  );
}

const HERO_W = SCREEN_W * 1.18;
const CURVE_R = 72;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bgDark
  },
  heroClip: {
    height: "47%",
    width: "100%",
    overflow: "hidden",
    zIndex: 2
  },
  heroGradient: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: HERO_W,
    left: (SCREEN_W - HERO_W) / 2,
    borderBottomLeftRadius: CURVE_R,
    borderBottomRightRadius: CURVE_R
  },
  heroForeground: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "flex-end",
    // Keep logo above the curve but closer to the brand name
    paddingBottom: 8
  },
  logoStage: {
    width: ORBIT_R * 2 + 48,
    height: ORBIT_R * 2 + 48,
    alignItems: "center",
    justifyContent: "center"
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
    width: 156,
    height: 156,
    borderRadius: 34,
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    zIndex: 3
  },
  title: {
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 34,
    // Pull name up so it straddles the curve (top on gradient, bottom on dark)
    marginTop: -32,
    letterSpacing: -0.3,
    zIndex: 6
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "center",
    marginTop: 16,
    lineHeight: 22
  },
  googleWrap: {
    width: "100%",
    marginTop: 30
  },
  noticeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 16,
    paddingHorizontal: 6,
    gap: 8
  },
  noticeText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginTop: 26
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
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    marginTop: 26,
    gap: 10,
    backgroundColor: "transparent"
  },
  inviteButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16
  },
  legalText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    textAlign: "center",
    marginTop: 24,
    lineHeight: 18
  },
  legalLink: {
    color: C.link,
    textDecorationLine: "underline",
    fontFamily: "Inter_500Medium"
  }
});
