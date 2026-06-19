import { NextRequest, NextResponse } from "next/server";
import { listDraftOnEbay } from "@/lib/ebay/sell-inventory";
import { logUserApiRequest } from "@/lib/requests/tracker";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";
import type { ListingDraft } from "@/types/listing-generator";

function validateDraft(draft: ListingDraft): string | null {
  if (!draft.listing.seoTitle.trim()) return "Title is required.";
  if (draft.listing.seoTitle.length > 80) return "Title must be 80 characters or less.";
  if (draft.listing.suggestedPrice <= 0) return "Price must be greater than 0.";
  if (draft.listing.brand !== "Unbranded") return "Brand must remain Unbranded.";
  if (!draft.photos.some((photo) => photo.selected)) return "Select at least one photo.";

  for (const variant of draft.variants) {
    if (variant.price <= 0) return "All variant prices must be greater than 0.";
    if (variant.stock < 0) return "Variant stock cannot be negative.";
  }

  return null;
}

export async function POST(request: NextRequest) {
  let userId: string | null = null;

  try {
    const body = (await request.json()) as {
      userId?: string;
      draft?: ListingDraft;
    };

    userId = body.userId?.trim() ?? null;

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    if (!body.draft) {
      return NextResponse.json({ error: "draft is required." }, { status: 400 });
    }

    const validationError = validateDraft(body.draft);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const result = await listDraftOnEbay(userId, body.draft);

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
