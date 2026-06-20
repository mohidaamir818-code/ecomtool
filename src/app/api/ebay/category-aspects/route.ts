import { NextRequest, NextResponse } from "next/server";
import { getSellerMarketplaceId } from "@/lib/ebay/marketplace";
import { getItemAspectsForCategory } from "@/lib/ebay/sell-inventory";
import { getEbayUserAccessToken } from "@/lib/ebay/oauth-user";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")?.trim();
    const categoryId = request.nextUrl.searchParams.get("categoryId")?.trim();

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    if (!categoryId) {
      return NextResponse.json({ error: "categoryId is required." }, { status: 400 });
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

    const marketplaceId = await getSellerMarketplaceId(userId);
    const aspectNames = await getItemAspectsForCategory(token, categoryId, marketplaceId);
    return NextResponse.json({ success: true, aspectNames });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load category aspects.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
