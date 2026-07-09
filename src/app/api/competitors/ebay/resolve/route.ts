import { NextRequest, NextResponse } from "next/server";
import { resolveEbayListingForCompetitorWatch } from "@/lib/competitors/service";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";

export async function GET(request: NextRequest) {
  try {
    const listingUrl = request.nextUrl.searchParams.get("url")?.trim() ?? "";
    const userId = request.nextUrl.searchParams.get("userId")?.trim();

    if (!listingUrl) {
      return NextResponse.json({ error: "Listing URL is required." }, { status: 400 });
    }

    if (userId) {
      const accessDenied = await requireActiveUser(userId);
      if (accessDenied) return accessDenied;
    }

    const resolved = await resolveEbayListingForCompetitorWatch(listingUrl);

    return NextResponse.json({
      success: true,
      ...resolved,
    });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message =
      error instanceof Error ? error.message : "Failed to load eBay listing from that URL.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
