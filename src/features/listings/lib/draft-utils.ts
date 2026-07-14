import type {
  GeneratedListing,
  ListingDraft,
  ListingPhotoDraft,
  ListingPricingPreferences,
  ListingProductSource,
  ListingVariantDraft,
  PricingBreakdown,
  VolumePromotionTier,
} from "@/types/listing-generator";
import { DEFAULT_PROMOTIONS } from "@/types/listing-generator";
import {
  draftNeedsSkuBackfill,
  mergeInternalSkusIntoDraft,
} from "@/lib/listings/internal-sku";
import { buildVariantPrices, calculatePricingBreakdown } from "@/lib/listings/pricing";
import { filterListingImages } from "@/lib/listings/listing-sanitize";

export function normalizeVariantDraft(variant: ListingVariantDraft): ListingVariantDraft {
  return {
    ...variant,
    sku: variant.sku?.trim() ?? "",
    ean: variant.ean ?? "",
    quantity: variant.quantity ?? 1,
  };
}

export function normalizeDraftVariants(draft: ListingDraft): ListingDraft {
  return {
    ...draft,
    product: {
      ...draft.product,
      descriptionImages: draft.product.descriptionImages ?? [],
    },
    descriptionPhotos: draft.descriptionPhotos ?? [],
    variationPhotoAttribute: draft.variationPhotoAttribute ?? "default",
    variants: draft.variants.map((variant) => normalizeVariantDraft(variant)),
  };
}

export async function assignInternalSkusToDraft(
  userId: string,
  productUrl: string,
  draft: ListingDraft,
): Promise<ListingDraft> {
  if (!draftNeedsSkuBackfill(draft)) return draft;

  const response = await fetch("/api/listings/internal-skus", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      productUrl,
      variants: draft.variants.map((variant) => ({ id: variant.id, label: variant.label })),
    }),
  });

  const data = (await response.json()) as {
    error?: string;
    baseSku?: string;
    variantSkus?: Record<string, string>;
  };

  if (!response.ok || !data.baseSku || !data.variantSkus) {
    throw new Error(data.error ?? "Failed to assign internal SKUs.");
  }

  return mergeInternalSkusIntoDraft(draft, data.baseSku, data.variantSkus);
}

export function buildInitialDraft(
  product: ListingProductSource,
  listing: GeneratedListing,
  options?: {
    pricing?: ListingPricingPreferences;
    pricingBreakdown?: PricingBreakdown;
    manualPriceOverride?: number | null;
    promotions?: VolumePromotionTier[];
  },
): ListingDraft {
  const galleryFilter = filterListingImages(product.images.filter(Boolean));
  const imagePool =
    galleryFilter.allowed.length > 0
      ? galleryFilter.allowed
      : product.imageUrl
        ? filterListingImages([product.imageUrl]).allowed
        : [];

  const photos: ListingPhotoDraft[] = imagePool.slice(0, 24).map((url) => ({
    url,
    selected: true,
  }));

  // Already sanitized upstream — do not re-filter (would drop CDN hosts).
  const descriptionPhotos: ListingPhotoDraft[] = (product.descriptionImages ?? [])
    .filter(Boolean)
    .map((url) => ({
      url,
      selected: true,
    }));

  const basePrice =
    options?.manualPriceOverride ??
    options?.pricingBreakdown?.recommendedPrice ??
    listing.suggestedPrice;

  const variants = buildVariantPrices(product, basePrice);

  return {
    product,
    listing: {
      ...listing,
      suggestedPrice: basePrice,
      brand: "Unbranded",
      itemSpecifics: listing.itemSpecifics.map((specific) =>
        specific.name.toLowerCase() === "brand"
          ? { ...specific, value: "Unbranded" }
          : specific,
      ),
    },
    photos,
    descriptionPhotos,
    variants,
    promotions: (options?.promotions ?? DEFAULT_PROMOTIONS).map((tier) => ({ ...tier })),
    variationPhotoAttribute: "default",
    pricing: options?.pricing,
    pricingBreakdown: options?.pricingBreakdown,
    manualPriceOverride: options?.manualPriceOverride ?? null,
  };
}

