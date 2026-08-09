import React from "react";
import {
  Linking,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowsClockwise,
  CaretRight,
  ChartPie,
  EnvelopeSimple,
  FileText,
  LockKey,
  ShieldCheck,
  UsersThree
} from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { GoogleSignInButton } from "../auth/GoogleSignInButton";
import { useTheme } from "../theme";
import { BrandLogo } from "./BrandLogo";
import { InlineNotice } from "./InlineNotice";

const TERMS_URL = "https://thesplitsaathi.com/terms";
const PRIVACY_URL = "https://thesplitsaathi.com/privacy";

// Phone security illustration on the right side of the banner
function PhoneSecurityIllustration() {
  return (
    <View style={styles.phoneIllustrationWrap}>
      <Svg width={44} height={44} viewBox="0 0 44 44" fill="none">
        {/* Top-right sparkle */}
        <Path d="M38 10 L39 12 L41 13 L39 14 L38 16 L37 14 L35 13 L37 12 Z" fill="#34D399" />
        {/* Bottom-left sparkle */}
        <Path d="M6 32 L7 33.5 L8.5 34 L7 34.5 L6 36 L5.5 34.5 L4 34 L5.5 33.5 Z" fill="#34D399" />

        {/* Smartphone outline */}
        <Rect x="12" y="6" width="20" height="32" rx="5" fill="#D1FAE5" stroke="#10B981" strokeWidth="1.5" />
        {/* Screen */}
        <Rect x="14" y="9" width="16" height="26" rx="3" fill="#FFFFFF" />
        {/* User avatar head */}
        <Circle cx="22" cy="17" r="3.5" fill="#10B981" />
        {/* User avatar body */}
        <Path d="M17 26 C17 22.5 19 21.5 22 21.5 C25 21.5 27 22.5 27 26 Z" fill="#10B981" />
      </Svg>

      {/* Purple Lock Badge */}
      <View style={styles.lockBadge}>
        <LockKey size={10} color="#FFFFFF" weight="bold" />
      </View>
    </View>
  );
}

// Background Dot Grid Pattern
function DotGridPattern({ style }: { style: any }) {
  return (
    <Svg width={72} height={72} viewBox="0 0 72 72" style={style}>
      {[0, 16, 32, 48, 64].map((x) =>
        [0, 16, 32, 48, 64].map((y) => (
          <Circle key={`${x}-${y}`} cx={x + 4} cy={y + 4} r={1.5} fill="rgba(255,255,255,0.18)" />
        ))
      )}
    </Svg>
  );
}

