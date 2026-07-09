import "server-only";

import { serverEnv } from "@/lib/env";
import { resolveMarketplaceConfig, type EbayMarketplaceId } from "@/lib/ebay/marketplace";
import type { EbayListing } from "@/types/ebay";

const EBAY_API_BASE = "https://api.ebay.com";
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;
const FETCH_BATCH = 6;

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

function ebayHeaders(token: string, marketplaceId?: EbayMarketplaceId): HeadersInit {
  const config = resolveMarketplaceConfig(marketplaceId);
  return {
    Authorization: `Bearer ${token}`,
    "X-EBAY-C-MARKETPLACE-ID": config.marketplaceId,
    "X-EBAY-C-ENDUSERCTX": `contextualLocation=country=${config.endUserCountry}`,
  };
}

interface EbayMoney {
  value?: string;
  currency?: string;
}

interface EbayTax {
  taxType?: string;
  taxPercentage?: string;
  includedInPrice?: boolean;
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
  legacyItemId?: string;
  title?: string;
  itemWebUrl?: string;
  condition?: string;
  price?: EbayMoney;
  seller?: { username?: string };
  shippingOptions?: EbayShippingOption[];
  image?: { imageUrl?: string };
  localizedAspects?: EbayLocalizedAspect[];
  color?: string;
  taxes?: EbayTax[];
  primaryItemGroup?: {
    itemGroupId?: string;
    itemGroupType?: string;
  };
}

const ACCESSORY_VARIANT_PATTERN =
  /\b(sim pin|cable only|hook only|charger only|charging cable|replacement|spare|tips only|case only|cover only|strap only|adapter only|earbud only)\b/i;

