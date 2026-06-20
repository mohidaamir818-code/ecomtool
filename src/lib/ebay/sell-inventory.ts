import "server-only";

import { getEbayUserAccessToken } from "@/lib/ebay/oauth-user";
import type {
  EbayCategorySuggestion,
  GeneratedListing,
  ListingDraft,
  ListOnEbayResult,
  VolumePromotionTier,
} from "@/types/listing-generator";
import { DEFAULT_PROMOTIONS } from "@/types/listing-generator";

const EBAY_API_BASE = "https://api.ebay.com";
const MARKETPLACE_ID = "EBAY_GB";
const CATEGORY_TREE_ID = "3";
const MAX_PHOTOS = 24;

function sellHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "Content-Language": "en-GB",
  };
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

function buildSku(externalId: string, suffix?: string): string {
  const base = `ae-${externalId}${suffix ? `-${suffix}` : ""}`;
  return base.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 50);
}

function resolveVariantSku(externalId: string, variant: ListingDraft["variants"][number]): string {
  const custom = variant.sku?.trim();
  if (custom) return custom.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 50);
  return buildSku(externalId, variant.id);
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
      aspects.Brand = ["Unbranded"];
      continue;
    }
    if (nameLower === "condition") continue;
    aspects[specific.name] = [specific.value];
  }

  if (!aspects.Brand) {
    aspects.Brand = ["Unbranded"];
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
): Promise<EbayCategorySuggestion[]> {
  const url = new URL(
    `${EBAY_API_BASE}/commerce/taxonomy/v1/category_tree/${CATEGORY_TREE_ID}/get_category_suggestions`,
  );
  url.searchParams.set("q", query.slice(0, 80));

  const response = await fetch(url.toString(), {
    headers: sellHeaders(token),
    cache: "no-store",
  });

  if (!response.ok) return [];

  const data = (await response.json()) as {
    categorySuggestions?: Array<{
      category?: { categoryId?: string; categoryName?: string };
      categoryTreeNodeAncestors?: Array<{ categoryName?: string }>;
    }>;
  };

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
): Promise<string[]> {
  const url = new URL(
    `${EBAY_API_BASE}/commerce/taxonomy/v1/category_tree/${CATEGORY_TREE_ID}/get_item_aspects_for_category`,
  );
  url.searchParams.set("category_id", categoryId);

  const response = await fetch(url.toString(), {
    headers: sellHeaders(token),
    cache: "no-store",
  });

  if (!response.ok) return [];

  const data = (await response.json()) as {
    aspects?: Array<{ localizedAspectName?: string }>;
  };

  return (data.aspects ?? [])
    .map((aspect) => aspect.localizedAspectName?.trim())
    .filter((name): name is string => Boolean(name));
}

async function resolveCategoryId(token: string, listing: GeneratedListing): Promise<string> {
  if (listing.categoryId) return listing.categoryId;

  const suggestions = await getCategorySuggestions(
    token,
    listing.categorySuggestion || listing.seoTitle,
  );

  const categoryId = suggestions[0]?.categoryId;
  if (!categoryId) {
    throw new Error("Could not resolve an eBay category for this product.");
  }

  return categoryId;
}

async function getFirstPolicyId(
  token: string,
  path: "fulfillment_policy" | "payment_policy" | "return_policy",
): Promise<string | null> {
  const url = new URL(`${EBAY_API_BASE}/sell/account/v1/${path}`);
  url.searchParams.set("marketplace_id", MARKETPLACE_ID);

  const response = await fetch(url.toString(), {
    headers: sellHeaders(token),
    cache: "no-store",
  });

  if (!response.ok) return null;

  const data = (await response.json()) as Record<string, Array<{ policyId?: string }> | undefined>;
  const key =
    path === "fulfillment_policy"
      ? "fulfillmentPolicies"
      : path === "payment_policy"
        ? "paymentPolicies"
        : "returnPolicies";

  return data[key]?.[0]?.policyId ?? null;
}

