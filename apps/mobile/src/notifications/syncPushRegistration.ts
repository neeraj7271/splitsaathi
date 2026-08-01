import { QueryClient } from "@tanstack/react-query";

import { apiClient } from "../api/client";
import type { UserPreferences } from "../types/domain";
import { registerPushIfPossible, unregisterPushIfPossible } from "./registerPush";

export async function syncPushRegistration(
  queryClient: QueryClient,
  options?: { forcePrompt?: boolean }
): Promise<void> {
  const cached = queryClient.getQueryData<UserPreferences>(["preferences"]);
  const preferences = cached ?? (await apiClient.getPreferences().catch(() => null));

  if (!preferences?.pushNotificationsEnabled) {
    await unregisterPushIfPossible().catch(() => undefined);
    return;
  }

  await registerPushIfPossible({ forcePrompt: options?.forcePrompt }).catch(() => undefined);
}
