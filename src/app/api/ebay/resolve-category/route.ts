import { NextRequest, NextResponse } from "next/server";
import { resolveDraftListingCategory } from "@/lib/ebay/sell-inventory";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { GeneratedListing, ListingVariantDraft } from "@/types/listing-generator";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      listing?: GeneratedListing;
      variants?: ListingVariantDraft[];
    };

    const userId = body.userId?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    if (!body.listing) {
      return NextResponse.json({ error: "listing is required." }, { status: 400 });
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

    const resolved = await resolveDraftListingCategory(
      userId,
      body.listing,
      body.variants ?? [],
    );

    return NextResponse.json({ success: true, ...resolved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resolve category.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
