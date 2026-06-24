import { NextRequest, NextResponse } from "next/server";
import {
  getListedProducts,
  removeListedProduct,
} from "@/lib/listings/listed-products-service";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const products = await getListedProducts(userId);
    return NextResponse.json({ success: true, products });
  } catch (error: unknown) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to load listed products.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as { userId?: string; listedProductId?: string };
    const userId = body.userId?.trim();
    const listedProductId = body.listedProductId?.trim();

    if (!userId || !listedProductId) {
      return NextResponse.json({ error: "userId and listedProductId are required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    await removeListedProduct(userId, listedProductId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to remove listed product.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
