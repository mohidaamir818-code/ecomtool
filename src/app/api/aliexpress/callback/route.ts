import { NextRequest, NextResponse } from "next/server";
import { exchangeAliExpressCode } from "@/lib/aliexpress/oauth";

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
    redirectUrl.searchParams.set("status", "error");
    redirectUrl.searchParams.set(
      "message",
      error instanceof Error ? error.message : "AliExpress OAuth failed.",
    );
    return NextResponse.redirect(redirectUrl);
  }
}
