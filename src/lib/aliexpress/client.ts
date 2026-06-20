import "server-only";

import crypto from "crypto";
import { serverEnv } from "@/lib/env";
import { getAliExpressAccessToken } from "@/lib/aliexpress/oauth";
import type { HandlingProductData, HandlingProductVariant } from "@/types/handling";

const MTOP_APP_KEY = "12574478";
const MTOP_HOST = "https://acs.aliexpress.com";
const AFFILIATE_ENDPOINT = "https://api-sg.aliexpress.com/sync";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-GB,en;q=0.9",
};

function md5(value: string): string {
  return crypto.createHash("md5").update(value, "utf8").digest("hex");
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

function signHmacSha256Params(params: Record<string, string>, secret: string): string {
  const sorted = Object.keys(params)
    .filter((key) => key !== "sign")
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join("");

  // AliExpress DS endpoint accepts raw sorted key/value payload without method prefix.
  return crypto.createHmac("sha256", secret).update(sorted, "utf8").digest("hex").toUpperCase();
}

function getHmacSha256StringToSign(params: Record<string, string>): string {
  const sorted = Object.keys(params)
    .filter((key) => key !== "sign")
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join("");

  return sorted;
}

function parseNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMultimediaImages(multimedia: Record<string, unknown> | undefined): string[] {
  if (!multimedia) return [];

  const imageUrls = multimedia.image_urls as
    | { string?: string[] }
    | string[]
    | string
    | undefined;

  if (Array.isArray(imageUrls)) {
    return imageUrls.map((url) => String(url).trim()).filter(Boolean);
  }

  if (typeof imageUrls === "string") {
    return imageUrls
      .split(";")
      .map((url) => url.trim())
      .filter(Boolean);
  }

  if (imageUrls?.string) {
    return imageUrls.string.map((url) => String(url).trim()).filter(Boolean);
  }

  return [];
}

function extractSkuImage(properties: Array<Record<string, unknown>> | undefined): string | null {
  if (!properties?.length) return null;
  for (const prop of properties) {
    const image =
      prop.sku_image ??
      prop.skuImage ??
      prop.property_value_definition_image ??
      prop.image_url;
    if (typeof image === "string" && image.trim()) return image.trim();
  }
  return null;
}

function parseCookies(setCookieHeaders: string[]): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const header of setCookieHeaders) {
    const part = header.split(";")[0];
    const eq = part.indexOf("=");
    if (eq > 0) cookies[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return cookies;
}

function cookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

export function extractAliExpressProductId(url: string): string | null {
  const patterns = [
    /\/item\/(\d+)\.html/i,
    /\/item\/(\d+)/i,
    /productId[=:](\d+)/i,
    /(\d{12,20})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

function isAliExpressUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return (
      hostname.includes("aliexpress.") ||
      hostname.includes("aliexpress") ||
      hostname.includes("s.click.aliexpress")
    );
  } catch {
    return false;
  }
}

async function resolveAliExpressUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url.trim(), {
      method: "GET",
      headers: BROWSER_HEADERS,
      redirect: "follow",
      cache: "no-store",
    });

    return response.url || url;
  } catch {
    return url;
  }
}

async function bootstrapMtopCookies(): Promise<Record<string, string>> {
  const bootstrapUrl =
    `${MTOP_HOST}/h5/mtop.aliexpress.pdp.pc.query/1.0/?` +
    new URLSearchParams({
      jsv: "2.5.1",
      appKey: MTOP_APP_KEY,
      t: String(Date.now()),
      sign: "abc123",
      api: "mtop.aliexpress.pdp.pc.query",
      v: "1.0",
      type: "originaljsonp",
      dataType: "originaljsonp",
      callback: "mtopjsonp1",
      data: "{}",
    }).toString();

  const response = await fetch(bootstrapUrl, {
    headers: {
      ...BROWSER_HEADERS,
      Referer: "https://www.aliexpress.com/",
    },
    cache: "no-store",
  });

  return parseCookies(response.headers.getSetCookie?.() ?? []);
}

interface MtopSkuPriceEntry {
  originalPrice?: { value?: number; currency?: string; formatedAmount?: string };
  salePriceString?: string;
  salePriceLocal?: string;
  taxIncludedPrice?: { value?: number } | number | string;
  taxIncludedAmount?: { value?: number };
  skuAmount?: { value?: number } | number | string;
  skuActivityAmount?: { value?: number } | number | string;
  isActivity?: boolean;
}

interface MtopQuantityView {
  maxBuyCount?: number;
  maxBuyCountStr?: string;
}

