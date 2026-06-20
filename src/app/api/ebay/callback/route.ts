import { NextRequest, NextResponse } from "next/server";
import { exchangeEbayCode } from "@/lib/ebay/oauth-user";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get("ebay_oauth_state")?.value;
  const userId = request.cookies.get("ebay_oauth_user_id")?.value;

  const redirectUrl = new URL("/dashboard/listings", url.origin);

  function errorRedirect(message: string) {
    redirectUrl.searchParams.set("ebay", "error");
    redirectUrl.searchParams.set("message", message);
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete("ebay_oauth_state");
    response.cookies.delete("ebay_oauth_user_id");
    return response;
  }

  if (!code) {
    return errorRedirect("Missing OAuth code from eBay.");
  }

  if (!state || !expectedState || state !== expectedState || !userId) {
    return errorRedirect("Invalid OAuth state. Please try again.");
  }

  try {
    await exchangeEbayCode(userId, code, url.origin);
    redirectUrl.searchParams.set("connected", "true");
    redirectUrl.searchParams.set("ebay", "connected");
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete("ebay_oauth_state");
    response.cookies.delete("ebay_oauth_user_id");
    return response;
  } catch (error) {
    return errorRedirect(error instanceof Error ? error.message : "eBay connection failed.");
  }
}
