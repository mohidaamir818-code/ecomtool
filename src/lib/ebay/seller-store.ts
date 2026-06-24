import "server-only";

import { serverEnv } from "@/lib/env";
import { buildEbayListingUrl, getSellerMarketplaceId, resolveMarketplaceConfig } from "@/lib/ebay/marketplace";
import { getEbayUserAccessToken } from "@/lib/ebay/oauth-user";
import { getListedProducts } from "@/lib/listings/listed-products-service";
import type { StoreImportListing, StoreImportVariant } from "@/types/store-import";

const EBAY_API_BASE = "https://api.ebay.com";
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

interface RawOffer {
  offerId?: string;
  sku?: string;
  inventoryItemGroupKey?: string;
  status?: string;
  availableQuantity?: number;
  listing?: { listingId?: string };
  pricingSummary?: { price?: { value?: string; currency?: string } };
}

interface InventoryItemRecord {
  sku?: string;
  product?: {
    title?: string;
    imageUrls?: string[];
    aspects?: Record<string, string[]>;
  };
  availability?: {
    shipToLocationAvailability?: { quantity?: number };
  };
}

interface BrowseListingPreview {
  title: string;
  imageUrl: string | null;
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

function variantLabelFromAspects(
  aspects: Record<string, string[]> | undefined,
  marketplaceId: Awaited<ReturnType<typeof getSellerMarketplaceId>>,
): string {
  if (!aspects) return "Default";
  const colourKey = marketplaceId === "EBAY_GB" ? "Colour" : "Color";
  const colour = aspects[colourKey]?.[0] ?? aspects.Color?.[0] ?? aspects.Colour?.[0] ?? "";
  const size = aspects.Size?.[0] ?? "";
  if (colour && size) return `${colour} / ${size}`;
  if (colour) return colour;
  if (size) return size;
  return "Default";
}

let browseTokenCache: { token: string; expiresAt: number } | null = null;

async function getBrowseAccessToken(): Promise<string | null> {
  if (browseTokenCache && Date.now() < browseTokenCache.expiresAt - 60_000) {
    return browseTokenCache.token;
  }

  const appId = serverEnv.ebayAppId();
  const certId = serverEnv.ebayCertId();
  if (!appId || !certId) return null;

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
  if (!response.ok || !data.access_token) return null;

  browseTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
  };
  return data.access_token;
}

