import "server-only";

import { buildAmazefPromotionsFromDraft } from "@/lib/amazef/build-promotions";
import { listDraftOnAmazef } from "@/lib/amazef/listing";
import { saveListedProduct } from "@/lib/listings/listed-products-service";
import { sendEmail } from "@/lib/email/send-email";
import { generateEbayListing } from "@/lib/gemini/generate-listing";
import { isAiAuthError } from "@/lib/gemini/client";
import { checkVeroSafety } from "@/lib/gemini/vero-check";
import { VeroAckRequiredError } from "@/lib/listings/vero-ack-error";
import { computeListingQualityScore } from "@/features/listings/lib/listing-quality";
import { buildInitialDraft, getSelectedPhotos } from "@/features/listings/lib/draft-utils";
import { ensureAmazefOffers } from "@/features/listings/lib/amazef-offers";
import type { AmazefAutoListingSettings } from "@/features/listings/lib/amazef-auto-listing";
import { normalizeAutoListingSettings } from "@/features/listings/lib/amazef-auto-listing";
import { mergeInternalSkusIntoDraft } from "@/lib/listings/internal-sku";
import { ensureInternalSkus } from "@/lib/listings/internal-sku-service";
import { fetchAliExpressShippingDaysLabel } from "@/lib/listings/aliexpress-shipping-days";
import {
  editAliExpressListingPhotos,
  mergeEditedPhotosIntoDraftPhotos,
} from "@/lib/listings/ai-listing-photos";
import { fetchListingProductSource } from "@/lib/listings/product-source";
import {
  buildBreakdownForPrice,
  calculatePricingBreakdown,
  resolveBaseAliPrice,
} from "@/lib/listings/pricing";
import { getMarketAveragePrice } from "@/lib/pricing/market-price";
import { computeSmartPrice } from "@/lib/pricing/smart-pricing";
import {
  getSellerPreferences,
  sellerPreferencesToFeePrefs,
  sellerPreferencesToPromotions,
} from "@/lib/listings/seller-preferences";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  ListingDraft,
  ListingPricingPreferences,
  PricingBreakdown,
} from "@/types/listing-generator";
import { defaultSellerPreferences } from "@/types/listing-generator";

export interface AmazefAutoListResult {
  listingUrl: string | null;
  title: string;
  price: number;
  currency: string;
}

function clampStock(value: number, minStock: number, maxStock: number): number {
  return Math.min(maxStock, Math.max(minStock, value));
}

function resolvePricingWithinProfitBounds(
  aliPrice: number,
  basePrefs: ListingPricingPreferences,
  minProfitPercent: number,
  maxProfitPercent: number,
): { prefs: ListingPricingPreferences; breakdown: PricingBreakdown } | null {
  let bestInRange: { prefs: ListingPricingPreferences; breakdown: PricingBreakdown } | null = null;

  for (let margin = 0; margin <= 85; margin += 0.5) {
    const prefs = { ...basePrefs, profitMarginPercent: margin };
    const breakdown = calculatePricingBreakdown(aliPrice, prefs);

    // Stay strictly inside the seller's min/max — never ignore max.
    if (breakdown.profitPercent >= minProfitPercent && breakdown.profitPercent <= maxProfitPercent) {
      bestInRange = { prefs, breakdown };
    }
  }

  return bestInRange;
}

function priceFloorAtMinProfit(
  aliPrice: number,
  basePrefs: ListingPricingPreferences,
  minProfitPercent: number,
  fallback: number,
): number {
  for (let margin = 0; margin <= 85; margin += 0.5) {
    const breakdown = calculatePricingBreakdown(aliPrice, {
      ...basePrefs,
      profitMarginPercent: margin,
    });
    if (breakdown.profitPercent >= minProfitPercent) return breakdown.recommendedPrice;
  }
  return fallback;
}

function applyStockLimits(draft: ListingDraft, minStock: number, maxStock: number): ListingDraft {
  return {
    ...draft,
    variants: draft.variants.map((variant) => {
      const sourceStock = variant.stock ?? variant.quantity ?? minStock;
      const nextStock = clampStock(sourceStock, minStock, maxStock);
      return {
        ...variant,
        stock: nextStock,
        quantity: nextStock,
      };
    }),
  };
}

async function assignSkusToDraft(userId: string, draft: ListingDraft): Promise<ListingDraft> {
  const result = await ensureInternalSkus({
    userId,
    productUrl: draft.product.productUrl,
    variants: draft.variants.map((variant) => ({ id: variant.id, label: variant.label })),
  });

  return mergeInternalSkusIntoDraft(draft, result.baseSku, result.variantSkus);
}

async function getUserEmail(userId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("profiles").select("email").eq("id", userId).maybeSingle();
  return data?.email?.trim() ?? null;
}

