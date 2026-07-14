import { calculatePricingBreakdown } from "@/lib/listings/pricing";
import type { ListingPricingPreferences } from "@/types/listing-generator";
import type { MarketAverage } from "@/lib/pricing/market-price";

/**
 * How far below the competitor average to price:
 *  - auto: our system picks a sensible undercut automatically (no seller input)
 *  - percent: seller-defined percentage below the market average
 *  - amount: seller-defined fixed amount (in the listing currency) below the average
 */
export type UndercutMode = "auto" | "percent" | "amount";

/** The undercut our system applies in "auto" mode. */
export const AUTO_UNDERCUT_PERCENT = 5;

/**
 * A custom charm-ending rule: prices at or below `maxPrice` use `ending` cents
 * (0–99). `maxPrice: null` is the catch-all for everything above the other rules.
 * Example: [{maxPrice:1.5, ending:99}, {maxPrice:2, ending:59}, {maxPrice:null, ending:89}]
 */
export interface CharmRule {
  maxPrice: number | null;
  ending: number;
}

export interface SmartPriceInput {
  aliPrice: number;
  feePrefs: ListingPricingPreferences;
  minProfitPercent: number;
  /** Cap profit % — market undercut is never allowed to exceed this. */
  maxProfitPercent: number;
  market: MarketAverage | null;
  undercutMode: UndercutMode;
  undercutPercent: number;
  undercutAmount: number;
  /** When true, end the price at a charm value just below the market average. */
  charmPricing: boolean;
  /**
   * Optional per-price-range endings. When empty, charm pricing uses .99 for all
   * prices (the simple default).
   */
  charmRules?: CharmRule[];
}

/**
 * Rounds a price down to the nearest value ending in `endingCents` (0–99).
 * e.g. ending 99: 5.00 → 4.99, 5.80 → 4.99; ending 59: 1.90 → 1.59.
 * Prices below 1 are left untouched.
 */
export function roundDownToEnding(price: number, endingCents: number): number {
  if (!Number.isFinite(price) || price < 1) return price;
  const ending = Math.min(Math.max(Math.round(endingCents), 0), 99) / 100;
  const base = Math.floor(price);
  const candidate = base + ending;
  if (candidate <= price + 1e-9) return Number(candidate.toFixed(2));
  return Number((base - 1 + ending).toFixed(2));
}

/** Back-compat: charm price ending in .99. */
export function roundDownToCharm(price: number): number {
  return roundDownToEnding(price, 99);
}

/** Picks the charm ending (cents) for a price from the seller's rules. */
export function resolveCharmEnding(price: number, rules?: CharmRule[]): number {
  if (!rules || rules.length === 0) return 99;

  const sorted = [...rules].sort((a, b) => {
    if (a.maxPrice == null) return 1;
    if (b.maxPrice == null) return -1;
    return a.maxPrice - b.maxPrice;
  });

  for (const rule of sorted) {
    if (rule.maxPrice == null || price <= rule.maxPrice) return rule.ending;
  }
  return sorted[sorted.length - 1]?.ending ?? 99;
}

export interface SmartPriceResult {
  price: number;
  marketAverage: number;
  sampleSize: number;
  /**
   * - market-undercut: priced just below the competitor average (good margin + competitive)
   * - min-profit-floor: market too cheap to undercut profitably, so listed at the
   *   lowest price that still hits the seller's minimum profit
   * - max-profit-ceiling: market undercut would exceed seller's max profit %, so capped
   */
  source: "market-undercut" | "min-profit-floor" | "max-profit-ceiling";
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

/** Highest price that still keeps profit % at or under the seller's max. */
function priceAtMaxProfit(
  aliPrice: number,
  prefs: ListingPricingPreferences,
  maxProfitPercent: number,
): number {
  let best = calculatePricingBreakdown(aliPrice, {
    ...prefs,
    profitMarginPercent: 0,
  }).recommendedPrice;

  for (let margin = 0; margin <= 85; margin += 0.5) {
    const breakdown = calculatePricingBreakdown(aliPrice, {
      ...prefs,
      profitMarginPercent: margin,
    });
    if (breakdown.profitPercent <= maxProfitPercent) {
      best = breakdown.recommendedPrice;
    } else {
      break;
    }
  }

  return best;
}

/**
 * Prices like an experienced seller, but never outside the seller's min/max profit %.
 *  - If AliExpress is cheap and the eBay competitor average is higher, list a bit
 *    BELOW the market average so it sells fast while keeping a healthy profit.
 *  - If the market undercut would exceed max profit %, cap at the max-profit price.
 *  - If the market is too cheap to undercut profitably, fall back to the lowest
 *    price that still meets the seller's minimum profit.
 *
 * Returns null when there isn't enough market data, so the caller can use the
 * normal profit-bounds pricing instead.
 */
export function computeSmartPrice(input: SmartPriceInput): SmartPriceResult | null {
  const { aliPrice, feePrefs, minProfitPercent, maxProfitPercent, market, undercutMode } = input;

  if (!market || market.average <= 0 || market.sampleSize < 3) return null;

  const floor = priceAtMinProfit(aliPrice, feePrefs, minProfitPercent);
  const ceiling = priceAtMaxProfit(aliPrice, feePrefs, maxProfitPercent);

  let rawTarget: number;
  if (input.charmPricing) {
    // Charm pricing: end the price at the seller's chosen charm value (per price
    // range when custom rules are set, otherwise .99), just below the market
    // average so it naturally undercuts while looking attractive.
    const ending = resolveCharmEnding(market.average, input.charmRules);
    rawTarget = roundDownToEnding(market.average, ending);
  } else if (undercutMode === "amount") {
    rawTarget = market.average - Math.max(input.undercutAmount, 0);
  } else if (undercutMode === "percent") {
    const pct = Math.min(Math.max(input.undercutPercent, 0), 50);
    rawTarget = market.average * (1 - pct / 100);
  } else {
    // auto: our system decides — a modest undercut so it sells fast while
    // keeping as much profit as possible.
    rawTarget = market.average * (1 - AUTO_UNDERCUT_PERCENT / 100);
  }

  let target = Number(rawTarget.toFixed(2));
  let source: SmartPriceResult["source"] = "market-undercut";

  if (target < floor) {
    target = floor;
    source = "min-profit-floor";
  } else if (target > ceiling) {
    target = ceiling;
    source = "max-profit-ceiling";
  }

  // If min > max settings somehow collide, prefer min floor.
  if (floor > ceiling) {
    target = floor;
    source = "min-profit-floor";
  }

  return {
    price: Number(target.toFixed(2)),
    marketAverage: market.average,
    sampleSize: market.sampleSize,
    source,
  };
}