interface MtopModuleMap {
  GLOBAL_DATA?: {
    globalData?: {
      errorCode?: string;
    };
  };
  PRODUCT_TITLE?: {
    text?: string;
  };
  HEADER_IMAGE_PC?: {
    imagePathList?: string[];
    mainImages?: Array<{ imageUrl?: string }>;
  };
  PRICE?: {
    selectedSkuId?: number | string;
    targetSkuPriceInfo?: MtopSkuPriceEntry;
    skuPriceInfoMap?: Record<string, MtopSkuPriceEntry>;
    skuSecondPriceInfoMap?: Record<string, MtopSkuPriceEntry>;
  };
  PRICE_EXTEND?: Record<string, unknown>;
  PRICE_BANNER?: Record<string, unknown>;
  PC_RATING?: {
    rating?: string;
    otherText?: string;
    totalValidNum?: number;
  };
  QUANTITY_PC?: {
    totalAvailableInventory?: number;
    currentSkuQuantityView?: MtopQuantityView;
    allSkuQuantityView?: Record<string, MtopQuantityView>;
  };
  BOTTOM_BAR_PC?: Record<string, unknown>;
  SKU?: Record<string, unknown>;
}

interface PriceHint {
  price: number;
  currency: string;
  original?: number;
}

function extractPriceHintFromUrl(url: string): PriceHint | null {
  try {
    const npi = new URL(url).searchParams.get("pdp_npi");
    if (!npi) return null;

    const parts = decodeURIComponent(npi).split("!");
    const currencyIndex = parts.findIndex((part) => /^[A-Z]{3}$/.test(part));
    if (currencyIndex < 0 || currencyIndex + 2 >= parts.length) return null;

    const currency = parts[currencyIndex];
    const original = parseNumber(parts[currencyIndex + 1]);
    const sale = parseNumber(parts[currencyIndex + 2]);
    if (sale == null) return null;

    return { price: sale, currency, original: original ?? undefined };
  } catch {
    return null;
  }
}

function extractOrderHintFromUrl(url: string): number | null {
  try {
    const raw = new URL(url).searchParams.get("pdp_ext_f");
    if (!raw) return null;

    const payload = JSON.parse(decodeURIComponent(raw)) as {
      order?: string | number;
    };
    return parseNumber(payload.order);
  } catch {
    return null;
  }
}

function parseSoldCountDisplay(value: string | null | undefined): number | null {
  if (!value) return null;

  const normalized = value.trim();
  if (!normalized) return null;

  const soldMatch = normalized.match(/^([\d,]+)\s*sold\b/i);
  if (soldMatch) return parseNumber(soldMatch[1]);

  const plusMatch = normalized.match(/^([\d,]+)\+/);
  if (plusMatch) return parseNumber(plusMatch[1]);

  return parseNumber(normalized);
}

function formatSoldOrders(count: number): string {
  return `${count.toLocaleString("en-US")} sold`;
}

function resolveSoldOrdersDisplay(
  orders: string | null,
  sourceUrls: string[],
): string | null {
  const candidates: number[] = [];

  const fromOrders = parseSoldCountDisplay(orders);
  if (fromOrders != null) candidates.push(fromOrders);

  for (const sourceUrl of sourceUrls) {
    const orderHint = extractOrderHintFromUrl(sourceUrl);
    if (orderHint != null) candidates.push(orderHint);
  }

  if (candidates.length === 0) return orders;

  return formatSoldOrders(Math.max(...candidates));
}

function collectSkuSaleCandidates(entry: MtopSkuPriceEntry): number[] {
  const original = parseNestedPrice(entry.originalPrice);
  const raw = [
    parseSalePriceLocal(entry.salePriceLocal),
    parseNumber(entry.salePriceString),
    parseNestedPrice(entry.taxIncludedPrice),
    parseNestedPrice(entry.taxIncludedAmount),
  ].filter((price): price is number => price != null && price > 0);

  if (original != null && original > 0) {
    return raw.filter((price) => price < original * 0.99);
  }

  return raw;
}

function pickDisplayPriceFromCandidates(candidates: number[]): number {
  const unique = [...new Set(candidates)].sort((a, b) => b - a);
  if (unique.length === 0) return 0;
  if (unique.length === 1) return unique[0];

  const highest = unique[0];
  const secondHighest = unique[1];

  // Drop deep personal-coupon outliers (e.g. £0.99 when shelf price is £2.07).
  if (highest >= secondHighest * 1.4) {
    const plausible = unique.filter((price) => price >= highest * 0.45);
    return Math.max(...plausible);
  }

  return highest;
}

function parseNestedPrice(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "object" && value !== null && "value" in value) {
    return parseNumber((value as { value?: unknown }).value);
  }
  return parseNumber(value);
}

