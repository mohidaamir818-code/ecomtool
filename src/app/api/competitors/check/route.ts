import { NextRequest, NextResponse } from "next/server";
import {
  getCompetitorCheckDetails,
  getRecentCompetitorChecks,
  runCompetitorCheck,
} from "@/lib/competitors/service";
import { logUserApiRequest } from "@/lib/requests/tracker";
import { quotaErrorResponse } from "@/lib/quota/api-helpers";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";
import type { CompetitorCheckPayload } from "@/types/competitor";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    const checkId = request.nextUrl.searchParams.get("checkId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

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

    void logUserApiRequest({
      userId,
      endpoint: "/api/competitors/check",
      method: "GET",
      status: "success",
    });

    return NextResponse.json({ success: true, recentChecks });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to load competitor checks.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let trackedUserId: string | null = null;

  try {
    const body = (await request.json()) as CompetitorCheckPayload;
    trackedUserId = body.userId?.trim() ?? null;

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

    const accessDenied = await requireActiveUser(body.userId);
    if (accessDenied) return accessDenied;

    const result = await runCompetitorCheck(body.userId, body.productQuery, userPrice);
    const recentChecks = await getRecentCompetitorChecks(body.userId);

    void logUserApiRequest({
      userId: body.userId,
      endpoint: "/api/competitors/check",
      method: "POST",
      status: "success",
    });

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
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const quotaResponse = quotaErrorResponse(error);
    if (quotaResponse) return quotaResponse;

    const message = error instanceof Error ? error.message : "Competitor check failed.";
    if (trackedUserId) {
      void logUserApiRequest({
        userId: trackedUserId,
        endpoint: "/api/competitors/check",
        method: "POST",
        status: "failed",
      });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
