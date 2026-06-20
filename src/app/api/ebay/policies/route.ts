import { NextRequest, NextResponse } from "next/server";
import { ensureSellerPolicies } from "@/lib/ebay/business-policies";
import { getEbayUserAccessToken } from "@/lib/ebay/oauth-user";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")?.trim();

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
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

    const token = await getEbayUserAccessToken(userId);
    if (!token) {
      return NextResponse.json({ error: "eBay account is not connected." }, { status: 400 });
    }

    const policies = await ensureSellerPolicies(token);
    return NextResponse.json({ success: true, ...policies });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load eBay policies.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
