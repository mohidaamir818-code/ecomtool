/**
 * Custom charm-ending rule: prices at or below `maxPrice` end at `ending` cents
 * (0–99). `maxPrice: null` is the catch-all for everything above the other rules.
 */
export interface CharmRule {
  maxPrice: number | null;
  ending: number;
}

export interface AmazefAutoListingSettings {
  enabled: boolean;
  platformFeePercent: number;
  minProfitPercent: number;
  maxProfitPercent: number;
  minStock: number;
  maxStock: number;
  listVeroProducts: boolean;
  veroWarningAcknowledged: boolean;
  // Smart pricing: prices just below the live market average so listings sell
  // fast while staying above the seller's minimum profit.
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
  // Buy One Get One (BOGO) promotion, configured in the seller's own words via AI.
  bogoEnabled: boolean;
  // Only apply BOGO when the per-item profit (money) is at least this.
  bogoMinProfit: number;
  // The seller's own plain-language description of how BOGO should work.
  bogoRule: string;
  // Flash sale promotion, configured in the seller's own words via AI.
  flashSaleEnabled: boolean;
  // When true, the real selling price stays the same and we only SHOW a higher
  // "was" price / discount so buyers feel it's on sale (no real loss).
  flashSaleKeepPrice: boolean;
  // The discount % to show/apply in the flash sale.
  flashSaleDiscountPercent: number;
  // Only apply the flash sale when the per-item profit (money) is at least this.
  flashSaleMinProfit: number;
  // The seller's own plain-language description of how the flash sale should work.
  flashSaleRule: string;
  /** When on, AliExpress photos are AI-edited with aiPhotoEditPrompt during prepare. */
  aiPhotoEditEnabled: boolean;
  /** Seller description of how photos should look (e.g. white background, remove logos). */
  aiPhotoEditPrompt: string;
}

export const DEFAULT_AMAZEF_AUTO_LISTING_SETTINGS: AmazefAutoListingSettings = {
  enabled: false,
  platformFeePercent: 15,
  minProfitPercent: 20,
  maxProfitPercent: 45,
  minStock: 1,
  maxStock: 50,
  listVeroProducts: false,
  veroWarningAcknowledged: false,
  smartPricingEnabled: true,
  undercutMode: "auto",
  marketUndercutPercent: 3,
  marketUndercutAmount: 1,
  charmPricingEnabled: false,
  charmRules: [],
  bogoEnabled: false,
  bogoMinProfit: 0,
  bogoRule: "",
  flashSaleEnabled: false,
  flashSaleKeepPrice: false,
  flashSaleDiscountPercent: 0,
  flashSaleMinProfit: 0,
  flashSaleRule: "",
  aiPhotoEditEnabled: false,
  aiPhotoEditPrompt: "",
};

export function amazefAutoListingSettingsKey(userId: string) {
  return `amazef-auto-listing-settings-${userId}`;
}

export function amazefShippingStorageKey(userId: string) {
  return `amazef-default-shipping-days-${userId}`;
}

export function amazefHandlingStorageKey(userId: string) {
  return `amazef-default-handling-time-${userId}`;
}

/** Amazef seller rule: handling / processing time cannot exceed 5 days. */
export const AMAZEF_MAX_HANDLING_DAYS = 5;

/**
 * Normalize a handling-time label and clamp any day numbers to Amazef's max (5).
 * Examples: "6 days" → "5 days", "3 to 7 days" → "3 to 5 days", "1-2 days" unchanged.
 */