type Props = {
  returningUser: boolean;
  googleConfigured: boolean;
  onGoogleIdToken: (idToken: string) => void;
  googlePending: boolean;
  googleError?: string;
  onJoinInvite: () => void;
};

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

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* Top Header Section with Gradient & Orbit Graphic */}
      <View style={[styles.headerSection, { paddingTop: Math.max(insets.top, 16) + 12 }]}>
        <LinearGradient
          colors={["#581C87", "#0D9488"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Decorative Dot Grids */}
        <DotGridPattern style={styles.dotGridLeft} />
        <DotGridPattern style={styles.dotGridRight} />

        {/* Hero Orbit Stage */}
        <View style={styles.orbitContainer}>
          {/* Orbital Translucent Dotted Ring */}
          <Svg width={240} height={240} viewBox="0 0 240 240" style={styles.orbitRingSvg}>
            <Circle
              cx="120"
              cy="120"
              r="105"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="1.5"
              strokeDasharray="4 8"
              fill="none"
            />
          </Svg>

          {/* Orbit Feature Badge 1: Top-Left (Purple) - Groups */}
          <View style={[styles.orbitBadge, styles.badgeTopLeft, { backgroundColor: "#8B5CF6" }]}>
            <UsersThree size={18} color="#FFFFFF" weight="bold" />
          </View>

          {/* Orbit Feature Badge 2: Top-Right (Gold) - Receipts */}
          <View style={[styles.orbitBadge, styles.badgeTopRight, { backgroundColor: "#F59E0B" }]}>
            <FileText size={18} color="#FFFFFF" weight="bold" />
          </View>

          {/* Orbit Feature Badge 3: Mid-Left (Teal) - Split Pie */}
          <View style={[styles.orbitBadge, styles.badgeMidLeft, { backgroundColor: "#14B8A6" }]}>
            <ChartPie size={18} color="#FFFFFF" weight="bold" />
          </View>

          {/* Orbit Feature Badge 4: Mid-Right (Blue) - Settlements */}
          <View style={[styles.orbitBadge, styles.badgeMidRight, { backgroundColor: "#3B82F6" }]}>
            <ArrowsClockwise size={18} color="#FFFFFF" weight="bold" />
          </View>

          {/* Central Logo Badge */}
          <View style={styles.centralLogoCard}>
            <BrandLogo variant="mark" size={54} />
          </View>
        </View>

        {/* Wordmark Title below Central Logo */}
        <Text style={styles.brandTitle}>
          <Text style={{ color: "#10B981" }}>Split</Text>
          <Text style={{ color: "#8B5CF6" }}>Saathi</Text>
        </Text>
      </View>

      {/* White Sheet / Card Body */}
      <View style={[styles.sheetCard, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
        {/* Top Handle Pill */}
        <View style={styles.handleBar} />

        {/* Subtitle Message */}
        <Text style={styles.subtitleText}>
          {returningUser
            ? "Welcome back! Continue with Google\nto open your groups."
            : "Welcome! Continue with Google\nto open your groups."}
        </Text>

        {/* Primary Google Sign-in Button */}
        {googleConfigured ? (
          <GoogleSignInButton
            variant="button"
            onIdToken={onGoogleIdToken}
            pending={googlePending}
            errorMessage={googleError}
            showChevron={true}
          />
        ) : (
          <InlineNotice
            title="Google sign-in not configured"
            body="Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to enable signup."
            tone="pending"
          />
        )}

        {/* Phone Info Security Banner */}
        <View style={styles.phoneBanner}>
          <View style={styles.phoneBannerShield}>
            <ShieldCheck size={20} color="#FFFFFF" weight="fill" />
          </View>

          <View style={styles.phoneBannerTextWrap}>
            <Text style={styles.phoneBannerTitle}>We&apos;ll ask for your phone number</Text>
            <Text style={styles.phoneBannerSub}>once to help friends find you.</Text>
          </View>

          <PhoneSecurityIllustration />
        </View>

        {/* OR Divider */}
        <View style={styles.orDividerRow}>
          <View style={styles.orLine} />
          <View style={styles.orBadge}>
            <Text style={styles.orText}>OR</Text>
          </View>
          <View style={styles.orLine} />
        </View>

        {/* Join with Invite Button */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Join with invite"
          onPress={onJoinInvite}
          style={({ pressed }) => [
            styles.inviteCard,
            { opacity: pressed ? 0.88 : 1 }
          ]}
        >
          <View style={styles.inviteIconBadge}>
            <EnvelopeSimple size={18} color="#0D9488" weight="duotone" />
          </View>
          <Text style={styles.inviteText}>Join with invite</Text>
          <CaretRight size={18} color="#0D9488" weight="bold" />
        </Pressable>

        {/* Footer Legal Privacy & Terms Notice */}
        <View style={styles.legalFooterRow}>
          <View style={styles.legalShieldBadge}>
            <ShieldCheck size={18} color="#6366F1" weight="duotone" />
          </View>
          <Text style={styles.legalText}>
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
    backgroundColor: "#FFFFFF"
  },
  headerSection: {
    flex: 45,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    paddingBottom: 24
  },
  dotGridLeft: {
    position: "absolute",
    top: 20,
    left: 12,
    opacity: 0.7
  },
  dotGridRight: {
    position: "absolute",
    bottom: 40,
    right: 12,
    opacity: 0.7
  },
  orbitContainer: {
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  orbitRingSvg: {
    position: "absolute"
  },
  orbitBadge: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  badgeTopLeft: {
    top: 14,
    left: 18
  },
  badgeTopRight: {
    top: 24,
    right: 16
  },
  badgeMidLeft: {
    bottom: 38,
    left: 6
  },
  badgeMidRight: {
    bottom: 48,
    right: 6
  },
  centralLogoCard: {
    width: 94,
    height: 94,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8
  },
  brandTitle: {
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 28,
    letterSpacing: -0.5,
    marginTop: 10,
    textAlign: "center"
  },
  sheetCard: {
    flex: 55,
    marginTop: -24,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 22,
    paddingTop: 12,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6
  },
  handleBar: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2DD4BF",
    alignSelf: "center",
    marginBottom: 10
  },
  subtitleText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14.5,
    lineHeight: 21,
    color: "#334155",
    textAlign: "center",
    marginBottom: 4
  },
  phoneBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DCFCE7",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10
  },
  phoneBannerShield: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },
  phoneBannerTextWrap: {
    flex: 1,
    gap: 1
  },
  phoneBannerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13.5,
    color: "#0F172A"
  },
  phoneBannerSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "#64748B"
  },
  phoneIllustrationWrap: {
    width: 44,
    height: 44,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },
  lockBadge: {
    position: "absolute",
    bottom: 1,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF"
  },
  orDividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 2
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E2E8F0"
  },
  orBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 10
  },
  orText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: "#64748B"
  },
  inviteCard: {
    height: 56,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#CCFBF1",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  inviteIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#E6F4F1",
    alignItems: "center",
    justifyContent: "center"
  },
  inviteText: {
    flex: 1,
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#0F172A"
  },
  legalFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 4
  },
  legalShieldBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },
  legalText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
    color: "#64748B"
  },
  legalLink: {
    fontFamily: "Inter_600SemiBold",
    color: "#0D9488",
    textDecorationLine: "underline"
  }
});
