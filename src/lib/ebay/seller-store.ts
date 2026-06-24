import "server-only";

import { serverEnv } from "@/lib/env";
import { buildEbayListingUrl, getSellerMarketplaceId, resolveMarketplaceConfig } from "@/lib/ebay/marketplace";
import { getEbayConnectionStatus, getEbayUserAccessToken } from "@/lib/ebay/oauth-user";
import { getListedProducts } from "@/lib/listings/listed-products-service";
import type { StoreImportListing, StoreImportVariant } from "@/types/store-import";

const EBAY_API_BASE = "https://api.ebay.com";
const BROWSE_PAGE_SIZE = 200;
const MIGRATE_BATCH_SIZE = 5;

interface EbayItemSummary {
  itemId?: string;
  legacyItemId?: string;
  title?: string;
  itemWebUrl?: string;
  price?: { value?: string; currency?: string };
  image?: { imageUrl?: string };
  itemGroupType?: string;
  itemGroupHref?: string;
}

interface EbayItemDetail {
  itemId?: string;
  legacyItemId?: string;
  title?: string;
  itemWebUrl?: string;
  price?: { value?: string; currency?: string };
  image?: { imageUrl?: string };
  localizedAspects?: Array<{ name?: string; value?: string }>;
  color?: string;
}

interface BrowseStoreRow {
  listingId: string;
  listingUrl: string;
  title: string;
  imageUrl: string | null;
  price: number;
  currency: string;
  label: string;
}

interface ResolvedOfferRow {
  sku: string;
  offerId: string;
}

function inventoryHeaders(token: string, marketplaceId: Awaited<ReturnType<typeof getSellerMarketplaceId>>): HeadersInit {
  const { contentLanguage, acceptLanguage } = resolveMarketplaceConfig(marketplaceId);
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "Content-Language": contentLanguage,
    "Accept-Language": acceptLanguage,
  };
}

function browseHeaders(token: string, marketplaceId: Awaited<ReturnType<typeof getSellerMarketplaceId>>): HeadersInit {
  const config = resolveMarketplaceConfig(marketplaceId);
  return {
    Authorization: `Bearer ${token}`,
    "X-EBAY-C-MARKETPLACE-ID": config.marketplaceId,
    "X-EBAY-C-ENDUSERCTX": `contextualLocation=country=${config.endUserCountry}`,
  };
}

let browseTokenCache: { token: string; expiresAt: number } | null = null;

async function getBrowseAccessToken(): Promise<string> {
  if (browseTokenCache && Date.now() < browseTokenCache.expiresAt - 60_000) {
    return browseTokenCache.token;
  }

  const appId = serverEnv.ebayAppId();
  const certId = serverEnv.ebayCertId();
  if (!appId || !certId) {
    throw new Error("eBay API credentials are not configured.");
  }

  const credentials = Buffer.from(`${appId}:${certId}`).toString("base64");
  const response = await fetch(`${EBAY_API_BASE}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
    cache: "no-store",
  });

  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!response.ok || !data.access_token) {
    throw new Error("Failed to obtain eBay browse token.");
  }

  browseTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
  };
  return data.access_token;
}

function extractListingId(item: { itemId?: string; legacyItemId?: string; itemWebUrl?: string }): string | null {
  const legacy = item.legacyItemId?.trim();
  if (legacy && /^\d{9,15}$/.test(legacy)) return legacy;

  const itemId = item.itemId?.trim();
  if (itemId) {
    const pipeMatch = itemId.match(/\|(\d{9,15})\|/);
    if (pipeMatch?.[1]) return pipeMatch[1];
    if (/^\d{9,15}$/.test(itemId)) return itemId;
  }

  const url = item.itemWebUrl?.trim();
  if (url) {
    const match = url.match(/\/itm\/(?:[^/]+\/)?(\d{9,15})/i);
    if (match?.[1]) return match[1];
  }

  return null;
}

function normalizeListingUrl(listingId: string, itemWebUrl?: string): string {
  if (itemWebUrl?.trim()) {
    try {
      const parsed = new URL(itemWebUrl);
      const match = parsed.pathname.match(/(\d{9,15})/);
      if (match?.[1]) return `https://www.ebay.co.uk/itm/${match[1]}`;
    } catch {
      // fall through
    }
  }
  return `https://www.ebay.co.uk/itm/${listingId}`;
}

function variantLabelFromDetail(item: EbayItemDetail): string {
  const colour =
    item.color?.trim() ||
    item.localizedAspects?.find((aspect) => /colou?r/i.test(aspect.name ?? ""))?.value?.trim() ||
    "";
  const size = item.localizedAspects?.find((aspect) => /^size$/i.test(aspect.name ?? ""))?.value?.trim() || "";
  if (colour && size) return `${colour} / ${size}`;
  if (colour) return colour;
  if (size) return size;
  return "Default";
}

