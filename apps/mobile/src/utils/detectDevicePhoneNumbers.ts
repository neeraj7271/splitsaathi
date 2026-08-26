import { Platform } from "react-native";

import { normalizePhoneE164 } from "./phoneHash";
import { validatePhoneNumber } from "./phoneValidation";

const SELF_CONTACT_NAMES = new Set(["me", "my number", "my phone", "self", "myself"]);

function uniqueValidNumbers(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const results: string[] = [];
  for (const value of values) {
    const normalized = value ? normalizePhoneE164(value) : null;
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    const validation = validatePhoneNumber(normalized);
    if (!validation.valid) {
      continue;
    }
    seen.add(normalized);
    results.push(normalized);
  }
  return results;
}

async function readNumbersFromContacts(): Promise<string[]> {
  if (Platform.OS === "web") {
    return [];
  }

  try {
    const Contacts = await import("expo-contacts");
    const permission = await Contacts.getPermissionsAsync();
    if (!permission.granted && permission.status !== "granted") {
      return [];
    }

    const response = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name]
    });

    const candidates: string[] = [];
    for (const contact of response.data) {
      const name = contact.name?.trim().toLowerCase() ?? "";
      const isSelfCard = SELF_CONTACT_NAMES.has(name);
      for (const phone of contact.phoneNumbers ?? []) {
        const normalized = normalizePhoneE164(phone.number ?? "");
        if (!normalized) {
          continue;
        }
        if (isSelfCard || phone.label?.toLowerCase().includes("my")) {
          candidates.push(normalized);
        }
      }
    }

    return uniqueValidNumbers(candidates);
  } catch {
    return [];
  }
}

/**
 * Best-effort phone autofill from the user's own contact card (no permission prompt).
 * Does not read the SIM directly — that requires a separate OS permission flow.
 */
export async function detectDevicePhoneNumbers(): Promise<string[]> {
  return readNumbersFromContacts();
}
