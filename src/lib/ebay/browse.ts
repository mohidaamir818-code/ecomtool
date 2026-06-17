import "server-only";

import { serverEnv } from "@/lib/env";
import type { EbayListing } from "@/types/ebay";

const EBAY_API_BASE = "https://api.ebay.com";
const MARKETPLACE_ID = "EBAY_GB";
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;
const FETCH_BATCH = 8;

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
  type?: string;
  shippingCost?: EbayMoney;
  shippingCostType?: string;
}

interface EbayLocalizedAspect {
  name?: string;
  value?: string;
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

interface EbayItemDetail {
  itemId?: string;
  title?: string;
  itemWebUrl?: string;
  condition?: string;
  price?: EbayMoney;
  marketingPrice?: {
    originalPrice?: EbayMoney;
  };
  seller?: { username?: string };
  shippingOptions?: EbayShippingOption[];
  image?: { imageUrl?: string };
  localizedAspects?: EbayLocalizedAspect[];
  color?: string;
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

function extractVariantLabel(item: EbayItemDetail): string | null {
  const aspects = item.localizedAspects ?? [];
  const preferredNames = ["Color", "Size", "Model", "Style", "Capacity"];

  for (const name of preferredNames) {
    const match = aspects.find((aspect) => aspect.name === name && aspect.value);
    if (match?.value) return match.value;
  }

  if (item.color) return item.color;

  const skip = new Set([
    "Wireless Type",
    "Type",
    "Brand",
    "Connectivity",
    "Form Factor",
    "Features",
  ]);
  const fallback = aspects.find(
    (aspect) => aspect.name && aspect.value && !skip.has(aspect.name),
  );
  return fallback?.value ?? null;
}

function buildListingRow(params: {
  id: string;
  title: string;
  variantLabel: string | null;
  hasVariations: boolean;
  sellerName: string;
  price: number;
  currency: string;
  shippingOptions?: EbayShippingOption[];
  condition: string;
  listingUrl: string;
  imageUrl: string | null;
}): EbayListing {
  const shipping = resolveMinShipping(params.shippingOptions, params.currency);
  const minShipping = shipping.minCost ?? 0;
  const totalPrice = params.price + minShipping;

  let totalPriceLabel = formatPrice(totalPrice, params.currency);
  if (shipping.multipleTiers) {
    totalPriceLabel = `from ${totalPriceLabel}`;
  }

  return {
    id: params.id,
    title: params.title,
    variantLabel: params.variantLabel,
    sellerName: params.sellerName,
    hasVariations: params.hasVariations,
    price: params.price,
    priceLabel: formatPrice(params.price, params.currency),
    shippingCost: shipping.minCost,
    shippingLabel: shipping.label,
    totalPrice,
    totalPriceLabel,
    currency: params.currency,
    condition: params.condition,
    listingUrl: params.listingUrl,
    imageUrl: params.imageUrl,
  };
}

function mapDetailToListing(item: EbayItemDetail, hasVariations: boolean): EbayListing | null {
  const currency = item.price?.currency ?? "GBP";
  const price = Number.parseFloat(item.price?.value ?? "0");
  if (!Number.isFinite(price) || price <= 0) return null;

  return buildListingRow({
    id: item.itemId ?? crypto.randomUUID(),
    title: item.title ?? "Untitled listing",
    variantLabel: hasVariations ? extractVariantLabel(item) : null,
    hasVariations,
    sellerName: item.seller?.username ?? "Unknown seller",
    price,
    currency,
    shippingOptions: item.shippingOptions,
    condition: item.condition ?? "—",
    listingUrl: item.itemWebUrl ?? "",
    imageUrl: item.image?.imageUrl ?? null,
  });
}

async function fetchItemDetail(token: string, itemId: string): Promise<EbayItemDetail | null> {
  const response = await fetch(
    `${EBAY_API_BASE}/buy/browse/v1/item/${encodeURIComponent(itemId)}`,
    {
      headers: ebayHeaders(token),
      next: { revalidate: 0 },
    },
  );

  if (!response.ok) return null;
  return (await response.json()) as EbayItemDetail;
}

async function fetchVariationItems(
  token: string,
  itemGroupHref: string,
): Promise<EbayItemDetail[]> {
  const response = await fetch(itemGroupHref, {
    headers: ebayHeaders(token),
    next: { revalidate: 0 },
  });

  if (!response.ok) return [];

  const data = (await response.json()) as { items?: EbayItemDetail[] };
  return data.items ?? [];
}

async function runBatched<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

async function enrichSearchSummary(
  token: string,
  summary: EbayItemSummary,
): Promise<EbayListing[]> {
  const isVariationGroup =
    summary.itemGroupType === "SELLER_DEFINED_VARIATIONS" && summary.itemGroupHref;

  if (isVariationGroup) {
    const variants = await fetchVariationItems(token, summary.itemGroupHref!);
    const rows = variants
      .map((variant) => mapDetailToListing(variant, true))
      .filter((row): row is EbayListing => row !== null);

    if (rows.length > 0) return rows;
  }

  if (summary.itemId) {
    const detail = await fetchItemDetail(token, summary.itemId);
    if (detail) {
      const row = mapDetailToListing(detail, false);
      if (row) return [row];
    }
  }

  const currency = summary.price?.currency ?? "GBP";
  const price = Number.parseFloat(summary.price?.value ?? "0") || 0;

  return [
    buildListingRow({
      id: summary.itemId ?? summary.legacyItemId ?? crypto.randomUUID(),
      title: summary.title ?? "Untitled listing",
      variantLabel: null,
      hasVariations: false,
      sellerName: summary.seller?.username ?? "Unknown seller",
      price,
      currency,
      shippingOptions: summary.shippingOptions,
      condition: summary.condition ?? "—",
      listingUrl: summary.itemWebUrl ?? "",
      imageUrl: summary.image?.imageUrl ?? null,
    }),
  ];
}

function sortListings(listings: EbayListing[], sort: "asc" | "desc"): EbayListing[] {
  return [...listings].sort((a, b) =>
    sort === "desc" ? b.totalPrice - a.totalPrice : a.totalPrice - b.totalPrice,
  );
}

export async function searchEbayListings(params: {
  query: string;
  limit?: number;
  offset?: number;
  sort?: "asc" | "desc";
}): Promise<{
  listings: EbayListing[];
  total: number;
  offerCount: number;
  offset: number;
  limit: number;
}> {
  const query = params.query.trim();
  if (query.length < 2) {
    throw new Error("Search keyword must be at least 2 characters.");
  }

  const limit = Math.min(Math.max(params.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(params.offset ?? 0, 0);
  const sort = params.sort === "desc" ? "desc" : "asc";

  const token = await getAccessToken();
  const url = new URL(`${EBAY_API_BASE}/buy/browse/v1/item_summary/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("sort", sort === "desc" ? "-price" : "price");

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
  const enriched = await runBatched(summaries, FETCH_BATCH, (summary) =>
    enrichSearchSummary(token, summary),
  );
  const listings = sortListings(enriched.flat(), sort);

  return {
    listings,
    total: data.total ?? summaries.length,
    offerCount: listings.length,
    offset,
    limit,
  };
}