function parseSalePriceLocal(value?: string): number | null {
  if (!value) return null;

  const leading = value.split("|")[0];
  const fromLeading = parseNumber(leading);
  if (fromLeading != null) return fromLeading;

  const parts = value.split("|");
  if (parts.length >= 3) {
    const whole = parseNumber(parts[1]);
    const fraction = parts[2];
    if (whole != null && fraction) {
      return parseNumber(`${whole}.${fraction.padStart(2, "0")}`);
    }
  }

  return null;
}

function parseSkuPriceEntry(entry: MtopSkuPriceEntry): { price: number; currency: string } | null {
  const currency = entry.originalPrice?.currency ?? "GBP";
  const candidates = collectSkuSaleCandidates(entry);

  if (candidates.length > 0) {
    return { price: pickDisplayPriceFromCandidates(candidates), currency };
  }

  const fallback =
    parseNestedPrice(entry.skuAmount) ?? parseNestedPrice(entry.originalPrice);

  if (fallback == null) return null;
  return { price: fallback, currency };
}

function extractBottomBarPrice(
  bottomBar?: Record<string, unknown>,
): { price: number; currency: string } | null {
  if (!bottomBar) return null;

  const preferredKeys = [
    "salePriceString",
    "priceString",
    "formattedPrice",
    "displayPrice",
    "price",
    "salePrice",
  ];

  for (const key of preferredKeys) {
    const value = bottomBar[key];
    const parsed =
      typeof value === "string" ? parseNumber(value) : parseNestedPrice(value);
    if (parsed != null) return { price: parsed, currency: "GBP" };
  }

  return null;
}

function parseLimitFromNote(note?: string): number | null {
  if (!note) return null;

  const maxPerShopper = note.match(/Max\.?\s*(\d+)\s*pcs/i);
  if (maxPerShopper) return Number(maxPerShopper[1]);

  const onlyLeft = note.match(/Only\s+(\d+)\s+left/i);
  if (onlyLeft) return Number(onlyLeft[1]);

  return null;
}

function findPriceInObject(value: unknown, depth = 0): number | null {
  if (depth > 6 || value == null) return null;

  if (typeof value === "string") {
    const parsed = parseNumber(value);
    if (parsed != null && parsed > 0 && parsed < 100000 && /£|\$|€|GBP|USD|EUR/.test(value)) {
      return parsed;
    }
    return null;
  }

  if (typeof value === "number" && value > 0 && value < 100000) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findPriceInObject(item, depth + 1);
      if (found != null) return found;
    }
    return null;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const preferredKeys = [
      "salePriceString",
      "formatedPrice",
      "formattedPrice",
      "displayPrice",
      "activityPrice",
      "price",
      "value",
    ];

    for (const key of preferredKeys) {
      if (key in record) {
        const found = findPriceInObject(record[key], depth + 1);
        if (found != null) return found;
      }
    }
  }

  return null;
}

function resolveSelectedSkuPrices(modules: MtopModuleMap): {
  primary: MtopSkuPriceEntry | null;
  second: MtopSkuPriceEntry | null;
} {
  const selectedSkuId = modules.PRICE?.selectedSkuId;
  const skuIdKey = selectedSkuId != null ? String(selectedSkuId) : null;

  const primary =
    (skuIdKey ? modules.PRICE?.skuPriceInfoMap?.[skuIdKey] : null) ??
    modules.PRICE?.targetSkuPriceInfo ??
    null;

  const second = skuIdKey ? (modules.PRICE?.skuSecondPriceInfoMap?.[skuIdKey] ?? null) : null;

  return { primary, second };
}

function extractDisplayPrice(
  modules: MtopModuleMap,
  sourceUrl: string,
): { price: number; currency: string } | null {
  const urlHint = extractPriceHintFromUrl(sourceUrl);

  const candidates: number[] = [];

  const bottomBarPrice = extractBottomBarPrice(modules.BOTTOM_BAR_PC);
  if (bottomBarPrice) candidates.push(bottomBarPrice.price);

  const { primary, second } = resolveSelectedSkuPrices(modules);
  const selectedId = modules.PRICE?.selectedSkuId;
  const selectedKey = selectedId != null ? String(selectedId) : null;

  for (const entry of [
    primary,
    second,
    modules.PRICE?.targetSkuPriceInfo,
    selectedKey ? modules.PRICE?.skuPriceInfoMap?.[selectedKey] : null,
    selectedKey ? modules.PRICE?.skuSecondPriceInfoMap?.[selectedKey] : null,
  ]) {
    if (!entry) continue;
    candidates.push(...collectSkuSaleCandidates(entry));
  }

  const bannerPrice = findPriceInObject(modules.PRICE_BANNER);
  if (bannerPrice != null) candidates.push(bannerPrice);

  let currency = primary?.originalPrice?.currency ?? urlHint?.currency ?? "GBP";
  let price: number | null = candidates.length > 0 ? pickDisplayPriceFromCandidates(candidates) : null;

  if (urlHint) {
    if (price == null || price < urlHint.price * 0.75) {
      price = urlHint.price;
      currency = urlHint.currency;
    }
  }

  if (price == null) {
    const extendPrice = findPriceInObject(modules.PRICE_EXTEND);
    if (extendPrice != null) price = extendPrice;
  }

  if (price == null) return null;
  return { price, currency };
}

