import "server-only";

import { buildDescriptionHtmlWithImages, getSelectedDescriptionPhotos } from "@/features/listings/lib/draft-utils";
import { getAppOrigin } from "@/lib/env";
import { requireConfirmedLocation } from "@/lib/ebay/inventory-location";
import {
  assertUniqueVariantSkus,
  resolveGroupSkuKey,
  resolveVariantSkuForEbay,
} from "@/lib/listings/internal-sku";
import {
  detectAgeGroupFromText,
  detectDepartmentFromText,
  detectSizeTypeFromText,
  findItemSpecificValue,
  MPN_DOES_NOT_APPLY,
  MPN_DOES_NOT_APPLY_EBAY,
  UNBRANDED,
} from "@/lib/listings/item-specifics";
import {
  buildEbayListingUrl,
  getSellerMarketplaceId,
  resolveMarketplaceConfig,
  type EbayMarketplaceId,
} from "@/lib/ebay/marketplace";
import { getEbayUserAccessToken } from "@/lib/ebay/oauth-user";
import type {
  EbayBusinessPolicies,
  EbayCategorySuggestion,
  GeneratedListing,
  ListingDraft,
  ListOnEbayResult,
  VolumePromotionTier,
} from "@/types/listing-generator";
import { DEFAULT_PROMOTIONS } from "@/types/listing-generator";

const EBAY_API_BASE = "https://api.ebay.com";
const MAX_PHOTOS = 24;

function taxonomyHeaders(token: string, marketplaceId: EbayMarketplaceId): HeadersInit {
  const { acceptLanguage } = resolveMarketplaceConfig(marketplaceId);
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Accept-Language": acceptLanguage,
  };
}

function inventoryHeaders(token: string, marketplaceId: EbayMarketplaceId): HeadersInit {
  const { contentLanguage, acceptLanguage } = resolveMarketplaceConfig(marketplaceId);
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "Content-Language": contentLanguage,
    "Accept-Language": acceptLanguage,
  };
}

export class EbayApiError extends Error {
  readonly status: number;
  readonly rawBody: string;
  readonly url: string;

  constructor(message: string, status: number, rawBody: string, url: string) {
    super(message);
    this.name = "EbayApiError";
    this.status = status;
    this.rawBody = rawBody;
    this.url = url;
  }
}

function redactHeaders(headers: HeadersInit): Record<string, string> {
  const result: Record<string, string> = {};

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      result[key] = key.toLowerCase() === "authorization" ? "Bearer [REDACTED]" : value;
    });
    return result;
  }

  if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      result[key] = key.toLowerCase() === "authorization" ? "Bearer [REDACTED]" : value;
    }
    return result;
  }

  for (const [key, value] of Object.entries(headers)) {
    result[key] = key.toLowerCase() === "authorization" ? "Bearer [REDACTED]" : String(value);
  }

  return result;
}

async function ebayFetch(
  label: string,
  url: string,
  init: RequestInit,
): Promise<{ response: Response; bodyText: string }> {
  console.log(`[eBay ${label}] Calling:`, url);
  console.log(`[eBay ${label}] Headers:`, JSON.stringify(redactHeaders(init.headers ?? {})));
  if (init.body) console.log(`[eBay ${label}] Body:`, init.body);

  const response = await fetch(url, init);
  const bodyText = await response.text();

  console.log(`[eBay ${label}] Status:`, response.status);
  console.log(`[eBay ${label}] Body:`, bodyText);

  return { response, bodyText };
}

function parseEbayErrorMessage(bodyText: string, fallback: string): string {
  try {
    const data = JSON.parse(bodyText) as {
      errors?: Array<{ message?: string; longMessage?: string }>;
    };
    return data.errors?.[0]?.longMessage ?? data.errors?.[0]?.message ?? fallback;
  } catch {
    return bodyText || fallback;
  }
}

function parseJsonSafe<T>(bodyText: string, fallback: T): T {
  if (!bodyText.trim()) return fallback;
  try {
    return JSON.parse(bodyText) as T;
  } catch {
    return fallback;
  }
}

