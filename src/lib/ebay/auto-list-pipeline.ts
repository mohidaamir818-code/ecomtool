import "server-only";

import { fetchSellerPolicies } from "@/lib/ebay/business-policies";
import { requireConfirmedLocation } from "@/lib/ebay/inventory-location";
import { getSellerMarketplaceId } from "@/lib/ebay/marketplace";
import { getEbayUserAccessToken } from "@/lib/ebay/oauth-user";
import { listDraftOnEbay, resolveDraftListingCategory } from "@/lib/ebay/sell-inventory";
import { promoteListing } from "@/lib/ebay/promoted-listings";
import { sendEmail } from "@/lib/email/send-email";
import { generateEbayListing } from "@/lib/gemini/generate-listing";
import { checkVeroSafety } from "@/lib/gemini/vero-check";
import { VeroAckRequiredError } from "@/lib/listings/vero-ack-error";
import { computeListingQualityScore } from "@/features/listings/lib/listing-quality";
import { buildInitialDraft, getSelectedPhotos } from "@/features/listings/lib/draft-utils";
import type { EbayAutoListingSettings } from "@/features/listings/lib/ebay-auto-listing";
import { normalizeEbayAutoListingSettings } from "@/features/listings/lib/ebay-auto-listing";
import { mergeInternalSkusIntoDraft } from "@/lib/listings/internal-sku";
import { ensureDraftVariantEans } from "@/lib/listings/ensure-draft-variant-eans";
import { ensureInternalSkus } from "@/lib/listings/internal-sku-service";
import { fetchAliExpressShippingDays } from "@/lib/listings/aliexpress-shipping-days";
import { flagDescriptionPhotos } from "@/lib/listings/description-image-flags";
import {
  editAliExpressListingPhotos,
  mergeEditedPhotosIntoDraftPhotos,
} from "@/lib/listings/ai-listing-photos";
import { selectFulfillmentPolicyWithAi } from "@/lib/listings/select-fulfillment-policy-ai";
import { saveListedProduct } from "@/lib/listings/listed-products-service";
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
} from "@/lib/listings/seller-preferences";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  EbayPolicyOption,
  ListingDraft,
  ListingPricingPreferences,
  PricingBreakdown,
} from "@/types/listing-generator";
import { defaultSellerPreferences } from "@/types/listing-generator";

export class EbayAutoListNeedsFulfillmentPolicyError extends Error {
  readonly code = "NEEDS_FULFILLMENT_POLICY" as const;

  constructor(
    readonly aliExpressShippingLabel: string,
    readonly fulfillmentPolicies: EbayPolicyOption[],
    readonly paymentPolicyId: string,
    readonly returnPolicyId: string,
  ) {
    super(
      `None of your eBay shipping policies are longer than AliExpress delivery (${aliExpressShippingLabel}). Choose a shipping policy below to continue.`,
    );
    this.name = "EbayAutoListNeedsFulfillmentPolicyError";
  }
}

export interface EbayAutoListResult {
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
  let bestAboveMin: { prefs: ListingPricingPreferences; breakdown: PricingBreakdown } | null = null;

  for (let margin = 0; margin <= 85; margin += 0.5) {
    const prefs = { ...basePrefs, profitMarginPercent: margin };
    const breakdown = calculatePricingBreakdown(aliPrice, prefs);

    if (breakdown.profitPercent >= minProfitPercent && breakdown.profitPercent <= maxProfitPercent) {
      bestInRange = { prefs, breakdown };
      break;
    }

    if (breakdown.profitPercent >= minProfitPercent) {
      bestAboveMin = { prefs, breakdown };
    }
  }

  return bestInRange ?? bestAboveMin;
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
  const timeoutMs = options?.timeoutMs ?? 45_000;
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
      if (attempt < maxAttempts) {
        console.warn(`[eBay prepare] ${label} failed (attempt ${attempt}), retrying…`, error);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`${label} failed after ${maxAttempts} attempts.`);
}

export interface EbayAutoListPrepared {
  draft: ListingDraft;
  pricingBreakdown: PricingBreakdown;
  settings: EbayAutoListingSettings;
}

