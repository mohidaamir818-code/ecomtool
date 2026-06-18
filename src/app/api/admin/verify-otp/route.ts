import { NextRequest, NextResponse } from "next/server";
import { AUTH_SESSION_COOKIE, isAdminConfigured } from "@/lib/admin/config";
import { isIpAllowed } from "@/lib/admin/ip";
import {
  adminSessionCookieOptions,
  createAdminSessionToken,
} from "@/lib/admin/session";
import {
  verifyAdminOtpAgainstPending,
  verifyAdminPendingToken,
} from "@/lib/admin/pending";

function notFoundResponse(): NextResponse {
  return new NextResponse("Not Found", { status: 404, statusText: "Not Found" });
}

export async function POST(request: NextRequest) {
  if (!isIpAllowed(request)) {
    return notFoundResponse();
  }

  if (!isAdminConfigured()) {
    return notFoundResponse();
  }

  try {
    const body = (await request.json()) as { pendingToken?: string; otp?: string };
    const pendingToken = body.pendingToken?.trim() ?? "";
    const otp = body.otp?.trim() ?? "";

    if (!pendingToken || !/^\d{6}$/.test(otp)) {
      return notFoundResponse();
    }

    const pending = verifyAdminPendingToken(pendingToken);
    if (!pending || !verifyAdminOtpAgainstPending(otp, pending.otpHash)) {
      return notFoundResponse();
    }

    const sessionToken = createAdminSessionToken(pending.email);
    const response = NextResponse.json({ success: true });
    response.cookies.set(
      AUTH_SESSION_COOKIE,
      sessionToken,
      adminSessionCookieOptions(8 * 60 * 60),
    );

    return response;
  } catch {
    return notFoundResponse();
  }
}
