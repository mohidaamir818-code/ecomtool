import { NextRequest, NextResponse } from "next/server";
import { syncSellerCalculatorMonth } from "@/lib/seller-calculator/service";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { userId?: string; year?: number; month?: number };
    const userId = body.userId?.trim();
    const year = Number(body.year);
    const month = Number(body.month);

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "Valid year and month are required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const result = await syncSellerCalculatorMonth(userId, year, month);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to sync orders.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
