import { NextRequest, NextResponse } from "next/server";
import { previewHandlingProduct } from "@/lib/handling/service";
import { consumeQuota } from "@/lib/quota/service";
import { quotaErrorResponse } from "@/lib/quota/api-helpers";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { userId?: string; url?: string };

    if (!body.userId?.trim()) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    if (!body.url?.trim()) {
      return NextResponse.json({ error: "AliExpress product URL is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(body.userId);
    if (accessDenied) return accessDenied;

    await consumeQuota(body.userId, "aliexpress", 1);

    const product = await previewHandlingProduct(body.url.trim());

    return NextResponse.json({ success: true, product });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const quotaResponse = quotaErrorResponse(error);
    if (quotaResponse) return quotaResponse;

    const message = error instanceof Error ? error.message : "Failed to preview product.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