function getVatRate(taxes?: EbayTax[]): number {
  const vat = taxes?.find((tax) => tax.taxType === "VAT");
  if (!vat?.taxPercentage || vat.includedInPrice) return 0;
  const rate = Number.parseFloat(vat.taxPercentage);
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

/** Convert API net price to the price UK buyers see on eBay.co.uk (VAT added when excluded). */
function toBuyerPrice(netPrice: number, taxes?: EbayTax[]): {
  price: number;
  priceNote: string | null;
} {
  const vatRate = getVatRate(taxes);
  if (vatRate <= 0) {
    return { price: netPrice, priceNote: null };
  }

  const grossPrice = Math.round(netPrice * (1 + vatRate / 100) * 100) / 100;
  return {
    price: grossPrice,
    priceNote: `incl. ${vatRate % 1 === 0 ? vatRate.toFixed(0) : vatRate}% VAT`,
  };
}

function normalizeEbayListingUrl(url: string, legacyItemId?: string): string {
  const fallbackId = legacyItemId?.trim();
  if (!url && fallbackId) {
    return `https://www.ebay.co.uk/itm/${fallbackId}`;
  }

  try {
    const parsed = new URL(url);
    const itemId = fallbackId || parsed.pathname.match(/(\d{9,15})/)?.[1];
    if (!itemId) return url;

    const variantId = parsed.searchParams.get("var");
    const base = `https://www.ebay.co.uk/itm/${itemId}`;
    return variantId ? `${base}?var=${variantId}` : base;
  } catch {
    return fallbackId ? `https://www.ebay.co.uk/itm/${fallbackId}` : url;
  }
}

function isLikelyAccessoryVariant(
  label: string | null,
  netPrice: number,
  siblingNetPrices: number[],
): boolean {
  if (label && ACCESSORY_VARIANT_PATTERN.test(label)) return true;
  if (siblingNetPrices.length < 2) return false;

  const sorted = [...siblingNetPrices].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return netPrice < 2 && median >= 4 && netPrice < median * 0.35;
}

function resolveBuyerShipping(
  shippingOptions: EbayShippingOption[] | undefined,
  currency: string,
  taxes?: EbayTax[],
): { cost: number | null; label: string; multipleTiers: boolean } {
  if (!shippingOptions?.length) {
    return { cost: null, label: "—", multipleTiers: false };
  }

  const parsed = shippingOptions
    .map((option) => {
      if (option.shippingCost?.value === undefined) return null;
      const net = Number.parseFloat(option.shippingCost.value);
      if (!Number.isFinite(net)) return null;
      const shipCurrency = option.shippingCost.currency ?? currency;
      const buyer = toBuyerPrice(net, taxes);
      return { net, buyer: buyer.price, currency: shipCurrency };
    })
    .filter((entry): entry is { net: number; buyer: number; currency: string } => entry !== null);

  if (!parsed.length) {
    return { cost: null, label: "—", multipleTiers: false };
  }

  const cheapest = parsed.reduce((low, cur) => (cur.buyer < low.buyer ? cur : low));
  const multipleTiers = parsed.length > 1 && new Set(parsed.map((entry) => entry.buyer)).size > 1;

  let label: string;
  if (multipleTiers) {
    label =
      cheapest.buyer === 0
        ? "from Free"
        : `from ${formatPrice(cheapest.buyer, cheapest.currency)}`;
  } else if (cheapest.buyer === 0) {
    label = "Free";
  } else {
    label = formatPrice(cheapest.buyer, cheapest.currency);
  }

  return { cost: cheapest.buyer, label, multipleTiers };
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

function mapDetailToListing(item: EbayItemDetail, hasVariations: boolean): EbayListing | null {
  const currency = item.price?.currency ?? "GBP";
  const netPrice = Number.parseFloat(item.price?.value ?? "0");
  if (!Number.isFinite(netPrice) || netPrice <= 0) return null;

  const { price: buyerPrice, priceNote } = toBuyerPrice(netPrice, item.taxes);
  const shipping = resolveBuyerShipping(item.shippingOptions, currency, item.taxes);
  const postage = shipping.cost ?? 0;
  const totalPrice = buyerPrice + postage;

  let totalPriceLabel = formatPrice(totalPrice, currency);
  if (shipping.multipleTiers) {
    totalPriceLabel = `from ${totalPriceLabel}`;
  }

  const listingUrl = normalizeEbayListingUrl(item.itemWebUrl ?? "", item.legacyItemId);
  if (!listingUrl) return null;

  return {
    id: item.itemId ?? item.legacyItemId ?? crypto.randomUUID(),
    title: item.title ?? "Untitled listing",
    variantLabel: hasVariations ? extractVariantLabel(item) : null,
    sellerName: item.seller?.username ?? "Unknown seller",
    hasVariations,
    price: buyerPrice,
    priceLabel: formatPrice(buyerPrice, currency),
    priceNote,
    shippingCost: shipping.cost,
    shippingLabel: shipping.label,
    totalPrice,
    totalPriceLabel,
    currency,
    condition: item.condition ?? "—",
    listingUrl,
    imageUrl: item.image?.imageUrl ?? null,
  };
}

function mapSummaryToListing(summary: EbayItemSummary): EbayListing | null {
  const currency = summary.price?.currency ?? "GBP";
  const netPrice = Number.parseFloat(summary.price?.value ?? "0");
  if (!Number.isFinite(netPrice) || netPrice <= 0) return null;

  const hasVariations = summary.itemGroupType === "SELLER_DEFINED_VARIATIONS";
  const { price: buyerPrice, priceNote } = toBuyerPrice(netPrice);
  const shipping = resolveBuyerShipping(summary.shippingOptions, currency);
  const postage = shipping.cost ?? 0;
  const totalPrice = buyerPrice + postage;

  let totalPriceLabel = formatPrice(totalPrice, currency);
  if (shipping.multipleTiers) {
    totalPriceLabel = `from ${totalPriceLabel}`;
  }

  const listingUrl = normalizeEbayListingUrl(summary.itemWebUrl ?? "", summary.legacyItemId);
  if (!listingUrl) return null;

  return {
    id: summary.itemId ?? summary.legacyItemId ?? crypto.randomUUID(),
    title: summary.title ?? "Untitled listing",
    variantLabel: null,
    sellerName: summary.seller?.username ?? "Unknown seller",
    hasVariations,
    price: buyerPrice,
    priceLabel: formatPrice(buyerPrice, currency),
    priceNote,
    shippingCost: shipping.cost,
    shippingLabel: shipping.label,
    totalPrice,
    totalPriceLabel,
    currency,
    condition: summary.condition ?? "—",
    listingUrl,
    imageUrl: summary.image?.imageUrl ?? null,
  };
}

async function fetchItemDetail(
  token: string,
  itemId: string,
  marketplaceId?: EbayMarketplaceId,
): Promise<EbayItemDetail | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(
      `${EBAY_API_BASE}/buy/browse/v1/item/${encodeURIComponent(itemId)}`,
      {
        headers: ebayHeaders(token, marketplaceId),
        next: { revalidate: 0 },
      },
    );

    if (response.ok) {
      return (await response.json()) as EbayItemDetail;
    }

    if (response.status === 429 && attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      continue;
    }

    return null;
  }

  return null;
}

