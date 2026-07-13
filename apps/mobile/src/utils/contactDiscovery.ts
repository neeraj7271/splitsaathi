import { Platform } from "react-native";

import { apiClient } from "../api/client";
import { hashPhoneE164, normalizePhoneE164 } from "./phoneHash";

type ContactsModule = typeof import("expo-contacts");

async function loadContactsModule(): Promise<ContactsModule> {
  try {
    return await import("expo-contacts");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("ExpoContacts")) {
      throw new Error("Contacts native module is unavailable. Restart Metro with cache cleared, then reload Expo Go.");
    }
    throw error;
  }
}

export interface DeviceContact {
  displayName: string;
  phoneE164: string;
  phoneHash: string;
}

export interface SyncedContact extends DeviceContact {
  id?: string;
  onSplitSaathi: boolean;
  matchedUserId?: string | null;
  matchedDisplayName?: string | null;
}

export async function requestContactsPermission() {
  if (Platform.OS === "web") {
    return { granted: false, reason: "Contacts are not available in the browser preview." };
  }

  const Contacts = await loadContactsModule();
  const current = await Contacts.getPermissionsAsync();
  if (current.granted) {
    return { granted: true as const };
  }

  const requested = await Contacts.requestPermissionsAsync();
  if (!requested.granted) {
    return { granted: false, reason: "Contacts permission was denied." };
  }

  return { granted: true as const };
}

export async function readDeviceContacts(): Promise<DeviceContact[]> {
  const permission = await requestContactsPermission();
  if (!permission.granted) {
    throw new Error(permission.reason ?? "Contacts permission is required.");
  }

  const Contacts = await loadContactsModule();
  const response = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name]
  });

  const uniqueByHash = new Map<string, DeviceContact>();
  for (const contact of response.data) {
    const displayName = contact.name?.trim() || "Unknown contact";
    for (const phone of contact.phoneNumbers ?? []) {
      const phoneE164 = normalizePhoneE164(phone.number ?? "");
      if (!phoneE164) {
        continue;
      }
      const phoneHash = await hashPhoneE164(phoneE164);
      if (!uniqueByHash.has(phoneHash)) {
        uniqueByHash.set(phoneHash, { displayName, phoneE164, phoneHash });
      }
    }
  }

  return [...uniqueByHash.values()].sort((left, right) => left.displayName.localeCompare(right.displayName));
}

export async function syncDeviceContacts() {
  const deviceContacts = await readDeviceContacts();
  if (!deviceContacts.length) {
    return { importedCount: 0, matchedOnSplitSaathi: 0, contacts: [] as SyncedContact[] };
  }

  const importResult = await apiClient.importContacts(
    deviceContacts.map((contact) => ({
      phoneHash: contact.phoneHash,
      displayName: contact.displayName
    }))
  );

  const serverContacts = await apiClient.listContacts();
  const contacts = mergeContacts(deviceContacts, serverContacts);
  return { ...importResult, contacts };
}

export function mergeContacts(deviceContacts: DeviceContact[], serverContacts: Awaited<ReturnType<typeof apiClient.listContacts>>): SyncedContact[] {
  const serverByHash = new Map(serverContacts.map((contact) => [contact.phoneHash, contact]));
  return deviceContacts.map((contact) => {
    const server = serverByHash.get(contact.phoneHash);
    return {
      ...contact,
      id: server?.id,
      onSplitSaathi: Boolean(server?.onSplitSaathi),
      matchedUserId: server?.matchedUserId,
      matchedDisplayName: server?.matchedDisplayName
    };
  });
}

export async function hasContactsConsent() {
  const consents = await apiClient.listConsents();
  const latest = consents
    .filter((record) => record.purpose === "contacts_discovery")
    .sort((left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime())[0];
  return latest?.status === "granted";
}
