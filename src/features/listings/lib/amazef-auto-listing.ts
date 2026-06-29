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
  smartPricingEnabled: boolean;
  marketUndercutPercent: number;
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
  marketUndercutPercent: 3,
};

export function amazefAutoListingSettingsKey(userId: string) {
  return `amazef-auto-listing-settings-${userId}`;
}

export function amazefShippingStorageKey(userId: string) {
  return `amazef-default-shipping-days-${userId}`;
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
    marketUndercutPercent,
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
