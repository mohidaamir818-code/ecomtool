import "server-only";

import { serverEnv } from "@/lib/env";
import type { EbayListing } from "@/types/ebay";

const EBAY_API_BASE = "https://api.ebay.com";
const MARKETPLACE_ID = "EBAY_GB";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

let cachedToken: { token: string; expiresAt: number } | null = null;

function formatPrice(price: number, currency: string): string {
  if (currency === "GBP") return `£${price.toFixed(2)}`;
  if (currency === "USD") return `$${price.toFixed(2)}`;
  if (currency === "EUR") return `€${price.toFixed(2)}`;
  return `${currency} ${price.toFixed(2)}`;
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const appId = serverEnv.ebayAppId();
  const certId = serverEnv.ebayCertId();

  if (!appId || !certId) {
    throw new Error("eBay API credentials are not configured. Set EBAY_APP_ID and EBAY_CERT_ID.");
  }

  const credentials = Buffer.from(`${appId}:${certId}`).toString("base64");

  const response = await fetch(`${EBAY_API_BASE}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
  });

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description ?? "Failed to obtain eBay access token.");
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
  };

  return data.access_token;
}

interface EbayItemSummary {
  itemId?: string;
  legacyItemId?: string;
  title?: string;
  itemWebUrl?: string;
  condition?: string;
  price?: { value?: string; currency?: string };
  seller?: { username?: string };
  shippingOptions?: Array<{ shippingCost?: { value?: string; currency?: string } }>;
  image?: { imageUrl?: string };
}

function mapItemSummary(item: EbayItemSummary): EbayListing {
  const currency = item.price?.currency ?? "GBP";
  const price = Number.parseFloat(item.price?.value ?? "0") || 0;

  const shippingOption = item.shippingOptions?.[0]?.shippingCost;
  const shippingCost =
    shippingOption?.value !== undefined ? Number.parseFloat(shippingOption.value) : null;
  const shippingCurrency = shippingOption?.currency ?? currency;

  const totalPrice = price + (shippingCost ?? 0);

  return {
    id: item.itemId ?? item.legacyItemId ?? crypto.randomUUID(),
    title: item.title ?? "Untitled listing",
    sellerName: item.seller?.username ?? "Unknown seller",
    price,
    priceLabel: formatPrice(price, currency),
    shippingCost,
    shippingLabel:
      shippingCost === null
        ? "—"
        : shippingCost === 0
          ? "Free"
          : formatPrice(shippingCost, shippingCurrency),
    totalPrice,
    totalPriceLabel: formatPrice(totalPrice, currency),
    currency,
    condition: item.condition ?? "—",
    listingUrl: item.itemWebUrl ?? "",
    imageUrl: item.image?.imageUrl ?? null,
  };
}

export async function searchEbayListings(params: {
  query: string;
  limit?: number;
  offset?: number;
  sort?: "asc" | "desc";
}): Promise<{ listings: EbayListing[]; total: number; offset: number; limit: number }> {
  const query = params.query.trim();
  if (query.length < 2) {
    throw new Error("Search keyword must be at least 2 characters.");
  }

  const limit = Math.min(Math.max(params.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(params.offset ?? 0, 0);
  const sort = params.sort === "desc" ? "-price" : "price";

  const token = await getAccessToken();
  const url = new URL(`${EBAY_API_BASE}/buy/browse/v1/item_summary/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("sort", sort);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": MARKETPLACE_ID,
    },
    next: { revalidate: 0 },
  });

  const data = (await response.json()) as {
    itemSummaries?: EbayItemSummary[];
    total?: number;
    errors?: Array<{ message?: string }>;
  };

  if (!response.ok) {
    const message = data.errors?.[0]?.message ?? "eBay search request failed.";
    throw new Error(message);
  }

  const listings = (data.itemSummaries ?? []).map(mapItemSummary);

  return {
    listings,
    total: data.total ?? listings.length,
    offset,
    limit,
  };
}
