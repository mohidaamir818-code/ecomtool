import type {
  GeneratedListing,
  ListingDraft,
  ListingPhotoDraft,
  ListingProductSource,
  VolumePromotionTier,
} from "@/types/listing-generator";
import { DEFAULT_PROMOTIONS } from "@/types/listing-generator";

export function buildInitialDraft(
  product: ListingProductSource,
  listing: GeneratedListing,
): ListingDraft {
  const defaultImage = product.imageUrl ?? product.images[0] ?? "";
  const photos: ListingPhotoDraft[] = product.images.slice(0, 24).map((url) => ({
    url,
    selected: true,
  }));

  const variants =
    product.variants && product.variants.length > 0
      ? product.variants.map((variant) => ({
          id: variant.id,
          label: variant.label,
          imageUrl: defaultImage,
          price: Number((variant.price * 2.5).toFixed(2)) || listing.suggestedPrice,
          stock: variant.stock ?? 1,
        }))
      : [
          {
            id: "default",
            label: "Default",
            imageUrl: defaultImage,
            price: listing.suggestedPrice,
            stock: product.stock ?? 1,
          },
        ];

  return {
    product,
    listing: {
      ...listing,
      brand: "Unbranded",
      itemSpecifics: listing.itemSpecifics.map((specific) =>
        specific.name.toLowerCase() === "brand"
          ? { ...specific, value: "Unbranded" }
          : specific,
      ),
    },
    photos,
    variants,
    promotions: DEFAULT_PROMOTIONS.map((tier) => ({ ...tier })),
  };
}

export function getSelectedPhotos(draft: ListingDraft): string[] {
  return draft.photos.filter((photo) => photo.selected).map((photo) => photo.url);
}

export function getEnabledPromotions(promotions: VolumePromotionTier[]) {
  return promotions.filter((tier) => tier.enabled && tier.discountPercent > 0);
}

export function formatListingPrice(price: number, currency: string): string {
  if (currency === "GBP") return `£${price.toFixed(2)}`;
  if (currency === "USD") return `$${price.toFixed(2)}`;
  if (currency === "EUR") return `€${price.toFixed(2)}`;
  return `${currency} ${price.toFixed(2)}`;
}

export function summarizeDeals(promotions: VolumePromotionTier[]): string {
  const enabled = getEnabledPromotions(promotions);
  if (enabled.length === 0) return "None";
  return enabled
    .map((tier) => `Buy ${tier.quantity} get ${tier.discountPercent}% off`)
    .join(", ");
}
