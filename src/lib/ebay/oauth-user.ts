import "server-only";

import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import type { EbayConnectionStatus } from "@/types/listing-generator";
import {
  normalizeMarketplaceId,
  persistSellerMarketplaceId,
  type EbayMarketplaceId,
} from "@/lib/ebay/marketplace";

const EBAY_AUTH_BASE = "https://auth.ebay.com";
const EBAY_API_BASE = "https://api.ebay.com";
const EBAY_SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
].join(" ");
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  token_type?: string;
}

export interface EbayOAuthSetupStatus {
  configured: boolean;
  authAcceptedUrl: string | null;
  authDeclinedUrl: string | null;
  ruNameSet: boolean;
  appUrlSet: boolean;
  appIdSet: boolean;
  certIdSet: boolean;
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

function stateSigningSecret(): string {
  const certId = serverEnv.ebayCertId();
  if (!certId) {
    throw new Error("EBAY_CERT_ID is not configured.");
  }
  return certId;
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signStatePayload(payloadB64: string): string {
  return crypto.createHmac("sha256", stateSigningSecret()).update(payloadB64).digest("base64url");
}

async function persistUserTokens(
  userId: string,
  token: TokenResponse,
  raw: unknown,
  ebayUsername: string | null,
  marketplaceId: EbayMarketplaceId | null,
): Promise<void> {
  if (!token.access_token || !token.refresh_token) {
    throw new Error("eBay OAuth response missing tokens.");
  }

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from("ebay_oauth_tokens")
    .select("marketplace_id")
    .eq("user_id", userId)
    .maybeSingle();

  const row: Record<string, unknown> = {
    user_id: userId,
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    access_token_expires_at: resolveExpiry(token.expires_in),
    refresh_token_expires_at: resolveExpiry(token.refresh_token_expires_in),
    scope: EBAY_SCOPES,
    token_type: token.token_type ?? "Bearer",
    ebay_username: ebayUsername,
    raw_response: raw,
  };

  if (marketplaceId && !existing?.marketplace_id) {
    row.marketplace_id = marketplaceId;
  }

  const { error } = await supabase.from("ebay_oauth_tokens").upsert(row, { onConflict: "user_id" });

  if (error) {
    throw new Error(`Failed to save eBay OAuth token: ${error.message}`);
  }
}

interface EbayIdentityProfile {
  username: string | null;
  registrationMarketplaceId: EbayMarketplaceId | null;
}

async function fetchEbayIdentityProfile(accessToken: string): Promise<EbayIdentityProfile> {
  try {
    const response = await fetch(`${EBAY_API_BASE}/commerce/identity/v1/user/`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return { username: null, registrationMarketplaceId: null };
    }

    const data = (await response.json()) as {
      username?: string;
      registrationMarketplaceId?: string;
    };

    const marketplace = data.registrationMarketplaceId
      ? normalizeMarketplaceId(data.registrationMarketplaceId)
      : null;

    return {
      username: data.username ?? null,
      registrationMarketplaceId: marketplace,
    };
  } catch {
    return { username: null, registrationMarketplaceId: null };
  }
}

function getEbayOAuthRedirectUri(): string {
  const ruName = serverEnv.ebayRuName();
  if (!ruName) {
    throw new Error("Set EBAY_RUNAME in env (eBay Developer Portal RuName).");
  }
  return ruName;
}

export function getEbayOAuthSetupStatus(): EbayOAuthSetupStatus {
  const appUrl = serverEnv.appUrl();
  const ruNameSet = Boolean(serverEnv.ebayRuName());
  const appUrlSet = Boolean(appUrl);
  const appIdSet = Boolean(serverEnv.ebayAppId());
  const certIdSet = Boolean(serverEnv.ebayCertId());

  const authAcceptedUrl = appUrlSet ? `${appUrl}/api/ebay/callback` : null;
  const authDeclinedUrl = appUrlSet
    ? `${appUrl}/dashboard/listings?error=connection_failed`
    : null;

  return {
    configured: ruNameSet && appUrlSet && appIdSet && certIdSet,
    authAcceptedUrl,
    authDeclinedUrl,
    ruNameSet,
    appUrlSet,
    appIdSet,
    certIdSet,
  };
}

export function validateEbayOAuthPreflight(): string | null {
  const setup = getEbayOAuthSetupStatus();
  if (!setup.ruNameSet) {
    return "EBAY_RUNAME is not configured. Set your eBay RuName in environment variables.";
  }
  if (!setup.appUrlSet) {
    return "APP_URL is not configured. Set your production domain in environment variables.";
  }
  if (!setup.appIdSet || !setup.certIdSet) {
    return "EBAY_APP_ID and EBAY_CERT_ID must be configured.";
  }
  return null;
}

export function decodeEbayOAuthCode(code: string): string {
  try {
    return decodeURIComponent(code);
  } catch {
    return code;
  }
}

export function createEbayOAuthState(userId: string): string {
  const payload = {
    userId,
    nonce: crypto.randomUUID(),
    exp: Date.now() + OAUTH_STATE_TTL_MS,
  };
  const payloadB64 = toBase64Url(JSON.stringify(payload));
  const signature = signStatePayload(payloadB64);
  return `${payloadB64}.${signature}`;
}

export function parseEbayOAuthState(state: string): { userId: string } | null {
  const dotIndex = state.lastIndexOf(".");
  if (dotIndex <= 0) return null;

  const payloadB64 = state.slice(0, dotIndex);
  const signature = state.slice(dotIndex + 1);
  if (!payloadB64 || !signature) return null;

  const expected = signStatePayload(payloadB64);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(payloadB64)) as {
      userId?: string;
      exp?: number;
    };
    if (!payload.userId || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
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
  const decodedCode = decodeEbayOAuthCode(code);

  const response = await fetch(`${EBAY_API_BASE}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuthHeader()}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: decodedCode,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });

  const raw = (await response.json()) as TokenResponse & { error_description?: string };

  if (!response.ok || !raw.access_token) {
    throw new Error(raw.error_description ?? "eBay OAuth code exchange failed.");
  }

  await persistUserTokens(userId, raw, raw, null, null);

  try {
    const profile = await fetchEbayIdentityProfile(raw.access_token);
    const supabase = getSupabaseAdmin();
    const updates: Record<string, string> = {};
    if (profile.username) updates.ebay_username = profile.username;
    if (Object.keys(updates).length > 0) {
      await supabase.from("ebay_oauth_tokens").update(updates).eq("user_id", userId);
    }
    if (profile.registrationMarketplaceId) {
      await persistSellerMarketplaceId(userId, profile.registrationMarketplaceId);
    }
  } catch {
    // Username and marketplace are optional; OAuth tokens are already saved.
  }
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

  const profile = await fetchEbayIdentityProfile(raw.access_token);
  await persistUserTokens(userId, raw, raw, profile.username, profile.registrationMarketplaceId);
  if (profile.registrationMarketplaceId) {
    await persistSellerMarketplaceId(userId, profile.registrationMarketplaceId);
  }
  return raw.access_token;
}

export async function refreshUserAccessToken(userId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("ebay_oauth_tokens")
    .select("refresh_token")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data?.refresh_token) return null;

  try {
    return await refreshUserToken(userId, data.refresh_token);
  } catch {
    return null;
  }
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

export async function disconnectEbayAccount(userId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("ebay_oauth_tokens").delete().eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to disconnect eBay account: ${error.message}`);
  }
}
