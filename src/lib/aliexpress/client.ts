import "server-only";

import crypto from "crypto";
import { serverEnv } from "@/lib/env";
import type { HandlingProductData } from "@/types/handling";

const API_ENDPOINTS = [
  "https://api-sg.aliexpress.com/sync",
  "https://gw.api.taobao.com/router/rest",
];

function formatTimestamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function signParams(params: Record<string, string>, secret: string): string {
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

export function extractAliExpressProductId(url: string): string | null {
  const patterns = [
    /\/item\/(\d+)\.html/i,
    /\/item\/(\d+)/i,
    /productId[=:](\d+)/i,
    /(\d{9,20})/,
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
    return hostname.includes("aliexpress.");
  } catch {
    return false;
  }
}

function parseNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
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

  params.sign = signParams(params, appSecret);

  for (const endpoint of API_ENDPOINTS) {
    const response = await fetch(endpoint, {
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

    if (!result) continue;

    const price = parseNumber(
      result.target_sale_price ??
        result.target_app_sale_price ??
        result.sale_price ??
        result.app_sale_price,
    );

    if (!result.product_title || price == null) continue;

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
  }

  return null;
}

async function scrapeAliExpressHtml(url: string, productId: string): Promise<HandlingProductData | null> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-GB,en;q=0.9",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Could not load AliExpress page (${response.status}).`);
  }

  const html = await response.text();

  const titleMatch =
    html.match(/property="og:title"\s+content="([^"]+)"/i) ??
    html.match(/"productTitle"\s*:\s*"([^"]+)"/) ??
    html.match(/"subject"\s*:\s*"([^"]+)"/) ??
    html.match(/<title>([^<]+)<\/title>/i);

  const imageMatch =
    html.match(/property="og:image"\s+content="([^"]+)"/i) ??
    html.match(/"imageUrl"\s*:\s*"(https:[^"]+)"/);

  const priceMatch =
    html.match(/"formattedPrice"\s*:\s*"([^"]+)"/) ??
    html.match(/"minActivityAmount"\s*:\s*\{[^}]*"value"\s*:\s*([0-9.]+)/) ??
    html.match(/"skuCalPrice"\s*:\s*"([0-9.]+)"/) ??
    html.match(/"actSkuCalPrice"\s*:\s*"([0-9.]+)"/);

  const stockMatch =
    html.match(/"totalAvailQuantity"\s*:\s*(\d+)/) ??
    html.match(/"skuAvailQuantity"\s*:\s*(\d+)/) ??
    html.match(/"totalValidNum"\s*:\s*(\d+)/);

  const ordersMatch =
    html.match(/"tradeCount"\s*:\s*"([^"]+)"/) ??
    html.match(/"totalTrades"\s*:\s*"([^"]+)"/);

  const title = titleMatch?.[1]?.replace(/&quot;/g, '"').replace(/\s*- AliExpress.*$/i, "").trim();
  const priceRaw = priceMatch?.[1];
  const price = priceRaw ? parseNumber(priceRaw.replace(/[^\d.]/g, "")) : null;

  if (!title || price == null) return null;

  return {
    source: "aliexpress",
    externalId: productId,
    productUrl: url,
    title,
    imageUrl: imageMatch?.[1] ?? null,
    price,
    currency: /£|GBP/i.test(priceRaw ?? "") ? "GBP" : "USD",
    stock: stockMatch ? Number(stockMatch[1]) : null,
    orders: ordersMatch?.[1] ?? null,
    rating: null,
  };
}

export async function fetchAliExpressProduct(url: string): Promise<HandlingProductData> {
  const trimmedUrl = url.trim();

  if (!isAliExpressUrl(trimmedUrl)) {
    throw new Error("Please enter a valid AliExpress product URL.");
  }

  const productId = extractAliExpressProductId(trimmedUrl);
  if (!productId) {
    throw new Error("Could not find a product ID in that AliExpress URL.");
  }

  const apiProduct = await callAffiliateApi(productId);
  if (apiProduct) return apiProduct;

  const htmlProduct = await scrapeAliExpressHtml(trimmedUrl, productId);
  if (htmlProduct) return htmlProduct;

  throw new Error(
    "Could not fetch product details. Enable the AliExpress Affiliate API on your app, or try another product URL.",
  );
}
