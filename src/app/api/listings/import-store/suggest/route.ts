import { NextRequest, NextResponse } from "next/server";
import { suggestImportStoreMatches } from "@/lib/listings/import-store-service";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";
import type { ListingPlatform } from "@/types/listing-generator";

export const maxDuration = 120;

const MAX_SUGGEST_BATCH = 5;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      platform?: ListingPlatform;
      listingIds?: string[];
    };

    const userId = body.userId?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }
    const platform = body.platform === "amazef" ? "amazef" : "ebay";

    const listingIds = Array.isArray(body.listingIds)
      ? body.listingIds.map((id) => String(id).trim()).filter(Boolean).slice(0, MAX_SUGGEST_BATCH)
      : [];

    if (listingIds.length === 0) {
      return NextResponse.json({ error: "listingIds is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const suggestions = await suggestImportStoreMatches(userId, platform, listingIds);
    return NextResponse.json({ success: true, suggestions });
  } catch (error: unknown) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to suggest matches.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
