import { apiClient, ApiError } from "../api/client";
import { clearTokens, getAccessToken, getRefreshToken } from "../auth/tokenStore";
import type { UserProfile } from "../types/domain";

export type ResumeSetupState = {
  needsPhoneLink: boolean;
  needsOnboarding: boolean;
  user: UserProfile;
};

export type SessionResolution =
  | { status: "signed_out" }
  | { status: "ready" }
  | { status: "setup_required"; setup: ResumeSetupState };

export async function resolveSessionState(): Promise<SessionResolution> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { status: "signed_out" };
  }

  try {
    let profile: UserProfile;
    try {
      profile = await apiClient.getMe();
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        throw error;
      }

      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        await clearTokens();
        return { status: "signed_out" };
      }

      await apiClient.refresh();
      profile = await apiClient.getMe();
    }

    const consents = await apiClient.listConsents();
    const needsPhoneLink = !profile.phoneE164;
    const needsOnboarding = !consents.some((record) => record.source === "onboarding");

    if (needsPhoneLink || needsOnboarding) {
      return {
        status: "setup_required",
        setup: {
          needsPhoneLink,
          needsOnboarding,
          user: profile
        }
      };
    }

    return { status: "ready" };
  } catch {
    await clearTokens();
    return { status: "signed_out" };
  }
}

/** @deprecated Prefer resolveSessionState for onboarding-aware boot. */
export async function restoreSession(): Promise<boolean> {
  const state = await resolveSessionState();
  return state.status !== "signed_out";
}
