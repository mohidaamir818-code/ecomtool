import { NextRequest, NextResponse } from "next/server";
import { searchEbayListings } from "@/lib/ebay/browse";
import { consumeQuota } from "@/lib/quota/service";
import { quotaErrorResponse } from "@/lib/quota/api-helpers";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const userId = request.nextUrl.searchParams.get("userId")?.trim();
    const offset = Number(request.nextUrl.searchParams.get("offset") ?? 0);
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? 25);
    const sortParam = request.nextUrl.searchParams.get("sort");
    const sort = sortParam === "desc" ? "desc" : "asc";

    if (query.length < 2) {
      return NextResponse.json(
        { error: "Search keyword must be at least 2 characters." },
        { status: 400 },
      );
    }

    if (userId) {
      const supabase = getSupabaseAdmin();
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .single();

      if (profile) {
        await consumeQuota(userId, "ebay", 1);
      }
    }

    const result = await searchEbayListings({ query, offset, limit, sort });

    return NextResponse.json({
      success: true,
      query,
      listings: result.listings,
      total: result.total,
      offerCount: result.offerCount,
      offset: result.offset,
      limit: result.limit,
      sort,
    });
  } catch (error) {
    const quotaResponse = quotaErrorResponse(error);
    if (quotaResponse) return quotaResponse;

    const message = error instanceof Error ? error.message : "eBay search failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