async function upsertInventoryItem(
  token: string,
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

  const response = await fetch(`${EBAY_API_BASE}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
    method: "PUT",
    headers: sellHeaders(token),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const error = (await response.json()) as { errors?: Array<{ message?: string }> };
    throw new Error(error.errors?.[0]?.message ?? "Failed to create eBay inventory item.");
  }
}

async function upsertInventoryItemGroup(
  token: string,
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

  const response = await fetch(
    `${EBAY_API_BASE}/sell/inventory/v1/inventory_item_group/${encodeURIComponent(groupKey)}`,
    {
      method: "PUT",
      headers: sellHeaders(token),
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const error = (await response.json()) as { errors?: Array<{ message?: string }> };
    throw new Error(error.errors?.[0]?.message ?? "Failed to create eBay inventory item group.");
  }
}

async function createOffer(
  token: string,
  listing: GeneratedListing,
  categoryId: string,
  quantity: number,
  promotions: VolumePromotionTier[],
  options: { sku?: string; inventoryItemGroupKey?: string; priceOverride?: number },
): Promise<string> {
  const fulfillmentPolicyId = await getFirstPolicyId(token, "fulfillment_policy");
  const paymentPolicyId = await getFirstPolicyId(token, "payment_policy");
  const returnPolicyId = await getFirstPolicyId(token, "return_policy");

  if (!fulfillmentPolicyId || !paymentPolicyId || !returnPolicyId) {
    throw new Error(
      "Your eBay account needs business policies (shipping, payment, returns) configured before listing.",
    );
  }

  const volumePricing = buildVolumePricing(promotions);
  const priceValue = options.priceOverride ?? listing.suggestedPrice;
  const pricingSummary: Record<string, unknown> = {
    price: {
      value: priceValue.toFixed(2),
      currency: listing.currency === "USD" ? "GBP" : listing.currency,
    },
  };

  if (volumePricing.length > 0) {
    pricingSummary.volumePricing = volumePricing;
  }

  const body: Record<string, unknown> = {
    marketplaceId: MARKETPLACE_ID,
    format: "FIXED_PRICE",
    listingDescription: listing.descriptionHtml,
    availableQuantity: quantity,
    categoryId,
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

  const response = await fetch(`${EBAY_API_BASE}/sell/inventory/v1/offer`, {
    method: "POST",
    headers: sellHeaders(token),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = (await response.json()) as { offerId?: string; errors?: Array<{ message?: string }> };

  if (!response.ok || !data.offerId) {
    throw new Error(data.errors?.[0]?.message ?? "Failed to create eBay offer.");
  }

  return data.offerId;
}

async function publishOfferByGroup(
  token: string,
  groupKey: string,
): Promise<{ listingId: string | null }> {
  const response = await fetch(
    `${EBAY_API_BASE}/sell/inventory/v1/offer/publish_by_inventory_item_group`,
    {
      method: "POST",
      headers: sellHeaders(token),
      body: JSON.stringify({
        inventoryItemGroupKey: groupKey,
        marketplaceId: MARKETPLACE_ID,
      }),
      cache: "no-store",
    },
  );

  const data = (await response.json()) as {
    listingId?: string;
    errors?: Array<{ message?: string }>;
  };

  if (!response.ok) {
    throw new Error(data.errors?.[0]?.message ?? "Failed to publish eBay listing group.");
  }

  return { listingId: data.listingId ?? null };
}

async function publishOffer(token: string, offerId: string): Promise<{ listingId: string | null }> {
  const response = await fetch(
    `${EBAY_API_BASE}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish`,
    {
      method: "POST",
      headers: sellHeaders(token),
      cache: "no-store",
    },
  );

  const data = (await response.json()) as {
    listingId?: string;
    errors?: Array<{ message?: string }>;
  };

  if (!response.ok) {
    throw new Error(data.errors?.[0]?.message ?? "Failed to publish eBay listing.");
  }

  return { listingId: data.listingId ?? null };
}

export async function listDraftOnEbay(userId: string, draft: ListingDraft): Promise<ListOnEbayResult> {
  const token = await getEbayUserAccessToken(userId);
  if (!token) {
    throw new Error("eBay account is not connected. Connect your eBay account first.");
  }

  if (draft.listing.brand !== "Unbranded") {
    throw new Error("Brand must remain Unbranded for this listing.");
  }

  const selectedPhotos = draft.photos.filter((photo) => photo.selected).map((photo) => photo.url);
  if (selectedPhotos.length === 0) {
    throw new Error("Select at least one photo for the listing.");
  }

  const categoryId = await resolveCategoryId(token, draft.listing);
  const listing = { ...draft.listing, categoryId, brand: "Unbranded" as const };

  const activeVariants = draft.variants.length > 0 ? draft.variants : [];
  const isMultiVariant = activeVariants.length > 1;

  if (!isMultiVariant) {
    const variant = activeVariants[0];
    const sku = variant ? resolveVariantSku(draft.product.externalId, variant) : buildSku(draft.product.externalId);
    const images = variant?.imageUrl ? [variant.imageUrl, ...selectedPhotos] : selectedPhotos;
    const quantity = variant ? resolveVariantQuantity(variant) : 1;

    if (variant && variant.price > 0) {
      listing.suggestedPrice = variant.price;
    }

    await upsertInventoryItem(
      token,
      sku,
      listing,
      images,
      quantity,
      variant?.label,
      variant?.ean,
    );
    const offerId = await createOffer(token, listing, categoryId, quantity, draft.promotions, { sku });
    const published = await publishOffer(token, offerId);

    return {
      sku,
      offerId,
      listingId: published.listingId,
      listingUrl: published.listingId ? `https://www.ebay.co.uk/itm/${published.listingId}` : null,
    };
  }

  const groupKey = buildSku(draft.product.externalId, "group");
  const variantSkus: string[] = [];
  const variantLabels: string[] = [];
  let firstOfferId = "";

  for (const variant of activeVariants) {
    const sku = resolveVariantSku(draft.product.externalId, variant);
    variantSkus.push(sku);
    variantLabels.push(variant.label);

    const images = variant.imageUrl ? [variant.imageUrl, ...selectedPhotos] : selectedPhotos;
    const variantListing = { ...listing, suggestedPrice: variant.price };
    const quantity = resolveVariantQuantity(variant);

    await upsertInventoryItem(
      token,
      sku,
      variantListing,
      images,
      quantity,
      variant.label,
      variant.ean,
    );

    const offerId = await createOffer(token, listing, categoryId, quantity, draft.promotions, {
      sku,
      inventoryItemGroupKey: groupKey,
      priceOverride: variant.price,
    });

    if (!firstOfferId) firstOfferId = offerId;
  }

  await upsertInventoryItemGroup(
    token,
    groupKey,
    listing,
    selectedPhotos,
    variantSkus,
    variantLabels,
  );

  const published = await publishOfferByGroup(token, groupKey);

  return {
    sku: groupKey,
    offerId: firstOfferId,
    listingId: published.listingId,
    listingUrl: published.listingId ? `https://www.ebay.co.uk/itm/${published.listingId}` : null,
  };
}

// Backward-compatible helper
export async function listProductOnEbay(
  userId: string,
  listing: GeneratedListing,
  product: ListingDraft["product"],
  quantity = 1,
): Promise<ListOnEbayResult> {
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
        sku: buildSku(product.externalId, "default"),
        ean: "",
        quantity,
      },
    ],
    promotions: DEFAULT_PROMOTIONS.map((tier) => ({ ...tier })),
  };

  return listDraftOnEbay(userId, draft);
}
