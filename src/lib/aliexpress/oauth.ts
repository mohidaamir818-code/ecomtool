import "server-only";

import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";

const AUTH_BASE = "https://api-sg.aliexpress.com";

class AliExpressOAuthError extends Error {
  constructor(
    message: string,
    public readonly details: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.name = "AliExpressOAuthError";
  }
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_valid_time?: number;
  token_type?: string;
  scope?: string;
}

function buildSyncSignPayload(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((key) => key !== "sign")
    .sort((a, b) => a.localeCompare(b))
    .map((key) => `${key}${params[key]}`)
    .join("");
}

function signSha256(params: Record<string, string>, secret: string): {
  stringToSign: string;
  signature: string;
} {
  const stringToSign = buildSyncSignPayload(params);
  const signature = crypto
    .createHmac("sha256", secret)
    .update(stringToSign, "utf8")
    .digest("hex")
    .toUpperCase();

  return { stringToSign, signature };
}

function computeExpiry(seconds?: number): string | null {
  if (!seconds || seconds <= 0) return null;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function extractTokenPayload(payload: unknown): TokenResponse | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;

  if (record.error_response) return null;

  return {
    access_token:
      typeof record.access_token === "string"
        ? record.access_token
        : undefined,
    refresh_token:
      typeof record.refresh_token === "string"
        ? record.refresh_token
        : undefined,
    expires_in:
      typeof record.expires_in === "number"
        ? record.expires_in
        : typeof record.expires_in === "string"
          ? Number(record.expires_in)
          : undefined,
    refresh_token_valid_time:
      typeof record.refresh_token_valid_time === "number"
        ? record.refresh_token_valid_time
        : typeof record.refresh_token_valid_time === "string"
          ? Number(record.refresh_token_valid_time)
          : undefined,
    token_type:
      typeof record.token_type === "string" ? record.token_type : undefined,
    scope: typeof record.scope === "string" ? record.scope : undefined,
  };
}

async function callAuthApi(
  method: "/auth/token/create" | "/auth/token/refresh",
  businessParams: Record<string, string>,
): Promise<{ token: TokenResponse | null; raw: unknown }> {
  const appKey = serverEnv.aliexpressAppKey();
  const appSecret = serverEnv.aliexpressAppSecret();
  if (!appKey || !appSecret) return { token: null, raw: null };

  const params: Record<string, string> = {
    app_key: appKey,
    method,
    sign_method: "sha256",
    timestamp: String(Date.now()),
    v: "2.0",
    format: "json",
    simplify: "true",
    ...businessParams,
  };
  const { stringToSign, signature } = signSha256(params, appSecret);
  params.sign = signature;

  console.log("[AliExpress OAuth /sync] method:", method);
  console.log("[AliExpress OAuth /sync] stringToSign:", stringToSign);
  console.log("[AliExpress OAuth /sync] signature:", signature);

  const response = await fetch(`${AUTH_BASE}/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: new URLSearchParams(params),
    cache: "no-store",
  });

  const raw = (await response.json()) as unknown;
  return { token: extractTokenPayload(raw), raw };
}

async function callAuthApiRest(
  path: "/auth/token/create" | "/auth/token/refresh",
  businessParams: Record<string, string>,
): Promise<{ token: TokenResponse | null; raw: unknown }> {
  const appKey = serverEnv.aliexpressAppKey();
  const appSecret = serverEnv.aliexpressAppSecret();
  if (!appKey || !appSecret) return { token: null, raw: null };

  const response = await fetch(`${AUTH_BASE}/rest${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: new URLSearchParams({
      app_key: appKey,
      app_secret: appSecret,
      ...businessParams,
    }),
    cache: "no-store",
  });

  const raw = (await response.json()) as unknown;
  return { token: extractTokenPayload(raw), raw };
}

function normalizeAliExpressError(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const errorResponse = record.error_response as Record<string, unknown> | undefined;

  if (errorResponse) {
    return {
      code: errorResponse.code ?? null,
      message: errorResponse.msg ?? null,
      request_id: errorResponse.request_id ?? null,
      trace_id: errorResponse._trace_id_ ?? null,
    };
  }

  return null;
}

async function persistAliExpressTokens(token: TokenResponse, raw: unknown): Promise<void> {
  if (!token.access_token || !token.refresh_token) return;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("aliexpress_oauth_tokens").upsert(
    {
      provider: "aliexpress",
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      access_token_expires_at: computeExpiry(token.expires_in),
      refresh_token_expires_at: computeExpiry(token.refresh_token_valid_time),
      scope: token.scope ?? null,
      token_type: token.token_type ?? null,
      raw_response: raw,
    },
    { onConflict: "provider" },
  );

  if (error) {
    throw new Error(`Failed to save AliExpress OAuth token: ${error.message}`);
  }
}

