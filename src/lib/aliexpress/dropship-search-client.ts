import "server-only";

import crypto from "crypto";
import sharp from "sharp";
import { serverEnv } from "@/lib/env";
import { getAliExpressAccessToken } from "@/lib/aliexpress/oauth";
import type { SupplierProduct, SupplierStockRegion } from "@/types/supplier-finder";

const DROPSHIP_ENDPOINT = "https://api-sg.aliexpress.com/sync";
const MAX_IMAGE_BYTES = 95 * 1024;

export interface DropshipSearchOptions {
  keywords: string;
  stockRegion: SupplierStockRegion;
  page?: number;
  pageSize?: number;
}

export interface DropshipImageSearchOptions {
  imageDataUrl?: string;
  imageBase64?: string;
  stockRegion: SupplierStockRegion;
  page?: number;
  pageSize?: number;
}

export interface DropshipSearchResult {
  products: SupplierProduct[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

function signHmacSha256Params(params: Record<string, string>, secret: string): string {
  const sorted = Object.keys(params)
    .filter((key) => key !== "sign")
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join("");

  return crypto.createHmac("sha256", secret).update(sorted, "utf8").digest("hex").toUpperCase();
}

function parseNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveRegion(stockRegion: SupplierStockRegion): {
  shipTo: string;
  countryCode: string;
  currency: string;
} {
  if (stockRegion === "us") {
    return { shipTo: "US", countryCode: "US", currency: "USD" };
  }
  if (stockRegion === "uk") {
    return { shipTo: "GB", countryCode: "GB", currency: "GBP" };
  }
  return { shipTo: "GB", countryCode: "GB", currency: "GBP" };
}

async function callDropshipApi(
  method: string,
  businessParams: Record<string, string>,
): Promise<Record<string, unknown>> {
  const appKey = serverEnv.aliexpressAppKey();
  const appSecret = serverEnv.aliexpressAppSecret();
  if (!appKey || !appSecret) {
    throw new Error(
      "AliExpress Dropship API is not configured. Add ALIEXPRESS_APP_KEY and ALIEXPRESS_APP_SECRET.",
    );
  }

  const accessToken = await getAliExpressAccessToken();
  if (!accessToken) {
    throw new Error(
      "AliExpress is not connected. Connect your AliExpress account before using Supplier Finder.",
    );
  }

  const params: Record<string, string> = {
    app_key: appKey,
    method,
    sign_method: "sha256",
    timestamp: String(Date.now()),
    format: "json",
    simplify: "true",
    session: accessToken,
    ...businessParams,
  };
  params.sign = signHmacSha256Params(params, appSecret);

  const response = await fetch(DROPSHIP_ENDPOINT, {
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
      errorResponse.sub_msg || errorResponse.msg || "AliExpress Dropship search failed.",
    );
  }

  return payload;
}

function parseDataUrl(input: string): { mediaType: string; data: string } | null {
  const match = input.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/i);
  if (!match) return null;
  return { mediaType: match[1].toLowerCase(), data: match[2] };
}

async function prepareImageBase64(input: {
  imageDataUrl?: string;
  imageBase64?: string;
}): Promise<string> {
  let buffer: Buffer;

  if (input.imageDataUrl?.trim()) {
    const parsed = parseDataUrl(input.imageDataUrl.trim());
    if (!parsed) {
      throw new Error("Invalid image upload. Please use a JPG, PNG, or WebP photo.");
    }
    buffer = Buffer.from(parsed.data, "base64");
  } else if (input.imageBase64?.trim()) {
    buffer = Buffer.from(input.imageBase64.trim(), "base64");
  } else {
    throw new Error("Please upload a product photo.");
  }

  if (buffer.length === 0) {
    throw new Error("Could not read the uploaded photo.");
  }

  let output = await sharp(buffer)
    .rotate()
    .resize(900, 900, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  if (output.length > MAX_IMAGE_BYTES) {
    output = await sharp(buffer)
      .rotate()
      .resize(640, 640, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();
  }

  if (output.length > MAX_IMAGE_BYTES) {
    output = await sharp(buffer)
      .rotate()
      .resize(480, 480, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 65 })
      .toBuffer();
  }

  if (output.length === 0) {
    throw new Error("Could not prepare the uploaded photo for search.");
  }

  return output.toString("base64");
}

function collectProductRecords(payload: unknown): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  function hasProductId(obj: Record<string, unknown>): string | null {
    const id = obj.product_id ?? obj.productId ?? obj.item_id ?? obj.itemId;
    if (id == null) return null;
    const normalized = String(id).trim();
    return normalized || null;
  }

  function walk(node: unknown) {
    if (!node || typeof node !== "object") return;

    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }

    const obj = node as Record<string, unknown>;
    const productId = hasProductId(obj);
    if (productId) {
      if (!seen.has(productId)) {
        seen.add(productId);
        results.push(obj);
      }
      return;
    }

    for (const value of Object.values(obj)) {
      walk(value);
    }
  }

  walk(payload);
  return results;
}

function firstImageUrl(raw: Record<string, unknown>): string | null {
  const direct =
    raw.product_main_image_url ??
    raw.item_main_image_url ??
    raw.image_url ??
    raw.main_image_url ??
    raw.product_image;

  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const smallImages = raw.product_small_image_urls as
    | { string?: string[] }
    | string[]
    | string
    | undefined;

  if (Array.isArray(smallImages) && smallImages[0]) return String(smallImages[0]);
  if (typeof smallImages === "string" && smallImages.trim()) {
    return smallImages.split(";")[0]?.trim() ?? null;
  }
  if (smallImages && typeof smallImages === "object" && !Array.isArray(smallImages)) {
    const nested = (smallImages as { string?: string[] }).string;
    if (nested?.[0]) return nested[0];
  }

  return null;
}

