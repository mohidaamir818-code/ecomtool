import { NextRequest, NextResponse } from "next/server";
import { ensureInternalSkus } from "@/lib/listings/internal-sku-service";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      productUrl?: string;
      variants?: Array<{ id?: string; label?: string }>;
    };

    const userId = body.userId?.trim();
    const productUrl = body.productUrl?.trim();

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    if (!productUrl) {
      return NextResponse.json({ error: "productUrl is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const variants = (body.variants ?? [])
      .filter((variant) => variant.id && variant.label != null)
      .map((variant) => ({
        id: String(variant.id),
        label: String(variant.label),
      }));

    if (variants.length === 0) {
      return NextResponse.json({ error: "At least one variant is required." }, { status: 400 });
    }

    const result = await ensureInternalSkus({ userId, productUrl, variants });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to assign internal SKUs.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
