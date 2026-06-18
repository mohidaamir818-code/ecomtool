import { NextRequest, NextResponse } from "next/server";
import { AUTH_SESSION_COOKIE } from "@/lib/admin/config";
import { isIpAllowed } from "@/lib/admin/ip";
import { adminSessionCookieOptions, verifyAdminSessionToken } from "@/lib/admin/session";

function notFoundResponse(): NextResponse {
  return new NextResponse("Not Found", { status: 404, statusText: "Not Found" });
}

export async function POST(request: NextRequest) {
  if (!isIpAllowed(request)) {
    return notFoundResponse();
  }

  const session = verifyAdminSessionToken(request.cookies.get(AUTH_SESSION_COOKIE)?.value);
  if (!session) {
    return notFoundResponse();
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(AUTH_SESSION_COOKIE, "", adminSessionCookieOptions(0));
  return response;
}
