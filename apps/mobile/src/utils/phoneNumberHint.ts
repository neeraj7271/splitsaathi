import { Platform } from "react-native";

import { normalizePhoneE164 } from "./phoneHash";
import { validatePhoneNumber } from "./phoneValidation";

export async function isPhoneNumberHintAvailable(): Promise<boolean> {
  if (Platform.OS !== "android") {
    return false;
  }

  try {
    const { isAvailableAsync } = await import("expo-phone-number-hint");
    return await isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Shows Google's SIM phone-number picker. User must tap to consent.
 * Returns a normalized E.164 number, or null if cancelled/unavailable.
 */
export async function requestPhoneNumberHint(): Promise<string | null> {
  if (Platform.OS !== "android") {
    return null;
  }

  try {
    const { formatToE164, showPhoneNumberHintAsync } = await import("expo-phone-number-hint");
    const result = await showPhoneNumberHintAsync();
    if (result.canceled || !result.hint) {
      return null;
    }

    const formatted =
      result.hint.e164 ??
      formatToE164(result.hint.number, result.hint.regionCode) ??
      normalizePhoneE164(result.hint.number);

    if (!formatted) {
      return null;
    }

    const validation = validatePhoneNumber(formatted);
    return validation.valid ? validation.phoneE164 : formatted;
  } catch {
    return null;
  }
}
