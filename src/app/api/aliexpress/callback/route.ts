import { NextRequest, NextResponse } from "next/server";
import {
  exchangeAliExpressCode,
  formatAliExpressOAuthError,
} from "@/lib/aliexpress/oauth";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get("aliexpress_oauth_state")?.value;

  const redirectUrl = new URL("/aliexpress/connect", url.origin);

  if (!code) {
    redirectUrl.searchParams.set("status", "error");
    redirectUrl.searchParams.set("message", "Missing OAuth code from AliExpress.");
    return NextResponse.redirect(redirectUrl);
  }

  if (!state || !expectedState || state !== expectedState) {
    redirectUrl.searchParams.set("status", "error");
    redirectUrl.searchParams.set("message", "Invalid OAuth state. Please try again.");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    await exchangeAliExpressCode(code);
    redirectUrl.searchParams.set("status", "success");
    redirectUrl.searchParams.set("message", "AliExpress connected successfully.");
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete("aliexpress_oauth_state");
    return response;
  } catch (error) {
    const formatted = formatAliExpressOAuthError(error);
    console.error("AliExpress OAuth callback exchange failed", {
      codePresent: Boolean(code),
      statePresent: Boolean(state),
      expectedStatePresent: Boolean(expectedState),
      details: formatted.details,
    });

    redirectUrl.searchParams.set("status", "error");
    const detailsText = formatted.details
      ? ` Details: ${JSON.stringify(formatted.details).slice(0, 400)}`
      : "";
    redirectUrl.searchParams.set("message", `${formatted.message}${detailsText}`);
    return NextResponse.redirect(redirectUrl);
  }
}
