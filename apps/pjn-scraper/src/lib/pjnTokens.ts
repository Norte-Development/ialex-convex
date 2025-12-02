import fetch from "node-fetch";
import { config } from "../config";
import { logger } from "../middleware/logging";

/**
 * Token response from PJN Keycloak SSO
 */
export interface PjnTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
  tokenType: string;
}

/**
 * Refresh PJN tokens using a refresh token
 */
export async function refreshPjnTokens(params: {
  refreshToken: string;
  cookies?: string[];
}): Promise<PjnTokenResponse> {
  const { refreshToken, cookies } = params;
  const tokenUrl = `${config.pjnSsoBaseUrl}/protocol/openid-connect/token`;

  logger.debug("Refreshing PJN tokens");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: "pjn-portal",
  }).toString();

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
    Referer: config.pjnPortalBaseUrl + "/",
  };

  // Include cookies if provided (may help with session validation)
  if (cookies && cookies.length > 0) {
    headers["Cookie"] = cookies.join("; ");
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error("Failed to refresh PJN tokens", {
      status: response.status,
      error: text,
    });
    throw new Error(`Failed to refresh PJN tokens: ${response.status} ${text}`);
  }

  const json = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    refresh_expires_in: number;
    token_type: string;
  };

  logger.info("PJN tokens refreshed successfully", {
    expiresIn: json.expires_in,
    refreshExpiresIn: json.refresh_expires_in,
  });

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in,
    refreshExpiresIn: json.refresh_expires_in,
    tokenType: json.token_type,
  };
}

/**
 * Check if an access token is expired or about to expire
 * @param expiresAt ISO timestamp when the token expires
 * @param bufferSeconds Number of seconds before expiry to consider it expired (default: 60)
 */
export function isTokenExpired(
  expiresAt: string | undefined,
  bufferSeconds: number = 60
): boolean {
  if (!expiresAt) {
    return true;
  }

  const expiryTime = new Date(expiresAt).getTime();
  const now = Date.now();
  const bufferMs = bufferSeconds * 1000;

  return now >= expiryTime - bufferMs;
}