function extractPurchaseLimit(
  modules: MtopModuleMap,
  selectedSkuId?: number | string,
): { stock: number | null; stockNote: string | null } {
  const quantity = modules.QUANTITY_PC;

  const blobLimits: number[] = [];
  for (const blob of [JSON.stringify(quantity ?? {}), JSON.stringify(modules.SKU ?? {})]) {
    for (const match of blob.matchAll(/Max\.?\s*(\d+)\s*pcs/gi)) {
      blobLimits.push(Number(match[1]));
    }
  }

  if (blobLimits.length > 0) {
    const max = Math.max(...blobLimits);
    return { stock: max, stockNote: `Max. ${max} pcs/shopper` };
  }

  if (!quantity) return { stock: null, stockNote: null };

  const skuIdKey = selectedSkuId != null ? String(selectedSkuId) : null;
  const views: MtopQuantityView[] = [];

  if (quantity.currentSkuQuantityView) {
    views.push(quantity.currentSkuQuantityView);
  }

  if (skuIdKey && quantity.allSkuQuantityView?.[skuIdKey]) {
    views.push(quantity.allSkuQuantityView[skuIdKey]);
  }

  if (quantity.allSkuQuantityView) {
    for (const view of Object.values(quantity.allSkuQuantityView)) {
      if (!views.includes(view)) views.push(view);
    }
  }

  const notes = views
    .map((view) => view.maxBuyCountStr)
    .filter((note): note is string => Boolean(note));

  const perShopperLimits = notes
    .map((note) => parseLimitFromNote(note))
    .filter((limit): limit is number => limit != null);

  if (perShopperLimits.length > 0) {
    return {
      stock: Math.max(...perShopperLimits),
      stockNote: notes.find((note) => /Max\.?\s*\d+\s*pcs/i.test(note)) ?? notes[0] ?? null,
    };
  }

  const buyCounts = views
    .map((view) => view.maxBuyCount)
    .filter((count): count is number => count != null && count > 0);

  if (buyCounts.length > 0) {
    return {
      stock: Math.max(...buyCounts),
      stockNote: notes[0] ?? null,
    };
  }

  return { stock: null, stockNote: notes[0] ?? null };
}

async function callMtopProductDetail(
  productId: string,
  cookies: Record<string, string>,
): Promise<MtopModuleMap | null> {
  const token = (cookies._m_h5_tk ?? "").split("_")[0];
  if (!token) return null;

  const data = JSON.stringify({
    productId: String(productId),
    _lang: "en_GB",
    _currency: "GBP",
    country: "GB",
    province: "",
    city: "",
    clientType: "pc",
    ext: JSON.stringify({ foreverRandomToken: md5(String(Date.now())) }),
  });

  const timestamp = Date.now();
  const sign = md5(`${token}&${timestamp}&${MTOP_APP_KEY}&${data}`);

  const url =
    `${MTOP_HOST}/h5/mtop.aliexpress.pdp.pc.query/1.0/?` +
    new URLSearchParams({
      jsv: "2.5.1",
      appKey: MTOP_APP_KEY,
      t: String(timestamp),
      sign,
      api: "mtop.aliexpress.pdp.pc.query",
      v: "1.0",
      type: "originaljsonp",
      dataType: "originaljsonp",
      callback: "mtopjsonp1",
      data,
    }).toString();

  const response = await fetch(url, {
    headers: {
      ...BROWSER_HEADERS,
      Referer: `https://www.aliexpress.com/item/${productId}.html`,
      Cookie: cookieHeader(cookies),
    },
    cache: "no-store",
  });

  const text = await response.text();
  const jsonMatch = text.match(/mtopjsonp1\(([\s\S]*)\)/);
  if (!jsonMatch) return null;

  const payload = JSON.parse(jsonMatch[1]) as {
    ret?: string[];
    data?: { result?: MtopModuleMap } & MtopModuleMap;
  };

  if (!payload.ret?.some((entry) => entry.startsWith("SUCCESS"))) {
    return null;
  }

  return payload.data?.result ?? payload.data ?? null;
}

