import { calculatePricingBreakdown } from "@/lib/listings/pricing";
import type { ListingPricingPreferences } from "@/types/listing-generator";
import type { MarketAverage } from "@/lib/pricing/market-price";

export interface SmartPriceInput {
  aliPrice: number;
  feePrefs: ListingPricingPreferences;
  minProfitPercent: number;
  market: MarketAverage | null;
  undercutPercent: number;
}

export interface SmartPriceResult {
  price: number;
  marketAverage: number;
  sampleSize: number;
  /**
   * - market-undercut: priced just below the competitor average (good margin + competitive)
   * - min-profit-floor: market too cheap to undercut profitably, so listed at the
   *   lowest price that still hits the seller's minimum profit
   */
  source: "market-undercut" | "min-profit-floor";
}

/** The lowest price that still yields the seller's minimum profit %. */
function priceAtMinProfit(
  aliPrice: number,
  prefs: ListingPricingPreferences,
  minProfitPercent: number,
): number {
  const breakdown = calculatePricingBreakdown(aliPrice, {
    ...prefs,
    profitMarginPercent: minProfitPercent,
  });
  return breakdown.recommendedPrice;
}

/**
 * Prices like an experienced seller:
 *  - If AliExpress is cheap and the eBay competitor average is higher, list a bit
 *    BELOW the market average so it sells fast while keeping a healthy profit.
 *  - If the market is too cheap to undercut profitably, fall back to the lowest
 *    price that still meets the seller's minimum profit.
 *
 * Returns null when there isn't enough market data, so the caller can use the
 * normal profit-bounds pricing instead.
 */
export function computeSmartPrice(input: SmartPriceInput): SmartPriceResult | null {
  const { aliPrice, feePrefs, minProfitPercent, market, undercutPercent } = input;

  if (!market || market.average <= 0 || market.sampleSize < 3) return null;

  const floor = priceAtMinProfit(aliPrice, feePrefs, minProfitPercent);
  const undercut = Math.min(Math.max(undercutPercent, 0), 50);
  const target = Number((market.average * (1 - undercut / 100)).toFixed(2));

  if (target >= floor) {
    return {
      price: target,
      marketAverage: market.average,
      sampleSize: market.sampleSize,
      source: "market-undercut",
    };
  }

  return {
    price: floor,
    marketAverage: market.average,
    sampleSize: market.sampleSize,
    source: "min-profit-floor",
  };
}
