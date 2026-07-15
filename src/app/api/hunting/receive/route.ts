import { NextRequest, NextResponse } from "next/server";
import {
  getHuntingResultById,
  getLatestHuntingResult,
  RANDOM_HOT_KEYWORD,
  saveHuntingResult,
  sendHuntProductsReadyEmail,
} from "@/lib/hunting/huntpro-service";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";
import type {
  HuntProProduct,
  HuntProReceivePayload,
  HuntProStatistics,
} from "@/types/huntpro";

const HUNTPRO_KEY = "huntpro-secret-2026";

function normalizeStatistics(raw: Partial<HuntProStatistics> | undefined): HuntProStatistics {
  return {
    totalSold: Number(raw?.totalSold ?? 0),
    avgPrice: Number(raw?.avgPrice ?? 0),
    minPrice: Number(raw?.minPrice ?? 0),
    maxPrice: Number(raw?.maxPrice ?? 0),
    totalRevenue: Number(raw?.totalRevenue ?? 0),
    dailyAverage: Number(raw?.dailyAverage ?? 0),
  };
}

function normalizeProducts(raw: HuntProProduct[] | undefined): HuntProProduct[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((product) => ({
    title: String(product?.title ?? ""),
    soldPrice: Number(product?.soldPrice ?? 0),
    soldDate: String(product?.soldDate ?? ""),
    imageUrl: String(product?.imageUrl ?? ""),
    itemId: String(product?.itemId ?? ""),
    condition: String(product?.condition ?? ""),
    shippingCost: Number(product?.shippingCost ?? 0),
    totalPrice: Number(product?.totalPrice ?? 0),
    listingUrl: String(product?.listingUrl ?? ""),
    soldCount: Number(product?.soldCount ?? 0),
    daysWindow: Number(product?.daysWindow ?? 0),
    listedDate: String(product?.listedDate ?? ""),
  }));
}

function isRandomHotHunt(keyword: string): boolean {
  const normalized = keyword.trim().toLowerCase();
  return normalized === RANDOM_HOT_KEYWORD || normalized.startsWith("random-hot");
}

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("x-huntpro-key") !== HUNTPRO_KEY) {
      return NextResponse.json({ error: "Invalid HuntPro key." }, { status: 401 });
    }

    const body = (await request.json()) as HuntProReceivePayload & {
      huntComplete?: boolean;
    };

    const userId = body.userId?.trim();
    const keyword = body.keyword?.trim() || RANDOM_HOT_KEYWORD;

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const products = normalizeProducts(body.products);
    const result = await saveHuntingResult({
      userId,
      keyword,
      source: body.source ?? "huntpro-extension",
      statistics: normalizeStatistics(body.statistics),
      products,
    });

    const shouldEmail =
      products.length > 0 &&
      (body.huntComplete === true || isRandomHotHunt(keyword) || products.length >= 20);

    if (shouldEmail) {
      await sendHuntProductsReadyEmail({
        userId,
        resultId: result.id,
        productCount: products.length,
      });
    }

    return NextResponse.json({ success: true, result, emailed: shouldEmail }, { status: 201 });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to save hunting results.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")?.trim();
    const keyword = request.nextUrl.searchParams.get("keyword")?.trim() || undefined;
    const resultId = request.nextUrl.searchParams.get("resultId")?.trim() || undefined;

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    const result = resultId
      ? await getHuntingResultById(userId, resultId)
      : await getLatestHuntingResult(userId, keyword);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const message = error instanceof Error ? error.message : "Failed to load hunting results.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
