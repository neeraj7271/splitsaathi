import { apiClient, ApiError } from "../api/client";
import { clearTokens, getAccessToken, getRefreshToken } from "../auth/tokenStore";

export async function restoreSession(): Promise<boolean> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return false;
  }

  try {
    await apiClient.getMe();
    return true;
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      return true;
    }
  }

  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    await clearTokens();
    return false;
  }

  try {
    await apiClient.refresh();
    await apiClient.getMe();
    return true;
  } catch {
    await clearTokens();
    return false;
  }
}
