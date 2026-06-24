import { NextRequest, NextResponse } from "next/server";
import {
  getListedProductDetail,
  updateListedProduct,
} from "@/lib/listings/listed-products-service";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";
import type { ListingDraft } from "@/types/listing-generator";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const userId = request.nextUrl.searchParams.get("userId")?.trim();
    if (!userId || !id) {
      return NextResponse.json({ error: "userId and listed product id are required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const product = await getListedProductDetail(userId, id);
    if (!product) {
      return NextResponse.json({ error: "Listed product not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, product });
  } catch (error: unknown) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to load listed product.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { userId?: string; draft?: ListingDraft };
    const userId = body.userId?.trim();
    const draft = body.draft;

    if (!userId || !id || !draft) {
      return NextResponse.json({ error: "userId, listed product id, and draft are required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const product = await updateListedProduct(userId, id, draft);
    return NextResponse.json({ success: true, product });
  } catch (error: unknown) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to update listed product.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
