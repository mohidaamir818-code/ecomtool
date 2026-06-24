import "server-only";

import { listDraftOnAmazef } from "@/lib/amazef/listing";
import { sendEmail } from "@/lib/email/send-email";
import { generateEbayListing } from "@/lib/gemini/generate-listing";
import { checkVeroSafety } from "@/lib/gemini/vero-check";
import { computeListingQualityScore } from "@/features/listings/lib/listing-quality";
import { buildInitialDraft } from "@/features/listings/lib/draft-utils";
import type { AmazefAutoListingSettings } from "@/features/listings/lib/amazef-auto-listing";
import { normalizeAutoListingSettings } from "@/features/listings/lib/amazef-auto-listing";
import { mergeInternalSkusIntoDraft } from "@/lib/listings/internal-sku";
import { ensureInternalSkus } from "@/lib/listings/internal-sku-service";
import { fetchAliExpressShippingDaysLabel } from "@/lib/listings/aliexpress-shipping-days";
import { fetchListingProductSource } from "@/lib/listings/product-source";
import {
  calculatePricingBreakdown,
  resolveBaseAliPrice,
} from "@/lib/listings/pricing";
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

export async function runAmazefAutoListPipeline(
  userId: string,
  productUrl: string,
  rawSettings: Partial<AmazefAutoListingSettings>,
  options?: { acknowledgeVero?: boolean },
): Promise<AmazefAutoListResult> {
  const settings = normalizeAutoListingSettings(rawSettings);
  const acknowledgeVero = Boolean(options?.acknowledgeVero);

  const product = await fetchListingProductSource(productUrl.trim());
  const vero = await checkVeroSafety(product);

  if (!vero.safe) {
    if (!settings.listVeroProducts) {
      throw new Error(
        "This product failed the VeRO check. Enable “List VeRO products” in auto listing settings to continue.",
      );
    }
    if (!acknowledgeVero) {
      throw new Error("VERO_ACK_REQUIRED");
    }
  }

  const currency = product.currency === "USD" ? "GBP" : product.currency;
  const sellerPrefs =
    (await getSellerPreferences(userId, currency)) ?? defaultSellerPreferences(currency);
  const feePrefs = sellerPreferencesToFeePrefs(sellerPrefs);
  const aliPrice = resolveBaseAliPrice(product);

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

  const listing = await generateEbayListing(product, pricing.breakdown.recommendedPrice);
  const promotions = sellerPreferencesToPromotions(sellerPrefs);

  let draft = buildInitialDraft(product, listing, {
    pricing: pricing.prefs,
    pricingBreakdown: pricing.breakdown,
    manualPriceOverride: null,
    promotions,
  });

  draft = applyStockLimits(draft, settings.minStock, settings.maxStock);

  const shippingDaysLabel = await fetchAliExpressShippingDaysLabel(product.productUrl);
  if (shippingDaysLabel) {
    draft = {
      ...draft,
      product: {
        ...draft.product,
        shippingDaysLabel,
      },
    };
  }

  const quality = computeListingQualityScore(draft, "amazef");
  const failedCritical = quality.checks.filter(
    (check) => !check.passed && ["title", "photos", "variants"].includes(check.id),
  );
  if (failedCritical.length > 0) {
    throw new Error(
      `Listing quality check failed: ${failedCritical.map((check) => check.label).join(", ")}.`,
    );
  }

  draft = await assignSkusToDraft(userId, draft);

  const listResult = await listDraftOnAmazef(userId, draft);

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
