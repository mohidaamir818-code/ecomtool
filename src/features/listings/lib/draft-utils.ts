import type {
  GeneratedListing,
  ListingDraft,
  ListingPhotoDraft,
  ListingPricingPreferences,
  ListingProductSource,
  PricingBreakdown,
  VolumePromotionTier,
} from "@/types/listing-generator";
import { DEFAULT_PROMOTIONS } from "@/types/listing-generator";
import { buildVariantPrices, calculatePricingBreakdown } from "@/lib/listings/pricing";

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
  const allImages = product.images.filter(Boolean);
  const imagePool = allImages.length > 0 ? allImages : product.imageUrl ? [product.imageUrl] : [];

  const photos: ListingPhotoDraft[] = imagePool.slice(0, 24).map((url) => ({
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
    variants,
    promotions: (options?.promotions ?? DEFAULT_PROMOTIONS).map((tier) => ({ ...tier })),
    pricing: options?.pricing,
    pricingBreakdown: options?.pricingBreakdown,
    manualPriceOverride: options?.manualPriceOverride ?? null,
  };
}

export function getSelectedPhotos(draft: ListingDraft): string[] {
  return draft.photos.filter((photo) => photo.selected).map((photo) => photo.url);
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

export function proxyImageUrl(originalUrl: string): string {
  if (!originalUrl) return "";
  return `/api/proxy-image?url=${encodeURIComponent(originalUrl)}`;
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
    variants: buildVariantPrices(draft.product, finalPrice),
  };
}