async function fetchBrowseListingPreview(
  listingId: string,
  marketplaceId: Awaited<ReturnType<typeof getSellerMarketplaceId>>,
): Promise<BrowseListingPreview | null> {
  const token = await getBrowseAccessToken();
  if (!token) return null;

  const config = resolveMarketplaceConfig(marketplaceId);
  const candidates = [`v1|${listingId}|0`, listingId];

  for (const itemId of candidates) {
    try {
      const response = await fetch(`${EBAY_API_BASE}/buy/browse/v1/item/${encodeURIComponent(itemId)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-EBAY-C-MARKETPLACE-ID": config.marketplaceId,
          "X-EBAY-C-ENDUSERCTX": `contextualLocation=country=${config.endUserCountry}`,
        },
        cache: "no-store",
      });
      if (!response.ok) continue;

      const data = (await response.json()) as {
        title?: string;
        image?: { imageUrl?: string };
      };
      const title = data.title?.trim();
      if (!title) continue;

      return {
        title,
        imageUrl: data.image?.imageUrl ?? null,
      };
    } catch {
      continue;
    }
  }

  return null;
}

async function fetchOffersPage(
  token: string,
  marketplaceId: Awaited<ReturnType<typeof getSellerMarketplaceId>>,
  offset: number,
  includeMarketplace = true,
): Promise<RawOffer[]> {
  const url = new URL(`${EBAY_API_BASE}/sell/inventory/v1/offer`);
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("offset", String(offset));
  if (includeMarketplace) {
    url.searchParams.set("marketplace_id", resolveMarketplaceConfig(marketplaceId).marketplaceId);
  }

  const response = await fetch(url.toString(), {
    headers: inventoryHeaders(token, marketplaceId),
    cache: "no-store",
  });

  const body = (await response.json()) as { offers?: RawOffer[]; errors?: Array<{ message?: string }> };
  if (!response.ok) {
    const message = body.errors?.[0]?.message ?? "Failed to load your eBay store.";
    if (includeMarketplace && offset === 0 && /sku/i.test(message)) {
      return fetchOffersPage(token, marketplaceId, offset, false);
    }
    throw new Error(message);
  }

  return body.offers ?? [];
}

async function fetchInventoryItemsPage(
  token: string,
  marketplaceId: Awaited<ReturnType<typeof getSellerMarketplaceId>>,
  offset: number,
): Promise<InventoryItemRecord[]> {
  const url = new URL(`${EBAY_API_BASE}/sell/inventory/v1/inventory_item`);
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("offset", String(offset));

  try {
    const response = await fetch(url.toString(), {
      headers: inventoryHeaders(token, marketplaceId),
      cache: "no-store",
    });

    const body = (await response.json()) as {
      inventoryItems?: InventoryItemRecord[];
      errors?: Array<{ message?: string }>;
    };

    if (!response.ok) return [];
    return body.inventoryItems ?? [];
  } catch {
    return [];
  }
}

function groupKeyForOffer(offer: RawOffer): string {
  if (offer.inventoryItemGroupKey?.trim()) return `group:${offer.inventoryItemGroupKey.trim()}`;
  if (offer.listing?.listingId?.trim()) return `listing:${offer.listing.listingId.trim()}`;
  if (offer.offerId?.trim()) return `offer:${offer.offerId.trim()}`;
  return `sku:${offer.sku?.trim() ?? offer.offerId?.trim() ?? "unknown"}`;
}

async function loadInventoryBySku(
  token: string,
  marketplaceId: Awaited<ReturnType<typeof getSellerMarketplaceId>>,
): Promise<Map<string, InventoryItemRecord>> {
  const map = new Map<string, InventoryItemRecord>();

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const batch = await fetchInventoryItemsPage(token, marketplaceId, page * PAGE_SIZE);
    for (const item of batch) {
      const sku = item.sku?.trim();
      if (sku) map.set(sku, item);
    }
    if (batch.length < PAGE_SIZE) break;
  }

  return map;
}

export async function fetchSellerEbayStore(userId: string): Promise<StoreImportListing[]> {
  const token = await getEbayUserAccessToken(userId);
  if (!token) {
    throw new Error("eBay account is not connected. Connect eBay first.");
  }

  const marketplaceId = await getSellerMarketplaceId(userId);
  const offers: RawOffer[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const batch = await fetchOffersPage(token, marketplaceId, page * PAGE_SIZE);
    offers.push(...batch.filter((offer) => offer.status === "PUBLISHED" || offer.listing?.listingId));
    if (batch.length < PAGE_SIZE) break;
  }

  const inventoryBySku = await loadInventoryBySku(token, marketplaceId);
  const browseCache = new Map<string, BrowseListingPreview | null>();

  const grouped = new Map<string, RawOffer[]>();
  for (const offer of offers) {
    const key = groupKeyForOffer(offer);
    const list = grouped.get(key) ?? [];
    list.push(offer);
    grouped.set(key, list);
  }

  const listings: StoreImportListing[] = [];

  for (const groupOffers of grouped.values()) {
    const primary = groupOffers[0];
    if (!primary?.offerId) continue;

    const listingId = primary.listing?.listingId?.trim() ?? primary.offerId.trim();
    const listingUrl = primary.listing?.listingId
      ? buildEbayListingUrl(primary.listing.listingId, marketplaceId)
      : buildEbayListingUrl(listingId, marketplaceId);

    if (!browseCache.has(listingId)) {
      browseCache.set(listingId, await fetchBrowseListingPreview(listingId, marketplaceId));
    }
    const browsePreview = browseCache.get(listingId) ?? null;

    const variants: StoreImportVariant[] = [];

    for (const [index, offer] of groupOffers.entries()) {
      const sku = offer.sku?.trim();
      const offerId = offer.offerId?.trim();
      if (!offerId) continue;

      const inventory = sku ? inventoryBySku.get(sku) : undefined;
      const price = Number(offer.pricingSummary?.price?.value ?? 0);
      const quantity =
        offer.availableQuantity ??
        inventory?.availability?.shipToLocationAvailability?.quantity ??
        0;

      variants.push({
        sku: sku ?? offerId,
        offerId,
        label:
          variantLabelFromAspects(inventory?.product?.aspects, marketplaceId) ||
          (groupOffers.length > 1 ? `Variant ${index + 1}` : "Default"),
        price: Number.isFinite(price) ? price : 0,
        quantity: Math.max(0, Number(quantity) || 0),
        imageUrl: inventory?.product?.imageUrls?.[0] ?? browsePreview?.imageUrl ?? null,
      });
    }

    if (variants.length === 0) continue;

    const primarySku = primary.sku?.trim();
    const primaryInventory = primarySku ? inventoryBySku.get(primarySku) : undefined;
    const title =
      browsePreview?.title?.trim() ||
      primaryInventory?.product?.title?.trim() ||
      `Listing ${listingId}`;
    const imageUrl =
      browsePreview?.imageUrl ??
      primaryInventory?.product?.imageUrls?.[0] ??
      variants.find((variant) => variant.imageUrl)?.imageUrl ??
      null;
    const currency = groupOffers[0]?.pricingSummary?.price?.currency ?? "GBP";

    listings.push({
      listingId,
      listingUrl,
      title,
      imageUrl,
      currency,
      variants,
      groupSku: primary.inventoryItemGroupKey?.trim() ?? null,
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
