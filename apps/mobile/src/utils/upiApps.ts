import { Linking, Platform } from "react-native";

export type UpiAppId = "gpay" | "phonepe" | "paytm" | "bhim" | "amazonpay" | "whatsapp" | "other";

export type UpiAppOption = {
  id: UpiAppId;
  label: string;
  brandColor: string;
  /** Schemes used only for install detection on this device. */
  detectSchemes: string[];
};

/** Known UPI apps we can try to detect and open. */
export const KNOWN_UPI_APPS: UpiAppOption[] = [
  {
    id: "gpay",
    label: "Google Pay",
    brandColor: "#4285F4",
    detectSchemes: ["tez://", "gpay://"]
  },
  {
    id: "phonepe",
    label: "PhonePe",
    brandColor: "#5F259F",
    detectSchemes: ["phonepe://", "ppe://"]
  },
  {
    id: "paytm",
    label: "Paytm",
    brandColor: "#00BAF2",
    detectSchemes: ["paytmmp://"]
  },
  {
    id: "bhim",
    label: "BHIM",
    brandColor: "#0072BC",
    detectSchemes: ["bhim://"]
  },
  {
    id: "amazonpay",
    label: "Amazon Pay",
    brandColor: "#FF9900",
    detectSchemes: ["amazonpay://"]
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    brandColor: "#25D366",
    detectSchemes: ["whatsapp://"]
  }
];

export type DetectedUpiApps = {
  installed: UpiAppOption[];
  notInstalled: UpiAppOption[];
};

/**
 * Normalizes a UPI URI into standard NPCI compliant format:
 * - Decodes VPA (pa) so '@' is literal (e.g. hemant@ybl instead of hemant%40ybl)
 * - Encodes payee name (pn) and note (tn) with %20 for spaces
 * - Ensures currency (cu) is INR
 */
export function normalizeUpiUri(upiUri: string): string {
  if (!upiUri) return "";
  try {
    const rawQuery = upiUri.includes("?") ? upiUri.slice(upiUri.indexOf("?") + 1) : upiUri;
    const params = new URLSearchParams(rawQuery);

    const pa = decodeURIComponent(params.get("pa") || "").trim();
    const pn = decodeURIComponent(params.get("pn") || "").trim();
    const am = params.get("am") || "";
    const cu = params.get("cu") || "INR";
    const tn = decodeURIComponent(params.get("tn") || "").trim();
    const tr = params.get("tr") || "";

    if (!pa) return upiUri;

    const parts: string[] = [`pa=${pa}`];
    if (pn) parts.push(`pn=${encodeURIComponent(pn)}`);
    if (am) parts.push(`am=${encodeURIComponent(am)}`);
    parts.push(`cu=${encodeURIComponent(cu)}`);
    if (tn) parts.push(`tn=${encodeURIComponent(tn)}`);
    if (tr) parts.push(`tr=${encodeURIComponent(tr)}`);

    return `upi://pay?${parts.join("&")}`;
  } catch {
    return upiUri.replace(/\+/g, "%20");
  }
}

function upiQuery(upiUri?: string): string {
  const safeUri = typeof upiUri === "string" ? upiUri : "";
  const match = safeUri.match(/^upi:\/\/pay\?(.*)$/i);
  return match?.[1] ?? safeUri.replace(/^[^?]+\?/, "");
}

const ANDROID_UPI_PACKAGES: Record<UpiAppId, string | undefined> = {
  gpay: "com.google.android.apps.nbu.paisa.user",
  phonepe: "com.phonepe.app",
  paytm: "net.one97.paytm",
  bhim: "in.org.npci.upiapp",
  amazonpay: "in.amazon.mShop.android.shopping",
  whatsapp: "com.whatsapp",
  other: undefined
};

/** Build an Android-specific Intent URI targeting the app package directly with upi:// intent data. */
export function buildAndroidIntentUri(appId: UpiAppId, upiUri: string): string | null {
  const pkg = ANDROID_UPI_PACKAGES[appId];
  if (!pkg) {
    return null;
  }
  const cleanUri = normalizeUpiUri(upiUri);
  const query = upiQuery(cleanUri);
  return `intent://pay?${query}#Intent;scheme=upi;package=${pkg};end`;
}

/** Build an app-specific pay URI from the canonical upi://pay?... link. */
export function buildAppPayUri(appId: UpiAppId, upiUri: string): string {
  const cleanUri = normalizeUpiUri(upiUri);
  const query = upiQuery(cleanUri);
  switch (appId) {
    case "gpay":
      return `tez://upi/pay?${query}`;
    case "phonepe":
      return `phonepe://upi/pay?${query}`;
    case "paytm":
      return `paytmmp://upi/pay?${query}`;
    case "bhim":
      return `bhim://upi/pay?${query}`;
    case "amazonpay":
      return `amazonpay://upi/pay?${query}`;
    case "whatsapp":
    case "other":
    default:
      return cleanUri;
  }
}

async function canOpenAny(schemes: string[]): Promise<boolean> {
  for (const scheme of schemes) {
    try {
      if (await Linking.canOpenURL(scheme)) {
        return true;
      }
    } catch {
      // Ignore scheme probe failures (common on iOS without LSApplicationQueriesSchemes).
    }
  }
  return false;
}

/** Probe which known UPI apps appear installed on this device. */
export async function detectInstalledUpiApps(): Promise<DetectedUpiApps> {
  if (Platform.OS === "web") {
    return { installed: [], notInstalled: [...KNOWN_UPI_APPS] };
  }

  const installed: UpiAppOption[] = [];
  const notInstalled: UpiAppOption[] = [];

  await Promise.all(
    KNOWN_UPI_APPS.map(async (app) => {
      const present = await canOpenAny(app.detectSchemes);
      if (present) {
        installed.push(app);
      } else {
        notInstalled.push(app);
      }
    })
  );

  const order = new Map(KNOWN_UPI_APPS.map((app, index) => [app.id, index]));
  installed.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  notInstalled.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  return { installed, notInstalled };
}

export async function openUpiWithApp(appId: UpiAppId, upiUri: string): Promise<void> {
  const normalized = normalizeUpiUri(upiUri);
  console.log(`[UPI] Opening app '${appId}' with normalized canonical URI: ${normalized}`);

  // Canonical upi://pay URI is the ONLY format that NPCI & UPI apps (PhonePe, GPay, Paytm, BHIM)
  // parse to pre-fill payee VPA, payee name, amount, and transaction note.
  // Custom schemes like phonepe:// open the app home tab without pre-filling details.
  try {
    console.log(`[UPI] Attempting canonical upi://pay launch...`);
    await Linking.openURL(normalized);
    console.log(`[UPI] Successfully launched canonical upi://pay link.`);
    return;
  } catch (error) {
    console.warn(`[UPI] Primary canonical upi://pay launch failed:`, error);
  }

  // Fallback to app-specific scheme if canonical upi:// failed
  const appPayUri = buildAppPayUri(appId, normalized);
  if (appPayUri !== normalized) {
    try {
      console.log(`[UPI] Fallback: Attempting app-specific scheme: ${appPayUri}`);
      const canOpen = await Linking.canOpenURL(appPayUri);
      if (canOpen) {
        await Linking.openURL(appPayUri);
        console.log(`[UPI] Successfully launched app-specific scheme.`);
        return;
      }
    } catch (fallbackError) {
      console.warn(`[UPI] Fallback app-specific scheme failed:`, fallbackError);
    }
  }

  throw new Error("Could not open a UPI app. Try scanning the QR code instead.");
}
