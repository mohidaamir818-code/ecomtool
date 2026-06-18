import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import {
  AUTH_SESSION_COOKIE,
  getAdminEmail,
  getAdminSessionSecret,
} from "@/lib/admin/config";
import type { AdminSession } from "@/lib/admin/session-types";

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function createAdminSessionToken(email: string): string {
  const secret = getAdminSessionSecret();
  if (!secret) {
    throw new Error("Admin session secret is not configured.");
  }

  const payload: AdminSession = {
    email,
    exp: Date.now() + SESSION_TTL_MS,
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signPayload(encoded, secret)}`;
}

export function verifyAdminSessionToken(token: string | undefined): AdminSession | null {
  if (!token) return null;

  const secret = getAdminSessionSecret();
  if (!secret) return null;

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = signPayload(encoded, secret);
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const session = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as AdminSession;

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

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  return verifyAdminSessionToken(cookieStore.get(AUTH_SESSION_COOKIE)?.value);
}

export function adminSessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export type { AdminSession };
