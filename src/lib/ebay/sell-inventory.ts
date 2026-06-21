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
  aspectsFromListingSpecifics,
  buildDefaultEbayUkAspects,
  filterAspectsForCategory,
  getSafeAspectDefault,
  mergeEbayAspects,
  normalizeAspectNameForMarketplace,
  resolveRequiredEbayAspects,
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
  ListingProductSource,
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
  readonly missingField?: string;

  constructor(
    message: string,
    status: number,
    rawBody: string,
    url: string,
    missingField?: string,
  ) {
    super(message);
    this.name = "EbayApiError";
    this.status = status;
    this.rawBody = rawBody;
    this.url = url;
    this.missingField = missingField;
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

export function parseEbayErrorDetails(
  bodyText: string,
  fallback = "eBay API error",
): {
  message: string;
  missingField?: string;
  errorId?: number;
  errors?: unknown[];
} {
  try {
    const data = JSON.parse(bodyText) as {
      errors?: Array<{
        errorId?: number;
        message?: string;
        longMessage?: string;
        parameters?: Array<{ name?: string; value?: string }>;
      }>;
    };
    const first = data.errors?.[0];
    const missingField = extractMissingAspectField(bodyText) ?? undefined;
    const message = first?.longMessage ?? first?.message ?? fallback;
    return {
      message,
      missingField,
      errorId: first?.errorId,
      errors: data.errors,
    };
  } catch {
    return { message: bodyText || fallback };
  }
}

export function extractMissingAspectField(bodyText: string): string | null {
  try {
    const data = JSON.parse(bodyText) as {
      errors?: Array<{
        errorId?: number;
        message?: string;
        longMessage?: string;
        parameters?: Array<{ name?: string; value?: string }>;
      }>;
    };
    const first = data.errors?.[0];
    if (!first) return null;

    const combined = `${first.message ?? ""} ${first.longMessage ?? ""}`.toLowerCase();
    const hasOfferId = first.parameters?.some(
      (param) => param.name === "offerId" && param.value,
    );
    if (combined.includes("already exists") || hasOfferId) return null;

    const isMissingAspect =
      first.errorId === 25002 ||
      combined.includes("item specific") ||
      (combined.includes("missing") && combined.includes("specific"));

    if (!isMissingAspect) return null;

    const field = first.parameters?.find((param) => param.name === "2")?.value?.trim();
    return field || null;
  } catch {
    return null;
  }
}

function patchMissingAspectOverride(
  aspectOptions: EbayAspectBuildOptions,
  missingField: string,
): void {
  if (!aspectOptions.aspectOverrides) {
    aspectOptions.aspectOverrides = {};
  }
  const fieldKey =
    aspectOptions.marketplaceId === "EBAY_GB"
      ? normalizeAspectNameForMarketplace(missingField, aspectOptions.marketplaceId)
      : missingField;
  const safeValue = getSafeAspectDefault(fieldKey);
  aspectOptions.aspectOverrides[fieldKey] = safeValue;
  console.log(`Auto-fixing missing field: ${fieldKey}`, safeValue);
}

async function executeWithMissingAspectRetry(
  aspectOptions: EbayAspectBuildOptions,
  execute: () => Promise<{ url: string; response: Response; bodyText: string }>,
  fallbackMessage: string,
  label: string,
): Promise<void> {
  let retried = false;

  while (true) {
    const { url, response, bodyText } = await execute();
    if (response.ok) return;

    if (!retried) {
      const missingField = extractMissingAspectField(bodyText);
      if (missingField) {
        patchMissingAspectOverride(aspectOptions, missingField);
        retried = true;
        continue;
      }
    }

    throwEbayApiError(url, response, bodyText, fallbackMessage);
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
  const details = parseEbayErrorDetails(bodyText, fallback);
  throw new EbayApiError(
    details.message,
    response.status,
    bodyText,
    url,
    details.missingField ?? extractMissingAspectField(bodyText) ?? undefined,
  );
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

export interface EbayAspectBuildOptions {
  marketplaceId: EbayMarketplaceId;
  product?: ListingProductSource;
  variantDrafts?: ListingDraft["variants"];
  categoryAspectNames?: string[];
  aspectOverrides?: Record<string, string[]>;
}

function buildEbayAspects(
  listing: GeneratedListing,
  options: EbayAspectBuildOptions,
): Record<string, string[]> {
  const {
    marketplaceId,
    product,
    variantDrafts,
    categoryAspectNames = [],
    aspectOverrides,
  } = options;

  const context = {
    listing,
    product,
    variantDrafts,
    marketplaceId,
  };

  if (marketplaceId === "EBAY_GB") {
    const defaults = buildDefaultEbayUkAspects(context);
    const aiAspects = aspectsFromListingSpecifics(listing, marketplaceId);
    return mergeEbayAspects(defaults, aiAspects, aspectOverrides);
  }

  const defaults = resolveRequiredEbayAspects(context);
  const aiAspects = aspectsFromListingSpecifics(listing, marketplaceId);
  const merged = mergeEbayAspects(defaults, aiAspects, aspectOverrides);
  return filterAspectsForCategory(merged, categoryAspectNames);
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
  aspectOptions: EbayAspectBuildOptions,
  variantLabel?: string,
  gtin?: string,
): Promise<void> {
  const requestUrl = `${EBAY_API_BASE}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`;

  await executeWithMissingAspectRetry(
    aspectOptions,
    async () => {
      const aspects = buildEbayAspects(listing, aspectOptions);
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

      const { response, bodyText } = await ebayFetch("inventory_item PUT", requestUrl, {
        method: "PUT",
        headers: inventoryHeaders(token, marketplaceId),
        body: JSON.stringify(body),
        cache: "no-store",
      });

      return { url: requestUrl, response, bodyText };
    },
    "Failed to create eBay inventory item.",
    "inventory_item PUT",
  );
}

async function upsertInventoryItemGroup(
  token: string,
  marketplaceId: EbayMarketplaceId,
  groupKey: string,
  listing: GeneratedListing,
  imageUrls: string[],
  variantSkus: string[],
  variantLabels: string[],
  aspectOptions: EbayAspectBuildOptions,
): Promise<void> {
  const requestUrl = `${EBAY_API_BASE}/sell/inventory/v1/inventory_item_group/${encodeURIComponent(groupKey)}`;

  await executeWithMissingAspectRetry(
    aspectOptions,
    async () => {
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
        aspects: buildEbayAspects(listing, aspectOptions),
      };

      const { response, bodyText } = await ebayFetch("inventory_item_group PUT", requestUrl, {
        method: "PUT",
        headers: inventoryHeaders(token, marketplaceId),
        body: JSON.stringify(body),
        cache: "no-store",
      });

      return { url: requestUrl, response, bodyText };
    },
    "Failed to create eBay inventory item group.",
    "inventory_item_group PUT",
  );
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
  aspectOptions: EbayAspectBuildOptions,
  reupsertInventory: () => Promise<void>,
): Promise<{ listingId: string | null }> {
  const config = resolveMarketplaceConfig(marketplaceId);
  const requestUrl = `${EBAY_API_BASE}/sell/inventory/v1/offer/publish_by_inventory_item_group`;
  let retried = false;

  while (true) {
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

    if (response.ok) {
      return { listingId: data.listingId ?? null };
    }

    if (!retried) {
      const missingField = extractMissingAspectField(bodyText);
      if (missingField) {
        console.log(
          `[eBay publish_by_group] Missing aspect "${missingField}", re-upserting and retrying`,
        );
        patchMissingAspectOverride(aspectOptions, missingField);
        await reupsertInventory();
        retried = true;
        continue;
      }
    }

    throwEbayApiError(requestUrl, response, bodyText, "Failed to publish eBay listing group.");
  }
}

async function publishOffer(
  token: string,
  marketplaceId: EbayMarketplaceId,
  offerId: string,
  aspectOptions: EbayAspectBuildOptions,
  reupsertInventory: () => Promise<void>,
): Promise<{ listingId: string | null }> {
  const requestUrl = `${EBAY_API_BASE}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish`;
  let retried = false;

  while (true) {
    const { response, bodyText } = await ebayFetch("publish POST", requestUrl, {
      method: "POST",
      headers: inventoryHeaders(token, marketplaceId),
      cache: "no-store",
    });

    const data = parseJsonSafe(bodyText, {} as {
      listingId?: string;
      errors?: Array<{ message?: string }>;
    });

    if (response.ok) {
      return { listingId: data.listingId ?? null };
    }

    if (!retried) {
      const missingField = extractMissingAspectField(bodyText);
      if (missingField) {
        console.log(
          `[eBay publish] Missing aspect "${missingField}", re-upserting and retrying`,
        );
        patchMissingAspectOverride(aspectOptions, missingField);
        await reupsertInventory();
        retried = true;
        continue;
      }
    }

    throwEbayApiError(requestUrl, response, bodyText, "Failed to publish eBay listing.");
  }
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
  const categoryAspectNames = await getItemAspectsForCategory(token, categoryId, marketplaceId);
  const aspectOptions: EbayAspectBuildOptions = {
    marketplaceId,
    product: draft.product,
    variantDrafts: draft.variants,
    categoryAspectNames,
    aspectOverrides: {},
  };
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
      aspectOptions,
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
    const reupsertSingleInventory = async () => {
      await upsertInventoryItem(
        token,
        marketplaceId,
        sku,
        listing,
        images,
        quantity,
        aspectOptions,
        variant?.label,
        variant?.ean,
      );
    };
    const published = await publishOffer(
      token,
      marketplaceId,
      offerId,
      aspectOptions,
      reupsertSingleInventory,
    );

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
        aspectOptions,
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
    aspectOptions,
  );

  await requireConfirmedLocation(userId);
  const reupsertAllInventory = async () => {
    await Promise.all(
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
          aspectOptions,
          variant.label,
          variant.ean,
        );
      }),
    );
    await upsertInventoryItemGroup(
      token,
      marketplaceId,
      groupKey,
      listing,
      selectedPhotos,
      variantSkus,
      variantLabels,
      aspectOptions,
    );
  };
  const published = await publishOfferByGroup(
    token,
    groupKey,
    marketplaceId,
    aspectOptions,
    reupsertAllInventory,
  );

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
