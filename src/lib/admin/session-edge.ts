import type { AdminSession } from "@/lib/admin/session-types";
import { getAdminEmail, getAdminSessionSecret } from "@/lib/admin/config";

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signPayloadEdge(encodedPayload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(encodedPayload));
  return bufferToBase64Url(signature);
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function verifyAdminSessionTokenEdge(
  token: string | undefined,
): Promise<AdminSession | null> {
  if (!token) return null;

  const secret = getAdminSessionSecret();
  if (!secret) return null;

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = await signPayloadEdge(encoded, secret);
  if (!timingSafeEqualString(signature, expected)) {
    return null;
  }

  try {
    const json = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    const session = JSON.parse(json) as AdminSession;

    if (!session.email || !session.exp || session.exp < Date.now()) {
      return null;
    }

    if (session.email !== getAdminEmail()) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}
