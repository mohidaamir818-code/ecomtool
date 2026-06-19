import { NextRequest, NextResponse } from "next/server";
import {
  addCompetitorWatch,
  getCompetitorWatchDetails,
  getCompetitorWatches,
  removeCompetitorWatch,
  upgradeCompetitorWatchPrice,
} from "@/lib/competitors/service";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { logUserApiRequest } from "@/lib/requests/tracker";
import { quotaErrorResponse } from "@/lib/quota/api-helpers";
import type { CompetitorWatchAddPayload, CompetitorWatchUpgradePayload } from "@/types/competitor";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    const watchId = request.nextUrl.searchParams.get("watchId");

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

    if (watchId) {
      const details = await getCompetitorWatchDetails(userId, watchId);
      const watches = await getCompetitorWatches(userId);

      void logUserApiRequest({
        userId,
        endpoint: "/api/competitors/watch",
        method: "GET",
        status: "success",
      });

      return NextResponse.json({
        success: true,
        watch: details.watch,
        matches: details.matches,
        message: details.message,
        userPriceLabel: details.userPriceLabel,
        totalSearched: details.totalSearched,
        watches,
      });
    }

    const watches = await getCompetitorWatches(userId);

    void logUserApiRequest({
      userId,
      endpoint: "/api/competitors/watch",
      method: "GET",
      status: "success",
    });

    return NextResponse.json({ success: true, watches });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load competitor watches.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CompetitorWatchAddPayload;

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

    if (!["auto_24h", "custom", "manual"].includes(body.updateMode)) {
      return NextResponse.json({ error: "Invalid update mode." }, { status: 400 });
    }

    if (body.updateMode === "custom") {
      const hours = Number(body.customHours);
      if (!Number.isFinite(hours) || hours <= 0) {
        return NextResponse.json({ error: "Enter valid custom hours." }, { status: 400 });
      }
    }

    if (body.platform && body.platform !== "amazef" && body.platform !== "ebay") {
      return NextResponse.json({ error: "Invalid platform." }, { status: 400 });
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

    const result = await addCompetitorWatch(body);
    const watches = await getCompetitorWatches(body.userId);

    void logUserApiRequest({
      userId: body.userId,
      endpoint: "/api/competitors/watch",
      method: "POST",
      status: "success",
    });

    return NextResponse.json(
      {
        success: true,
        message: result.message,
        watch: result.watch,
        matches: result.matches,
        watches,
      },
      { status: 201 },
    );
  } catch (error) {
    const quotaResponse = quotaErrorResponse(error);
    if (quotaResponse) return quotaResponse;

    const message = error instanceof Error ? error.message : "Failed to add competitor watch.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    const watchId = request.nextUrl.searchParams.get("watchId");

    if (!userId || !watchId) {
      return NextResponse.json({ error: "userId and watchId are required." }, { status: 400 });
    }

    await removeCompetitorWatch(userId, watchId);
    const watches = await getCompetitorWatches(userId);

    return NextResponse.json({ success: true, watches });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove competitor watch.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as CompetitorWatchUpgradePayload;

    if (!body.userId?.trim() || !body.watchId?.trim()) {
      return NextResponse.json({ error: "userId and watchId are required." }, { status: 400 });
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

    const result = await upgradeCompetitorWatchPrice(body.userId, body.watchId, userPrice);
    const watches = await getCompetitorWatches(body.userId);

    void logUserApiRequest({
      userId: body.userId,
      endpoint: "/api/competitors/watch",
      method: "PATCH",
      status: "success",
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      watch: result.watch,
      matches: result.matches,
      watches,
    });
  } catch (error) {
    const quotaResponse = quotaErrorResponse(error);
    if (quotaResponse) return quotaResponse;

    const message =
      error instanceof Error ? error.message : "Failed to upgrade competitor watch price.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
