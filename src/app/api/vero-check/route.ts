import { NextRequest, NextResponse } from "next/server";
import { checkVeroSafety, checkVeroSafetyForDraft } from "@/lib/gemini/vero-check";
import { fetchListingProductSource } from "@/lib/listings/product-source";
import { logUserApiRequest } from "@/lib/requests/tracker";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";
import type { ListingDraft, ListingProductSource } from "@/types/listing-generator";

export async function POST(request: NextRequest) {
  let userId: string | null = null;

  try {
    const body = (await request.json()) as {
      userId?: string;
      url?: string;
      product?: ListingProductSource;
      title?: string;
      draft?: ListingDraft;
      finalCheck?: boolean;
    };

    userId = body.userId?.trim() ?? null;

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    if (body.finalCheck && body.draft) {
      const vero = await checkVeroSafetyForDraft(body.draft);
      void logUserApiRequest({
        userId,
        endpoint: "/api/vero-check",
        method: "POST",
        status: "success",
      });
      return NextResponse.json({ success: true, vero });
    }

    let product = body.product ?? null;

    if (!product) {
      if (!body.url?.trim()) {
        return NextResponse.json(
          { error: "AliExpress product URL or product data is required." },
          { status: 400 },
        );
      }
      product = await fetchListingProductSource(body.url.trim());
    }

    const vero = await checkVeroSafety(product, body.title);

    void logUserApiRequest({
      userId,
      endpoint: "/api/vero-check",
      method: "POST",
      status: "success",
    });

    return NextResponse.json({ success: true, product, vero });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "VeRO check failed.";
    if (userId) {
      void logUserApiRequest({
        userId,
        endpoint: "/api/vero-check",
        method: "POST",
        status: "failed",
      });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
