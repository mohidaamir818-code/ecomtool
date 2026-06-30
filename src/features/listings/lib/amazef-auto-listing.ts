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
};

export function amazefAutoListingSettingsKey(userId: string) {
  return `amazef-auto-listing-settings-${userId}`;
}

export function amazefShippingStorageKey(userId: string) {
  return `amazef-default-shipping-days-${userId}`;
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
  const minProfitPercent = clampNumber(input.minProfitPercent, 1, 90, base.minProfitPercent);
  const maxProfitPercent = clampNumber(
    input.maxProfitPercent,
    minProfitPercent,
    95,
    Math.max(minProfitPercent, base.maxProfitPercent),
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
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
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
  return null;
}