/** Build the full listing draft (no publish). Used by review UI and by full auto-list. */
export async function prepareEbayAutoListDraft(
  userId: string,
  productUrl: string,
  rawSettings: Partial<EbayAutoListingSettings>,
  options?: {
    acknowledgeVero?: boolean;
    fulfillmentPolicyId?: string;
    manualPriceOverride?: number | null;
  },
): Promise<EbayAutoListPrepared> {
  const settings = normalizeEbayAutoListingSettings(rawSettings);
  const acknowledgeVero = Boolean(options?.acknowledgeVero);

  const token = await getEbayUserAccessToken(userId);
  if (!token) {
    throw new Error("eBay account is not connected or token expired. Reconnect eBay.");
  }

  const [, marketplaceId] = await Promise.all([
    requireConfirmedLocation(userId),
    getSellerMarketplaceId(userId),
  ]);

  const product = await runPrepareStep("Product fetch", () =>
    fetchListingProductSource(productUrl.trim()),
  );

  const currency = product.currency === "USD" ? "GBP" : product.currency;

  const [vero, sellerPrefs, aliExpressShipping, policies] = await Promise.all([
    runPrepareStep("VeRO check", () => checkVeroSafety(product)),
    getSellerPreferences(userId, currency).then(
      (prefs) => prefs ?? defaultSellerPreferences(currency),
    ),
    runPrepareStep("AliExpress shipping", () =>
      fetchAliExpressShippingDays(product.productUrl),
    ).catch(() => null),
    runPrepareStep("eBay policies", () => fetchSellerPolicies(token, marketplaceId, { userId })),
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

  const fixedPrice =
    options?.manualPriceOverride != null && options.manualPriceOverride > 0
      ? options.manualPriceOverride
      : null;

  let smartPrice: number | null = null;
  if (fixedPrice == null && settings.smartPricingEnabled) {
    smartPrice = await runPrepareStep("Market price", async () => {
      const market = await getMarketAveragePrice(product.title, marketplaceId);
      const smart = computeSmartPrice({
        aliPrice,
        feePrefs,
        minProfitPercent: settings.minProfitPercent,
        market,
        undercutMode: settings.undercutMode,
        undercutPercent: settings.marketUndercutPercent,
        undercutAmount: settings.marketUndercutAmount,
        charmPricing: settings.charmPricingEnabled,
        charmRules: settings.charmRules,
      });
      return smart?.price ?? null;
    }).catch(() => null);
  }

  const effectivePrice = fixedPrice ?? smartPrice;

  let pricingPrefs: ListingPricingPreferences;
  let pricingBreakdown: PricingBreakdown;
  let listingPrice: number;

  if (effectivePrice != null) {
    pricingPrefs = { ...feePrefs };
    pricingBreakdown = buildBreakdownForPrice(aliPrice, pricingPrefs, effectivePrice);
    listingPrice = effectivePrice;
  } else {
    const pricing = resolvePricingWithinProfitBounds(
      aliPrice,
      feePrefs,
      settings.minProfitPercent,
      settings.maxProfitPercent,
    );

    if (!pricing) {
      throw new Error(
        `Could not reach your minimum profit of ${settings.minProfitPercent}% for this product.`,
      );
    }

    pricingPrefs = pricing.prefs;
    pricingBreakdown = pricing.breakdown;
    listingPrice = pricing.breakdown.recommendedPrice;
  }

  const photoEditPromise =
    settings.aiPhotoEditEnabled && settings.aiPhotoEditPrompt.trim()
      ? editAliExpressListingPhotos({
          userId,
          photoUrls: product.images ?? [],
          sellerPrompt: settings.aiPhotoEditPrompt,
          productTitle: product.title,
          count: 3,
        }).catch((error) => {
          console.warn("[eBay prepare] AI photo edit skipped:", error);
          return [] as Awaited<ReturnType<typeof editAliExpressListingPhotos>>;
        })
      : Promise.resolve([] as Awaited<ReturnType<typeof editAliExpressListingPhotos>>);

  const [listing, editedPhotos] = await Promise.all([
    runPrepareStep("Listing generation", () => generateEbayListing(product, listingPrice)),
    photoEditPromise,
  ]);

  let draft = buildInitialDraft(product, listing, {
    pricing: pricingPrefs,
    pricingBreakdown,
    manualPriceOverride: effectivePrice,
    promotions: settings.promotions,
  });

  if (editedPhotos.length > 0) {
    draft = {
      ...draft,
      photos: mergeEditedPhotosIntoDraftPhotos(draft.photos, editedPhotos),
    };
  }

  draft = applyStockLimits(draft, settings.minStock, settings.maxStock);

  if (aliExpressShipping) {
    draft = {
      ...draft,
      product: {
        ...draft.product,
        shippingDaysLabel: aliExpressShipping.label,
      },
    };
  }

  if (policies.noPoliciesFound) {
    throw new Error(
      policies.emptyPolicyMessage ??
        "No eBay business policies found. Create policies in eBay Seller Hub first.",
    );
  }

  const paymentPolicyId = policies.selected.paymentPolicyId;
  const returnPolicyId = policies.selected.returnPolicyId;

  let fulfillmentPolicy: EbayPolicyOption | null = null;

  if (options?.fulfillmentPolicyId) {
    fulfillmentPolicy =
      policies.fulfillment.find((policy) => policy.policyId === options.fulfillmentPolicyId) ??
      null;
    if (!fulfillmentPolicy) {
      throw new Error("Selected shipping policy was not found on your eBay account.");
    }
  } else {
    fulfillmentPolicy = await runPrepareStep("Shipping policy match", () =>
      selectFulfillmentPolicyWithAi({
        aliExpressLabel: aliExpressShipping?.label ?? draft.product.shippingDaysLabel ?? null,
        aliExpressMinDays: aliExpressShipping?.minDays ?? null,
        aliExpressMaxDays: aliExpressShipping?.maxDays ?? null,
        policies: policies.fulfillment,
      }),
    ).catch(() => null);

    if (!fulfillmentPolicy && aliExpressShipping) {
      throw new EbayAutoListNeedsFulfillmentPolicyError(
        aliExpressShipping.label,
        policies.fulfillment,
        paymentPolicyId,
        returnPolicyId,
      );
    }
  }

  if (!fulfillmentPolicy?.policyId || !paymentPolicyId || !returnPolicyId) {
    throw new Error("Shipping, payment, and return policies are required before listing on eBay.");
  }

  draft = {
    ...draft,
    ebayPolicies: {
      fulfillmentPolicyId: fulfillmentPolicy.policyId,
      paymentPolicyId,
      returnPolicyId,
    },
    promotions: settings.promotions,
  };

  const quality = computeListingQualityScore(draft, "ebay");
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

  const draftBeforeFinalize = draft;
  const [draftWithSkus, resolvedCategory] = await Promise.all([
    runPrepareStep("SKU assignment", () => assignSkusToDraft(userId, draftBeforeFinalize)),
    runPrepareStep("Category resolve", () =>
      resolveDraftListingCategory(userId, draftBeforeFinalize.listing, draftBeforeFinalize.variants),
    ).catch((error) => {
      console.warn("[eBay prepare] Could not auto-resolve category:", error);
      return null;
    }),
  ]);

  draft = draftWithSkus;
  if (resolvedCategory && (resolvedCategory.changed || !draft.listing.categoryId)) {
    draft = {
      ...draft,
      listing: {
        ...draft.listing,
        categoryId: resolvedCategory.categoryId,
        categorySuggestion: resolvedCategory.categoryPath,
      },
    };
  }

  draft = await ensureDraftVariantEans(draft);

  return { draft, pricingBreakdown, settings };
}

export async function runEbayAutoListPipeline(
  userId: string,
  productUrl: string,
  rawSettings: Partial<EbayAutoListingSettings>,
  options?: {
    acknowledgeVero?: boolean;
    fulfillmentPolicyId?: string;
    manualPriceOverride?: number | null;
  },
): Promise<EbayAutoListResult> {
  const { draft: preparedDraft, pricingBreakdown, settings } = await prepareEbayAutoListDraft(
    userId,
    productUrl,
    rawSettings,
    options,
  );

  let draft = preparedDraft;
  if (draft.descriptionPhotos && draft.descriptionPhotos.length > 0) {
    draft = {
      ...draft,
      descriptionPhotos: await flagDescriptionPhotos(draft.descriptionPhotos),
    };
  }

  const listResult = await listDraftOnEbay(userId, draft);

  try {
    await saveListedProduct(userId, "ebay", draft, listResult);
  } catch (error) {
    console.error("[eBay auto-list] Failed to save listed product:", error);
  }

  // Auto promotion: once listed, add the item to the seller's Promoted Listings
  // campaign when its profit clears the seller's threshold. Best-effort — a
  // promotion failure never affects the successful listing.
  if (
    settings.autoPromoteEnabled &&
    listResult.listingId &&
    pricingBreakdown.profit >= settings.autoPromoteMinProfit
  ) {
    try {
      const result = await promoteListing(
        userId,
        listResult.listingId,
        settings.autoPromoteAdRatePercent,
      );
      if (!result.promoted) {
        console.warn("[eBay auto-list] Promotion skipped:", result.reason);
      }
    } catch (error) {
      console.error("[eBay auto-list] Promotion error:", error);
    }
  }

  const email = await getUserEmail(userId);
  if (email && listResult.listingUrl) {
    try {
      await sendEmail({
        to: email,
        subject: "Your product is listed on eBay",
        text: [
          "Your product has been listed on eBay.",
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