function parseMtopProduct(
  modules: MtopModuleMap,
  productId: string,
  productUrl: string,
  sourceUrl: string,
): HandlingProductData | null {
  const errorCode = modules.GLOBAL_DATA?.globalData?.errorCode;
  if (errorCode === "SITEM_NOT_EXIST") {
    throw new Error("This AliExpress product was not found or is no longer available.");
  }

  const title = modules.PRODUCT_TITLE?.text?.trim();
  if (!title) return null;

  const priceResult = extractDisplayPrice(modules, sourceUrl);
  if (!priceResult) return null;

  const { price, currency } = priceResult;
  const imageUrl =
    modules.HEADER_IMAGE_PC?.mainImages?.[0]?.imageUrl ??
    modules.HEADER_IMAGE_PC?.imagePathList?.[0] ??
    null;

  const images = [
    ...(modules.HEADER_IMAGE_PC?.mainImages
      ?.map((entry) => entry.imageUrl?.trim())
      .filter((url): url is string => Boolean(url)) ?? []),
    ...(modules.HEADER_IMAGE_PC?.imagePathList?.filter(Boolean) ?? []),
  ].filter((url, index, list) => list.indexOf(url) === index);

  const resolvedImages = images.length > 0 ? images : imageUrl ? [imageUrl] : [];

  const { stock } = extractPurchaseLimit(modules, modules.PRICE?.selectedSkuId);
  const orders =
    modules.PC_RATING?.otherText ??
    (modules.PC_RATING?.totalValidNum != null
      ? `${modules.PC_RATING.totalValidNum} reviews`
      : null);
  const rating = parseNumber(modules.PC_RATING?.rating);

  return {
    source: "aliexpress",
    externalId: productId,
    productUrl,
    title,
    imageUrl,
    images: resolvedImages,
    price,
    currency,
    stock,
    orders,
    rating,
  };
}

async function fetchViaMtop(
  productId: string,
  productUrl: string,
  sourceUrl: string,
): Promise<HandlingProductData | null> {
  let cookies = await bootstrapMtopCookies();
  let modules = await callMtopProductDetail(productId, cookies);

  if (!modules) {
    cookies = await bootstrapMtopCookies();
    modules = await callMtopProductDetail(productId, cookies);
  }

  if (!modules) return null;

  return parseMtopProduct(modules, productId, productUrl, sourceUrl);
}

async function callOpenPlatformApi(
  method: string,
  businessParams: Record<string, string>,
  options: {
    signMethod: "md5" | "sha256";
    accessToken?: string;
  },
): Promise<Record<string, unknown> | null> {
  const appKey = serverEnv.aliexpressAppKey();
  const appSecret = serverEnv.aliexpressAppSecret();

  if (!appKey || !appSecret) return null;

  const params: Record<string, string> = {
    app_key: appKey,
    method,
    format: "json",
    ...businessParams,
  };

  if (options.signMethod === "md5") {
    params.sign_method = "md5";
    params.v = "2.0";
    params.timestamp = formatTimestamp();
    params.sign = signMd5Params(params, appSecret);
  } else {
    params.sign_method = "sha256";
    params.timestamp = String(Date.now());
    params.simplify = "true";
    if (options.accessToken) {
      params.session = options.accessToken;
    }
    const stringToSign = getHmacSha256StringToSign(params);
    params.sign = signHmacSha256Params(params, appSecret);

    if (method === "aliexpress.ds.product.get") {
      console.log("[AliExpress DS Live] stringToSign(no_method_prefix):", stringToSign);
      console.log("[AliExpress DS Live] signature:", params.sign);
      console.log("[AliExpress DS Live] sortedKeys:", Object.keys(params).filter((k) => k !== "sign").sort());
    }
  }

  try {
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
      console.log("[AliExpress Fetch Debug] OpenPlatform error", {
        method,
        signMethod: options.signMethod,
        hasAccessToken: Boolean(options.accessToken),
        error: payload.error_response,
      });
      return null;
    }

    return payload;
  } catch {
    console.log("[AliExpress Fetch Debug] OpenPlatform request failed", {
      method,
      signMethod: options.signMethod,
      hasAccessToken: Boolean(options.accessToken),
    });
    return null;
  }
}

function normalizeDsSkuList(raw: unknown): Array<Record<string, unknown>> {
  if (!raw || typeof raw !== "object") return [];

  const record = raw as Record<string, unknown>;
  const nested =
    record.ae_item_sku_info_d_t_o ??
    record.ae_item_sku_info_dto ??
    record.ae_item_sku_info_DTO;

  if (Array.isArray(nested)) return nested as Array<Record<string, unknown>>;
  if (nested && typeof nested === "object") return [nested as Record<string, unknown>];
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;

  return [];
}

function normalizeImageUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("data:")) return null;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return null;
}

