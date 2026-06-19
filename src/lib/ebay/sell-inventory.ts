import "server-only";

import { getEbayUserAccessToken } from "@/lib/ebay/oauth-user";
import type {
  GeneratedListing,
  ListOnEbayResult,
  ListingProductSource,
} from "@/types/listing-generator";

const EBAY_API_BASE = "https://api.ebay.com";
const MARKETPLACE_ID = "EBAY_GB";
const CATEGORY_TREE_ID = "3";

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
  if (normalized.includes("new other")) return "NEW_OTHER";
  return "NEW";
}

function buildSku(externalId: string): string {
  return `ae-${externalId}`.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 50);
}

function aspectsFromListing(listing: GeneratedListing): Record<string, string[]> {
  const aspects: Record<string, string[]> = {};

  for (const specific of listing.itemSpecifics) {
    aspects[specific.name] = [specific.value];
  }

  if (!aspects.Brand) {
    aspects.Brand = [listing.brand || "Unbranded"];
  }

  return aspects;
}

async function resolveCategoryId(token: string, query: string): Promise<string | null> {
  const url = new URL(
    `${EBAY_API_BASE}/commerce/taxonomy/v1/category_tree/${CATEGORY_TREE_ID}/get_category_suggestions`,
  );
  url.searchParams.set("q", query.slice(0, 80));

  const response = await fetch(url.toString(), {
    headers: sellHeaders(token),
    cache: "no-store",
  });

  if (!response.ok) return null;

  const data = (await response.json()) as {
    categorySuggestions?: Array<{ category?: { categoryId?: string } }>;
  };

  return data.categorySuggestions?.[0]?.category?.categoryId ?? null;
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

  const policies = data[key];
  return policies?.[0]?.policyId ?? null;
}

async function upsertInventoryItem(
  token: string,
  sku: string,
  listing: GeneratedListing,
  product: ListingProductSource,
  quantity: number,
): Promise<void> {
  const imageUrls = (product.images.length > 0 ? product.images : product.imageUrl ? [product.imageUrl] : [])
    .slice(0, 12)
    .map((url) => url.replace(/^\/\//, "https://"));

  const body = {
    product: {
      title: listing.seoTitle,
      description: listing.descriptionHtml,
      imageUrls,
      aspects: aspectsFromListing(listing),
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

async function createOffer(
  token: string,
  sku: string,
  listing: GeneratedListing,
  categoryId: string,
  quantity: number,
): Promise<string> {
  const fulfillmentPolicyId = await getFirstPolicyId(token, "fulfillment_policy");
  const paymentPolicyId = await getFirstPolicyId(token, "payment_policy");
  const returnPolicyId = await getFirstPolicyId(token, "return_policy");

  if (!fulfillmentPolicyId || !paymentPolicyId || !returnPolicyId) {
    throw new Error(
      "Your eBay account needs business policies (shipping, payment, returns) configured before listing.",
    );
  }

  const body = {
    sku,
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
    pricingSummary: {
      price: {
        value: listing.suggestedPrice.toFixed(2),
        currency: listing.currency === "USD" ? "GBP" : listing.currency,
      },
    },
  };

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

export async function listProductOnEbay(
  userId: string,
  listing: GeneratedListing,
  product: ListingProductSource,
  quantity = 1,
): Promise<ListOnEbayResult> {
  const token = await getEbayUserAccessToken(userId);
  if (!token) {
    throw new Error("eBay account is not connected. Connect your eBay account first.");
  }

  const sku = buildSku(product.externalId);
  const categoryId =
    listing.categoryId ??
    (await resolveCategoryId(token, listing.categorySuggestion || listing.seoTitle));

  if (!categoryId) {
    throw new Error("Could not resolve an eBay category for this product.");
  }

  await upsertInventoryItem(token, sku, listing, product, quantity);
  const offerId = await createOffer(token, sku, listing, categoryId, quantity);
  const published = await publishOffer(token, offerId);

  const listingUrl = published.listingId
    ? `https://www.ebay.co.uk/itm/${published.listingId}`
    : null;

  return {
    sku,
    offerId,
    listingId: published.listingId,
    listingUrl,
  };
}