export function normalizeAmazefHandlingTimeLabel(
  raw: string | null | undefined,
  fallback = "1 day",
): string {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return fallback;

  const rangeMatch = trimmed.match(
    /(\d+)\s*(?:to|-|–|—)\s*(\d+)/i,
  );
  if (rangeMatch) {
    const low = Math.min(
      AMAZEF_MAX_HANDLING_DAYS,
      Math.max(1, Number.parseInt(rangeMatch[1], 10)),
    );
    const high = Math.min(
      AMAZEF_MAX_HANDLING_DAYS,
      Math.max(low, Number.parseInt(rangeMatch[2], 10)),
    );
    if (low === high) return low === 1 ? "1 day" : `${low} days`;
    return `${low} to ${high} days`;
  }

  const singleMatch = trimmed.match(/(\d+)/);
  if (singleMatch) {
    const days = Math.min(
      AMAZEF_MAX_HANDLING_DAYS,
      Math.max(1, Number.parseInt(singleMatch[1], 10)),
    );
    return days === 1 ? "1 day" : `${days} days`;
  }

  return trimmed || fallback;
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

export function normalizeAutoListingSettings(
  input: Partial<AmazefAutoListingSettings> | null | undefined,
): AmazefAutoListingSettings {
  const base = { ...DEFAULT_AMAZEF_AUTO_LISTING_SETTINGS };
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
  const undercutMode: AmazefAutoListingSettings["undercutMode"] =
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
    smartPricingEnabled: input.smartPricingEnabled ?? base.smartPricingEnabled,
    undercutMode,
    marketUndercutPercent,
    marketUndercutAmount,
    charmPricingEnabled: Boolean(input.charmPricingEnabled),
    charmRules: normalizeCharmRules(input.charmRules),
    bogoEnabled: Boolean(input.bogoEnabled),
    bogoMinProfit: clampNumber(input.bogoMinProfit, 0, 100000, base.bogoMinProfit),
    bogoRule: clampString(input.bogoRule, base.bogoRule),
    flashSaleEnabled: Boolean(input.flashSaleEnabled),
    flashSaleKeepPrice: Boolean(input.flashSaleKeepPrice),
    flashSaleDiscountPercent: clampNumber(
      input.flashSaleDiscountPercent,
      0,
      90,
      base.flashSaleDiscountPercent,
    ),
    flashSaleMinProfit: clampNumber(input.flashSaleMinProfit, 0, 100000, base.flashSaleMinProfit),
    flashSaleRule: clampString(input.flashSaleRule, base.flashSaleRule),
    aiPhotoEditEnabled: Boolean(input.aiPhotoEditEnabled),
    // Do not trim while typing — trailing spaces are needed between words.
    aiPhotoEditPrompt:
      typeof input.aiPhotoEditPrompt === "string"
        ? input.aiPhotoEditPrompt.slice(0, 500)
        : base.aiPhotoEditPrompt,
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function clampString(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, 500);
}

export function loadAutoListingSettings(userId: string): AmazefAutoListingSettings {
  try {
    const raw = localStorage.getItem(amazefAutoListingSettingsKey(userId));
    if (!raw) return { ...DEFAULT_AMAZEF_AUTO_LISTING_SETTINGS };
    return normalizeAutoListingSettings(JSON.parse(raw) as Partial<AmazefAutoListingSettings>);
  } catch {
    return { ...DEFAULT_AMAZEF_AUTO_LISTING_SETTINGS };
  }
}

export function saveAutoListingSettings(userId: string, settings: AmazefAutoListingSettings) {
  localStorage.setItem(
    amazefAutoListingSettingsKey(userId),
    JSON.stringify(normalizeAutoListingSettings(settings)),
  );
}

export function validateAutoListingSettingsInput(
  settings: AmazefAutoListingSettings,
): string | null {
  if (settings.minProfitPercent > settings.maxProfitPercent) {
    return "Minimum profit % cannot be greater than maximum profit %.";
  }
  if (settings.minStock > settings.maxStock) {
    return "Minimum stock cannot be greater than maximum stock.";
  }
  if (settings.aiPhotoEditEnabled && !settings.aiPhotoEditPrompt.trim()) {
    return "Write a photo edit prompt, or turn off AI photo edit.";
  }
  return null;
}
