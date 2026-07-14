import type {
  AmazefBogoOffer,
  AmazefCustomGift,
  AmazefFlashSaleOffer,
  AmazefListingOffers,
  ListingDraft,
} from "@/types/listing-generator";

export function calcFlashSaleDiscountPercent(
  originalPrice: number,
  flashSalePrice: number,
): number {
  if (originalPrice <= 0 || flashSalePrice <= 0 || flashSalePrice >= originalPrice) {
    return 0;
  }
  return Math.round((1 - flashSalePrice / originalPrice) * 100);
}

export function calcFlashSalePriceFromDiscount(
  originalPrice: number,
  discountPercent: number,
): number {
  if (originalPrice <= 0 || discountPercent <= 0) return originalPrice;
  const clamped = Math.min(Math.max(discountPercent, 0), 99);
  return Number((originalPrice * (1 - clamped / 100)).toFixed(2));
}

export function createDefaultAmazefOffers(draft: ListingDraft): AmazefListingOffers {
  const basePrice =
    draft.variants.find((variant) => variant.price > 0)?.price ?? draft.listing.suggestedPrice;

  const flashSale: AmazefFlashSaleOffer = {
    enabled: false,
    originalPrice: basePrice,
    flashSalePrice: basePrice,
    discountPercent: 0,
  };

  const bogo: AmazefBogoOffer = {
    enabled: false,
    eligibleVariantIds: draft.variants.map((variant) => variant.id),
    customGifts: [],
  };

  return { flashSale, bogo };
}

export function ensureAmazefOffers(draft: ListingDraft): ListingDraft {
  if (draft.amazefOffers) return draft;
  return { ...draft, amazefOffers: createDefaultAmazefOffers(draft) };
}

export function createCustomGiftId(): string {
  return `gift-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyCustomGift(): AmazefCustomGift {
  return {
    id: createCustomGiftId(),
    title: "",
    description: "",
    imageUrl: "",
  };
}
