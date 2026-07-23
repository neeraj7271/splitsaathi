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

function upiQuery(upiUri: string): string {
  const match = upiUri.match(/^upi:\/\/pay\?(.*)$/i);
  return match?.[1] ?? upiUri.replace(/^[^?]+\?/, "");
}

/** Build an app-specific pay URI from the canonical upi://pay?... link. */
export function buildAppPayUri(appId: UpiAppId, upiUri: string): string {
  const query = upiQuery(upiUri);
  switch (appId) {
    case "gpay":
      return `tez://upi/pay?${query}`;
    case "phonepe":
      return `phonepe://pay?${query}`;
    case "paytm":
      return `paytmmp://pay?${query}`;
    case "bhim":
      return `bhim://upi/pay?${query}`;
    case "amazonpay":
      return `amazonpay://upi/pay?${query}`;
    case "whatsapp":
      return upiUri;
    case "other":
    default:
      return upiUri;
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
  const candidates = [buildAppPayUri(appId, upiUri), upiUri].filter(
    (uri, index, list) => list.indexOf(uri) === index
  );

  let lastError: unknown;
  for (const uri of candidates) {
    try {
      const canOpen = await Linking.canOpenURL(uri);
      if (!canOpen && uri !== upiUri) {
        continue;
      }
      await Linking.openURL(uri);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not open a UPI app. Try scanning the QR code instead.");
}