async function fetchVariationItems(
  token: string,
  itemGroupHref: string,
  marketplaceId?: EbayMarketplaceId,
): Promise<EbayItemDetail[]> {
  const response = await fetch(itemGroupHref, {
    headers: ebayHeaders(token, marketplaceId),
    next: { revalidate: 0 },
  });

  if (!response.ok) return [];

  const data = (await response.json()) as { items?: EbayItemDetail[] };
  const variants = data.items ?? [];

  const detailed = await runBatched(variants, FETCH_BATCH, async (variant) => {
    if (!variant.itemId) return null;
    return fetchItemDetail(token, variant.itemId, marketplaceId);
  });

  return detailed.filter((item): item is EbayItemDetail => item !== null);
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
  marketplaceId?: EbayMarketplaceId,
): Promise<EbayListing[]> {
  const isVariationGroup =
    summary.itemGroupType === "SELLER_DEFINED_VARIATIONS" && summary.itemGroupHref;

  if (isVariationGroup) {
    const variants = await fetchVariationItems(token, summary.itemGroupHref!, marketplaceId);
    const siblingNetPrices = variants
      .map((variant) => Number.parseFloat(variant.price?.value ?? "0"))
      .filter((value) => value > 0);

    const rows: EbayListing[] = [];

    for (const variant of variants) {
      const netPrice = Number.parseFloat(variant.price?.value ?? "0");
      const variantLabel = extractVariantLabel(variant);

      if (isLikelyAccessoryVariant(variantLabel, netPrice, siblingNetPrices)) {
        continue;
      }

      const row = mapDetailToListing(variant, true);
      if (row) rows.push(row);
    }

    return rows;
  }

  if (!summary.itemId) return [];

  const detail = await fetchItemDetail(token, summary.itemId, marketplaceId);
  if (!detail) return [];

  const row = mapDetailToListing(detail, false);
  return row ? [row] : [];
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
  enrichDetails?: boolean;
  marketplaceId?: EbayMarketplaceId;
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
  const enrichDetails = params.enrichDetails !== false;
  const marketplaceId = params.marketplaceId;

  const token = await getAccessToken();
  const url = new URL(`${EBAY_API_BASE}/buy/browse/v1/item_summary/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("sort", sort === "desc" ? "-price" : "price");

  const response = await fetch(url.toString(), {
    headers: ebayHeaders(token, marketplaceId),
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
  const listings = enrichDetails
    ? sortListings(
        (
          await runBatched(summaries, FETCH_BATCH, (summary) =>
            enrichSearchSummary(token, summary, marketplaceId),
          )
        ).flat(),
        sort,
      )
    : sortListings(
        summaries
          .map((summary) => mapSummaryToListing(summary))
          .filter((listing): listing is EbayListing => listing !== null),
        sort,
      );

  return {
    listings,
    total: data.total ?? summaries.length,
    offerCount: listings.length,
    offset,
    limit,
  };
}

export interface ResolvedEbaySellerListing {
  title: string;
  listingUrl: string;
  sellerName: string;
  variants: EbayListing[];
}

function parseEbayListingUrlParts(rawUrl: string): { legacyItemId: string; variantId: string | null } {
  const trimmed = rawUrl.trim();
  const idMatch =
    trimmed.match(/\/itm\/(?:[^/]+\/)?(\d{9,15})/i) ??
    trimmed.match(/[?&]item=(\d{9,15})/i) ??
    trimmed.match(/^(\d{9,15})$/);

  if (!idMatch?.[1]) {
    throw new Error("Could not read eBay item ID from that URL.");
  }

  let variantId: string | null = null;
  try {
    const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    variantId = parsed.searchParams.get("var");
  } catch {
    variantId = null;
  }

  return { legacyItemId: idMatch[1], variantId };
}

function listingMatchesVariantId(listing: EbayListing, variantId: string): boolean {
  try {
    const parsed = new URL(listing.listingUrl);
    return parsed.searchParams.get("var") === variantId;
  } catch {
    return listing.id.includes(variantId) || listing.listingUrl.includes(variantId);
  }
}

async function fetchItemsByItemGroup(
  token: string,
  itemGroupId: string,
  marketplaceId?: EbayMarketplaceId,
): Promise<EbayItemDetail[]> {
  const url = new URL(`${EBAY_API_BASE}/buy/browse/v1/item/get_items_by_item_group`);
  url.searchParams.set("item_group_id", itemGroupId);

  const response = await fetch(url.toString(), {
    headers: ebayHeaders(token, marketplaceId),
    next: { revalidate: 0 },
  });

  if (!response.ok) return [];

  const data = (await response.json()) as { items?: EbayItemDetail[] };
  const items = data.items ?? [];

  const detailed = await runBatched(items, FETCH_BATCH, async (item) => {
    if (!item.itemId) return item;
    const detail = await fetchItemDetail(token, item.itemId, marketplaceId);
    return detail ?? item;
  });

  return detailed.filter((item): item is EbayItemDetail => item !== null);
}

/** Load a seller's eBay listing (all variants on that listing) from a product page URL. */
export async function resolveEbayListingFromUrl(
  rawUrl: string,
  marketplaceId?: EbayMarketplaceId,
): Promise<ResolvedEbaySellerListing> {
  const { legacyItemId, variantId } = parseEbayListingUrlParts(rawUrl);
  const token = await getAccessToken();
  const itemId = `v1|${legacyItemId}|0`;
  const detail = await fetchItemDetail(token, itemId, marketplaceId);

  if (!detail?.title) {
    throw new Error("Could not load that eBay listing. Check the URL and try again.");
  }

  const title = detail.title.trim();
  const sellerName = detail.seller?.username ?? "Unknown seller";
  const listingUrl = normalizeEbayListingUrl(detail.itemWebUrl ?? rawUrl, legacyItemId);

  const isVariationGroup =
    detail.primaryItemGroup?.itemGroupType === "SELLER_DEFINED_VARIATIONS" &&
    detail.primaryItemGroup.itemGroupId;

  let variantDetails: EbayItemDetail[] = [detail];

  if (isVariationGroup && detail.primaryItemGroup?.itemGroupId) {
    const groupItems = await fetchItemsByItemGroup(
      token,
      detail.primaryItemGroup.itemGroupId,
      marketplaceId,
    );
    if (groupItems.length > 0) {
      const siblingNetPrices = groupItems
        .map((item) => Number.parseFloat(item.price?.value ?? "0"))
        .filter((value) => value > 0);

      variantDetails = groupItems.filter((item) => {
        const netPrice = Number.parseFloat(item.price?.value ?? "0");
        const label = extractVariantLabel(item);
        return !isLikelyAccessoryVariant(label, netPrice, siblingNetPrices);
      });
    }
  }

  let variants = variantDetails
    .map((item) => mapDetailToListing(item, variantDetails.length > 1))
    .filter((listing): listing is EbayListing => listing !== null);

  if (variantId) {
    const filtered = variants.filter((listing) => listingMatchesVariantId(listing, variantId));
    if (filtered.length > 0) {
      variants = filtered;
    }
  }

  if (variants.length === 0) {
    const single = mapDetailToListing(detail, false);
    if (!single) {
      throw new Error("Could not read pricing for that eBay listing.");
    }
    variants = [single];
  }

  return {
    title,
    listingUrl,
    sellerName,
    variants,
  };
}
