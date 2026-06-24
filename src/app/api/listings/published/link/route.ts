import { NextRequest, NextResponse } from "next/server";
import { linkExistingListing } from "@/lib/listings/link-existing-listing";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";
import type { LinkExistingVariantInput } from "@/types/listed-products";
import type { ListingPlatform } from "@/types/listing-generator";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      aliexpressUrl?: string;
      listingUrl?: string;
      platform?: ListingPlatform;
      variants?: LinkExistingVariantInput[];
    };

    const userId = body.userId?.trim();
    const aliexpressUrl = body.aliexpressUrl?.trim();
    const listingUrl = body.listingUrl?.trim();
    const platform = body.platform;

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }
    if (!aliexpressUrl) {
      return NextResponse.json({ error: "AliExpress product URL is required." }, { status: 400 });
    }
    if (!listingUrl) {
      return NextResponse.json({ error: "Listing URL is required." }, { status: 400 });
    }
    if (platform !== "ebay" && platform !== "amazef") {
      return NextResponse.json({ error: "platform must be ebay or amazef." }, { status: 400 });
    }
    if (!body.variants?.length) {
      return NextResponse.json({ error: "At least one variant is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    await linkExistingListing(userId, platform, aliexpressUrl, listingUrl, body.variants);

    return NextResponse.json({
      success: true,
      message: "Existing listing linked. AliExpress monitoring and auto-sync are active.",
    });
  } catch (error: unknown) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to link existing listing.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
