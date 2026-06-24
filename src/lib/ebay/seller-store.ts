import "server-only";

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

interface InventoryItemResponse {
  product?: {
    title?: string;
    imageUrls?: string[];
    aspects?: Record<string, string[]>;
  };
  availability?: {
    shipToLocationAvailability?: { quantity?: number };
  };
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

async function fetchOffersPage(
  token: string,
  marketplaceId: Awaited<ReturnType<typeof getSellerMarketplaceId>>,
  offset: number,
): Promise<RawOffer[]> {
  const url = new URL(`${EBAY_API_BASE}/sell/inventory/v1/offer`);
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("marketplace_id", resolveMarketplaceConfig(marketplaceId).marketplaceId);

  const response = await fetch(url.toString(), {
    headers: inventoryHeaders(token, marketplaceId),
    cache: "no-store",
  });

  const body = (await response.json()) as { offers?: RawOffer[]; errors?: Array<{ message?: string }> };
  if (!response.ok) {
    throw new Error(body.errors?.[0]?.message ?? "Failed to load your eBay store.");
  }

  return body.offers ?? [];
}

async function fetchInventoryItem(
  token: string,
  marketplaceId: Awaited<ReturnType<typeof getSellerMarketplaceId>>,
  sku: string,
): Promise<InventoryItemResponse | null> {
  const response = await fetch(
    `${EBAY_API_BASE}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
    {
      headers: inventoryHeaders(token, marketplaceId),
      cache: "no-store",
    },
  );

  if (!response.ok) return null;
  return (await response.json()) as InventoryItemResponse;
}

function groupKeyForOffer(offer: RawOffer): string {
  if (offer.inventoryItemGroupKey?.trim()) return `group:${offer.inventoryItemGroupKey.trim()}`;
  if (offer.listing?.listingId?.trim()) return `listing:${offer.listing.listingId.trim()}`;
  if (offer.offerId?.trim()) return `offer:${offer.offerId.trim()}`;
  return `sku:${offer.sku?.trim() ?? offer.offerId?.trim() ?? "unknown"}`;
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

  const grouped = new Map<string, RawOffer[]>();
  for (const offer of offers) {
    const key = groupKeyForOffer(offer);
    const list = grouped.get(key) ?? [];
    list.push(offer);
    grouped.set(key, list);
  }

  const inventoryCache = new Map<string, InventoryItemResponse | null>();
  const listings: StoreImportListing[] = [];

  for (const groupOffers of grouped.values()) {
    const primary = groupOffers[0];
    if (!primary?.sku || !primary.offerId) continue;

    const listingId = primary.listing?.listingId?.trim() ?? primary.offerId;
    const listingUrl = primary.listing?.listingId
      ? buildEbayListingUrl(primary.listing.listingId, marketplaceId)
      : buildEbayListingUrl(listingId, marketplaceId);

    const variants: StoreImportVariant[] = [];

    for (const offer of groupOffers) {
      const sku = offer.sku?.trim();
      const offerId = offer.offerId?.trim();
      if (!sku || !offerId) continue;

      if (!inventoryCache.has(sku)) {
        inventoryCache.set(sku, await fetchInventoryItem(token, marketplaceId, sku));
      }
      const inventory = inventoryCache.get(sku);
      const price = Number(offer.pricingSummary?.price?.value ?? 0);
      const currency = offer.pricingSummary?.price?.currency ?? "GBP";
      const quantity =
        offer.availableQuantity ??
        inventory?.availability?.shipToLocationAvailability?.quantity ??
        0;

      variants.push({
        sku,
        offerId,
        label: variantLabelFromAspects(inventory?.product?.aspects, marketplaceId),
        price: Number.isFinite(price) ? price : 0,
        quantity: Math.max(0, Number(quantity) || 0),
        imageUrl: inventory?.product?.imageUrls?.[0] ?? null,
      });

      if (!listings.length && currency) {
        // currency captured from first variant below
      }
    }

    if (variants.length === 0) continue;

    const primaryInventory = inventoryCache.get(primary.sku.trim());
    const title = primaryInventory?.product?.title?.trim() || `Listing ${listingId}`;
    const imageUrl =
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
