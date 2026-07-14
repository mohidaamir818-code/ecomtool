import type { AmazefCustomGift, ListingDraft } from "@/types/listing-generator";
import type { AmazefPromotionPayload } from "@/lib/amazef/listing";

export function buildAmazefPromotionsFromDraft(
  draft: ListingDraft,
  floorPrice?: number,
): AmazefPromotionPayload | undefined {
  const offers = draft.amazefOffers;
  if (!offers) return undefined;

  const payload: AmazefPromotionPayload = {};
  const eligibleVariants = draft.variants
    .filter((variant) => offers.bogo.eligibleVariantIds.includes(variant.id))
    .map((variant) => ({ id: variant.id, label: variant.label }));

  if (offers.flashSale.enabled) {
    const { originalPrice, flashSalePrice, discountPercent } = offers.flashSale;
    payload.flashSale = {
      enabled: true,
      originalPrice,
      flashSalePrice,
      discountPercent,
      keepPrice: flashSalePrice >= originalPrice - 0.001,
      rule: `Flash sale: was ${originalPrice.toFixed(2)}, now ${flashSalePrice.toFixed(2)} (${discountPercent}% off).`,
    };
  }

  if (offers.bogo.enabled) {
    const giftSummary =
      offers.bogo.customGifts.length > 0
        ? ` Custom gifts: ${offers.bogo.customGifts.map((gift) => gift.title || "Gift").join(", ")}.`
        : "";
    payload.bogo = {
      enabled: true,
      eligibleVariantIds: offers.bogo.eligibleVariantIds,
      eligibleVariants,
      customGifts: offers.bogo.customGifts.filter(
        (gift): gift is AmazefCustomGift => Boolean(gift.title.trim() || gift.imageUrl.trim()),
      ),
      rule: `Buy one get one free on selected variants.${giftSummary}`,
    };
  }

  if (!payload.bogo && !payload.flashSale) return undefined;

  if (floorPrice != null && floorPrice > 0) {
    payload.floorPrice = Number(floorPrice.toFixed(2));
  }

  return payload;
}