function mapDetailToRow(item: EbayItemDetail, fallbackTitle: string): BrowseStoreRow | null {
  const listingId = extractListingId(item);
  if (!listingId) return null;

  const price = Number.parseFloat(item.price?.value ?? "0");
  if (!Number.isFinite(price) || price <= 0) return null;

  return {
    listingId,
    listingUrl: normalizeListingUrl(listingId, item.itemWebUrl),
    title: item.title?.trim() || fallbackTitle,
    imageUrl: item.image?.imageUrl ?? null,
    price,
    currency: item.price?.currency ?? "GBP",
    label: variantLabelFromDetail(item),
  };
}

async function fetchItemDetail(
  token: string,
  itemId: string,
  marketplaceId: Awaited<ReturnType<typeof getSellerMarketplaceId>>,
): Promise<EbayItemDetail | null> {
  try {
    const response = await fetch(`${EBAY_API_BASE}/buy/browse/v1/item/${encodeURIComponent(itemId)}`, {
      headers: browseHeaders(token, marketplaceId),
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as EbayItemDetail;
  } catch {
    return null;
  }
}

async function fetchVariationRows(
  token: string,
  summary: EbayItemSummary,
  marketplaceId: Awaited<ReturnType<typeof getSellerMarketplaceId>>,
): Promise<BrowseStoreRow[]> {
  if (!summary.itemGroupHref?.trim()) return [];

  try {
    const response = await fetch(summary.itemGroupHref, {
      headers: browseHeaders(token, marketplaceId),
      cache: "no-store",
    });
    if (!response.ok) return [];

    const data = (await response.json()) as { items?: EbayItemDetail[] };
    const rows: BrowseStoreRow[] = [];
    for (const item of data.items ?? []) {
      const row = mapDetailToRow(item, summary.title?.trim() || "Listing");
      if (row) rows.push(row);
    }
    return rows;
  } catch {
    return [];
  }
}

async function summaryToRows(
  token: string,
  summary: EbayItemSummary,
  marketplaceId: Awaited<ReturnType<typeof getSellerMarketplaceId>>,
): Promise<BrowseStoreRow[]> {
  const isVariationGroup =
    summary.itemGroupType === "SELLER_DEFINED_VARIATIONS" && summary.itemGroupHref?.trim();

  if (isVariationGroup) {
    const rows = await fetchVariationRows(token, summary, marketplaceId);
    if (rows.length > 0) return rows;
  }

  if (!summary.itemId?.trim()) return [];

  const detail = await fetchItemDetail(token, summary.itemId, marketplaceId);
  if (detail) {
    const row = mapDetailToRow(detail, summary.title?.trim() || "Listing");
    return row ? [row] : [];
  }

  const listingId = extractListingId(summary);
  if (!listingId) return [];

  const price = Number.parseFloat(summary.price?.value ?? "0");
  if (!Number.isFinite(price) || price <= 0) return [];

  return [
    {
      listingId,
      listingUrl: normalizeListingUrl(listingId, summary.itemWebUrl),
      title: summary.title?.trim() || `Listing ${listingId}`,
      imageUrl: summary.image?.imageUrl ?? null,
      price,
      currency: summary.price?.currency ?? "GBP",
      label: "Default",
    },
  ];
}

async function fetchSellerBrowseRows(
  sellerUsername: string,
  marketplaceId: Awaited<ReturnType<typeof getSellerMarketplaceId>>,
): Promise<BrowseStoreRow[]> {
  const token = await getBrowseAccessToken();
  const searchQuery = sellerUsername.length >= 2 ? sellerUsername : `${sellerUsername}x`;
  const rows: BrowseStoreRow[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total) {
    const url = new URL(`${EBAY_API_BASE}/buy/browse/v1/item_summary/search`);
    url.searchParams.set("q", searchQuery);
    url.searchParams.set("filter", `sellers:{${sellerUsername}}`);
    url.searchParams.set("limit", String(BROWSE_PAGE_SIZE));
    url.searchParams.set("offset", String(offset));

    const response = await fetch(url.toString(), {
      headers: browseHeaders(token, marketplaceId),
      cache: "no-store",
    });

    const data = (await response.json()) as {
      itemSummaries?: EbayItemSummary[];
      total?: number;
      errors?: Array<{ message?: string }>;
    };

    if (!response.ok) {
      throw new Error(data.errors?.[0]?.message ?? "Failed to load your eBay store.");
    }

    total = data.total ?? 0;
    const summaries = data.itemSummaries ?? [];
    if (summaries.length === 0) break;

    for (const summary of summaries) {
      const batch = await summaryToRows(token, summary, marketplaceId);
      rows.push(...batch);
    }

    offset += summaries.length;
    if (summaries.length < BROWSE_PAGE_SIZE) break;
  }

  return rows;
}

function groupBrowseRows(rows: BrowseStoreRow[]): Map<string, BrowseStoreRow[]> {
  const grouped = new Map<string, BrowseStoreRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.listingId) ?? [];
    list.push(row);
    grouped.set(row.listingId, list);
  }
  return grouped;
}

