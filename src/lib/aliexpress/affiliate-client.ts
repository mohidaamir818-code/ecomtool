import "server-only";

import crypto from "crypto";
import { serverEnv } from "@/lib/env";
import type { SupplierProduct, SupplierStockRegion } from "@/types/supplier-finder";

const AFFILIATE_ENDPOINT = "https://api-sg.aliexpress.com/sync";

const PRODUCT_FIELDS = [
  "product_id",
  "product_title",
  "product_main_image_url",
  "product_detail_url",
  "target_sale_price",
  "target_sale_price_currency",
  "target_original_price",
  "sale_price",
  "commission_rate",
  "lastest_volume",
  "evaluate_rate",
  "discount",
  "ship_to_days",
  "shop_url",
].join(",");

export interface AffiliateSearchOptions {
  keywords: string;
  stockRegion: SupplierStockRegion;
  page?: number;
  pageSize?: number;
  /** Extra phrases to try when the primary keywords return no products. */
  fallbackKeywords?: string[];
}

export interface AffiliateSearchResult {
  products: SupplierProduct[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

function formatTimestamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function signMd5Params(params: Record<string, string>, secret: string): string {
  const sorted = Object.keys(params)
    .filter((key) => key !== "sign")
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join("");

  return crypto
    .createHash("md5")
    .update(`${secret}${sorted}${secret}`, "utf8")
    .digest("hex")
    .toUpperCase();
}

function parseNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveStockParams(region: SupplierStockRegion): {
  shipToCountry: string;
  deliveryDays?: string;
  currency: string;
} {
  if (region === "us") {
    return { shipToCountry: "US", deliveryDays: "3", currency: "USD" };
  }
  if (region === "uk") {
    return { shipToCountry: "GB", deliveryDays: "3", currency: "GBP" };
  }
  return { shipToCountry: "GB", currency: "GBP" };
}

/** AliExpress search works best with a short space-separated phrase, not comma lists. */
function sanitizeSearchKeywords(input: string): string {
  return input
    .replace(/[,;|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

function isEmptyAffiliateResultMessage(message: string): boolean {
  return /result is empty|no result|not found|no product/i.test(message);
}

function emptySearchResult(page: number, pageSize: number): AffiliateSearchResult {
  return {
    products: [],
    total: 0,
    page,
    pageSize,
    hasMore: false,
  };
}

function extractAffiliateProducts(
  payload: Record<string, unknown>,
  responseKey: string,
): { products: SupplierProduct[]; total: number; empty: boolean } {
  const affiliateResponse = payload[responseKey] as
    | {
        resp_result?: {
          resp_code?: number;
          resp_msg?: string;
          result?: {
            products?: { product?: unknown[] | Record<string, unknown> } | unknown[];
            total_record_count?: number;
            is_finished?: boolean;
          };
        };
      }
    | undefined;

  const respCode = affiliateResponse?.resp_result?.resp_code;
  const respMsg = affiliateResponse?.resp_result?.resp_msg?.trim() ?? "";

  if (respCode != null && respCode !== 200 && respCode !== 0) {
    if (isEmptyAffiliateResultMessage(respMsg)) {
      return { products: [], total: 0, empty: true };
    }
    throw new Error(respMsg || "AliExpress Affiliate search failed.");
  }

  const result = affiliateResponse?.resp_result?.result;
  const rawProducts = result?.products;
  let items: unknown[] = [];

  if (Array.isArray(rawProducts)) {
    items = rawProducts;
  } else if (rawProducts && typeof rawProducts === "object") {
    const nested = (rawProducts as { product?: unknown[] | Record<string, unknown> }).product;
    if (Array.isArray(nested)) {
      items = nested;
    } else if (nested && typeof nested === "object") {
      items = [nested];
    }
  }

  const products = items
    .map((item) => normalizeProduct(item as Record<string, unknown>))
    .filter((item): item is SupplierProduct => item !== null);

  const total = Number(result?.total_record_count ?? products.length);
  return { products, total, empty: false };
}

async function queryAffiliateProducts(input: {
  method: "aliexpress.affiliate.product.query" | "aliexpress.affiliate.product.smartmatch";
  keywords: string;
  stock: ReturnType<typeof resolveStockParams>;
  page: number;
  pageSize: number;
  includeDeliveryDays: boolean;
}): Promise<{ products: SupplierProduct[]; total: number; empty: boolean }> {
  const trackingId = affiliateTrackingId();
  const businessParams: Record<string, string> = {
    keywords: input.keywords,
    fields: PRODUCT_FIELDS,
    page_no: String(input.page),
    page_size: String(input.pageSize),
    target_currency: input.stock.currency,
    target_language: "EN",
    sort: "LAST_VOLUME_DESC",
  };

  if (input.method === "aliexpress.affiliate.product.query") {
    businessParams.ship_to_country = input.stock.shipToCountry;
    if (input.includeDeliveryDays && input.stock.deliveryDays) {
      businessParams.delivery_days = input.stock.deliveryDays;
    }
  } else {
    businessParams.device_id = "ecomtools-supplier-finder";
    businessParams.country = input.stock.shipToCountry;
  }

  if (trackingId) {
    businessParams.tracking_id = trackingId;
  }

  const payload = await callAffiliateApi(input.method, businessParams);
  if (!payload) {
    throw new Error("AliExpress Affiliate API returned an empty response.");
  }

  const responseKey =
    input.method === "aliexpress.affiliate.product.query"
      ? "aliexpress_affiliate_product_query_response"
      : "aliexpress_affiliate_product_smartmatch_response";

  return extractAffiliateProducts(payload, responseKey);
}

function buildKeywordVariants(primary: string, extras: string[] = []): string[] {
  const seen = new Set<string>();
  const variants: string[] = [];

  function add(value: string) {
    const cleaned = sanitizeSearchKeywords(value);
    if (cleaned.length < 2 || seen.has(cleaned.toLowerCase())) return;
    seen.add(cleaned.toLowerCase());
    variants.push(cleaned);
  }

  add(primary);
  for (const extra of extras) add(extra);

  const words = sanitizeSearchKeywords(primary).split(/\s+/).filter(Boolean);
  if (words.length > 3) add(words.slice(0, 3).join(" "));
  if (words.length > 2) add(words.slice(0, 2).join(" "));
  if (words.length > 2) add(words.slice(-2).join(" "));

  return variants;
}

function affiliateTrackingId(): string | undefined {
  const value = process.env.ALIEXPRESS_AFFILIATE_TRACKING_ID?.trim();
  return value || undefined;
}

async function callAffiliateApi(
  method: string,
  businessParams: Record<string, string>,
): Promise<Record<string, unknown> | null> {
  const appKey = serverEnv.aliexpressAffiliateAppKey();
  const appSecret = serverEnv.aliexpressAffiliateAppSecret();

  if (!appKey || !appSecret) {
    throw new Error(
      "AliExpress Affiliate API is not configured. Add ALIEXPRESS_AFFILIATE_APP_KEY and ALIEXPRESS_AFFILIATE_APP_SECRET.",
    );
  }

  const params: Record<string, string> = {
    app_key: appKey,
    method,
    sign_method: "md5",
    format: "json",
    v: "2.0",
    timestamp: formatTimestamp(),
    ...businessParams,
  };
  params.sign = signMd5Params(params, appSecret);

  const response = await fetch(AFFILIATE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: new URLSearchParams(params),
    cache: "no-store",
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (payload.error_response) {
    const errorResponse = payload.error_response as { msg?: string; sub_msg?: string };
    throw new Error(
      errorResponse.sub_msg || errorResponse.msg || "AliExpress Affiliate API request failed.",
    );
  }

  return payload;
}

function normalizeProduct(raw: Record<string, unknown>): SupplierProduct | null {
  const productId = raw.product_id != null ? String(raw.product_id).trim() : "";
  const title = typeof raw.product_title === "string" ? raw.product_title.trim() : "";
  const price =
    parseNumber(raw.target_sale_price) ??
    parseNumber(raw.target_app_sale_price) ??
    parseNumber(raw.app_sale_price) ??
    parseNumber(raw.sale_price) ??
    parseNumber(raw.original_price) ??
    0;

  if (!productId || !title) return null;

  const currency =
    typeof raw.target_sale_price_currency === "string"
      ? raw.target_sale_price_currency
      : typeof raw.sale_price_currency === "string"
        ? raw.sale_price_currency
        : "GBP";

  const originalPrice = parseNumber(raw.target_original_price ?? raw.original_price);

  return {
    productId,
    title,
    imageUrl:
      typeof raw.product_main_image_url === "string" ? raw.product_main_image_url.trim() : null,
    productUrl:
      typeof raw.product_detail_url === "string" ? raw.product_detail_url.trim() : null,
    price,
    currency,
    originalPrice,
    commissionRate:
      raw.commission_rate != null ? String(raw.commission_rate) : null,
    orders: parseNumber(raw.lastest_volume),
    rating: raw.evaluate_rate != null ? String(raw.evaluate_rate) : null,
    discount: raw.discount != null ? String(raw.discount) : null,
    deliveryDays: raw.ship_to_days != null ? String(raw.ship_to_days) : null,
    shopUrl: typeof raw.shop_url === "string" ? raw.shop_url.trim() : null,
  };
}

/**
 * Search AliExpress products via the Affiliate API (aliexpress.affiliate.product.query).
 * Separate from the Dropship/Open Platform client used for product fetching.
 */
export async function searchAffiliateProducts(
  options: AffiliateSearchOptions,
): Promise<AffiliateSearchResult> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 20));
  const stock = resolveStockParams(options.stockRegion);
  const keywordVariants = buildKeywordVariants(
    options.keywords,
    options.fallbackKeywords ?? [],
  );

  if (keywordVariants.length === 0) {
    throw new Error("Search keywords must be at least 2 characters.");
  }

  async function tryVariants(
    method: "aliexpress.affiliate.product.query" | "aliexpress.affiliate.product.smartmatch",
    includeDeliveryDays: boolean,
  ): Promise<AffiliateSearchResult | null> {
    for (const variant of keywordVariants) {
      const result = await queryAffiliateProducts({
        method,
        keywords: variant,
        stock,
        page,
        pageSize,
        includeDeliveryDays,
      });

      if (result.products.length > 0) {
        const hasMore = page * pageSize < result.total;
        return {
          products: result.products,
          total: result.total,
          page,
          pageSize,
          hasMore,
        };
      }
    }
    return null;
  }

  const withDelivery =
    (await tryVariants("aliexpress.affiliate.product.query", true)) ??
    (stock.deliveryDays
      ? await tryVariants("aliexpress.affiliate.product.query", false)
      : null);

  if (withDelivery) return withDelivery;

  const smartMatch =
    (await tryVariants("aliexpress.affiliate.product.smartmatch", false)) ?? null;

  if (smartMatch) return smartMatch;

  return emptySearchResult(page, pageSize);
}
