import { NextRequest, NextResponse } from "next/server";
import { EbayApiError, listDraftOnEbay, parseEbayErrorDetails } from "@/lib/ebay/sell-inventory";
import { requireConfirmedLocation } from "@/lib/ebay/inventory-location";
import { assertUniqueVariantSkus, resolveVariantSkuForEbay } from "@/lib/listings/internal-sku";
import { logUserApiRequest } from "@/lib/requests/tracker";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";
import type { ListingDraft } from "@/types/listing-generator";

function validateDraft(draft: ListingDraft): string | null {
  if (!draft.listing.seoTitle.trim()) return "Title is required.";
  if (draft.listing.seoTitle.length > 80) return "Title must be 80 characters or less.";
  if (draft.listing.suggestedPrice <= 0) return "Price must be greater than 0.";
  if (draft.listing.brand !== "Unbranded") return "Brand must remain Unbranded.";
  if (!draft.photos.some((photo) => photo.selected)) return "Select at least one photo.";

  if (
    !draft.ebayPolicies?.fulfillmentPolicyId ||
    !draft.ebayPolicies?.paymentPolicyId ||
    !draft.ebayPolicies?.returnPolicyId
  ) {
    return "Shipping, payment, and return policies are required.";
  }

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
  console.log("=== LIST ON EBAY CALLED ===");
  console.log("Starting listing process...");

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

    try {
      await requireConfirmedLocation(userId);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Warehouse address is not set up. Enter your eBay registration address before listing.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const result = await listDraftOnEbay(userId, body.draft);

    void logUserApiRequest({
      userId,
      endpoint: "/api/ebay/list-item",
      method: "POST",
      status: "success",
    });

    return NextResponse.json({ success: true, result });
  } catch (error: unknown) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to list item on eBay.";

    console.error("=== LIST ON EBAY ERROR ===");
    console.error("Error message:", message);
    if (error instanceof Error && error.stack) {
      console.error("Error stack:", error.stack);
    }
    if (error instanceof EbayApiError) {
      console.error("eBay URL:", error.url);
      console.error("eBay status:", error.status);
      console.error("eBay raw body:", error.rawBody);

      const details = parseEbayErrorDetails(error.rawBody, error.message);
      const missingField = error.missingField ?? details.missingField;
      const ebayError = parseJsonSafe(error.rawBody, null);

      if (userId) {
        void logUserApiRequest({
          userId,
          endpoint: "/api/ebay/list-item",
          method: "POST",
          status: "failed",
        });
      }

      const responseStatus =
        error.status >= 400 && error.status < 500 ? error.status : 400;

      return NextResponse.json(
        {
          success: false,
          error: missingField
            ? `Missing required field: ${missingField}`
            : details.message,
          ebayError,
          status: error.status,
        },
        { status: responseStatus },
      );
    }

    if (userId) {
      void logUserApiRequest({
        userId,
        endpoint: "/api/ebay/list-item",
        method: "POST",
        status: "failed",
      });
    }

    const status = 500;
    const details = error instanceof Error ? error.stack : undefined;

    return NextResponse.json(
      {
        success: false,
        error: message,
        details,
        status,
      },
      { status },
    );
  }
}

function parseJsonSafe<T>(bodyText: string, fallback: T): T {
  if (!bodyText.trim()) return fallback;
  try {
    return JSON.parse(bodyText) as T;
  } catch {
    return fallback;
  }
}
