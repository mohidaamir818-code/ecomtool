import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";
import type { ListingDraft } from "@/types/listing-generator";

const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("listing_wizard_drafts")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      if (error.message.includes("does not exist")) {
        return NextResponse.json({ success: true, draft: null });
      }
      throw new Error(error.message);
    }

    if (!data) {
      return NextResponse.json({ success: true, draft: null });
    }

    const updatedAt = new Date(String(data.updated_at)).getTime();
    if (Date.now() - updatedAt > DRAFT_MAX_AGE_MS) {
      await supabase.from("listing_wizard_drafts").delete().eq("user_id", userId);
      return NextResponse.json({ success: true, draft: null });
    }

    return NextResponse.json({
      success: true,
      draft: {
        productUrl: data.product_url ?? null,
        currentStep: Number(data.current_step ?? 0),
        draftJson: data.draft_json ?? null,
        updatedAt: data.updated_at,
      },
    });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to load draft.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      productUrl?: string;
      currentStep?: number;
      draft?: ListingDraft | null;
    };

    const userId = body.userId?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("listing_wizard_drafts").upsert(
      {
        user_id: userId,
        product_url: body.productUrl ?? null,
        current_step: body.currentStep ?? 0,
        draft_json: body.draft ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) {
      if (error.message.includes("does not exist")) {
        return NextResponse.json(
          { error: "Run supabase/migrations/017_listing_fee_preferences.sql in Supabase." },
          { status: 500 },
        );
      }
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to save draft.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const supabase = getSupabaseAdmin();
    await supabase.from("listing_wizard_drafts").delete().eq("user_id", userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to delete draft.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
