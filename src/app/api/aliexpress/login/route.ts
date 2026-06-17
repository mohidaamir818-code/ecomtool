import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { buildAliExpressAuthorizeUrl } from "@/lib/aliexpress/oauth";

export async function GET(request: NextRequest) {
  const state = crypto.randomUUID();
  const url = buildAliExpressAuthorizeUrl(request.nextUrl.origin, state);

  const response = NextResponse.redirect(url);
  response.cookies.set("aliexpress_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    maxAge: 10 * 60,
    path: "/",
  });

  return response;
}
