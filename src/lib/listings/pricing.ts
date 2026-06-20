import type {
  ListingPricingPreferences,
  ListingProductSource,
  ListingVariantDraft,
  PricingBreakdown,
} from "@/types/listing-generator";

const DEFAULT_VARIANT_SKU = "N/A";

export function calculatePricingBreakdown(
  aliExpressPrice: number,
  prefs: ListingPricingPreferences,
): PricingBreakdown {
  const baseCost = aliExpressPrice + prefs.shippingCost;
  const feeRate =
    (prefs.ebayFinalValueFeePercent + prefs.paymentFeePercent + prefs.profitMarginPercent) / 100;

  const safeDenominator = Math.max(1 - feeRate, 0.01);
  const targetPrice = baseCost / safeDenominator;
  const recommendedPrice = Number((targetPrice + prefs.ebayTransactionFee).toFixed(2));

  const ebayFees = Number(
    (recommendedPrice * (prefs.ebayFinalValueFeePercent / 100) + prefs.ebayTransactionFee).toFixed(2),
  );
  const paymentFees = Number((recommendedPrice * (prefs.paymentFeePercent / 100)).toFixed(2));
  const totalFees = ebayFees + paymentFees;
  const profit = Number((recommendedPrice - baseCost - totalFees).toFixed(2));
  const profitPercent =
    recommendedPrice > 0 ? Number(((profit / recommendedPrice) * 100).toFixed(1)) : 0;

  return {
    aliExpressCost: aliExpressPrice,
    shippingCost: prefs.shippingCost,
    baseCost: Number(baseCost.toFixed(2)),
    ebayFees: Number(totalFees.toFixed(2)),
    profit,
    profitPercent,
    recommendedPrice,
    currency: prefs.currency,
  };
}

export function buildVariantPrices(
  product: ListingProductSource,
  baseEbayPrice: number,
): ListingVariantDraft[] {
  const inStockVariants =
    product.variants?.filter((v) => v.stock != null && v.stock > 0) ?? [];

  if (inStockVariants.length === 0) {
    const defaultImage = product.imageUrl ?? product.images[0] ?? "";
    return [
      {
        id: "default",
        label: "Default",
        imageUrl: defaultImage,
        price: baseEbayPrice,
        stock: product.stock ?? 1,
        sku: DEFAULT_VARIANT_SKU,
        ean: "",
        quantity: 1,
        aliExpressPrice: product.price,
      },
    ];
  }

  const baseAliPrice = Math.min(...inStockVariants.map((v) => v.price));

  return inStockVariants.map((variant) => {
    const ratio = baseAliPrice > 0 ? variant.price / baseAliPrice : 1;
    const variantImage =
      variant.imageUrl ?? product.imageUrl ?? product.images[0] ?? "";

    return {
      id: variant.id,
      label: variant.label,
      imageUrl: variantImage,
      price: Number((baseEbayPrice * ratio).toFixed(2)),
      stock: variant.stock ?? 1,
      sku: DEFAULT_VARIANT_SKU,
      ean: "",
      quantity: 1,
      aliExpressPrice: variant.price,
    };
  });
}

export function resolveBaseAliPrice(product: ListingProductSource): number {
  const inStock = product.variants?.filter((v) => v.stock != null && v.stock > 0) ?? [];
  if (inStock.length > 0) {
    return Math.min(...inStock.map((v) => v.price));
  }
  return product.price;
}
