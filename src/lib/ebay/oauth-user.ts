import "server-only";

import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import type { EbayConnectionStatus } from "@/types/listing-generator";

const EBAY_AUTH_BASE = "https://auth.ebay.com";
const EBAY_API_BASE = "https://api.ebay.com";
const EBAY_SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
].join(" ");

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  token_type?: string;
}

function basicAuthHeader(): string {
  const appId = serverEnv.ebayAppId();
  const certId = serverEnv.ebayCertId();
  if (!appId || !certId) {
    throw new Error("eBay API credentials are not configured.");
  }
  return Buffer.from(`${appId}:${certId}`).toString("base64");
}

function resolveExpiry(seconds: number | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

async function persistUserTokens(
  userId: string,
  token: TokenResponse,
  raw: unknown,
  ebayUsername: string | null,
): Promise<void> {
  if (!token.access_token || !token.refresh_token) {
    throw new Error("eBay OAuth response missing tokens.");
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("ebay_oauth_tokens").upsert(
    {
      user_id: userId,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      access_token_expires_at: resolveExpiry(token.expires_in),
      refresh_token_expires_at: resolveExpiry(token.refresh_token_expires_in),
      scope: EBAY_SCOPES,
      token_type: token.token_type ?? "Bearer",
      ebay_username: ebayUsername,
      raw_response: raw,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error(`Failed to save eBay OAuth token: ${error.message}`);
  }
}

async function fetchEbayUsername(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch(`${EBAY_API_BASE}/commerce/identity/v1/user/`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { username?: string };
    return data.username ?? null;
  } catch {
    return null;
  }
}

function getEbayOAuthRedirectUri(): string {
  const ruName = serverEnv.ebayRuName();
  if (!ruName) {
    throw new Error("Set EBAY_RUNAME in env (eBay Developer Portal RuName).");
  }
  return ruName;
}

export function buildEbayAuthorizeUrl(_origin: string, state: string): string {
  const redirectUri = getEbayOAuthRedirectUri();
  const baseParams = new URLSearchParams({
    client_id: serverEnv.ebayAppId(),
    response_type: "code",
    redirect_uri: redirectUri,
    state,
  });

  const scopeEncoded = EBAY_SCOPES.split(" ")
    .map((s) => encodeURIComponent(s))
    .join("%20");

  return `${EBAY_AUTH_BASE}/oauth2/authorize?${baseParams.toString()}&scope=${scopeEncoded}`;
}

export async function exchangeEbayCode(userId: string, code: string, _origin: string): Promise<void> {
  const redirectUri = getEbayOAuthRedirectUri();

  const response = await fetch(`${EBAY_API_BASE}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuthHeader()}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });

  const raw = (await response.json()) as TokenResponse & { error_description?: string };

  if (!response.ok || !raw.access_token) {
    throw new Error(raw.error_description ?? "eBay OAuth code exchange failed.");
  }

  const ebayUsername = await fetchEbayUsername(raw.access_token);
  await persistUserTokens(userId, raw, raw, ebayUsername);
}

async function refreshUserToken(userId: string, refreshToken: string): Promise<string> {
  const response = await fetch(`${EBAY_API_BASE}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuthHeader()}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: EBAY_SCOPES,
    }),
    cache: "no-store",
  });

  const raw = (await response.json()) as TokenResponse & { error_description?: string };

  if (!response.ok || !raw.access_token || !raw.refresh_token) {
    throw new Error(raw.error_description ?? "Failed to refresh eBay token.");
  }

  const ebayUsername = await fetchEbayUsername(raw.access_token);
  await persistUserTokens(userId, raw, raw, ebayUsername);
  return raw.access_token;
}

export async function getEbayUserAccessToken(userId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ebay_oauth_tokens")
    .select("access_token, refresh_token, access_token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  const expiresAt = data.access_token_expires_at
    ? new Date(data.access_token_expires_at).getTime()
    : null;

  if (data.access_token && (!expiresAt || expiresAt - Date.now() > 5 * 60 * 1000)) {
    return data.access_token;
  }

  if (!data.refresh_token) return null;

  try {
    return await refreshUserToken(userId, data.refresh_token);
  } catch {
    return null;
  }
}

export async function getEbayConnectionStatus(userId: string): Promise<EbayConnectionStatus> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("ebay_oauth_tokens")
    .select("access_token_expires_at, refresh_token_expires_at, ebay_username")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) {
    return { connected: false, ebayUsername: null, accessTokenExpiresAt: null };
  }

  const refreshExpiresAt = data.refresh_token_expires_at
    ? new Date(data.refresh_token_expires_at).getTime()
    : null;

  if (refreshExpiresAt != null && refreshExpiresAt <= Date.now()) {
    return {
      connected: false,
      ebayUsername: data.ebay_username ?? null,
      accessTokenExpiresAt: data.access_token_expires_at ?? null,
    };
  }

  const accessToken = await getEbayUserAccessToken(userId);

  return {
    connected: Boolean(accessToken),
    ebayUsername: data.ebay_username ?? null,
    accessTokenExpiresAt: data.access_token_expires_at ?? null,
  };
}

export function createEbayOAuthState(): string {
  return crypto.randomUUID();
}

export async function disconnectEbayAccount(userId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("ebay_oauth_tokens").delete().eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to disconnect eBay account: ${error.message}`);
  }
}
