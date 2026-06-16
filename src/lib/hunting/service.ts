import "server-only";

import {
  DEFAULT_HUNT_LOOKBACK_DAYS,
  HUNT_LOOKBACK_OPTIONS,
  type HuntLookbackDays,
} from "@/features/hunting/constants";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { HuntProduct, HuntRequest, HuntStats } from "@/types/hunting";

export function normalizeLookbackDays(days?: number): HuntLookbackDays {
  const parsed = Number(days ?? DEFAULT_HUNT_LOOKBACK_DAYS);

  if (HUNT_LOOKBACK_OPTIONS.includes(parsed as HuntLookbackDays)) {
    return parsed as HuntLookbackDays;
  }

  return DEFAULT_HUNT_LOOKBACK_DAYS;
}

function getSinceDate(lookbackDays: number): string {
  const since = new Date();
  since.setDate(since.getDate() - lookbackDays);
  return since.toISOString();
}

export function parseOrdersCount(value: string | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;

  const normalized = String(value).trim().toLowerCase().replace(/,/g, "");
  if (!normalized) return 0;

  const match = normalized.match(/^([\d.]+)\s*([kmb])?/);
  if (!match) {
    return parseFloat(normalized.replace(/[^0-9.]/g, "")) || 0;
  }

  const num = parseFloat(match[1]);
  const suffix = match[2];

  if (suffix === "k") return num * 1000;
  if (suffix === "m") return num * 1_000_000;
  if (suffix === "b") return num * 1_000_000_000;

  return num;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? "" : "s"} ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;

  return date.toLocaleDateString();
}

function mapRequestStatus(status: string): HuntRequest["status"] {
  const normalized = status.toLowerCase();
  if (normalized === "completed") return "Completed";
  if (normalized === "failed") return "Failed";
  if (normalized === "pending") return "Pending";
  return "Processing";
}

function mapRowToRequest(row: Record<string, unknown>): HuntRequest {
  return {
    id: String(row.id),
    keyword: String(row.keyword),
    status: mapRequestStatus(String(row.status)),
    productCount: Number(row.product_count ?? 0),
    lookbackDays: Number(row.lookback_days ?? DEFAULT_HUNT_LOOKBACK_DAYS),
    errorMessage: row.error_message ? String(row.error_message) : null,
    createdAt: formatRelativeTime(String(row.created_at)),
  };
}

function formatPrice(price: number, currency: string): string {
  if (currency === "USD") return `$${price.toFixed(2)}`;
  if (currency === "GBP") return `£${price.toFixed(2)}`;
  if (currency === "EUR") return `€${price.toFixed(2)}`;
  return `${currency} ${price.toFixed(2)}`;
}

function formatOrdersDisplay(value: unknown): string {
  if (value == null || String(value).trim() === "") return "—";
  return String(value);
}

function resolveProductUrl(row: Record<string, unknown>): string | null {
  if (row.product_url) return String(row.product_url);

  const externalId = row.external_id ? String(row.external_id) : null;
  const source = String(row.source ?? "amazef").toLowerCase();

  if (externalId && source === "amazef") {
    return `https://amazef.com/products/${externalId}`;
  }

  return null;
}

function mapRowToProduct(row: Record<string, unknown>): HuntProduct {
  const price = row.price != null ? Number(row.price) : null;
  const currency = String(row.currency ?? "GBP");
  const source = String(row.source ?? "amazef");

  return {
    id: String(row.id),
    huntRequestId: String(row.hunt_request_id),
    keyword: String(row.keyword),
    productName: String(row.product_name),
    price: price != null ? formatPrice(price, currency) : "—",
    score: row.score != null ? Number(row.score) : null,
    orders: formatOrdersDisplay(row.orders_count),
    status: "Completed",
    huntedAt: formatRelativeTime(String(row.created_at)),
    imageUrl: row.image_url ? String(row.image_url) : null,
    productUrl: resolveProductUrl(row),
    source,
  };
}

