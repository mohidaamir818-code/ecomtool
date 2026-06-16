import "server-only";

import { serverEnv } from "@/lib/env";

export interface AmazefRawProduct {
  id?: string | number;
  title?: string;
  name?: string;
  product_name?: string;
  price?: number | string;
  buyerDisplayPrice?: number | string;
  buyerPriceGbp?: number | string;
  currency?: string;
  score?: number;
  orders?: number | string;
  orders_count?: number | string;
  reviews_count?: number;
  created_at?: string;
  inventory?: number;
  image?: string;
  image_url?: string;
  images?: string[];
  url?: string;
  product_url?: string;
  flash_deal_discount_percent?: number;
  average_rating?: number;
  localizedPrice?: {
    currency?: string;
    totalLocal?: string | number;
  };
  seller_listing_meta?: {
    currency?: string;
  };
}

export interface AmazefSearchResult {
  id: string;
  title: string;
  price: number;
  currency: string;
  score: number | null;
  orders: string | null;
  imageUrl: string | null;
  productUrl: string | null;
}

function computeScore(raw: AmazefRawProduct): number | null {
  if (typeof raw.score === "number") return raw.score;

  let score = 50;
  if (raw.flash_deal_discount_percent) {
    score += Math.min(raw.flash_deal_discount_percent, 30);
  }
  if (raw.average_rating) {
    score += Math.round(raw.average_rating * 4);
  }
  if (raw.reviews_count && raw.reviews_count > 0) {
    score += Math.min(raw.reviews_count, 10);
  }

  return Math.min(score, 100);
}

function parsePrice(value: number | string | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return parseFloat(String(value).replace(/[^0-9.]/g, "")) || 0;
}

function extractBuyerPrice(raw: AmazefRawProduct): number {
  const buyerPrice =
    parsePrice(raw.buyerDisplayPrice) ||
    parsePrice(raw.buyerPriceGbp) ||
    parsePrice(raw.localizedPrice?.totalLocal);

  if (buyerPrice > 0) return buyerPrice;

  return parsePrice(raw.price);
}

function buildAmazefProductUrl(id: string | number | undefined): string | null {
  if (!id) return null;
  return `https://amazef.com/products/${id}`;
}

function formatOrdersValue(raw: AmazefRawProduct): string | null {
  const ordersRaw = raw.orders ?? raw.orders_count;
  if (ordersRaw != null && String(ordersRaw).trim() !== "") {
    return String(ordersRaw);
  }
  if (raw.reviews_count != null) {
    return String(raw.reviews_count);
  }
  return null;
}

function normalizeProduct(raw: AmazefRawProduct): AmazefSearchResult | null {
  const title = raw.title ?? raw.name ?? raw.product_name;
  if (!title) return null;

  const price = extractBuyerPrice(raw);
  const productId = raw.id != null ? String(raw.id) : null;

  const currency =
    raw.localizedPrice?.currency ??
    raw.seller_listing_meta?.currency ??
    raw.currency ??
    "GBP";

  const orders = formatOrdersValue(raw);

  const imageUrl =
    raw.image_url ??
    raw.image ??
    (Array.isArray(raw.images) && raw.images.length > 0 ? raw.images[0] : null);

  return {
    id: productId ?? crypto.randomUUID(),
    title: String(title),
    price,
    currency,
    score: computeScore(raw),
    orders,
    imageUrl,
    productUrl: raw.product_url ?? raw.url ?? buildAmazefProductUrl(raw.id),
  };
}

function extractProducts(payload: unknown): AmazefRawProduct[] {
  if (!payload || typeof payload !== "object") return [];

  const data = payload as Record<string, unknown>;

  if (Array.isArray(data)) return data as AmazefRawProduct[];
  if (Array.isArray(data.organicProducts)) return data.organicProducts as AmazefRawProduct[];
  if (Array.isArray(data.products)) return data.products as AmazefRawProduct[];
  if (Array.isArray(data.data)) return data.data as AmazefRawProduct[];
  if (Array.isArray(data.results)) return data.results as AmazefRawProduct[];

  return [];
}

function buildSearchUrl(
  baseUrl: string,
  query: string,
  lookbackDays?: number,
): string {
  let endpoint = baseUrl.trim().replace(/\/$/, "");

  // Strip legacy /search suffix if user copied an old example URL
  endpoint = endpoint.replace(/\/search$/, "");

  if (!endpoint.endsWith("/api/products")) {
    endpoint = `${endpoint}/api/products`;
  }

  const url = new URL(endpoint);
  url.searchParams.set("q", query);
  if (lookbackDays != null) {
    url.searchParams.set("days", String(lookbackDays));
  }
  return url.toString();
}

function isWithinLookback(raw: AmazefRawProduct, lookbackDays: number): boolean {
  if (!raw.created_at) return true;

  const since = new Date();
  since.setDate(since.getDate() - lookbackDays);

  return new Date(raw.created_at) >= since;
}

export async function searchAmazefProducts(
  query: string,
  lookbackDays = 7,
  options?: { skipLookback?: boolean },
): Promise<AmazefSearchResult[]> {
  const baseUrl = serverEnv.amazefApiUrl();
  const apiKey = serverEnv.amazefApiKey();

  if (!baseUrl) {
    throw new Error(
      "AMAZEF_API_URL is not configured. Add it to your .env.local file.",
    );
  }

  const url = buildSearchUrl(
    baseUrl,
    query,
    options?.skipLookback ? undefined : lookbackDays,
  );

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    const snippet = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
    throw new Error(
      `Amazef API error (${response.status}): ${snippet || response.statusText}`,
    );
  }

  const payload = await response.json();
  const rawProducts = extractProducts(payload);
  const filteredRaw = options?.skipLookback
    ? rawProducts
    : rawProducts.filter((raw) => isWithinLookback(raw, lookbackDays));

  return filteredRaw
    .map(normalizeProduct)
    .filter((p): p is AmazefSearchResult => p !== null);
}