async function runPrepareStep<T>(
  label: string,
  run: () => Promise<T>,
  options?: { timeoutMs?: number; maxAttempts?: number },
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 25_000;
  const maxAttempts = options?.maxAttempts ?? 2;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await Promise.race([
        run(),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error(`${label} timed out after ${timeoutMs / 1000}s.`)),
            timeoutMs,
          );
        }),
      ]);
    } catch (error) {
      lastError = error;
      // Invalid Anthropic key will never succeed on retry — fail immediately.
      if (isAiAuthError(error)) break;
      if (attempt < maxAttempts) {
        console.warn(`[Amazef prepare] ${label} failed (attempt ${attempt}), retrying…`, error);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`${label} failed after ${maxAttempts} attempts.`);
}

export interface AmazefAutoListPrepared {
  draft: ListingDraft;
  pricingBreakdown: PricingBreakdown;
  settings: AmazefAutoListingSettings;
}

export async function prepareAmazefAutoListDraft(
  userId: string,
  productUrl: string,
  rawSettings: Partial<AmazefAutoListingSettings>,
  options?: { acknowledgeVero?: boolean; manualPriceOverride?: number | null },
): Promise<AmazefAutoListPrepared> {
  const settings = normalizeAutoListingSettings(rawSettings);
  const acknowledgeVero = Boolean(options?.acknowledgeVero);

  const product = await runPrepareStep("Product fetch", () =>
    fetchListingProductSource(productUrl.trim()),
  );

  const currency = product.currency === "USD" ? "GBP" : product.currency;
  const fixedPrice =
    options?.manualPriceOverride != null && options.manualPriceOverride > 0
      ? options.manualPriceOverride
      : null;
  const wantMarket = fixedPrice == null && settings.smartPricingEnabled;

  const [vero, sellerPrefs, shippingDaysLabel, market] = await Promise.all([
    runPrepareStep("VeRO check", () => checkVeroSafety(product)),
    getSellerPreferences(userId, currency).then(
      (prefs) => prefs ?? defaultSellerPreferences(currency),
    ),
    runPrepareStep("AliExpress shipping", () =>
      fetchAliExpressShippingDaysLabel(product.productUrl),
    ).catch(() => null),
    wantMarket
      ? getMarketAveragePrice(product.title, "EBAY_GB").catch(() => null)
      : Promise.resolve(null),
  ]);

  if (!vero.safe) {
    if (!settings.listVeroProducts) {
      throw new Error(
        "This product failed the VeRO check. Enable “List VeRO products” in auto listing settings to continue.",
      );
    }
    if (!acknowledgeVero) {
      throw new VeroAckRequiredError(vero);
    }
  }

  const feePrefs = {
    ...sellerPreferencesToFeePrefs(sellerPrefs),
    ebayFinalValueFeePercent: settings.platformFeePercent,
  };
  const aliPrice = resolveBaseAliPrice(product);

  let smartPrice: number | null = null;
  if (wantMarket && market) {
    const smart = computeSmartPrice({
      aliPrice,
      feePrefs,
      minProfitPercent: settings.minProfitPercent,
      maxProfitPercent: settings.maxProfitPercent,
      market,
      undercutMode: settings.undercutMode,
      undercutPercent: settings.marketUndercutPercent,
      undercutAmount: settings.marketUndercutAmount,
      charmPricing: settings.charmPricingEnabled,
      charmRules: settings.charmRules,
    });
    smartPrice = smart?.price ?? null;
  }

  const effectivePrice = fixedPrice ?? smartPrice;

  let pricingPrefs: ListingPricingPreferences;
  let pricingBreakdown: PricingBreakdown;
  let listingPrice: number;

  if (effectivePrice != null) {
    pricingPrefs = { ...feePrefs };
    pricingBreakdown = buildBreakdownForPrice(aliPrice, pricingPrefs, effectivePrice);
    listingPrice = effectivePrice;

    // Fixed price is seller-intent; smart price must still respect max profit %.
    if (fixedPrice == null && pricingBreakdown.profitPercent > settings.maxProfitPercent) {
      const capped = resolvePricingWithinProfitBounds(
        aliPrice,
        feePrefs,
        settings.minProfitPercent,
        settings.maxProfitPercent,
      );
      if (capped) {
        pricingPrefs = capped.prefs;
        pricingBreakdown = capped.breakdown;
        listingPrice = capped.breakdown.recommendedPrice;
      }
    }
  } else {
    const pricing = resolvePricingWithinProfitBounds(
      aliPrice,
      feePrefs,
      settings.minProfitPercent,
      settings.maxProfitPercent,
    );

    if (!pricing) {
      throw new Error(
        `Could not price within your profit range of ${settings.minProfitPercent}%–${settings.maxProfitPercent}%.`,
      );
    }

    pricingPrefs = pricing.prefs;
    pricingBreakdown = pricing.breakdown;
    listingPrice = pricing.breakdown.recommendedPrice;
  }

  type EditedPhotos = Awaited<ReturnType<typeof editAliExpressListingPhotos>>;
  const emptyEditedPhotos: EditedPhotos = [];
  const photoEditPromise =
    settings.aiPhotoEditEnabled && settings.aiPhotoEditPrompt.trim()
      ? editAliExpressListingPhotos({
          userId,
          photoUrls: product.images ?? [],
          sellerPrompt: settings.aiPhotoEditPrompt,
          productTitle: product.title,
          count: 3,
        }).catch((error) => {
          console.warn("[Amazef prepare] AI photo edit skipped:", error);
          return emptyEditedPhotos;
        })
      : Promise.resolve(emptyEditedPhotos);

  const timedPhotoEdit = Promise.race([
    photoEditPromise,
    new Promise<EditedPhotos>((resolve) => {
      setTimeout(() => resolve(emptyEditedPhotos), 20_000);
    }),
  ]);

  const [listing, editedPhotos] = await Promise.all([
    runPrepareStep(
      "Listing generation",
      () => generateEbayListing(product, listingPrice),
      { timeoutMs: 30_000, maxAttempts: 1 },
    ),
    timedPhotoEdit,
  ]);
  const promotions = sellerPreferencesToPromotions(sellerPrefs);

  let draft = buildInitialDraft(product, listing, {
    pricing: pricingPrefs,
    pricingBreakdown,
    manualPriceOverride: effectivePrice,
    promotions,
  });

  if (editedPhotos.length > 0) {
    draft = {
      ...draft,
      photos: mergeEditedPhotosIntoDraftPhotos(draft.photos, editedPhotos),
    };
  }

  draft = applyStockLimits(draft, settings.minStock, settings.maxStock);

  if (shippingDaysLabel) {
    draft = {
      ...draft,
      product: { ...draft.product, shippingDaysLabel },
    };
  }

  const quality = computeListingQualityScore(draft, "amazef");
  const hasPhoto = getSelectedPhotos(draft).length > 0;
  const failedCritical = quality.checks.filter((check) => {
    if (check.id === "photos") return !hasPhoto;
    return !check.passed && ["title", "variants"].includes(check.id);
  });
  if (failedCritical.length > 0) {
    throw new Error(
      `Listing quality check failed: ${failedCritical.map((check) => check.label).join(", ")}.`,
    );
  }

  draft = await runPrepareStep("SKU assignment", () => assignSkusToDraft(userId, draft));
  draft = ensureAmazefOffers(draft);

  return { draft, pricingBreakdown, settings };
}

