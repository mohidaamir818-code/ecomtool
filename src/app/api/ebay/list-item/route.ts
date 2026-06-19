import { NextRequest, NextResponse } from "next/server";
import { listProductOnEbay } from "@/lib/ebay/sell-inventory";
import { logUserApiRequest } from "@/lib/requests/tracker";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";
import type { GeneratedListing, ListingProductSource } from "@/types/listing-generator";

export async function POST(request: NextRequest) {
  let userId: string | null = null;

  try {
    const body = (await request.json()) as {
      userId?: string;
      listing?: GeneratedListing;
      product?: ListingProductSource;
      quantity?: number;
    };

    userId = body.userId?.trim() ?? null;

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    if (!body.listing || !body.product) {
      return NextResponse.json({ error: "listing and product are required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const result = await listProductOnEbay(
      userId,
      body.listing,
      body.product,
      body.quantity ?? 1,
    );

    void logUserApiRequest({
      userId,
      endpoint: "/api/ebay/list-item",
      method: "POST",
      status: "success",
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to list item on eBay.";
    if (userId) {
      void logUserApiRequest({
        userId,
        endpoint: "/api/ebay/list-item",
        method: "POST",
        status: "failed",
      });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