export function getSelectedPhotos(draft: ListingDraft): string[] {
  const selected = draft.photos.filter((photo) => photo.selected).map((photo) => photo.url);
  if (selected.length > 0) return selected;
  return draft.photos.map((photo) => photo.url);
}

export function getEnabledPromotions(promotions: ListingDraft["promotions"]) {
  return promotions.filter((tier) => tier.enabled && tier.discountPercent > 0);
}

export function formatListingPrice(price: number, currency: string): string {
  if (currency === "GBP") return `£${price.toFixed(2)}`;
  if (currency === "USD") return `$${price.toFixed(2)}`;
  if (currency === "EUR") return `€${price.toFixed(2)}`;
  return `${currency} ${price.toFixed(2)}`;
}

export function summarizeDeals(promotions: ListingDraft["promotions"]): string {
  const enabled = getEnabledPromotions(promotions);
  if (enabled.length === 0) return "None";
  return enabled
    .map((tier) => `Buy ${tier.quantity} get ${tier.discountPercent}% off`)
    .join(", ");
}

export function proxyImageUrl(originalUrl: string, appOrigin = ""): string {
  if (!originalUrl) return "";
  const path = `/api/proxy-image?url=${encodeURIComponent(originalUrl)}`;
  if (!appOrigin) return path;
  return `${appOrigin.replace(/\/$/, "")}${path}`;
}

function descriptionImageSrc(url: string, appOrigin: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";

  try {
    const host = new URL(trimmed).hostname.toLowerCase();
    const needsProxy =
      host.includes("alicdn.com") ||
      host.includes("aliexpress-media.com") ||
      host.includes("aliexpress.com");
    if (!needsProxy) return trimmed;
  } catch {
    // Relative / invalid — fall through to proxy helper when origin exists
  }

  // AliExpress CDNs: proxy through APP_URL so eBay / browser can load them.
  if (appOrigin) return proxyImageUrl(trimmed, appOrigin);
  return trimmed;
}

export function getSelectedDescriptionPhotos(
  descriptionPhotos: ListingPhotoDraft[] | undefined,
): string[] {
  if (!descriptionPhotos?.length) return [];
  const selected = descriptionPhotos.filter((photo) => photo.selected).map((photo) => photo.url);
  return selected.length > 0 ? selected : descriptionPhotos.map((photo) => photo.url);
}

export function buildDescriptionHtmlWithImages(
  descriptionHtml: string,
  descriptionPhotos: ListingPhotoDraft[] | undefined,
  appOrigin: string,
): string {
  const urls = getSelectedDescriptionPhotos(descriptionPhotos);
  if (urls.length === 0) return descriptionHtml;

  const imagesHtml = urls
    .map(
      (url) =>
        `<img src="${descriptionImageSrc(url, appOrigin)}" alt="" style="max-width:100%;margin-bottom:10px;display:block" />`,
    )
    .join("\n");

  return `${descriptionHtml}\n<div style="margin-top:20px">\n${imagesHtml}\n</div>`;
}

export function recalculateDraftPricing(
  draft: ListingDraft,
  prefs: ListingPricingPreferences,
  manualPriceOverride?: number | null,
): ListingDraft {
  const baseAliPrice =
    draft.product.variants?.filter((v) => v.stock != null && v.stock > 0).sort((a, b) => a.price - b.price)[0]
      ?.price ?? draft.product.price;

  const breakdown = calculatePricingBreakdown(baseAliPrice, prefs);
  const finalPrice = manualPriceOverride ?? breakdown.recommendedPrice;
  const nextVariants = buildVariantPrices(draft.product, finalPrice).map((variant) => {
    const existing = draft.variants.find((entry) => entry.id === variant.id);
    return existing?.sku ? { ...variant, sku: existing.sku } : variant;
  });

  return {
    ...draft,
    pricing: prefs,
    pricingBreakdown: { ...breakdown, recommendedPrice: finalPrice },
    manualPriceOverride: manualPriceOverride ?? null,
    listing: {
      ...draft.listing,
      suggestedPrice: finalPrice,
      currency: prefs.currency,
    },
    variants: nextVariants,
  };
}