export async function runAmazefAutoListPipeline(
  userId: string,
  productUrl: string,
  rawSettings: Partial<AmazefAutoListingSettings>,
  options?: { acknowledgeVero?: boolean; manualPriceOverride?: number | null },
): Promise<AmazefAutoListResult> {
  const settings = normalizeAutoListingSettings(rawSettings);
  const { draft } = await prepareAmazefAutoListDraft(userId, productUrl, rawSettings, options);

  const feePrefs =
    draft.pricing ?? sellerPreferencesToFeePrefs(defaultSellerPreferences(draft.listing.currency));
  const promotionFloor = priceFloorAtMinProfit(
    resolveBaseAliPrice(draft.product),
    feePrefs,
    settings.minProfitPercent,
    draft.listing.suggestedPrice,
  );
  const amazefPromotions = buildAmazefPromotionsFromDraft(draft, promotionFloor);

  const listResult = await listDraftOnAmazef(userId, draft, amazefPromotions);

  try {
    await saveListedProduct(userId, "amazef", draft, listResult);
  } catch (error) {
    console.error("[Amazef auto-list] Failed to save listed product:", error);
  }

  const email = await getUserEmail(userId);
  if (email && listResult.listingUrl) {
    try {
      await sendEmail({
        to: email,
        subject: "Your product is listed on Amazef",
        text: [
          "Your product has been listed on Amazef.",
          "",
          `Title: ${draft.listing.seoTitle}`,
          `Price: ${draft.listing.currency} ${draft.listing.suggestedPrice.toFixed(2)}`,
          `View listing: ${listResult.listingUrl}`,
        ].join("\n"),
      });
    } catch {
      // Listing succeeded; email is best-effort.
    }
  }

  return {
    listingUrl: listResult.listingUrl,
    title: draft.listing.seoTitle,
    price: draft.listing.suggestedPrice,
    currency: draft.listing.currency,
  };
}
