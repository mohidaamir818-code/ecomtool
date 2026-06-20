import { NextRequest, NextResponse } from "next/server";
import { getFeePreferences, saveFeePreferences } from "@/lib/listings/fee-preferences";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";
import type { ListingPricingPreferences } from "@/types/listing-generator";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")?.trim();
    const currency = request.nextUrl.searchParams.get("currency")?.trim() ?? "GBP";

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const preferences = await getFeePreferences(userId, currency);
    return NextResponse.json({ success: true, preferences });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to load fee preferences.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      preferences?: ListingPricingPreferences;
    };

    const userId = body.userId?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    if (!body.preferences) {
      return NextResponse.json({ error: "preferences is required." }, { status: 400 });
    }

    await saveFeePreferences(userId, body.preferences);
    return NextResponse.json({ success: true });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to save fee preferences.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
