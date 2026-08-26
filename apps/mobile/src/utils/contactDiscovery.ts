import { Linking, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

import { apiClient } from "../api/client";
import { hashPhoneE164, normalizePhoneE164 } from "./phoneHash";

type ContactsModule = typeof import("expo-contacts");

type PermissionFailure = {
  granted: false;
  reason: string;
  openSettings?: boolean;
};

const CONTACTS_ASKED_KEY = "splitsaathi.contactsPermissionAsked.v1";

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

async function getFlag(key: string) {
  if (Platform.OS === "web") {
    return typeof window !== "undefined" && window.localStorage.getItem(key) === "1";
  }
  return (await SecureStore.getItemAsync(key)) === "1";
}

async function setFlag(key: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, "1");
    }
    return;
  }
  await SecureStore.setItemAsync(key, "1");
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

function isGranted(permission: { granted?: boolean; status?: string }) {
  return Boolean(permission.granted) || permission.status === "granted";
}

export async function getContactsPermissionStatus() {
  if (Platform.OS === "web") {
    return { granted: false, canAskAgain: false, status: "denied" as const };
  }

  const Contacts = await loadContactsModule();
  return Contacts.getPermissionsAsync();
}

/**
 * Ask for contacts access when the OS still allows a prompt.
 * Only falls back to Settings after the user has permanently blocked access.
 */
export async function requestContactsPermission(options?: { forcePrompt?: boolean }) {
  if (Platform.OS === "web") {
    return { granted: false, reason: "Contacts are not available in the browser preview." } satisfies PermissionFailure;
  }

  const Contacts = await loadContactsModule();
  const current = await Contacts.getPermissionsAsync();
  if (isGranted(current)) {
    return { granted: true as const };
  }

  if (current.canAskAgain === false) {
    return {
      granted: false as const,
      reason: "Contacts access is blocked. Enable Contacts for SplitSaathi in system Settings.",
      openSettings: true
    } satisfies PermissionFailure;
  }

  const previouslyAsked = await getFlag(CONTACTS_ASKED_KEY);
  if (!options?.forcePrompt && previouslyAsked) {
    return {
      granted: false as const,
      reason: "Contacts access was denied."
    } satisfies PermissionFailure;
  }

  const requested = await Contacts.requestPermissionsAsync();
  await setFlag(CONTACTS_ASKED_KEY);
  if (isGranted(requested)) {
    return { granted: true as const };
  }

  if (requested.canAskAgain === false) {
    return {
      granted: false as const,
      reason: "Contacts access was denied. Enable Contacts for SplitSaathi in system Settings.",
      openSettings: true
    } satisfies PermissionFailure;
  }

  return {
    granted: false as const,
    reason: "Contacts access was denied."
  } satisfies PermissionFailure;
}

export async function openSystemSettings() {
  await Linking.openSettings();
}

/** OS permission + in-app contacts consent before reading the address book. */
export async function ensureContactsAccess(options?: { forcePrompt?: boolean }) {
  const permission = await requestContactsPermission(options);
  if (!permission.granted) {
    return {
      ok: false as const,
      reason: permission.reason,
      openSettings: permission.openSettings
    };
  }

  const consented = await hasContactsConsent();
  if (!consented) {
    await apiClient.recordConsent("contacts_discovery", true, "settings");
  }

  return { ok: true as const };
}

export async function readDeviceContacts(): Promise<DeviceContact[]> {
  const access = await ensureContactsAccess();
  if (!access.ok) {
    throw new Error(access.reason);
  }

  return loadDeviceContacts();
}

async function loadDeviceContacts(): Promise<DeviceContact[]> {
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

const CONTACT_IMPORT_BATCH_SIZE = 400;

export async function syncDeviceContacts(options?: { skipPermissionCheck?: boolean }) {
  if (!options?.skipPermissionCheck) {
    const access = await ensureContactsAccess();
    if (!access.ok) {
      throw new Error(access.reason);
    }
  } else {
    const consented = await hasContactsConsent();
    if (!consented) {
      await apiClient.recordConsent("contacts_discovery", true, "settings");
    }
  }

  const deviceContacts = await loadDeviceContacts();
  if (!deviceContacts.length) {
    return { importedCount: 0, matchedOnSplitSaathi: 0, contacts: [] as SyncedContact[] };
  }

  let importedCount = 0;
  let matchedOnSplitSaathi = 0;
  const payload = deviceContacts.map((contact) => ({
    phoneHash: contact.phoneHash,
    displayName: contact.displayName
  }));

  for (let index = 0; index < payload.length; index += CONTACT_IMPORT_BATCH_SIZE) {
    const batch = payload.slice(index, index + CONTACT_IMPORT_BATCH_SIZE);
    const importResult = await apiClient.importContacts(batch);
    importedCount += importResult.importedCount;
    matchedOnSplitSaathi += importResult.matchedOnSplitSaathi;
  }

  const serverContacts = await apiClient.listContacts();
  const contacts = mergeContacts(deviceContacts, serverContacts);
  return { importedCount, matchedOnSplitSaathi, contacts };
}

export function mergeContacts(
  deviceContacts: DeviceContact[],
  serverContacts: Awaited<ReturnType<typeof apiClient.listContacts>>
): SyncedContact[] {
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
