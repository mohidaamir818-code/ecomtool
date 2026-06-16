import { NextRequest, NextResponse } from "next/server";
import {
  getCompetitorCheckDetails,
  getRecentCompetitorChecks,
  runCompetitorCheck,
} from "@/lib/competitors/service";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { CompetitorCheckPayload } from "@/types/competitor";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    const checkId = request.nextUrl.searchParams.get("checkId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
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

    if (checkId) {
      const details = await getCompetitorCheckDetails(userId, checkId);

      return NextResponse.json({
        success: true,
        message: details.message,
        userPriceLabel: details.userPriceLabel,
        matches: details.matches,
        totalSearched: details.totalSearched,
        selectedCheck: details.check,
      });
    }

    const recentChecks = await getRecentCompetitorChecks(userId);

    return NextResponse.json({ success: true, recentChecks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load competitor checks.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CompetitorCheckPayload;

    if (!body.userId?.trim()) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    if (!body.productQuery?.trim() || body.productQuery.trim().length < 2) {
      return NextResponse.json(
        { error: "Product name or keyword must be at least 2 characters." },
        { status: 400 },
      );
    }

    const userPrice = Number(body.userPrice);
    if (!Number.isFinite(userPrice) || userPrice <= 0) {
      return NextResponse.json(
        { error: "Enter a valid selling price greater than 0." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", body.userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const result = await runCompetitorCheck(body.userId, body.productQuery, userPrice);
    const recentChecks = await getRecentCompetitorChecks(body.userId);

    return NextResponse.json(
      {
        success: true,
        message: result.message,
        userPrice,
        userPriceLabel: result.userPriceLabel,
        currency: result.currency,
        matches: result.matches,
        totalSearched: result.totalSearched,
        check: result.check,
        recentChecks,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Competitor check failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
