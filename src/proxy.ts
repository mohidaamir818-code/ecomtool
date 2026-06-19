import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ADMIN_AUTH_GATEWAY_PATH,
  AUTH_SESSION_COOKIE,
  getAdminPath,
  INTERNAL_ADMIN_PATH,
} from "@/lib/admin/config";
import { isIpAllowed } from "@/lib/admin/ip";
import { verifyAdminSessionTokenEdge } from "@/lib/admin/session-edge";

function notFoundResponse(): NextResponse {
  return new NextResponse("Not Found", { status: 404, statusText: "Not Found" });
}

function isPublicAdminApi(pathname: string, method: string): boolean {
  return (
    (pathname === "/api/admin/login" && method === "POST") ||
    (pathname === "/api/admin/verify-otp" && method === "POST")
  );
}

export async function proxy(request: NextRequest) {
  const adminPath = getAdminPath();
  const { pathname } = request.nextUrl;

  const isInternalAdmin =
    pathname === INTERNAL_ADMIN_PATH || pathname.startsWith(`${INTERNAL_ADMIN_PATH}/`);
  const isAdminApi = pathname.startsWith("/api/admin/");
  const isAuthGateway = pathname === ADMIN_AUTH_GATEWAY_PATH;
  const isAdminPublicPath =
    Boolean(adminPath) &&
    (pathname === adminPath || pathname.startsWith(`${adminPath}/`));

  if (!isInternalAdmin && !isAdminApi && !isAdminPublicPath && !isAuthGateway) {
    return NextResponse.next();
  }

  if (!isIpAllowed(request)) {
    return notFoundResponse();
  }

  if (isPublicAdminApi(pathname, request.method) || isAuthGateway) {
    return NextResponse.next();
  }

  const session = await verifyAdminSessionTokenEdge(
    request.cookies.get(AUTH_SESSION_COOKIE)?.value,
  );

  if (!session) {
    return notFoundResponse();
  }

  if (isAdminPublicPath && adminPath) {
    const url = request.nextUrl.clone();
    const suffix = pathname.slice(adminPath.length);
    url.pathname = `${INTERNAL_ADMIN_PATH}${suffix || ""}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/internal-admin-dashboard",
    "/internal-admin-dashboard/:path*",
    "/admin-auth-gateway",
    "/api/admin/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
