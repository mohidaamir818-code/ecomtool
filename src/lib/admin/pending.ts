import { createHash, createHmac, timingSafeEqual } from "crypto";
import { getAdminEmail, getAdminSessionSecret } from "@/lib/admin/config";

const PENDING_TTL_MS = 10 * 60 * 1000;

export interface AdminPendingPayload {
  kind: "admin_pending";
  email: string;
  exp: number;
  otpHash: string;
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function hashAdminOtp(otp: string): string {
  return createHash("sha256").update(otp).digest("hex");
}

export function generateAdminOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function createAdminPendingToken(email: string, otp: string): string {
  const secret = getAdminSessionSecret();
  if (!secret) {
    throw new Error("Admin session secret is not configured.");
  }

  const payload: AdminPendingPayload = {
    kind: "admin_pending",
    email,
    exp: Date.now() + PENDING_TTL_MS,
    otpHash: hashAdminOtp(otp),
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signPayload(encoded, secret)}`;
}

export function verifyAdminPendingToken(token: string | undefined): AdminPendingPayload | null {
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
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as AdminPendingPayload;

    if (
      payload.kind !== "admin_pending" ||
      !payload.email ||
      !payload.otpHash ||
      !payload.exp ||
      payload.exp < Date.now()
    ) {
      return null;
    }

    if (payload.email !== getAdminEmail()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function verifyAdminOtpAgainstPending(otp: string, otpHash: string): boolean {
  const candidate = hashAdminOtp(otp.trim());
  const a = Buffer.from(candidate);
  const b = Buffer.from(otpHash);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const ADMIN_OTP_EXPIRY_MINUTES = 10;
