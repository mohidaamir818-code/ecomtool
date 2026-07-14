import type { VolumePromotionTier } from "@/types/listing-generator";
import { DEFAULT_PROMOTIONS } from "@/types/listing-generator";

/**
 * Custom charm-ending rule: prices at or below `maxPrice` end at `ending` cents
 * (0–99). `maxPrice: null` is the catch-all for everything above the other rules.
 */
export interface CharmRule {
  maxPrice: number | null;
  ending: number;
}

export interface EbayAutoListingSettings {
  enabled: boolean;
  platformFeePercent: number;
  minProfitPercent: number;
  maxProfitPercent: number;
  minStock: number;
  maxStock: number;
  listVeroProducts: boolean;
  veroWarningAcknowledged: boolean;
  promotions: VolumePromotionTier[];
  // Smart pricing: prices just below the live eBay competitor average so listings
  // sell fast while staying above the seller's minimum profit.
  //   undercutMode "auto"    -> our system sets the undercut automatically
  //   undercutMode "percent" -> seller's marketUndercutPercent below the average
  //   undercutMode "amount"  -> seller's marketUndercutAmount (currency) below it
  smartPricingEnabled: boolean;
  undercutMode: "auto" | "percent" | "amount";
  marketUndercutPercent: number;
  marketUndercutAmount: number;
  // Charm pricing: always end the price at .99, just below the market average
  // (only when it still keeps the seller's minimum profit).
  charmPricingEnabled: boolean;
  // Optional per-price-range endings (e.g. ≤£1.5 → .99, ≤£2 → .59, else → .89).
  // Empty means charm pricing uses .99 for everything.
  charmRules: CharmRule[];
  // Auto promotion (eBay Promoted Listings): after a product is listed, it is
  // added to the seller's promotion campaign automatically — but only when the
  // per-item profit is at or above autoPromoteMinProfit (0 = always promote).
  autoPromoteEnabled: boolean;
  autoPromoteMinProfit: number;
  autoPromoteAdRatePercent: number;
  /** When on, AliExpress photos are AI-edited with aiPhotoEditPrompt during prepare. */
  aiPhotoEditEnabled: boolean;
  /** Seller description of how photos should look (e.g. white background, remove logos). */
  aiPhotoEditPrompt: string;
}

export const DEFAULT_EBAY_AUTO_LISTING_SETTINGS: EbayAutoListingSettings = {
  enabled: false,
  platformFeePercent: 13.25,
  minProfitPercent: 20,
  maxProfitPercent: 45,
  minStock: 1,
  maxStock: 50,
  listVeroProducts: false,
  veroWarningAcknowledged: false,
  promotions: DEFAULT_PROMOTIONS.map((tier) => ({ ...tier })),
  smartPricingEnabled: true,
  undercutMode: "auto",
  marketUndercutPercent: 3,
  marketUndercutAmount: 1,
  charmPricingEnabled: false,
  charmRules: [],
  autoPromoteEnabled: false,
  autoPromoteMinProfit: 5,
  autoPromoteAdRatePercent: 5,
  aiPhotoEditEnabled: false,
  aiPhotoEditPrompt: "",
};

export function ebayAutoListingSettingsKey(userId: string) {
  return `ebay-auto-listing-settings-${userId}`;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizePromotions(input: VolumePromotionTier[] | undefined): VolumePromotionTier[] {
  const defaults = DEFAULT_EBAY_AUTO_LISTING_SETTINGS.promotions;
  if (!Array.isArray(input) || input.length === 0) {
    return defaults.map((tier) => ({ ...tier }));
  }

  return defaults.map((defaultTier) => {
    const match = input.find((tier) => tier.quantity === defaultTier.quantity);
    if (!match) return { ...defaultTier };
    return {
      quantity: defaultTier.quantity,
      enabled: Boolean(match.enabled),
      discountPercent: clampNumber(match.discountPercent, 0, 90, defaultTier.discountPercent),
    };
  });
}

export function normalizeCharmRules(input: unknown): CharmRule[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw) => {
      const rule = raw as Partial<CharmRule>;
      const maxPriceValue = Number(rule.maxPrice);
      const maxPrice =
        rule.maxPrice == null || !Number.isFinite(maxPriceValue) || maxPriceValue <= 0
          ? null
          : Number(maxPriceValue.toFixed(2));
      const ending = Math.min(Math.max(Math.round(Number(rule.ending)), 0), 99);
      if (!Number.isFinite(ending)) return null;
      return { maxPrice, ending } as CharmRule;
    })
    .filter((rule): rule is CharmRule => rule !== null);
}