export function buildAliExpressAuthorizeUrl(baseUrl: string, state: string): string {
  const appKey = serverEnv.aliexpressAppKey();
  const callback =
    process.env.ALIEXPRESS_OAUTH_REDIRECT_URL?.trim() ||
    `${baseUrl}/api/aliexpress/callback`;

  const params = new URLSearchParams({
    response_type: "code",
    force_auth: "true",
    client_id: appKey,
    redirect_url: callback,
    state,
  });

  return `${AUTH_BASE}/oauth/authorize?${params.toString()}`;
}

export async function exchangeAliExpressCode(code: string): Promise<void> {
  const redirectUrl = process.env.ALIEXPRESS_OAUTH_REDIRECT_URL?.trim();
  const commonParams: Record<string, string> = {
    code,
    grant_type: "authorization_code",
  };
  if (redirectUrl) {
    commonParams.redirect_uri = redirectUrl;
    commonParams.redirect_url = redirectUrl;
  }

  const attempts: Array<{ source: string; token: TokenResponse | null; raw: unknown }> = [];

  const syncAttempt = await callAuthApi("/auth/token/create", commonParams);
  attempts.push({ source: "/sync", ...syncAttempt });
  if (syncAttempt.token?.access_token && syncAttempt.token.refresh_token) {
    await persistAliExpressTokens(syncAttempt.token, syncAttempt.raw);
    return;
  }

  const restAttempt = await callAuthApiRest("/auth/token/create", commonParams);
  attempts.push({ source: "/rest/auth/token/create", ...restAttempt });
  if (restAttempt.token?.access_token && restAttempt.token.refresh_token) {
    await persistAliExpressTokens(restAttempt.token, restAttempt.raw);
    return;
  }

  throw new AliExpressOAuthError("AliExpress OAuth code exchange failed.", {
    attempts: attempts.map(({ source, raw }) => ({
      source,
      error: normalizeAliExpressError(raw),
      raw,
    })),
  });
}

export async function refreshAliExpressToken(refreshToken: string): Promise<string | null> {
  const syncAttempt = await callAuthApi("/auth/token/refresh", {
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  if (syncAttempt.token?.access_token && syncAttempt.token.refresh_token) {
    await persistAliExpressTokens(syncAttempt.token, syncAttempt.raw);
    return syncAttempt.token.access_token;
  }

  const restAttempt = await callAuthApiRest("/auth/token/refresh", {
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  if (restAttempt.token?.access_token && restAttempt.token.refresh_token) {
    await persistAliExpressTokens(restAttempt.token, restAttempt.raw);
    return restAttempt.token.access_token;
  }

  return null;
}

export async function getAliExpressAccessToken(): Promise<string | null> {
  const envToken = serverEnv.aliexpressAccessToken();
  if (envToken) return envToken;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("aliexpress_oauth_tokens")
    .select(
      "access_token, refresh_token, access_token_expires_at, refresh_token_expires_at",
    )
    .eq("provider", "aliexpress")
    .maybeSingle();

  if (error || !data) return null;

  const expiresAt = data.access_token_expires_at
    ? new Date(data.access_token_expires_at)
    : null;
  const now = Date.now();
  const hasValidAccessToken =
    !expiresAt || expiresAt.getTime() - now > 5 * 60 * 1000;

  if (hasValidAccessToken && data.access_token) {
    return data.access_token;
  }

  if (!data.refresh_token) return null;

  const refreshExpiresAt = data.refresh_token_expires_at
    ? new Date(data.refresh_token_expires_at)
    : null;
  if (refreshExpiresAt && refreshExpiresAt.getTime() <= now) {
    return null;
  }

  return refreshAliExpressToken(data.refresh_token);
}

export async function getAliExpressTokenStatus(): Promise<{
  connected: boolean;
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
}> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("aliexpress_oauth_tokens")
    .select("access_token_expires_at, refresh_token_expires_at")
    .eq("provider", "aliexpress")
    .maybeSingle();

  return {
    connected: Boolean(data),
    accessTokenExpiresAt: data?.access_token_expires_at ?? null,
    refreshTokenExpiresAt: data?.refresh_token_expires_at ?? null,
  };
}

export function formatAliExpressOAuthError(
  error: unknown,
): { message: string; details: Record<string, unknown> | null } {
  if (error instanceof AliExpressOAuthError) {
    return { message: error.message, details: error.details };
  }
  if (error instanceof Error) {
    return { message: error.message, details: null };
  }
  return { message: "AliExpress OAuth failed.", details: null };
}