function pickMostSoldProductPerRequest(
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  const bestByRequest = new Map<string, Record<string, unknown>>();

  for (const row of rows) {
    const requestId = String(row.hunt_request_id);
    const current = bestByRequest.get(requestId);
    const orders = parseOrdersCount(
      row.orders_count != null ? String(row.orders_count) : null,
    );
    const currentOrders = current
      ? parseOrdersCount(
          current.orders_count != null ? String(current.orders_count) : null,
        )
      : -1;

    if (!current || orders > currentOrders) {
      bestByRequest.set(requestId, row);
    }
  }

  return Array.from(bestByRequest.values()).sort(
    (a, b) =>
      new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime(),
  );
}

export async function getHuntData(userId: string, lookbackDaysInput?: number) {
  const lookbackDays = normalizeLookbackDays(lookbackDaysInput);
  const supabase = getSupabaseAdmin();
  const since = getSinceDate(lookbackDays);

  const { data: requests, error: requestsError } = await supabase
    .from("hunt_requests")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);

  if (requestsError) {
    throw new Error(
      requestsError.message.includes("does not exist")
        ? "Hunt tables missing. Run supabase/migrations/004_hunt_products.sql in Supabase SQL Editor."
        : requestsError.message,
    );
  }

  const { data: products, error: productsError } = await supabase
    .from("hunt_products")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (productsError) throw new Error(productsError.message);

  const topProducts = pickMostSoldProductPerRequest(products ?? []);
  const mappedProducts = topProducts.map(mapRowToProduct);
  const mappedRequests = (requests ?? []).map(mapRowToRequest);

  const scores = mappedProducts
    .map((p) => p.score)
    .filter((s): s is number => s != null);

  const stats: HuntStats = {
    totalHunts: mappedRequests.length,
    totalProducts: mappedProducts.length,
    winningProducts: mappedProducts.filter((p) => (p.score ?? 0) >= 80).length,
    avgScore: scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0,
  };

  return {
    products: mappedProducts,
    requests: mappedRequests,
    stats,
    lookbackDays,
  };
}

export async function createHuntRequest(
  userId: string,
  keyword: string,
  lookbackDays: number,
) {
  const supabase = getSupabaseAdmin();

  const basePayload = {
    user_id: userId,
    keyword,
    platform: "amazef",
    status: "processing",
  };

  let result = await supabase
    .from("hunt_requests")
    .insert({ ...basePayload, lookback_days: lookbackDays })
    .select()
    .single();

  if (result.error?.message.includes("lookback_days")) {
    result = await supabase.from("hunt_requests").insert(basePayload).select().single();
  }

  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function completeHuntRequest(
  requestId: string,
  productCount: number,
  status: "completed" | "failed",
  errorMessage?: string,
) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("hunt_requests")
    .update({
      status,
      product_count: productCount,
      error_message: errorMessage ?? null,
    })
    .eq("id", requestId);

  if (error) throw new Error(error.message);
}

export async function saveHuntProducts(
  userId: string,
  requestId: string,
  keyword: string,
  products: {
    externalId: string;
    title: string;
    price: number;
    currency: string;
    score: number | null;
    orders: string | null;
    imageUrl: string | null;
    productUrl: string | null;
  }[],
) {
  if (products.length === 0) return;

  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("hunt_products").insert(
    products.map((p) => ({
      hunt_request_id: requestId,
      user_id: userId,
      external_id: p.externalId,
      product_name: p.title,
      keyword,
      price: p.price,
      currency: p.currency,
      score: p.score,
      orders_count: p.orders,
      image_url: p.imageUrl,
      product_url: p.productUrl,
      source: "amazef",
    })),
  );

  if (error) throw new Error(error.message);
}

export function selectMostSoldProducts<
  T extends { orders: string | null; score: number | null },
>(products: T[], limit = 1): T[] {
  return [...products]
    .sort((a, b) => {
      const ordersDiff = parseOrdersCount(b.orders) - parseOrdersCount(a.orders);
      if (ordersDiff !== 0) return ordersDiff;
      return (b.score ?? 0) - (a.score ?? 0);
    })
    .slice(0, limit);
}
