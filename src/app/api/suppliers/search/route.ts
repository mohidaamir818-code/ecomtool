import { NextRequest, NextResponse } from "next/server";
import { searchAffiliateProducts } from "@/lib/aliexpress/affiliate-client";
import { extractSupplierKeywordsFromPhoto } from "@/lib/suppliers/photo-keywords";
import { consumeQuota } from "@/lib/quota/service";
import { quotaErrorResponse } from "@/lib/quota/api-helpers";
import { requireActiveUser, userBlockErrorResponse } from "@/lib/user/block-api-helpers";
import type {
  SupplierSearchMode,
  SupplierSearchResponse,
  SupplierStockRegion,
} from "@/types/supplier-finder";

interface SupplierSearchBody {
  userId?: string;
  mode?: SupplierSearchMode;
  query?: string;
  stockRegion?: SupplierStockRegion;
  page?: number;
  pageSize?: number;
  imageBase64?: string;
  imageDataUrl?: string;
}

function normalizeMode(value: unknown): SupplierSearchMode {
  if (value === "title" || value === "photo") return value;
  return "keyword";
}

function normalizeStockRegion(value: unknown): SupplierStockRegion {
  if (value === "uk" || value === "us") return value;
  return "any";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SupplierSearchBody;
    const userId = body.userId?.trim();
    const mode = normalizeMode(body.mode);
    const stockRegion = normalizeStockRegion(body.stockRegion);
    const page = Math.max(1, Number(body.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(body.pageSize) || 20));

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    let searchQuery = body.query?.trim() ?? "";
    let derivedKeywords: string | undefined;

    if (mode === "photo") {
      const extracted = await extractSupplierKeywordsFromPhoto({
        imageBase64: body.imageBase64,
        imageDataUrl: body.imageDataUrl,
      });
      searchQuery = extracted.keywords;
      derivedKeywords = extracted.title;

      await consumeQuota(userId, "aliexpress", 1);

      const result = await searchAffiliateProducts({
        keywords: searchQuery,
        fallbackKeywords: extracted.fallbackQueries,
        stockRegion,
        page,
        pageSize,
      });

      const response: SupplierSearchResponse = {
        success: true,
        mode,
        query: searchQuery,
        stockRegion,
        products: result.products,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        hasMore: result.hasMore,
        derivedKeywords,
      };

      return NextResponse.json(response);
    } else if (searchQuery.length < 2) {
      return NextResponse.json(
        { error: mode === "title" ? "Title must be at least 2 characters." : "Keyword must be at least 2 characters." },
        { status: 400 },
      );
    }

    await consumeQuota(userId, "aliexpress", 1);

    const result = await searchAffiliateProducts({
      keywords: searchQuery,
      stockRegion,
      page,
      pageSize,
    });

    const response: SupplierSearchResponse = {
      success: true,
      mode,
      query: searchQuery,
      stockRegion,
      products: result.products,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      hasMore: result.hasMore,
      ...(derivedKeywords ? { derivedKeywords } : {}),
    };

    return NextResponse.json(response);
  } catch (error) {
    const blocked = userBlockErrorResponse(error);
    if (blocked) return blocked;

    const quotaResponse = quotaErrorResponse(error);
    if (quotaResponse) return quotaResponse;

    const message =
      error instanceof Error ? error.message : "Supplier search failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
