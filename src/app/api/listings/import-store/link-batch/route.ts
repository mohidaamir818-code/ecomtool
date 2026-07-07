import { NextRequest, NextResponse } from "next/server";
import { linkImportStoreListingsBatch } from "@/lib/listings/import-store-service";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";
import type { ListingPlatform } from "@/types/listing-generator";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      platform?: ListingPlatform;
      links?: Array<{ listingId?: string; aliexpressUrl?: string; skipMatchValidation?: boolean }>;
    };

    const userId = body.userId?.trim();
    const platform = body.platform === "amazef" ? "amazef" : "ebay";
    const links = Array.isArray(body.links)
      ? body.links
          .map((link) => ({
            listingId: link.listingId?.trim() ?? "",
            aliexpressUrl: link.aliexpressUrl?.trim() ?? "",
            skipMatchValidation: link.skipMatchValidation === true,
          }))
          .filter((link) => link.listingId && link.aliexpressUrl)
      : [];

    if (!userId || links.length === 0) {
      return NextResponse.json(
        { error: "userId and at least one link are required." },
        { status: 400 },
      );
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const result = await linkImportStoreListingsBatch(userId, platform, links);
    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to link listings.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
