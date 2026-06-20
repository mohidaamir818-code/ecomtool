import { NextRequest, NextResponse } from "next/server";
import {
  decodeEbayOAuthCode,
  exchangeEbayCode,
  parseEbayOAuthState,
} from "@/lib/ebay/oauth-user";
import { serverEnv } from "@/lib/env";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const rawCode = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get("ebay_oauth_state")?.value;
  const cookieUserId = request.cookies.get("ebay_oauth_user_id")?.value;

  const appOrigin = serverEnv.appUrl() || url.origin;
  const redirectUrl = new URL("/dashboard/listings", appOrigin);

  function errorRedirect(message: string) {
    redirectUrl.searchParams.set("error", "connection_failed");
    redirectUrl.searchParams.set("message", message);
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete("ebay_oauth_state");
    response.cookies.delete("ebay_oauth_user_id");
    return response;
  }

  if (!rawCode) {
    return errorRedirect("Missing OAuth code from eBay.");
  }

  if (!state) {
    return errorRedirect("Invalid OAuth state. Please try again.");
  }

  const code = decodeEbayOAuthCode(rawCode);
  const parsedState = parseEbayOAuthState(state);
  const userId = parsedState?.userId ?? cookieUserId ?? null;

  const legacyCookieMatch =
    Boolean(expectedState) && state === expectedState && Boolean(cookieUserId);

  if (!parsedState && !legacyCookieMatch) {
    return errorRedirect("Invalid OAuth state. Please try again.");
  }

  if (!userId) {
    return errorRedirect("Invalid OAuth state. Please try again.");
  }

  try {
    await exchangeEbayCode(userId, code, url.origin);
    redirectUrl.searchParams.set("connected", "true");
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete("ebay_oauth_state");
    response.cookies.delete("ebay_oauth_user_id");
    return response;
  } catch (error) {
    return errorRedirect(error instanceof Error ? error.message : "eBay connection failed.");
  }
}
