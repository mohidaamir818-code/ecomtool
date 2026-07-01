import { NextRequest, NextResponse } from "next/server";
import {
  searchDropshipProducts,
  searchDropshipProductsByImage,
} from "@/lib/aliexpress/dropship-search-client";
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
  minPrice?: number | string | null;
  maxPrice?: number | string | null;
}

function normalizeMode(value: unknown): SupplierSearchMode {
  if (value === "title" || value === "photo") return value;
  return "keyword";
}

function normalizeStockRegion(value: unknown): SupplierStockRegion {
  if (value === "uk" || value === "us") return value;
  return "any";
}

function normalizePrice(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100) / 100;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SupplierSearchBody;
    const userId = body.userId?.trim();
    const mode = normalizeMode(body.mode);
    const stockRegion = normalizeStockRegion(body.stockRegion);
    const page = Math.max(1, Number(body.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(body.pageSize) || 20));
    const minPrice = normalizePrice(body.minPrice);
    const maxPrice = normalizePrice(body.maxPrice);

    if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
      return NextResponse.json(
        { error: "Minimum price cannot be higher than maximum price." },
        { status: 400 },
      );
    }

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const accessDenied = await requireActiveUser(userId);
    if (accessDenied) return accessDenied;

    await consumeQuota(userId, "aliexpress", 1);

    let searchQuery = body.query?.trim() ?? "";
    let derivedKeywords: string | undefined;
    let result;

    if (mode === "photo") {
      if (!body.imageDataUrl?.trim() && !body.imageBase64?.trim()) {
        return NextResponse.json({ error: "Please upload a product photo." }, { status: 400 });
      }

      searchQuery = "Photo search";
      derivedKeywords = "Visual match from uploaded photo";

      result = await searchDropshipProductsByImage({
        imageDataUrl: body.imageDataUrl,
        imageBase64: body.imageBase64,
        stockRegion,
        page,
        pageSize,
        minPrice,
        maxPrice,
      });
    } else {
      if (searchQuery.length < 2) {
        return NextResponse.json(
          {
            error:
              mode === "title"
                ? "Title must be at least 2 characters."
                : "Keyword must be at least 2 characters.",
          },
          { status: 400 },
        );
      }

      result = await searchDropshipProducts({
        keywords: searchQuery,
        stockRegion,
        page,
        pageSize,
        minPrice,
        maxPrice,
      });
    }

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
      minPrice,
      maxPrice,
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
