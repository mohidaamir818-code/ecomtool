import "server-only";

import crypto from "crypto";
import { serverEnv } from "@/lib/env";
import type { HandlingProductData } from "@/types/handling";

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

function signAffiliateParams(params: Record<string, string>, secret: string): string {
  const sorted = Object.keys(params)
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
    targetSkuPriceInfo?: {
      originalPrice?: { value?: number; currency?: string };
      salePriceString?: string;
    };
    skuPriceInfoMap?: Record<
      string,
      {
        originalPrice?: { value?: number; currency?: string };
        salePriceString?: string;
      }
    >;
  };
  PC_RATING?: {
    rating?: string;
    otherText?: string;
    totalValidNum?: number;
  };
  QUANTITY_PC?: {
    totalAvailableInventory?: number;
  };
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
): HandlingProductData | null {
  const errorCode = modules.GLOBAL_DATA?.globalData?.errorCode;
  if (errorCode === "SITEM_NOT_EXIST") {
    throw new Error("This AliExpress product was not found or is no longer available.");
  }

  const title = modules.PRODUCT_TITLE?.text?.trim();
  if (!title) return null;

  const priceInfo =
    modules.PRICE?.targetSkuPriceInfo ??
    Object.values(modules.PRICE?.skuPriceInfoMap ?? {})[0];

  const price =
    parseNumber(priceInfo?.salePriceString) ??
    parseNumber(priceInfo?.originalPrice?.value);

  if (price == null) return null;

  const currency = priceInfo?.originalPrice?.currency ?? "GBP";
  const imageUrl =
    modules.HEADER_IMAGE_PC?.mainImages?.[0]?.imageUrl ??
    modules.HEADER_IMAGE_PC?.imagePathList?.[0] ??
    null;

  const stock = modules.QUANTITY_PC?.totalAvailableInventory ?? null;
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
    price,
    currency,
    stock,
    orders,
    rating,
  };
}

async function fetchViaMtop(productId: string, productUrl: string): Promise<HandlingProductData | null> {
  let cookies = await bootstrapMtopCookies();
  let modules = await callMtopProductDetail(productId, cookies);

  if (!modules) {
    cookies = await bootstrapMtopCookies();
    modules = await callMtopProductDetail(productId, cookies);
  }

  if (!modules) return null;

  return parseMtopProduct(modules, productId, productUrl);
}

async function callAffiliateApi(productId: string): Promise<HandlingProductData | null> {
  const appKey = serverEnv.aliexpressAppKey();
  const appSecret = serverEnv.aliexpressAppSecret();

  if (!appKey || !appSecret) return null;

  const params: Record<string, string> = {
    app_key: appKey,
    method: "aliexpress.affiliate.productdetail.get",
    sign_method: "md5",
    timestamp: formatTimestamp(),
    format: "json",
    v: "2.0",
    product_ids: productId,
    target_currency: "GBP",
    target_language: "EN",
  };

  params.sign = signAffiliateParams(params, appSecret);

  try {
    const response = await fetch(AFFILIATE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      },
      body: new URLSearchParams(params),
      cache: "no-store",
    });

    const payload = await response.json();
    const result =
      payload?.aliexpress_affiliate_productdetail_get_response?.resp_result?.result
        ?.products?.product?.[0] ??
      payload?.aliexpress_affiliate_productdetail_get_response?.resp_result?.result
        ?.products?.[0];

    if (!result) return null;

    const price = parseNumber(
      result.target_sale_price ??
        result.target_app_sale_price ??
        result.sale_price ??
        result.app_sale_price,
    );

    if (!result.product_title || price == null) return null;

    return {
      source: "aliexpress",
      externalId: String(result.product_id ?? productId),
      productUrl: result.product_detail_url ?? `https://www.aliexpress.com/item/${productId}.html`,
      title: String(result.product_title),
      imageUrl: result.product_main_image_url ?? result.product_small_image_urls?.string?.[0] ?? null,
      price,
      currency: String(result.target_sale_price_currency ?? "GBP"),
      stock: parseNumber(result.lastest_volume) ?? null,
      orders: result.lastest_volume != null ? String(result.lastest_volume) : null,
      rating: parseNumber(result.evaluate_rate),
    };
  } catch {
    return null;
  }
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

    return {
      source: "aliexpress",
      externalId: productId,
      productUrl: url,
      title,
      imageUrl: imageMatch?.[1] || null,
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

  const apiProduct = await callAffiliateApi(productId);
  if (apiProduct) return apiProduct;

  const mtopProduct = await fetchViaMtop(productId, canonicalUrl);
  if (mtopProduct) return mtopProduct;

  const htmlProduct = await scrapeAliExpressHtml(canonicalUrl, productId);
  if (htmlProduct) return htmlProduct;

  throw new Error(
    "Could not fetch product details from AliExpress. Check the URL is a live product page and try again.",
  );
}