export function normalizeEbayAutoListingSettings(
  input: Partial<EbayAutoListingSettings> | null | undefined,
): EbayAutoListingSettings {
  const base = { ...DEFAULT_EBAY_AUTO_LISTING_SETTINGS };
  if (!input) return base;

  const platformFeePercent = clampNumber(input.platformFeePercent, 0, 100, base.platformFeePercent);
  const minProfitPercent = clampNumber(input.minProfitPercent, 0, 90, base.minProfitPercent);
  const maxProfitPercent = clampNumber(
    input.maxProfitPercent,
    minProfitPercent,
    95,
    Math.max(minProfitPercent, Number(input.maxProfitPercent) || minProfitPercent),
  );
  const minStock = clampNumber(input.minStock, 1, 9999, base.minStock);
  const maxStock = clampNumber(input.maxStock, minStock, 99999, Math.max(minStock, base.maxStock));
  const marketUndercutPercent = clampNumber(
    input.marketUndercutPercent,
    0,
    50,
    base.marketUndercutPercent,
  );
  const marketUndercutAmount = clampNumber(
    input.marketUndercutAmount,
    0,
    100000,
    base.marketUndercutAmount,
  );
  const undercutMode: EbayAutoListingSettings["undercutMode"] =
    input.undercutMode === "percent" || input.undercutMode === "amount"
      ? input.undercutMode
      : "auto";

  return {
    enabled: Boolean(input.enabled),
    platformFeePercent,
    minProfitPercent,
    maxProfitPercent,
    minStock,
    maxStock,
    listVeroProducts: Boolean(input.listVeroProducts),
    veroWarningAcknowledged: Boolean(input.veroWarningAcknowledged),
    promotions: normalizePromotions(input.promotions),
    smartPricingEnabled: input.smartPricingEnabled ?? base.smartPricingEnabled,
    undercutMode,
    marketUndercutPercent,
    marketUndercutAmount,
    charmPricingEnabled: Boolean(input.charmPricingEnabled),
    charmRules: normalizeCharmRules(input.charmRules),
    autoPromoteEnabled: Boolean(input.autoPromoteEnabled),
    autoPromoteMinProfit: clampNumber(input.autoPromoteMinProfit, 0, 100000, base.autoPromoteMinProfit),
    autoPromoteAdRatePercent: clampNumber(
      input.autoPromoteAdRatePercent,
      2,
      100,
      base.autoPromoteAdRatePercent,
    ),
    aiPhotoEditEnabled: Boolean(input.aiPhotoEditEnabled),
    aiPhotoEditPrompt:
      typeof input.aiPhotoEditPrompt === "string"
        ? input.aiPhotoEditPrompt.trim().slice(0, 500)
        : base.aiPhotoEditPrompt,
  };
}

export function loadEbayAutoListingSettings(userId: string): EbayAutoListingSettings {
  try {
    const raw = localStorage.getItem(ebayAutoListingSettingsKey(userId));
    if (!raw) return { ...DEFAULT_EBAY_AUTO_LISTING_SETTINGS };
    return normalizeEbayAutoListingSettings(JSON.parse(raw) as Partial<EbayAutoListingSettings>);
  } catch {
    return { ...DEFAULT_EBAY_AUTO_LISTING_SETTINGS };
  }
}

export function saveEbayAutoListingSettings(userId: string, settings: EbayAutoListingSettings) {
  localStorage.setItem(
    ebayAutoListingSettingsKey(userId),
    JSON.stringify(normalizeEbayAutoListingSettings(settings)),
  );
}

export function validateEbayAutoListingSettingsInput(
  settings: EbayAutoListingSettings,
): string | null {
  if (settings.minProfitPercent > settings.maxProfitPercent) {
    return "Minimum profit % cannot be greater than maximum profit %.";
  }
  if (settings.minStock > settings.maxStock) {
    return "Minimum stock cannot be greater than maximum stock.";
  }

  for (const tier of settings.promotions) {
    if (tier.enabled && (tier.discountPercent < 1 || tier.discountPercent > 90)) {
      return `Buy ${tier.quantity} discount must be between 1% and 90%.`;
    }
  }

  if (settings.aiPhotoEditEnabled && !settings.aiPhotoEditPrompt.trim()) {
    return "Write a photo edit prompt, or turn off AI photo edit.";
  }

  return null;
}
