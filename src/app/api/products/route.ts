import { NextRequest, NextResponse } from "next/server";
import { getRecentSnapshots } from "@/lib/services/price-alerts";

export async function GET(request: NextRequest) {
  try {
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : 20;

    if (Number.isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: "limit must be a number between 1 and 100" },
        { status: 400 },
      );
    }

    const products = await getRecentSnapshots(limit);

    return NextResponse.json({ products });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch products";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
