import { NextRequest, NextResponse } from "next/server";
import { searchAmazefProducts } from "@/lib/amazef/client";
import {
  completeHuntRequest,
  createHuntRequest,
  getHuntData,
  normalizeLookbackDays,
  parseOrdersCount,
  saveHuntProducts,
  selectMostSoldProducts,
} from "@/lib/hunting/service";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { logUserApiRequest } from "@/lib/requests/tracker";
import { consumeQuota } from "@/lib/quota/service";
import { quotaErrorResponse } from "@/lib/quota/api-helpers";
import type { HuntAmazefPayload } from "@/types/hunting";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    const lookbackDays = normalizeLookbackDays(
      Number(request.nextUrl.searchParams.get("lookbackDays")),
    );

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

    const data = await getHuntData(userId, lookbackDays);

    void logUserApiRequest({
      userId,
      endpoint: "/api/hunt/amazef",
      method: "GET",
      status: "success",
    });

    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load hunt data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let requestId: string | null = null;
  let trackedUserId: string | null = null;

  try {
    const body = (await request.json()) as HuntAmazefPayload;
    trackedUserId = body.userId?.trim() ?? null;

    if (!body.userId?.trim()) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    if (!body.query?.trim() || body.query.trim().length < 2) {
      return NextResponse.json(
        { error: "Search query must be at least 2 characters." },
        { status: 400 },
      );
    }

    const keyword = body.query.trim();
    const lookbackDays = normalizeLookbackDays(body.lookbackDays);
    const supabase = getSupabaseAdmin();

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", body.userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    await consumeQuota(body.userId, "amazef", 1);

    const huntRequest = await createHuntRequest(body.userId, keyword, lookbackDays);
    requestId = huntRequest.id as string;

    const amazefProducts = await searchAmazefProducts(keyword, lookbackDays);
    const topProducts = selectMostSoldProducts(amazefProducts, 1);

    await saveHuntProducts(
      body.userId,
      requestId,
      keyword,
      topProducts.map((p) => ({
        externalId: p.id,
        title: p.title,
        price: p.price,
        currency: p.currency,
        score: p.score,
        orders: p.orders,
        imageUrl: p.imageUrl,
        productUrl: p.productUrl,
      })),
    );

    await completeHuntRequest(requestId, topProducts.length, "completed");

    const data = await getHuntData(body.userId, lookbackDays);

    const topOrders = topProducts[0] ? parseOrdersCount(topProducts[0].orders) : 0;

    void logUserApiRequest({
      userId: body.userId,
      endpoint: "/api/hunt/amazef",
      method: "POST",
      status: "success",
    });

    return NextResponse.json(
      {
        success: true,
        message:
          topProducts.length > 0
            ? `Most sold product saved for "${keyword}" in the last ${lookbackDays} days (${topOrders} orders from ${amazefProducts.length} match${amazefProducts.length === 1 ? "" : "es"}).`
            : `No products found for "${keyword}" in the last ${lookbackDays} days.`,
        ...data,
      },
      { status: 201 },
    );
  } catch (error) {
    const quotaResponse = quotaErrorResponse(error);
    if (quotaResponse) return quotaResponse;

    const message = error instanceof Error ? error.message : "Hunt failed.";

    if (requestId) {
      try {
        await completeHuntRequest(requestId, 0, "failed", message);
      } catch {
        // ignore cleanup errors
      }
    }

    if (trackedUserId) {
      void logUserApiRequest({
        userId: trackedUserId,
        endpoint: "/api/hunt/amazef",
        method: "POST",
        status: "failed",
      });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
