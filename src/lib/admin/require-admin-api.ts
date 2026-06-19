import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { AUTH_SESSION_COOKIE } from "@/lib/admin/config";
import { isIpAllowed } from "@/lib/admin/ip";
import { verifyAdminSessionToken } from "@/lib/admin/session";

export function adminApiNotFound(): NextResponse {
  return new NextResponse("Not Found", { status: 404, statusText: "Not Found" });
}

export function requireAdminApi(request: NextRequest): NextResponse | null {
  if (!isIpAllowed(request)) {
    return adminApiNotFound();
  }

  const session = verifyAdminSessionToken(request.cookies.get(AUTH_SESSION_COOKIE)?.value);
  if (!session) {
    return adminApiNotFound();
  }

  return null;
}
