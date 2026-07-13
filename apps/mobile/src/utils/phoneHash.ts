import * as Crypto from "expo-crypto";

const DEFAULT_PEPPER = "splitsaathi_local_dev_secret";

export function normalizePhoneE164(raw: string, defaultCountryCode = "91"): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) {
    return null;
  }

  if (digits.length === 10 && defaultCountryCode === "91") {
    return `+91${digits}`;
  }

  if (digits.length >= 11 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null;
}

export async function hashPhoneE164(phoneE164: string, pepper = process.env.EXPO_PUBLIC_PHONE_HASH_PEPPER ?? DEFAULT_PEPPER) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${pepper}:${phoneE164}`);
}