function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const url of urls) {
    const normalized = normalizeImageUrl(url);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

export function extractImagesFromHtml(html: string): string[] {
  if (!html.trim()) return [];

  const urls: string[] = [];
  const imgTagPattern = /<img[^>]+>/gi;

  for (const tag of html.match(imgTagPattern) ?? []) {
    const srcMatch = tag.match(/\bsrc=["']([^"']+)["']/i);
    if (srcMatch?.[1]) urls.push(srcMatch[1]);

    const dataSrcMatch = tag.match(/\bdata-src=["']([^"']+)["']/i);
    if (dataSrcMatch?.[1]) urls.push(dataSrcMatch[1]);

    const srcsetMatch = tag.match(/\bsrcset=["']([^"']+)["']/i);
    if (srcsetMatch?.[1]) {
      const first = srcsetMatch[1].split(",")[0]?.trim().split(/\s+/)[0];
      if (first) urls.push(first);
    }
  }

  return dedupeUrls(urls);
}

function collectHtmlStrings(value: unknown, keyHint: string, output: string[]): void {
  if (typeof value === "string" && /<img/i.test(value) && /description|detail/i.test(keyHint)) {
    output.push(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectHtmlStrings(item, keyHint, output);
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      collectHtmlStrings(nested, key, output);
    }
  }
}

export function extractDescriptionImagesFromDsResult(result: Record<string, unknown>): string[] {
  const htmlChunks: string[] = [];
  const base = result.ae_item_base_info_dto as Record<string, unknown> | undefined;
  const descriptionDto = result.ae_item_description_dto as Record<string, unknown> | undefined;

  for (const source of [base, descriptionDto, result]) {
    if (!source) continue;
    for (const key of ["detail", "mobile_detail", "product_description", "description"]) {
      const value = source[key];
      if (typeof value === "string" && value.includes("<img")) {
        htmlChunks.push(value);
      }
    }
  }

  collectHtmlStrings(result, "", htmlChunks);

  return dedupeUrls(htmlChunks.flatMap((chunk) => extractImagesFromHtml(chunk)));
}

export async function fetchDescriptionHtmlFromPage(productUrl: string): Promise<string | null> {
  try {
    const response = await fetch(productUrl, {
      headers: BROWSER_HEADERS,
      cache: "no-store",
    });

    if (!response.ok) return null;

    const html = await response.text();
    const patterns = [
      /"description"\s*:\s*"((?:\\.|[^"\\])*)"/,
      /"productDesc"\s*:\s*"((?:\\.|[^"\\])*)"/,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (!match?.[1]) continue;

      const decoded = match[1]
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .replace(/\\u0026/g, "&");

      if (decoded.includes("<img") || decoded.length >= 20) {
        return decoded;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function excludeGalleryImages(descriptionImages: string[], galleryImages: string[]): string[] {
  const gallerySet = new Set(galleryImages.map((url) => normalizeImageUrl(url)).filter(Boolean));
  return descriptionImages.filter((url) => !gallerySet.has(url));
}

async function enrichDescriptionImages(product: HandlingProductData): Promise<HandlingProductData> {
  const gallery = product.images?.filter(Boolean) ?? (product.imageUrl ? [product.imageUrl] : []);
  let descriptionImages = excludeGalleryImages(product.descriptionImages ?? [], gallery);

  if (descriptionImages.length === 0) {
    const html = await fetchDescriptionHtmlFromPage(product.productUrl);
    if (html) {
      descriptionImages = excludeGalleryImages(extractImagesFromHtml(html), gallery);
    }
  }

  return {
    ...product,
    descriptionImages,
  };
}

function parseDsProductPayload(
  payload: Record<string, unknown>,
  productId: string,
): HandlingProductData | null {
  const response = payload.aliexpress_ds_product_get_response as
    | { result?: Record<string, unknown> }
    | undefined;
  const topLevelResult =
    (payload.result as Record<string, unknown> | undefined) ?? undefined;
  const result = response?.result ?? topLevelResult;
  if (!result) return null;

  const base = result.ae_item_base_info_dto as Record<string, unknown> | undefined;
  const title = base?.subject ? String(base.subject) : null;
  if (!title) return null;

  const skus = normalizeDsSkuList(result.ae_item_sku_info_dtos);
  const variants = skus
    .map((sku) => {
      const price = parseNumber(sku.offer_sale_price ?? sku.sku_price);
      if (price == null) return null;
      const stock = parseNumber(
        sku.sku_available_stock ?? sku.s_k_u_available_stock ?? sku.ipm_sku_stock,
      );

      const properties = sku.ae_sku_property_dtos as
        | Array<Record<string, unknown>>
        | undefined;
      const labelFromProp = properties?.[0]?.property_value_definition_name;
      const fallbackLabel = sku.sku_attr ?? sku.id ?? sku.sku_id ?? "Variant";
      const skuImage = extractSkuImage(properties);

      return {
        id: String(sku.sku_id ?? sku.id ?? fallbackLabel),
        label: String(labelFromProp ?? fallbackLabel),
        price,
        currency: String(sku.currency_code ?? base?.currency_code ?? "GBP"),
        stock,
        imageUrl: skuImage ?? null,
      } satisfies HandlingProductVariant;
    })
    .filter((value) => value !== null) as HandlingProductVariant[];

  const defaultVariant = variants[0];
  if (!defaultVariant) return null;

  const multimedia = result.ae_multimedia_info_dto as Record<string, unknown> | undefined;
  const parsedImages = parseMultimediaImages(multimedia);
  const imageUrl = parsedImages[0] ?? null;
  const descriptionImages = excludeGalleryImages(
    extractDescriptionImagesFromDsResult(result),
    parsedImages,
  );

  const soldCount = parseNumber(base?.sales_count);
  const ratingValue = parseNumber(base?.avg_evaluation_rating);

  console.log("[AliExpress Fetch Debug] Dropship parsed price", {
    source: "dropship",
    productId,
    selectedPrice: defaultVariant.price,
    selectedCurrency: defaultVariant.currency,
    selectedStock: defaultVariant.stock,
    selectedSkuId: defaultVariant.id,
    selectedSkuLabel: defaultVariant.label,
    variantsCount: variants.length,
    baseCurrencyCode: base?.currency_code ?? null,
  });

  return {
    source: "aliexpress",
    externalId: String(base?.product_id ?? productId),
    productUrl: `https://www.aliexpress.com/item/${productId}.html`,
    title,
    imageUrl: imageUrl ? String(imageUrl) : null,
    images: parsedImages,
    price: defaultVariant.price,
    currency: defaultVariant.currency,
    stock: defaultVariant.stock,
    orders:
      soldCount != null ? `${soldCount.toLocaleString()} sold` : base?.sales_count ? String(base.sales_count) : null,
    rating: ratingValue != null && ratingValue > 0 ? ratingValue : null,
    variants,
    selectedVariantId: defaultVariant.id,
    descriptionImages,
  };
}

async function callAffiliateProductApi(productId: string): Promise<HandlingProductData | null> {
  const payload = await callOpenPlatformApi(
    "aliexpress.affiliate.productdetail.get",
    {
      product_ids: productId,
      target_currency: "GBP",
      target_language: "EN",
    },
    { signMethod: "md5" },
  );

  if (!payload) return null;

  const affiliateResponse = payload.aliexpress_affiliate_productdetail_get_response as
    | {
        resp_result?: {
          result?: {
            products?: { product?: unknown[] } | unknown[];
          };
        };
      }
    | undefined;

  const products = affiliateResponse?.resp_result?.result?.products;
  const result = Array.isArray(products)
    ? products[0]
    : products?.product?.[0];

  if (!result || typeof result !== "object") return null;

  const item = result as Record<string, unknown>;
  const price = parseNumber(
    item.target_sale_price ??
      item.target_app_sale_price ??
      item.sale_price ??
      item.app_sale_price,
  );

  if (!item.product_title || price == null) return null;

  const imageUrls = item.product_small_image_urls as { string?: string[] } | undefined;

  console.log("[AliExpress Fetch Debug] Affiliate parsed price", {
    source: "affiliate",
    productId,
    selectedPrice: price,
    selectedCurrency: String(item.target_sale_price_currency ?? "GBP"),
    rawTargetSalePrice: item.target_sale_price ?? null,
    rawTargetAppSalePrice: item.target_app_sale_price ?? null,
    rawSalePrice: item.sale_price ?? null,
    rawAppSalePrice: item.app_sale_price ?? null,
  });

  return {
    source: "aliexpress",
    externalId: String(item.product_id ?? productId),
    productUrl:
      String(item.product_detail_url ?? `https://www.aliexpress.com/item/${productId}.html`),
    title: String(item.product_title),
    imageUrl:
      (item.product_main_image_url ? String(item.product_main_image_url) : null) ??
      imageUrls?.string?.[0] ??
      null,
    price,
    currency: String(item.target_sale_price_currency ?? "GBP"),
    stock: null,
    orders: item.lastest_volume != null ? String(item.lastest_volume) : null,
    rating: parseNumber(item.evaluate_rate),
  };
}

async function callDropshipProductApi(productId: string): Promise<HandlingProductData | null> {
  const accessToken = await getAliExpressAccessToken();
  if (!accessToken) return null;

  const payload = await callOpenPlatformApi(
    "aliexpress.ds.product.get",
    {
      product_id: productId,
      ship_to_country: "GB",
      target_currency: "GBP",
      target_language: "EN",
    },
    { signMethod: "sha256", accessToken },
  );

  if (!payload) return null;

  return parseDsProductPayload(payload, productId);
}

async function fetchViaOpenPlatform(productId: string): Promise<HandlingProductData | null> {
  const dropshipProduct = await callDropshipProductApi(productId);
  if (dropshipProduct) return dropshipProduct;

  const affiliateProduct = await callAffiliateProductApi(productId);
  if (affiliateProduct) return affiliateProduct;

  return null;
}

async function scrapeAliExpressHtml(url: string, productId: string): Promise<HandlingProductData | null> {
  try {
    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      cache: "no-store",
    });

    if (!response.ok) return null;

    const html = await response.text();

    const titleMatch =
      html.match(/property="og:title"\s+content="([^"]+)"/i) ??
      html.match(/"productTitle"\s*:\s*"([^"]+)"/) ??
      html.match(/"subject"\s*:\s*"([^"]+)"/);

    const imageMatch =
      html.match(/property="og:image"\s+content="([^"]+)"/i) ??
      html.match(/"imageUrl"\s*:\s*"(https:[^"]+)"/);

    const priceMatch =
      html.match(/"formattedPrice"\s*:\s*"([^"]+)"/) ??
      html.match(/"minActivityAmount"\s*:\s*\{[^}]*"value"\s*:\s*([0-9.]+)/) ??
      html.match(/"skuCalPrice"\s*:\s*"([0-9.]+)"/);

    const stockMatch =
      html.match(/"totalAvailQuantity"\s*:\s*(\d+)/) ??
      html.match(/"totalAvailableInventory"\s*:\s*(\d+)/);

    const ordersMatch =
      html.match(/"tradeCount"\s*:\s*"([^"]+)"/) ??
      html.match(/"otherText"\s*:\s*"([^"]+)"/);

    const title = titleMatch?.[1]?.replace(/&quot;/g, '"').replace(/\s*- AliExpress.*$/i, "").trim();
    const priceRaw = priceMatch?.[1];
    const price = priceRaw ? parseNumber(priceRaw.replace(/[^\d.]/g, "")) : null;

    if (!title || price == null) return null;

    console.log("[AliExpress Fetch Debug] HTML parsed price", {
      source: "html-scrape",
      productId,
      selectedPrice: price,
      selectedCurrency: /£|GBP/i.test(priceRaw ?? "") ? "GBP" : "USD",
      rawPriceMatch: priceRaw ?? null,
    });

    return {
      source: "aliexpress",
      externalId: productId,
      productUrl: url,
      title,
      imageUrl: imageMatch?.[1] || null,
      images: imageMatch?.[1] ? [imageMatch[1]] : [],
      price,
      currency: /£|GBP/i.test(priceRaw ?? "") ? "GBP" : "USD",
      stock: stockMatch ? Number(stockMatch[1]) : null,
      orders: ordersMatch?.[1] ?? null,
      rating: null,
    };
  } catch {
    return null;
  }
}

