import "server-only";

import { serverEnv } from "@/lib/env";
import type { EbayListing } from "@/types/ebay";

const EBAY_API_BASE = "https://api.ebay.com";
const MARKETPLACE_ID = "EBAY_GB";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const VARIATION_FETCH_BATCH = 10;

let cachedToken: { token: string; expiresAt: number } | null = null;

function formatPrice(price: number, currency: string): string {
  if (currency === "GBP") return `£${price.toFixed(2)}`;
  if (currency === "USD") return `$${price.toFixed(2)}`;
  if (currency === "EUR") return `€${price.toFixed(2)}`;
  return `${currency} ${price.toFixed(2)}`;
}

function formatPriceRange(min: number, max: number, currency: string): string {
  if (min === max) return formatPrice(min, currency);
  return `${formatPrice(min, currency)} – ${formatPrice(max, currency)}`;
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

function ebayHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "X-EBAY-C-MARKETPLACE-ID": MARKETPLACE_ID,
  };
}

interface EbayMoney {
  value?: string;
  currency?: string;
}

interface EbayShippingOption {
  shippingCost?: EbayMoney;
}

interface EbayItemSummary {
  itemId?: string;
  legacyItemId?: string;
  title?: string;
  itemWebUrl?: string;
  condition?: string;
  price?: EbayMoney;
  seller?: { username?: string };
  shippingOptions?: EbayShippingOption[];
  image?: { imageUrl?: string };
  itemGroupType?: string;
  itemGroupHref?: string;
}

interface VariationPriceRange {
  min: number;
  max: number;
  currency: string;
}

function resolveMinShipping(
  shippingOptions: EbayShippingOption[] | undefined,
  fallbackCurrency: string,
): { minCost: number | null; currency: string; multipleTiers: boolean; label: string } {
  if (!shippingOptions?.length) {
    return { minCost: null, currency: fallbackCurrency, multipleTiers: false, label: "—" };
  }

  const parsed = shippingOptions
    .map((option) => {
      if (option.shippingCost?.value === undefined) return null;
      const value = Number.parseFloat(option.shippingCost.value);
      if (!Number.isFinite(value)) return null;
      return {
        value,
        currency: option.shippingCost.currency ?? fallbackCurrency,
      };
    })
    .filter((entry): entry is { value: number; currency: string } => entry !== null);

  if (!parsed.length) {
    return { minCost: null, currency: fallbackCurrency, multipleTiers: false, label: "—" };
  }

  const minEntry = parsed.reduce((lowest, current) =>
    current.value < lowest.value ? current : lowest,
  );
  const multipleTiers = parsed.length > 1 && new Set(parsed.map((entry) => entry.value)).size > 1;

  let label: string;
  if (multipleTiers) {
    label =
      minEntry.value === 0
        ? "from Free"
        : `from ${formatPrice(minEntry.value, minEntry.currency)}`;
  } else if (minEntry.value === 0) {
    label = "Free";
  } else {
    label = formatPrice(minEntry.value, minEntry.currency);
  }

  return {
    minCost: minEntry.value,
    currency: minEntry.currency,
    multipleTiers,
    label,
  };
}

async function fetchVariationPriceRange(
  token: string,
  itemGroupHref: string,
): Promise<VariationPriceRange | null> {
  const response = await fetch(itemGroupHref, {
    headers: ebayHeaders(token),
    next: { revalidate: 0 },
  });

  if (!response.ok) return null;

  const data = (await response.json()) as {
    items?: Array<{ price?: EbayMoney }>;
  };

  const prices = (data.items ?? [])
    .map((item) => ({
      value: Number.parseFloat(item.price?.value ?? "0"),
      currency: item.price?.currency ?? "GBP",
    }))
    .filter((entry) => entry.value > 0);

  if (!prices.length) return null;

  return {
    min: Math.min(...prices.map((entry) => entry.value)),
    max: Math.max(...prices.map((entry) => entry.value)),
    currency: prices[0].currency,
  };
}

async function loadVariationPriceRanges(
  token: string,
  items: EbayItemSummary[],
): Promise<Map<string, VariationPriceRange>> {
  const variationEntries = items
    .filter(
      (item) =>
        item.itemGroupType === "SELLER_DEFINED_VARIATIONS" &&
        item.itemGroupHref &&
        item.itemId,
    )
    .map((item) => ({ id: item.itemId!, href: item.itemGroupHref! }));

  const ranges = new Map<string, VariationPriceRange>();

  for (let index = 0; index < variationEntries.length; index += VARIATION_FETCH_BATCH) {
    const batch = variationEntries.slice(index, index + VARIATION_FETCH_BATCH);
    const results = await Promise.all(
      batch.map(async ({ id, href }) => {
        const range = await fetchVariationPriceRange(token, href);
        return { id, range };
      }),
    );

    for (const { id, range } of results) {
      if (range) ranges.set(id, range);
    }
  }

  return ranges;
}

function mapItemSummary(
  item: EbayItemSummary,
  variationRanges: Map<string, VariationPriceRange>,
): EbayListing {
  const baseCurrency = item.price?.currency ?? "GBP";
  const basePrice = Number.parseFloat(item.price?.value ?? "0") || 0;
  const hasVariations = item.itemGroupType === "SELLER_DEFINED_VARIATIONS";
  const variationRange = item.itemId ? variationRanges.get(item.itemId) : undefined;

  const priceMin = variationRange?.min ?? basePrice;
  const priceMax = variationRange?.max ?? basePrice;
  const currency = variationRange?.currency ?? baseCurrency;

  const shipping = resolveMinShipping(item.shippingOptions, currency);
  const minShipping = shipping.minCost ?? 0;

  const totalPrice = priceMin + minShipping;
  const totalPriceMax = priceMax + minShipping;

  let totalPriceLabel = formatPrice(totalPrice, currency);
  if (hasVariations && priceMin !== priceMax) {
    totalPriceLabel = formatPriceRange(totalPrice, totalPriceMax, currency);
  } else if (shipping.multipleTiers) {
    totalPriceLabel = `from ${formatPrice(totalPrice, currency)}`;
  }

  return {
    id: item.itemId ?? item.legacyItemId ?? crypto.randomUUID(),
    title: item.title ?? "Untitled listing",
    sellerName: item.seller?.username ?? "Unknown seller",
    hasVariations,
    priceMin,
    priceMax,
    priceLabel:
      hasVariations && priceMin !== priceMax
        ? formatPriceRange(priceMin, priceMax, currency)
        : formatPrice(priceMin, currency),
    shippingCost: shipping.minCost,
    shippingLabel: shipping.label,
    totalPrice,
    totalPriceMax,
    totalPriceLabel,
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
    headers: ebayHeaders(token),
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

  const summaries = data.itemSummaries ?? [];
  const variationRanges = await loadVariationPriceRanges(token, summaries);
  const listings = summaries.map((item) => mapItemSummary(item, variationRanges));

  return {
    listings,
    total: data.total ?? listings.length,
    offset,
    limit,
  };
}