function throwEbayApiError(url: string, response: Response, bodyText: string, fallback: string): never {
  throw new EbayApiError(parseEbayErrorMessage(bodyText, fallback), response.status, bodyText, url);
}

function mapCondition(condition: string): string {
  const normalized = condition.toLowerCase();
  if (normalized.includes("used")) return "USED_EXCELLENT";
  if (normalized.includes("new with defects")) return "NEW_WITH_DEFECTS";
  if (normalized.includes("new without tags")) return "NEW_OTHER";
  if (normalized.includes("new with tags")) return "NEW";
  if (normalized.includes("new other")) return "NEW_OTHER";
  return "NEW";
}

function resolveVariantQuantity(variant: ListingDraft["variants"][number]): number {
  return variant.quantity >= 1 ? variant.quantity : 1;
}

function normalizeImageUrls(urls: string[]): string[] {
  return urls
    .slice(0, MAX_PHOTOS)
    .map((url) => url.replace(/^\/\//, "https://"))
    .filter(Boolean);
}

function aspectsFromListing(listing: GeneratedListing): Record<string, string[]> {
  const aspects: Record<string, string[]> = {};

  for (const specific of listing.itemSpecifics) {
    const nameLower = specific.name.toLowerCase();
    if (nameLower === "brand") {
      aspects.Brand = [UNBRANDED];
      continue;
    }
    if (nameLower === "condition") continue;
    aspects[specific.name] = [specific.value];
  }

  const department =
    findItemSpecificValue(listing.itemSpecifics, "Department") ??
    detectDepartmentFromText(listing.seoTitle, listing.descriptionHtml);
  const sizeType =
    findItemSpecificValue(listing.itemSpecifics, "Size Type") ??
    detectSizeTypeFromText(listing.seoTitle, listing.descriptionHtml);
  const ageGroup =
    findItemSpecificValue(listing.itemSpecifics, "Age Group") ??
    detectAgeGroupFromText(listing.seoTitle, listing.descriptionHtml);

  if (!aspects.Brand) {
    aspects.Brand = [UNBRANDED];
  }
  if (!aspects.MPN) {
    aspects.MPN = [MPN_DOES_NOT_APPLY_EBAY];
  } else if (aspects.MPN[0] === MPN_DOES_NOT_APPLY) {
    aspects.MPN = [MPN_DOES_NOT_APPLY_EBAY];
  }
  if (!aspects.Department) {
    aspects.Department = [department];
  }
  if (!aspects["Size Type"]) {
    aspects["Size Type"] = [sizeType];
  }
  if (!aspects["Age Group"]) {
    aspects["Age Group"] = [ageGroup];
  }

  return aspects;
}

function buildVolumePricing(promotions: VolumePromotionTier[]) {
  return promotions
    .filter((tier) => tier.enabled && tier.discountPercent > 0)
    .map((tier) => ({
      quantity: tier.quantity,
      discountPercentage: tier.discountPercent.toFixed(2),
    }));
}

export async function getCategorySuggestions(
  token: string,
  query: string,
  marketplaceId?: EbayMarketplaceId,
): Promise<EbayCategorySuggestion[]> {
  const config = resolveMarketplaceConfig(marketplaceId);
  const resolvedMarketplaceId = config.marketplaceId;
  const url = new URL(
    `${EBAY_API_BASE}/commerce/taxonomy/v1/category_tree/${config.categoryTreeId}/get_category_suggestions`,
  );
  url.searchParams.set("q", query.slice(0, 80));

  const requestUrl = url.toString();
  const { response, bodyText } = await ebayFetch("taxonomy/suggestions", requestUrl, {
    headers: taxonomyHeaders(token, resolvedMarketplaceId),
    cache: "no-store",
  });

  if (!response.ok) return [];

  const data = parseJsonSafe(bodyText, {} as {
    categorySuggestions?: Array<{
      category?: { categoryId?: string; categoryName?: string };
      categoryTreeNodeAncestors?: Array<{ categoryName?: string }>;
    }>;
  });

  return (data.categorySuggestions ?? [])
    .map((entry) => {
      const categoryId = entry.category?.categoryId;
      const categoryName = entry.category?.categoryName;
      if (!categoryId || !categoryName) return null;

      const ancestors = (entry.categoryTreeNodeAncestors ?? [])
        .map((node) => node.categoryName)
        .filter(Boolean)
        .reverse();

      return {
        categoryId,
        categoryName,
        categoryPath: [...ancestors, categoryName].join(" > "),
      } satisfies EbayCategorySuggestion;
    })
    .filter((entry): entry is EbayCategorySuggestion => entry !== null);
}

export async function getItemAspectsForCategory(
  token: string,
  categoryId: string,
  marketplaceId?: EbayMarketplaceId,
): Promise<string[]> {
  const config = resolveMarketplaceConfig(marketplaceId);
  const resolvedMarketplaceId = config.marketplaceId;
  const url = new URL(
    `${EBAY_API_BASE}/commerce/taxonomy/v1/category_tree/${config.categoryTreeId}/get_item_aspects_for_category`,
  );
  url.searchParams.set("category_id", categoryId);

  const requestUrl = url.toString();
  const { response, bodyText } = await ebayFetch("taxonomy/aspects", requestUrl, {
    headers: taxonomyHeaders(token, resolvedMarketplaceId),
    cache: "no-store",
  });

  if (!response.ok) return [];

  const data = parseJsonSafe(bodyText, {} as {
    aspects?: Array<{ localizedAspectName?: string }>;
  });

  return (data.aspects ?? [])
    .map((aspect) => aspect.localizedAspectName?.trim())
    .filter((name): name is string => Boolean(name));
}

async function resolveCategoryId(
  token: string,
  listing: GeneratedListing,
  marketplaceId: EbayMarketplaceId,
): Promise<string> {
  if (listing.categoryId) return listing.categoryId;

  const suggestions = await getCategorySuggestions(
    token,
    listing.categorySuggestion || listing.seoTitle,
    marketplaceId,
  );

  const categoryId = suggestions[0]?.categoryId;
  if (!categoryId) {
    throw new Error("Could not resolve an eBay category for this product.");
  }

  return categoryId;
}

async function upsertInventoryItem(
  token: string,
  marketplaceId: EbayMarketplaceId,
  sku: string,
  listing: GeneratedListing,
  imageUrls: string[],
  quantity: number,
  variantLabel?: string,
  gtin?: string,
): Promise<void> {
  const aspects = aspectsFromListing(listing);
  if (variantLabel) {
    aspects.Variant = [variantLabel];
  }
  if (gtin?.trim()) {
    aspects.GTIN = [gtin.trim()];
  }

  const body = {
    product: {
      title: listing.seoTitle,
      description: listing.descriptionHtml,
      imageUrls: normalizeImageUrls(imageUrls),
      aspects,
    },
    condition: mapCondition(listing.condition),
    availability: {
      shipToLocationAvailability: {
        quantity,
      },
    },
  };

  const requestUrl = `${EBAY_API_BASE}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`;
  const { response, bodyText } = await ebayFetch("inventory_item PUT", requestUrl, {
    method: "PUT",
    headers: inventoryHeaders(token, marketplaceId),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    throwEbayApiError(requestUrl, response, bodyText, "Failed to create eBay inventory item.");
  }
}

async function upsertInventoryItemGroup(
  token: string,
  marketplaceId: EbayMarketplaceId,
  groupKey: string,
  listing: GeneratedListing,
  imageUrls: string[],
  variantSkus: string[],
  variantLabels: string[],
): Promise<void> {
  const body = {
    inventoryItemGroupKey: groupKey,
    variantSKUs: variantSkus,
    title: listing.seoTitle,
    description: listing.descriptionHtml,
    imageUrls: normalizeImageUrls(imageUrls),
    variesBy: {
      specifications: [
        {
          name: "Variant",
          values: variantLabels,
        },
      ],
    },
    aspects: aspectsFromListing(listing),
  };

  const requestUrl = `${EBAY_API_BASE}/sell/inventory/v1/inventory_item_group/${encodeURIComponent(groupKey)}`;
  const { response, bodyText } = await ebayFetch("inventory_item_group PUT", requestUrl, {
    method: "PUT",
    headers: inventoryHeaders(token, marketplaceId),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    throwEbayApiError(requestUrl, response, bodyText, "Failed to create eBay inventory item group.");
  }
}

function parseOfferIdFromErrorBody(bodyText: string): string | null {
  try {
    const data = JSON.parse(bodyText) as {
      errors?: Array<{
        errorId?: number;
        message?: string;
        parameters?: Array<{ name?: string; value?: string }>;
      }>;
    };

    for (const error of data.errors ?? []) {
      const isDuplicate =
        error.errorId === 25002 || error.message?.toLowerCase().includes("already exists");
      if (!isDuplicate) continue;

      const offerParam = error.parameters?.find((param) => param.name === "offerId");
      if (offerParam?.value) return offerParam.value;
    }
  } catch {
    return null;
  }

  return null;
}

function buildOfferBody(
  listing: GeneratedListing,
  categoryId: string,
  quantity: number,
  promotions: VolumePromotionTier[],
  policyIds: EbayBusinessPolicies,
  marketplaceId: EbayMarketplaceId,
  options: {
    sku?: string;
    inventoryItemGroupKey?: string;
    priceOverride?: number;
    merchantLocationKey: string;
  },
): Record<string, unknown> {
  const config = resolveMarketplaceConfig(marketplaceId);
  const { fulfillmentPolicyId, paymentPolicyId, returnPolicyId } = policyIds;

  if (!fulfillmentPolicyId || !paymentPolicyId || !returnPolicyId) {
    throw new Error(
      "Shipping, payment, and return policies are required before listing on eBay.",
    );
  }

  const volumePricing = buildVolumePricing(promotions);
  const priceValue = options.priceOverride ?? listing.suggestedPrice;
  const pricingSummary: Record<string, unknown> = {
    price: {
      value: priceValue.toFixed(2),
      currency: listing.currency || config.currency,
    },
  };

  if (volumePricing.length > 0) {
    pricingSummary.volumePricing = volumePricing;
  }

  const body: Record<string, unknown> = {
    marketplaceId: config.marketplaceId,
    format: "FIXED_PRICE",
    listingDescription: listing.descriptionHtml,
    availableQuantity: quantity,
    categoryId,
    merchantLocationKey: options.merchantLocationKey,
    listingPolicies: {
      fulfillmentPolicyId,
      paymentPolicyId,
      returnPolicyId,
    },
    pricingSummary,
  };

  if (options.inventoryItemGroupKey) {
    body.inventoryItemGroupKey = options.inventoryItemGroupKey;
  }
  if (options.sku) {
    body.sku = options.sku;
  }

  return body;
}

async function updateOffer(
  token: string,
  marketplaceId: EbayMarketplaceId,
  offerId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const requestUrl = `${EBAY_API_BASE}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`;
  const { response, bodyText } = await ebayFetch("offer PUT", requestUrl, {
    method: "PUT",
    headers: inventoryHeaders(token, marketplaceId),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    throwEbayApiError(requestUrl, response, bodyText, "Failed to update eBay offer.");
  }
}

async function createOffer(
  token: string,
  listing: GeneratedListing,
  categoryId: string,
  quantity: number,
  promotions: VolumePromotionTier[],
  policyIds: EbayBusinessPolicies,
  marketplaceId: EbayMarketplaceId,
  options: {
    sku?: string;
    inventoryItemGroupKey?: string;
    priceOverride?: number;
    merchantLocationKey: string;
  },
): Promise<string> {
  const body = buildOfferBody(
    listing,
    categoryId,
    quantity,
    promotions,
    policyIds,
    marketplaceId,
    options,
  );

  const requestUrl = `${EBAY_API_BASE}/sell/inventory/v1/offer`;
  const { response, bodyText } = await ebayFetch("offer POST", requestUrl, {
    method: "POST",
    headers: inventoryHeaders(token, marketplaceId),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (response.ok) {
    const data = parseJsonSafe(bodyText, {} as { offerId?: string });
    if (data.offerId) return data.offerId;
  }

  const offerIdFromError = parseOfferIdFromErrorBody(bodyText);
  if (offerIdFromError) {
    await updateOffer(token, marketplaceId, offerIdFromError, body);
    return offerIdFromError;
  }

  throwEbayApiError(requestUrl, response, bodyText, "Failed to create eBay offer.");
}

async function publishOfferByGroup(
  token: string,
  groupKey: string,
  marketplaceId: EbayMarketplaceId,
): Promise<{ listingId: string | null }> {
  const config = resolveMarketplaceConfig(marketplaceId);
  const requestUrl = `${EBAY_API_BASE}/sell/inventory/v1/offer/publish_by_inventory_item_group`;
  const { response, bodyText } = await ebayFetch("publish_by_group POST", requestUrl, {
    method: "POST",
    headers: inventoryHeaders(token, marketplaceId),
    body: JSON.stringify({
      inventoryItemGroupKey: groupKey,
      marketplaceId: config.marketplaceId,
    }),
    cache: "no-store",
  });

  const data = parseJsonSafe(bodyText, {} as {
    listingId?: string;
    errors?: Array<{ message?: string }>;
  });

  if (!response.ok) {
    throwEbayApiError(requestUrl, response, bodyText, "Failed to publish eBay listing group.");
  }

  return { listingId: data.listingId ?? null };
}

async function publishOffer(
  token: string,
  marketplaceId: EbayMarketplaceId,
  offerId: string,
): Promise<{ listingId: string | null }> {
  const requestUrl = `${EBAY_API_BASE}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish`;
  const { response, bodyText } = await ebayFetch("publish POST", requestUrl, {
    method: "POST",
    headers: inventoryHeaders(token, marketplaceId),
    cache: "no-store",
  });

  const data = parseJsonSafe(bodyText, {} as {
    listingId?: string;
    errors?: Array<{ message?: string }>;
  });

  if (!response.ok) {
    throwEbayApiError(requestUrl, response, bodyText, "Failed to publish eBay listing.");
  }

  return { listingId: data.listingId ?? null };
}

export async function listDraftOnEbay(userId: string, draft: ListingDraft): Promise<ListOnEbayResult> {
  const token = await getEbayUserAccessToken(userId);
  if (!token) {
    throw new Error("eBay account is not connected. Connect your eBay account first.");
  }

  const marketplaceId = await getSellerMarketplaceId(userId);
  const marketplaceConfig = resolveMarketplaceConfig(marketplaceId);
  const sellerLocation = await requireConfirmedLocation(userId);
  const merchantLocationKey = sellerLocation.merchantLocationKey;

  if (draft.listing.brand !== "Unbranded") {
    throw new Error("Brand must remain Unbranded for this listing.");
  }

  const selectedPhotos = draft.photos.filter((photo) => photo.selected).map((photo) => photo.url);
  if (selectedPhotos.length === 0) {
    throw new Error("Select at least one photo for the listing.");
  }

  if (
    !draft.ebayPolicies?.fulfillmentPolicyId ||
    !draft.ebayPolicies?.paymentPolicyId ||
    !draft.ebayPolicies?.returnPolicyId
  ) {
    throw new Error("Shipping, payment, and return policies are required before listing on eBay.");
  }

  const policyIds = draft.ebayPolicies;
  const categoryId = await resolveCategoryId(token, draft.listing, marketplaceId);
  const selectedDescriptionPhotos = getSelectedDescriptionPhotos(draft.descriptionPhotos);
  const appOrigin = selectedDescriptionPhotos.length > 0 ? getAppOrigin() : "";
  const listing = {
    ...draft.listing,
    categoryId,
    currency: draft.listing.currency || marketplaceConfig.currency,
    brand: "Unbranded" as const,
    descriptionHtml: buildDescriptionHtmlWithImages(
      draft.listing.descriptionHtml,
      draft.descriptionPhotos,
      appOrigin,
    ),
  };

  const activeVariants = draft.variants.length > 0 ? draft.variants : [];
  const isMultiVariant = activeVariants.length > 1;
  assertUniqueVariantSkus(activeVariants);

  if (!isMultiVariant) {
    const variant = activeVariants[0];
    const sku = variant
      ? resolveVariantSkuForEbay(variant)
      : resolveVariantSkuForEbay({
          id: "default",
          label: "Default",
          imageUrl: "",
          price: listing.suggestedPrice,
          stock: 1,
          sku: draft.product.internalProductSku ?? "",
          ean: "",
          quantity: 1,
        });
    const images = variant?.imageUrl ? [variant.imageUrl, ...selectedPhotos] : selectedPhotos;
    const quantity = variant ? resolveVariantQuantity(variant) : 1;

    if (variant && variant.price > 0) {
      listing.suggestedPrice = variant.price;
    }

    await upsertInventoryItem(
      token,
      marketplaceId,
      sku,
      listing,
      images,
      quantity,
      variant?.label,
      variant?.ean,
    );
    const offerId = await createOffer(
      token,
      listing,
      categoryId,
      quantity,
      draft.promotions,
      policyIds,
      marketplaceId,
      { sku, merchantLocationKey },
    );
    await requireConfirmedLocation(userId);
    const published = await publishOffer(token, marketplaceId, offerId);

    return {
      sku,
      offerId,
      listingId: published.listingId,
      listingUrl: published.listingId
        ? buildEbayListingUrl(published.listingId, marketplaceId)
        : null,
    };
  }

  const groupKey = resolveGroupSkuKey(draft);

  const variantResults = await Promise.all(
    activeVariants.map(async (variant) => {
      const sku = resolveVariantSkuForEbay(variant);

      const images = variant.imageUrl ? [variant.imageUrl, ...selectedPhotos] : selectedPhotos;
      const variantListing = { ...listing, suggestedPrice: variant.price };
      const quantity = resolveVariantQuantity(variant);

      await upsertInventoryItem(
        token,
        marketplaceId,
        sku,
        variantListing,
        images,
        quantity,
        variant.label,
        variant.ean,
      );

      const offerId = await createOffer(
        token,
        listing,
        categoryId,
        quantity,
        draft.promotions,
        policyIds,
        marketplaceId,
        {
          sku,
          inventoryItemGroupKey: groupKey,
          priceOverride: variant.price,
          merchantLocationKey,
        },
      );

      return { sku, offerId, label: variant.label };
    }),
  );

  const variantSkus = variantResults.map((entry) => entry.sku);
  const variantLabels = variantResults.map((entry) => entry.label);
  const firstOfferId = variantResults[0]?.offerId ?? "";

  await upsertInventoryItemGroup(
    token,
    marketplaceId,
    groupKey,
    listing,
    selectedPhotos,
    variantSkus,
    variantLabels,
  );

  await requireConfirmedLocation(userId);
  const published = await publishOfferByGroup(token, groupKey, marketplaceId);

  return {
    sku: groupKey,
    offerId: firstOfferId,
    listingId: published.listingId,
    listingUrl: published.listingId
      ? buildEbayListingUrl(published.listingId, marketplaceId)
      : null,
  };
}

// Backward-compatible helper
export async function listProductOnEbay(
  userId: string,
  listing: GeneratedListing,
  product: ListingDraft["product"],
  quantity = 1,
): Promise<ListOnEbayResult> {
  const baseSku = product.internalProductSku?.trim();
  if (!baseSku) {
    throw new Error("Internal product SKU is missing. Assign internal SKUs before listing.");
  }

  const draft: ListingDraft = {
    product,
    listing: { ...listing, brand: "Unbranded" },
    photos: (product.images.length > 0 ? product.images : product.imageUrl ? [product.imageUrl] : []).map(
      (url) => ({ url, selected: true }),
    ),
    variants: [
      {
        id: "default",
        label: "Default",
        imageUrl: product.imageUrl ?? product.images[0] ?? "",
        price: listing.suggestedPrice,
        stock: quantity,
        sku: baseSku,
        ean: "",
        quantity,
      },
    ],
    promotions: DEFAULT_PROMOTIONS.map((tier) => ({ ...tier })),
  };

  return listDraftOnEbay(userId, draft);
}