export async function fetchAliExpressProduct(url: string): Promise<HandlingProductData> {
  const trimmedUrl = url.trim();

  if (!isAliExpressUrl(trimmedUrl)) {
    throw new Error("Please enter a valid AliExpress product URL.");
  }

  const resolvedUrl = await resolveAliExpressUrl(trimmedUrl);
  const productId = extractAliExpressProductId(resolvedUrl);

  if (!productId) {
    throw new Error("Could not find a product ID in that AliExpress URL.");
  }

  const canonicalUrl =
    resolvedUrl.includes("/item/") && resolvedUrl.includes(productId)
      ? resolvedUrl.split("?")[0]
      : `https://www.aliexpress.com/item/${productId}.html`;

  const openPlatformProduct = await fetchViaOpenPlatform(productId);
  if (openPlatformProduct) {
    openPlatformProduct.orders = resolveSoldOrdersDisplay(openPlatformProduct.orders, [
      trimmedUrl,
      resolvedUrl,
    ]);

    const enriched = await enrichDescriptionImages({
      ...openPlatformProduct,
      productUrl: canonicalUrl,
    });

    console.log("[AliExpress Fetch Debug] Final source selected", {
      source: "open-platform",
      productId,
      finalPrice: enriched.price,
      finalCurrency: enriched.currency,
      finalStock: enriched.stock,
      finalOrders: enriched.orders,
      descriptionImagesCount: enriched.descriptionImages?.length ?? 0,
      inputUrl: trimmedUrl,
    });
    return enriched;
  }

  throw new Error(
    "Could not fetch product details from official AliExpress APIs (Dropship/Affiliate). Please reconnect AliExpress OAuth and try again.",
  );
}