async function resolveOffersByListingIds(
  token: string,
  marketplaceId: Awaited<ReturnType<typeof getSellerMarketplaceId>>,
  listingIds: string[],
): Promise<Map<string, ResolvedOfferRow[]>> {
  const resolved = new Map<string, ResolvedOfferRow[]>();

  for (let index = 0; index < listingIds.length; index += MIGRATE_BATCH_SIZE) {
    const batch = listingIds.slice(index, index + MIGRATE_BATCH_SIZE);
    try {
      const response = await fetch(`${EBAY_API_BASE}/sell/inventory/v1/bulk_migrate_listing`, {
        method: "POST",
        headers: inventoryHeaders(token, marketplaceId),
        body: JSON.stringify({
          requests: batch.map((listingId) => ({ listingId })),
        }),
        cache: "no-store",
      });

      const data = (await response.json()) as {
        responses?: Array<{
          statusCode?: number;
          listingId?: string;
          inventoryItems?: Array<{ sku?: string; offerId?: string }>;
          offers?: Array<{ sku?: string; offerId?: string }>;
          errors?: Array<{ message?: string }>;
        }>;
      };

      if (!response.ok) continue;

      for (const entry of data.responses ?? []) {
        const listingId = entry.listingId?.trim();
        if (!listingId) continue;

        const offerRows: ResolvedOfferRow[] = [];
        const sources = [...(entry.inventoryItems ?? []), ...(entry.offers ?? [])];

        for (const source of sources) {
          const offerId = source.offerId?.trim();
          const sku = source.sku?.trim();
          if (!offerId) continue;
          offerRows.push({ offerId, sku: sku || offerId });
        }

        if (offerRows.length > 0) {
          resolved.set(listingId, offerRows);
        }
      }
    } catch {
      continue;
    }
  }

  return resolved;
}

function buildVariants(
  browseRows: BrowseStoreRow[],
  offerRows: ResolvedOfferRow[] | undefined,
): StoreImportVariant[] {
  if (offerRows && offerRows.length > 0) {
    return offerRows.map((offer, index) => {
      const browse = browseRows[index] ?? browseRows[0];
      return {
        sku: offer.sku,
        offerId: offer.offerId,
        label: browse?.label ?? (offerRows.length > 1 ? `Variant ${index + 1}` : "Default"),
        price: browse?.price ?? 0,
        quantity: 1,
        imageUrl: browse?.imageUrl ?? null,
      };
    });
  }

  return browseRows.map((row, index) => ({
    sku: row.listingId,
    offerId: row.listingId,
    label: row.label || (browseRows.length > 1 ? `Variant ${index + 1}` : "Default"),
    price: row.price,
    quantity: 1,
    imageUrl: row.imageUrl,
  }));
}

export async function fetchSellerEbayStore(userId: string): Promise<StoreImportListing[]> {
  const token = await getEbayUserAccessToken(userId);
  if (!token) {
    throw new Error("eBay account is not connected. Connect eBay first.");
  }

  const status = await getEbayConnectionStatus(userId);
  const sellerUsername = status.ebayUsername?.trim();
  if (!sellerUsername) {
    throw new Error("eBay store username not found. Reconnect your eBay account.");
  }

  const marketplaceId = await getSellerMarketplaceId(userId);
  const browseRows = await fetchSellerBrowseRows(sellerUsername, marketplaceId);
  const grouped = groupBrowseRows(browseRows);
  const listingIds = [...grouped.keys()];

  const offersByListingId = await resolveOffersByListingIds(token, marketplaceId, listingIds);
  const listings: StoreImportListing[] = [];

  for (const [listingId, rows] of grouped.entries()) {
    const primary = rows[0];
    if (!primary) continue;

    const variants = buildVariants(rows, offersByListingId.get(listingId));
    if (variants.length === 0) continue;

    listings.push({
      listingId,
      listingUrl: buildEbayListingUrl(listingId, marketplaceId) || primary.listingUrl,
      title: primary.title,
      imageUrl: primary.imageUrl ?? variants.find((variant) => variant.imageUrl)?.imageUrl ?? null,
      currency: primary.currency,
      variants,
      groupSku: variants.length > 1 ? listingId : null,
      linked: false,
      listedProductId: null,
      aliexpressUrl: null,
    });
  }

  const saved = await getListedProducts(userId);
  const savedByListingId = new Map(
    saved
      .filter((product) => product.platform === "ebay" && product.listingId)
      .map((product) => [product.listingId as string, product]),
  );

  return listings
    .map((listing) => {
      const savedProduct = savedByListingId.get(listing.listingId);
      if (!savedProduct) return listing;
      return {
        ...listing,
        linked: true,
        listedProductId: savedProduct.id,
        aliexpressUrl: savedProduct.aliexpressUrl,
      };
    })
    .sort((a, b) => {
      if (a.linked === b.linked) return a.title.localeCompare(b.title);
      return a.linked ? 1 : -1;
    });
}
