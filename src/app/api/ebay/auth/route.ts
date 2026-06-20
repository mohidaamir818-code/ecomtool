import { NextRequest, NextResponse } from "next/server";
import {
  buildEbayAuthorizeUrl,
  createEbayOAuthState,
  validateEbayOAuthPreflight,
} from "@/lib/ebay/oauth-user";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId")?.trim();

  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  const preflightError = validateEbayOAuthPreflight();
  if (preflightError) {
    return NextResponse.json({ error: preflightError }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const state = createEbayOAuthState(userId);
  const url = buildEbayAuthorizeUrl(request.nextUrl.origin, state);

  const response = NextResponse.redirect(url);
  response.cookies.set("ebay_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    maxAge: 10 * 60,
    path: "/",
  });
  response.cookies.set("ebay_oauth_user_id", userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    maxAge: 10 * 60,
    path: "/",
  });

  return response;
}
