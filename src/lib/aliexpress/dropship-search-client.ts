import "server-only";

import crypto from "crypto";
import sharp from "sharp";
import { serverEnv } from "@/lib/env";
import { getAliExpressAccessToken } from "@/lib/aliexpress/oauth";
import type { SupplierProduct, SupplierStockRegion } from "@/types/supplier-finder";

const DROPSHIP_ENDPOINT = "https://api-sg.aliexpress.com/sync";
const MAX_IMAGE_BYTES = 95 * 1024;
const IMAGE_SEARCH_MAX_PRODUCTS = 150;

export interface DropshipSearchOptions {
  keywords: string;
  stockRegion: SupplierStockRegion;
  page?: number;
  pageSize?: number;
  minPrice?: number | null;
  maxPrice?: number | null;
}

export interface DropshipImageSearchOptions {
  imageDataUrl?: string;
  imageBase64?: string;
  stockRegion: SupplierStockRegion;
  page?: number;
  pageSize?: number;
  minPrice?: number | null;
  maxPrice?: number | null;
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

function parseVolume(value: unknown): number | null {
  if (value == null) return null;
  const raw = String(value).trim().toLowerCase();
  if (!raw) return null;

  const kMatch = raw.match(/^([\d,.]+)\s*k\+?$/);
  if (kMatch) {
    const parsed = Number(kMatch[1].replace(/,/g, ""));
    return Number.isFinite(parsed) ? Math.round(parsed * 1000) : null;
  }

  return parseNumber(raw);
}

function normalizeRating(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (raw.includes("%")) return raw;
  const parsed = parseNumber(raw);
  if (parsed == null) return null;
  if (parsed <= 5) return `${parsed.toFixed(1)}★`;
  return `${parsed}%`;
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

function filterByPriceRange(
  products: SupplierProduct[],
  minPrice?: number | null,
  maxPrice?: number | null,
): SupplierProduct[] {
  const hasMin = minPrice != null && Number.isFinite(minPrice);
  const hasMax = maxPrice != null && Number.isFinite(maxPrice);
  if (!hasMin && !hasMax) return products;

  return products.filter((product) => {
    if (!Number.isFinite(product.price)) return false;
    if (hasMin && product.price < minPrice!) return false;
    if (hasMax && product.price > maxPrice!) return false;
    return true;
  });
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
    v: "2.0",
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

async function prepareImageBuffer(input: {
  imageDataUrl?: string;
  imageBase64?: string;
}): Promise<Buffer> {
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

  return output;
}

async function callDropshipImageSearch(
  imageBuffer: Buffer,
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
    method: "aliexpress.ds.image.search",
    sign_method: "sha256",
    timestamp: String(Date.now()),
    format: "json",
    v: "2.0",
    session: accessToken,
    ...businessParams,
  };
  params.sign = signHmacSha256Params(params, appSecret);

  const form = new FormData();
  for (const [key, value] of Object.entries(params)) {
    form.append(key, value);
  }
  form.append(
    "image_file_bytes",
    new Blob([new Uint8Array(imageBuffer)], { type: "image/jpeg" }),
    "search.jpg",
  );

  const response = await fetch(DROPSHIP_ENDPOINT, {
    method: "POST",
    body: form,
    cache: "no-store",
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (payload.error_response) {
    const errorResponse = payload.error_response as { msg?: string; sub_msg?: string };
    throw new Error(
      errorResponse.sub_msg || errorResponse.msg || "AliExpress image search failed.",
    );
  }

  return payload;
}

function normalizeImageUrl(url: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
}

function extractSearchProducts(payload: Record<string, unknown>): Record<string, unknown>[] {
  if (payload.data && typeof payload.data === "object") {
    const data = payload.data as Record<string, unknown>;
    if (Array.isArray(data.products)) {
      return data.products as Record<string, unknown>[];
    }
  }

  const imageRoot =
    payload.aliexpress_ds_image_search_response ??
    payload.aliexpress_ds_image_searchV2_response;
  if (imageRoot && typeof imageRoot === "object") {
    const data = (imageRoot as Record<string, unknown>).data as Record<string, unknown> | undefined;
    const productsWrap = data?.products;
    if (productsWrap && typeof productsWrap === "object") {
      const wrap = productsWrap as Record<string, unknown>;
      const dto =
        wrap.traffic_image_product_d_t_o ??
        wrap.traffic_image_product_dto ??
        wrap.product;
      if (Array.isArray(dto)) return dto as Record<string, unknown>[];
      if (dto && typeof dto === "object") return [dto as Record<string, unknown>];
    }
  }

  return collectProductRecords(payload);
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
    raw.itemMainPic ??
    raw.image_url ??
    raw.main_image_url ??
    raw.product_image;

  if (typeof direct === "string" && direct.trim()) {
    return normalizeImageUrl(direct.trim());
  }

  const smallImages = raw.product_small_image_urls as
    | { string?: string[] }
    | string[]
    | string
    | undefined;

  if (Array.isArray(smallImages) && smallImages[0]) {
    return normalizeImageUrl(String(smallImages[0]));
  }
  if (typeof smallImages === "string" && smallImages.trim()) {
    return normalizeImageUrl(smallImages.split(";")[0]?.trim() ?? null);
  }
  if (smallImages && typeof smallImages === "object" && !Array.isArray(smallImages)) {
    const nested = (smallImages as { string?: string[] }).string;
    if (nested?.[0]) return normalizeImageUrl(nested[0]);
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

  const productUrl = normalizeImageUrl(
    typeof raw.product_detail_url === "string"
      ? raw.product_detail_url.trim()
      : typeof raw.detail_url === "string"
        ? raw.detail_url.trim()
        : typeof raw.itemUrl === "string"
          ? raw.itemUrl.trim()
          : `https://www.aliexpress.com/item/${productId}.html`,
  );

  return {
    productId,
    title,
    imageUrl: firstImageUrl(raw),
    productUrl: productUrl ?? `https://www.aliexpress.com/item/${productId}.html`,
    price,
    currency,
    originalPrice: parseNumber(raw.target_original_price ?? raw.original_price),
    commissionRate: null,
    orders: parseVolume(
      raw.lastest_volume ??
        raw.latest_volume ??
        raw.sales_count ??
        raw.orders ??
        raw.order_count ??
        raw.trade_count,
    ),
    rating: normalizeRating(
      raw.evaluate_rate ?? raw.evaluateRate ?? raw.avg_evaluation_rating ?? raw.product_score,
    ),
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
  const records = extractSearchProducts(payload);
  const products = records
    .map((record) => normalizeDropshipProduct(record, currency))
    .filter((product): product is SupplierProduct => product !== null);

  const totalFromPayload =
    findTotalCount(payload) ??
    (payload.data && typeof payload.data === "object"
      ? parseNumber((payload.data as Record<string, unknown>).totalCount)
      : null);
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
      "totalCount",
      "total_count",
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

function extractProductGetResult(payload: Record<string, unknown>): Record<string, unknown> | null {
  if (payload.result && typeof payload.result === "object") {
    return payload.result as Record<string, unknown>;
  }

  const nested = payload.aliexpress_ds_product_get_response as Record<string, unknown> | undefined;
  if (nested?.result && typeof nested.result === "object") {
    return nested.result as Record<string, unknown>;
  }

  return null;
}

async function enrichProductMetrics(
  products: SupplierProduct[],
  region: ReturnType<typeof resolveRegion>,
): Promise<SupplierProduct[]> {
  const targets = products
    .filter((product) => product.orders == null && !product.rating)
    .slice(0, 20);
  if (targets.length === 0) return products;

  const patches = new Map<string, Pick<SupplierProduct, "orders" | "rating" | "shopUrl">>();

  await Promise.all(
    targets.map(async (product) => {
      try {
        const payload = await callDropshipApi("aliexpress.ds.product.get", {
          product_id: product.productId,
          ship_to_country: region.countryCode,
          target_currency: region.currency,
          target_language: "EN",
        });

        const result = extractProductGetResult(payload);
        if (!result) return;

        const base = result.ae_item_base_info_dto as Record<string, unknown> | undefined;
        const store = result.ae_store_info as Record<string, unknown> | undefined;

        patches.set(product.productId, {
          orders: parseVolume(base?.sales_count ?? base?.lastest_volume) ?? product.orders,
          rating:
            normalizeRating(base?.avg_evaluation_rating ?? base?.evaluate_rate) ?? product.rating,
          shopUrl:
            typeof store?.store_url === "string" ? store.store_url.trim() : product.shopUrl,
        });
      } catch {
        // Keep the image-search row when detail lookup fails.
      }
    }),
  );

  if (patches.size === 0) return products;

  return products.map((product) => {
    const patch = patches.get(product.productId);
    return patch ? { ...product, ...patch } : product;
  });
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

  const parsed = parseSearchPayload(payload, page, pageSize, region.currency);
  const hasPriceFilter =
    (options.minPrice != null && Number.isFinite(options.minPrice)) ||
    (options.maxPrice != null && Number.isFinite(options.maxPrice));

  if (!hasPriceFilter) {
    return parsed;
  }

  const filtered = filterByPriceRange(parsed.products, options.minPrice, options.maxPrice);

  return {
    products: filtered,
    total: filtered.length,
    page: parsed.page,
    pageSize: parsed.pageSize,
    hasMore: parsed.hasMore,
  };
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
  const imageBuffer = await prepareImageBuffer(options);

  // Request max products in one call (API has no page_index). Omit sort so results
  // stay in visual-match order and include evaluate_rate / lastest_volume.
  const payload = await callDropshipImageSearch(imageBuffer, {
    target_language: "EN",
    target_currency: region.currency,
    product_cnt: String(IMAGE_SEARCH_MAX_PRODUCTS),
    shpt_to: region.shipTo,
  });

  const fullResult = parseSearchPayload(
    payload,
    1,
    IMAGE_SEARCH_MAX_PRODUCTS,
    region.currency,
  );
  const filtered = filterByPriceRange(
    fullResult.products,
    options.minPrice,
    options.maxPrice,
  );
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const sliced = filtered.slice(start, start + pageSize);
  const products = await enrichProductMetrics(sliced, region);

  return {
    products,
    total,
    page,
    pageSize,
    hasMore: start + pageSize < filtered.length,
  };
}
