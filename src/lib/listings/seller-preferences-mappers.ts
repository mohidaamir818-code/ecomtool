import type {
  ListingPricingPreferences,
  SellerPreferences,
  VolumePromotionTier,
} from "@/types/listing-generator";
import { defaultSellerPreferences } from "@/types/listing-generator";

export function sellerPreferencesToFeePrefs(prefs: SellerPreferences): ListingPricingPreferences {
  return {
    ebayFinalValueFeePercent: prefs.ebayFinalValueFeePercent,
    ebayTransactionFee: prefs.transactionFeeAmount,
    paymentFeePercent: prefs.paymentFeePercent,
    profitMarginPercent: prefs.profitMarginPercent,
    shippingCost: prefs.shippingCost,
    currency: prefs.currency,
  };
}

export function feePrefsToSellerPreferences(
  fees: ListingPricingPreferences,
  existing?: SellerPreferences,
): SellerPreferences {
  const base = existing ?? defaultSellerPreferences(fees.currency);
  return {
    ...base,
    ebayFinalValueFeePercent: fees.ebayFinalValueFeePercent,
    transactionFeeAmount: fees.ebayTransactionFee,
    paymentFeePercent: fees.paymentFeePercent,
    profitMarginPercent: fees.profitMarginPercent,
    shippingCost: fees.shippingCost,
    currency: fees.currency,
  };
}

export function sellerPreferencesToPromotions(prefs: SellerPreferences): VolumePromotionTier[] {
  return [
    { enabled: prefs.buy2Enabled, quantity: 2, discountPercent: prefs.buy2DiscountPercent },
    { enabled: prefs.buy3Enabled, quantity: 3, discountPercent: prefs.buy3DiscountPercent },
    { enabled: prefs.buy5Enabled, quantity: 5, discountPercent: prefs.buy5DiscountPercent },
    { enabled: prefs.buy10Enabled, quantity: 10, discountPercent: prefs.buy10DiscountPercent },
  ];
}

export function promotionsToSellerPreferences(
  promotions: VolumePromotionTier[],
  existing: SellerPreferences,
): SellerPreferences {
  const byQty = Object.fromEntries(promotions.map((tier) => [tier.quantity, tier]));

  return {
    ...existing,
    buy2Enabled: Boolean(byQty[2]?.enabled),
    buy2DiscountPercent: Number(byQty[2]?.discountPercent ?? 0),
    buy3Enabled: Boolean(byQty[3]?.enabled),
    buy3DiscountPercent: Number(byQty[3]?.discountPercent ?? 0),
    buy5Enabled: Boolean(byQty[5]?.enabled),
    buy5DiscountPercent: Number(byQty[5]?.discountPercent ?? 0),
    buy10Enabled: Boolean(byQty[10]?.enabled),
    buy10DiscountPercent: Number(byQty[10]?.discountPercent ?? 0),
  };
}
