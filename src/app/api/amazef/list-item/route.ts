import { NextRequest, NextResponse } from "next/server";
import { AmazefListingError, listDraftOnAmazef } from "@/lib/amazef/listing";
import { assertUniqueVariantSkus, resolveVariantSkuForEbay } from "@/lib/listings/internal-sku";
import { logUserApiRequest } from "@/lib/requests/tracker";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";
import type { ListingDraft } from "@/types/listing-generator";

function validateDraft(draft: ListingDraft): string | null {
  if (!draft.listing.seoTitle.trim()) return "Title is required.";
  if (draft.listing.seoTitle.length > 80) return "Title must be 80 characters or less.";
  if (draft.listing.suggestedPrice <= 0) return "Price must be greater than 0.";
  if (!draft.photos.some((photo) => photo.selected)) return "Select at least one photo.";

  if (!draft.product.internalProductSku?.trim()) {
    return "Internal product SKU is missing. Re-open the listing wizard to assign SKUs.";
  }

  for (const variant of draft.variants) {
    if (variant.price <= 0) return "All variant prices must be greater than 0.";
    if (variant.stock < 0) return "Variant stock cannot be negative.";
    try {
      resolveVariantSkuForEbay(variant);
    } catch (error) {
      return error instanceof Error ? error.message : "Variant SKU is invalid.";
    }
  }

  try {
    assertUniqueVariantSkus(draft.variants);
  } catch (error) {
    return error instanceof Error ? error.message : "Variant SKUs must be unique.";
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

    const result = await listDraftOnAmazef(userId, body.draft);

    void logUserApiRequest({
      userId,
      endpoint: "/api/amazef/list-item",
      method: "POST",
      status: "success",
    });

    return NextResponse.json({ success: true, result });
  } catch (error: unknown) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to list item on Amazef.";

    if (userId) {
      void logUserApiRequest({
        userId,
        endpoint: "/api/amazef/list-item",
        method: "POST",
        status: "failed",
      });
    }

    const status = error instanceof AmazefListingError && error.status >= 400 && error.status < 500
      ? error.status
      : 500;

    return NextResponse.json({ success: false, error: message, status }, { status });
  }
}
