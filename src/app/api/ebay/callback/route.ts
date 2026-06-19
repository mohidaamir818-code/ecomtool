import { NextRequest, NextResponse } from "next/server";
import { exchangeEbayCode } from "@/lib/ebay/oauth-user";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get("ebay_oauth_state")?.value;
  const userId = request.cookies.get("ebay_oauth_user_id")?.value;

  const redirectUrl = new URL("/dashboard/listings", url.origin);

  if (!code) {
    redirectUrl.searchParams.set("ebay", "error");
    redirectUrl.searchParams.set("message", "Missing OAuth code from eBay.");
    return NextResponse.redirect(redirectUrl);
  }

  if (!state || !expectedState || state !== expectedState || !userId) {
    redirectUrl.searchParams.set("ebay", "error");
    redirectUrl.searchParams.set("message", "Invalid OAuth state. Please try again.");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    await exchangeEbayCode(userId, code, url.origin);
    redirectUrl.searchParams.set("ebay", "connected");
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete("ebay_oauth_state");
    response.cookies.delete("ebay_oauth_user_id");
    return response;
  } catch (error) {
    redirectUrl.searchParams.set("ebay", "error");
    redirectUrl.searchParams.set(
      "message",
      error instanceof Error ? error.message : "eBay connection failed.",
    );
    return NextResponse.redirect(redirectUrl);
  }
}