function normalizeDropshipProduct(
  raw: Record<string, unknown>,
  fallbackCurrency: string,
): SupplierProduct | null {
  const productId = String(
    raw.product_id ?? raw.productId ?? raw.item_id ?? raw.itemId ?? "",
  ).trim();
  const title = String(
    raw.product_title ?? raw.title ?? raw.subject ?? raw.product_name ?? "",
  ).trim();

  const price =
    parseNumber(raw.target_sale_price) ??
    parseNumber(raw.target_app_sale_price) ??
    parseNumber(raw.app_sale_price) ??
    parseNumber(raw.sale_price) ??
    parseNumber(raw.price) ??
    parseNumber(raw.original_price) ??
    0;

  if (!productId || !title) return null;

  const currency =
    typeof raw.target_sale_price_currency === "string"
      ? raw.target_sale_price_currency
      : typeof raw.sale_price_currency === "string"
        ? raw.sale_price_currency
        : typeof raw.currency === "string"
          ? raw.currency
          : fallbackCurrency;

  const productUrl =
    typeof raw.product_detail_url === "string"
      ? raw.product_detail_url.trim()
      : typeof raw.detail_url === "string"
        ? raw.detail_url.trim()
        : `https://www.aliexpress.com/item/${productId}.html`;

  return {
    productId,
    title,
    imageUrl: firstImageUrl(raw),
    productUrl,
    price,
    currency,
    originalPrice: parseNumber(raw.target_original_price ?? raw.original_price),
    commissionRate: null,
    orders: parseNumber(raw.lastest_volume ?? raw.orders ?? raw.order_count),
    rating: raw.evaluate_rate != null ? String(raw.evaluate_rate) : null,
    discount: raw.discount != null ? String(raw.discount) : null,
    deliveryDays: raw.ship_to_days != null ? String(raw.ship_to_days) : null,
    shopUrl: typeof raw.shop_url === "string" ? raw.shop_url.trim() : null,
  };
}

function parseSearchPayload(
  payload: Record<string, unknown>,
  page: number,
  pageSize: number,
  currency: string,
): DropshipSearchResult {
  const records = collectProductRecords(payload);
  const products = records
    .map((record) => normalizeDropshipProduct(record, currency))
    .filter((product): product is SupplierProduct => product !== null);

  const totalFromPayload = findTotalCount(payload);
  const total = totalFromPayload ?? products.length;
  const hasMore = page * pageSize < total || products.length >= pageSize;

  return {
    products,
    total,
    page,
    pageSize,
    hasMore,
  };
}

function findTotalCount(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;

  const stack: unknown[] = [payload];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;

    if (Array.isArray(node)) {
      stack.push(...node);
      continue;
    }

    const obj = node as Record<string, unknown>;
    for (const key of [
      "total_record_count",
      "total_count",
      "totalCount",
      "total",
      "record_count",
    ]) {
      const parsed = parseNumber(obj[key]);
      if (parsed != null && parsed > 0) return parsed;
    }

    stack.push(...Object.values(obj));
  }

  return null;
}

function emptyResult(page: number, pageSize: number): DropshipSearchResult {
  return { products: [], total: 0, page, pageSize, hasMore: false };
}

/**
 * Full-catalog keyword/title search via Dropship API (aliexpress.ds.text.search).
 */
export async function searchDropshipProducts(
  options: DropshipSearchOptions,
): Promise<DropshipSearchResult> {
  const keywords = options.keywords.trim().replace(/\s+/g, " ");
  if (keywords.length < 2) {
    throw new Error("Search keywords must be at least 2 characters.");
  }

  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 20));
  const region = resolveRegion(options.stockRegion);

  const payload = await callDropshipApi("aliexpress.ds.text.search", {
    key_word: keywords,
    local: "en",
    countryCode: region.countryCode,
    currency: region.currency,
    pageSize: String(pageSize),
    pageIndex: String(page),
    sortType: "orders",
  });

  return parseSearchPayload(payload, page, pageSize, region.currency);
}

/**
 * Visual product search via Dropship image APIs — matches the uploaded photo,
 * same as AliExpress “search by image”, not keyword guessing.
 */
export async function searchDropshipProductsByImage(
  options: DropshipImageSearchOptions,
): Promise<DropshipSearchResult> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 20));
  const region = resolveRegion(options.stockRegion);
  const imageBase64 = await prepareImageBase64(options);

  const attempts: Array<{ method: string; params: Record<string, string> }> = [
    {
      method: "aliexpress.ds.image.searchV2",
      params: {
        image_base64: imageBase64,
        sort_type: "default",
        ship_to: region.shipTo,
        currency: region.currency,
        locale: "en",
        page_size: String(pageSize),
        page_index: String(page),
      },
    },
    {
      method: "aliexpress.ds.image.searchV2",
      params: {
        image_base64: imageBase64,
        sort_type: "default",
        ship_to: region.shipTo,
        currency: region.currency,
        locale: "en",
      },
    },
    {
      method: "aliexpress.ds.image.search",
      params: {
        image_file_bytes: imageBase64,
        shpt_to: region.shipTo,
        target_currency: region.currency,
        target_language: "EN",
        product_cnt: String(Math.min(pageSize, 50)),
        sort: "LAST_VOLUME_DESC",
      },
    },
  ];

  for (const attempt of attempts) {
    try {
      const payload = await callDropshipApi(attempt.method, attempt.params);
      const parsed = parseSearchPayload(payload, page, pageSize, region.currency);
      if (parsed.products.length > 0) return parsed;
    } catch {
      // Try the next image-search variant.
    }
  }

  return emptyResult(page, pageSize);
}
