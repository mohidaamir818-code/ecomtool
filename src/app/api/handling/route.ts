import { NextRequest, NextResponse } from "next/server";
import {
  addHandlingProduct,
  getHandlingProducts,
  processDueHandlingUpdates,
  removeHandlingProduct,
} from "@/lib/handling/service";
import { logUserApiRequest } from "@/lib/requests/tracker";
import type { HandlingAddPayload } from "@/types/handling";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    await processDueHandlingUpdates(userId);
    const products = await getHandlingProducts(userId);

    void logUserApiRequest({
      userId,
      endpoint: "/api/handling",
      method: "GET",
      status: "success",
    });

    return NextResponse.json({ success: true, products });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to load handling products.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as HandlingAddPayload;

    if (!body.userId?.trim()) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    if (!body.product?.productUrl) {
      return NextResponse.json({ error: "Product data is required." }, { status: 400 });
    }

    if (!["auto_24h", "custom", "manual"].includes(body.updateMode)) {
      return NextResponse.json({ error: "Invalid update mode." }, { status: 400 });
    }

    if (body.updateMode === "custom") {
      const hours = Number(body.customHours);
      if (!Number.isFinite(hours) || hours <= 0) {
        return NextResponse.json({ error: "Enter valid custom hours." }, { status: 400 });
      }
    }

    const accessDenied = await requireActiveUser(body.userId);
    if (accessDenied) return accessDenied;

    const product = await addHandlingProduct(body);
    const products = await getHandlingProducts(body.userId);

    void logUserApiRequest({
      userId: body.userId,
      endpoint: "/api/handling",
      method: "POST",
      status: "success",
    });

    return NextResponse.json({ success: true, product, products }, { status: 201 });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to add handling product.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    const productId = request.nextUrl.searchParams.get("productId");

    if (!userId || !productId) {
      return NextResponse.json({ error: "userId and productId are required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    await removeHandlingProduct(userId, productId);
    const products = await getHandlingProducts(userId);

    return NextResponse.json({ success: true, products });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to remove product.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
