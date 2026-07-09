import { NextRequest, NextResponse } from "next/server";
import { getSellerCalculatorMonth } from "@/lib/seller-calculator/service";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")?.trim();
    const year = Number(request.nextUrl.searchParams.get("year"));
    const month = Number(request.nextUrl.searchParams.get("month"));

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "Valid year and month are required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const result = await getSellerCalculatorMonth(userId, year, month);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to load seller calculator.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
