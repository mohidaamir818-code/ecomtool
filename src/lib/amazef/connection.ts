import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import type { AmazefConnectionStatus } from "@/types/listing-generator";

const AMAZEF_FETCH_TIMEOUT_MS = 20000;

export class AmazefConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AmazefConnectionError";
  }
}

async function amazefFetch(path: string, init: RequestInit): Promise<Response> {
  const baseUrl = serverEnv.amazefListingUrl();
  if (!baseUrl) {
    throw new AmazefConnectionError(
      "AMAZEF_LISTING_API_URL is not configured. Add it to your environment.",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AMAZEF_FETCH_TIMEOUT_MS);

  try {
    return await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

interface AmazefLoginResponse {
  token?: string;
  user?: {
    id?: string | number;
    email?: string;
  };
  success?: boolean;
  valid?: boolean;
  userId?: string | number;
  email?: string;
  error?: string;
}

export interface AmazefVerifyResult {
  valid: boolean;
  amazefUserId: string | null;
  email: string | null;
}

export async function verifyAmazefCredentials(
  email: string,
  password: string,
): Promise<AmazefVerifyResult> {
  // Amazef store auth is /api/auth/login (email+password). /api/auth/verify is a
  // separate internal endpoint that requires AMAZEF_LISTING_SECRET and returns
  // Unauthorized without it — which previously looked like bad credentials.
  const response = await amazefFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  const text = await response.text().catch(() => "");
  const payload = (() => {
    try {
      return JSON.parse(text) as AmazefLoginResponse;
    } catch {
      return null;
    }
  })();

  if (response.status === 401) {
    return { valid: false, amazefUserId: null, email: null };
  }

  if (!response.ok) {
    const snippet = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
    throw new AmazefConnectionError(
      payload?.error?.trim() ||
        `Amazef login error (${response.status}): ${snippet || response.statusText}`,
    );
  }

  const user = payload?.user;
  const amazefUserId =
    user?.id != null
      ? String(user.id)
      : payload?.userId != null
        ? String(payload.userId)
        : null;
  const resolvedEmail = user?.email
    ? String(user.email)
    : payload?.email
      ? String(payload.email)
      : email;

  const looksValid =
    Boolean(payload?.token) ||
    Boolean(user?.id != null) ||
    payload?.valid === true ||
    payload?.success === true;

  if (!payload || !looksValid) {
    return { valid: false, amazefUserId: null, email: null };
  }

  return {
    valid: true,
    amazefUserId,
    email: resolvedEmail,
  };
}

export async function connectAmazefAccount(
  userId: string,
  email: string,
  password: string,
): Promise<AmazefConnectionStatus> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw new AmazefConnectionError("Email and password are required.");
  }

  const result = await verifyAmazefCredentials(normalizedEmail, password);
  if (!result.valid) {
    return { connected: false, amazefEmail: null };
  }

  const storedEmail = result.email ?? normalizedEmail;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("amazef_connections").upsert(
    {
      user_id: userId,
      amazef_email: storedEmail,
      amazef_user_id: result.amazefUserId,
      connected: true,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new AmazefConnectionError(error.message);
  }

  return { connected: true, amazefEmail: storedEmail };
}

export async function getAmazefConnectionStatus(
  userId: string,
): Promise<AmazefConnectionStatus> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("amazef_connections")
    .select("amazef_email, connected")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data || !data.connected) {
    return { connected: false, amazefEmail: null };
  }

  return {
    connected: true,
    amazefEmail: data.amazef_email ? String(data.amazef_email) : null,
  };
}

export async function getAmazefEmail(userId: string): Promise<string | null> {
  const status = await getAmazefConnectionStatus(userId);
  return status.connected ? status.amazefEmail : null;
}

export async function disconnectAmazefAccount(userId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("amazef_connections").delete().eq("user_id", userId);
  if (error) {
    throw new AmazefConnectionError(error.message);
  }
}
