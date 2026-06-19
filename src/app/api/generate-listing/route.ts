import { NextRequest, NextResponse } from "next/server";
import { generateEbayListing } from "@/lib/gemini/generate-listing";
import { fetchListingProductSource } from "@/lib/listings/product-source";
import { logUserApiRequest } from "@/lib/requests/tracker";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";

export async function POST(request: NextRequest) {
  let userId: string | null = null;

  try {
    const body = (await request.json()) as { userId?: string; url?: string };
    userId = body.userId?.trim() ?? null;

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    if (!body.url?.trim()) {
      return NextResponse.json({ error: "AliExpress product URL is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const product = await fetchListingProductSource(body.url.trim());
    const listing = await generateEbayListing(product);

    void logUserApiRequest({
      userId,
      endpoint: "/api/generate-listing",
      method: "POST",
      status: "success",
    });

    return NextResponse.json({ success: true, product, listing });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to generate listing.";
    if (userId) {
      void logUserApiRequest({
        userId,
        endpoint: "/api/generate-listing",
        method: "POST",
        status: "failed",
      });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
