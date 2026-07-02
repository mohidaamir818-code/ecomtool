import { NextRequest, NextResponse } from "next/server";
import { getImportStoreListings } from "@/lib/listings/import-store-service";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";
import type { ListingPlatform } from "@/types/listing-generator";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }
    const platform = (request.nextUrl.searchParams.get("platform")?.trim() || "ebay") as ListingPlatform;
    if (platform !== "ebay" && platform !== "amazef") {
      return NextResponse.json({ error: "platform must be ebay or amazef." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const listings = await getImportStoreListings(userId, platform);
    return NextResponse.json({ success: true, listings });
  } catch (error: unknown) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to import store.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
