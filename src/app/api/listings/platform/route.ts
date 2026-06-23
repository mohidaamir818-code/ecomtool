import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { ListingPlatform } from "@/types/listing-generator";

const VALID_PLATFORMS: ListingPlatform[] = ["ebay", "amazef"];

function normalizePlatform(value: unknown): ListingPlatform {
  return value === "amazef" ? "amazef" : "ebay";
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")?.trim();

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from("profiles")
      .select("active_listing_platform")
      .eq("id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      platform: normalizePlatform(profile.active_listing_platform),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load listing platform.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { userId?: string; platform?: string };
    const userId = body.userId?.trim();
    const platform = normalizePlatform(body.platform);

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    if (!VALID_PLATFORMS.includes(platform)) {
      return NextResponse.json({ error: "Invalid platform." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const { error } = await supabase
      .from("profiles")
      .update({ active_listing_platform: platform })
      .eq("id", userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, platform });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update listing platform.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
