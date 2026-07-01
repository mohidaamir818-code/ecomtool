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
    parseNumber(raw.sale_price);

  if (!productId || !title || price == null) return null;

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
  const keywords = options.keywords.trim();
  if (keywords.length < 2) {
    throw new Error("Search keywords must be at least 2 characters.");
  }

  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 20));
  const stock = resolveStockParams(options.stockRegion);

  const businessParams: Record<string, string> = {
    keywords,
    fields: PRODUCT_FIELDS,
    page_no: String(page),
    page_size: String(pageSize),
    target_currency: stock.currency,
    target_language: "EN",
    ship_to_country: stock.shipToCountry,
    sort: "LAST_VOLUME_DESC",
  };

  if (stock.deliveryDays) {
    businessParams.delivery_days = stock.deliveryDays;
  }

  const payload = await callAffiliateApi("aliexpress.affiliate.product.query", businessParams);
  if (!payload) {
    throw new Error("AliExpress Affiliate API returned an empty response.");
  }

  const affiliateResponse = payload.aliexpress_affiliate_product_query_response as
    | {
        resp_result?: {
          resp_code?: number;
          resp_msg?: string;
          result?: {
            products?: { product?: unknown[] } | unknown[];
            current_page_no?: number;
            total_record_count?: number;
            is_finished?: boolean;
          };
        };
      }
    | undefined;

  const respCode = affiliateResponse?.resp_result?.resp_code;
  if (respCode != null && respCode !== 200 && respCode !== 0) {
    throw new Error(
      affiliateResponse?.resp_result?.resp_msg ?? "AliExpress Affiliate search failed.",
    );
  }

  const result = affiliateResponse?.resp_result?.result;
  const rawProducts = result?.products;
  const items = Array.isArray(rawProducts)
    ? rawProducts
    : Array.isArray(rawProducts?.product)
      ? rawProducts.product
      : [];

  const products = items
    .map((item) => normalizeProduct(item as Record<string, unknown>))
    .filter((item): item is SupplierProduct => item !== null);

  const total = Number(result?.total_record_count ?? products.length);
  const hasMore = result?.is_finished === false || page * pageSize < total;

  return {
    products,
    total,
    page,
    pageSize,
    hasMore,
  };
}
