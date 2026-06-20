import { NextRequest, NextResponse } from "next/server";
import {
  getSellerPreferences,
  saveSellerPreferences,
} from "@/lib/listings/seller-preferences";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";
import type { SellerPreferences } from "@/types/listing-generator";
import { defaultSellerPreferences } from "@/types/listing-generator";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")?.trim();
    const currency = request.nextUrl.searchParams.get("currency")?.trim() ?? "GBP";

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const saved = await getSellerPreferences(userId, currency);
    const preferences = saved ?? defaultSellerPreferences(currency);

    return NextResponse.json({
      success: true,
      preferences,
      hasSaved: Boolean(saved),
    });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to load seller preferences.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      preferences?: SellerPreferences;
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

    await saveSellerPreferences(userId, body.preferences);

    return NextResponse.json({ success: true, saved: true });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to save seller preferences.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
