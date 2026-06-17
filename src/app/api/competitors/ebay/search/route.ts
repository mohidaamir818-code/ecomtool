import { NextRequest, NextResponse } from "next/server";
import { searchEbayListings } from "@/lib/ebay/browse";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const offset = Number(request.nextUrl.searchParams.get("offset") ?? 0);
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? 50);
    const sortParam = request.nextUrl.searchParams.get("sort");
    const sort = sortParam === "desc" ? "desc" : "asc";

    if (query.length < 2) {
      return NextResponse.json(
        { error: "Search keyword must be at least 2 characters." },
        { status: 400 },
      );
    }

    const result = await searchEbayListings({ query, offset, limit, sort });

    return NextResponse.json({
      success: true,
      query,
      listings: result.listings,
      total: result.total,
      offset: result.offset,
      limit: result.limit,
      sort,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "eBay search failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
