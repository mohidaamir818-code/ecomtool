import "server-only";

import { fetchSellerPolicies } from "@/lib/ebay/business-policies";
import { requireConfirmedLocation } from "@/lib/ebay/inventory-location";
import { getSellerMarketplaceId } from "@/lib/ebay/marketplace";
import { getEbayUserAccessToken } from "@/lib/ebay/oauth-user";
import { listDraftOnEbay } from "@/lib/ebay/sell-inventory";
import { sendEmail } from "@/lib/email/send-email";
import { generateEbayListing } from "@/lib/gemini/generate-listing";
import { checkVeroSafety } from "@/lib/gemini/vero-check";
import { computeListingQualityScore } from "@/features/listings/lib/listing-quality";
import { buildInitialDraft } from "@/features/listings/lib/draft-utils";
import type { EbayAutoListingSettings } from "@/features/listings/lib/ebay-auto-listing";
import { normalizeEbayAutoListingSettings } from "@/features/listings/lib/ebay-auto-listing";
import { mergeInternalSkusIntoDraft } from "@/lib/listings/internal-sku";
import { ensureInternalSkus } from "@/lib/listings/internal-sku-service";
import { fetchAliExpressShippingDays } from "@/lib/listings/aliexpress-shipping-days";
import { selectFulfillmentPolicyForAliExpress } from "@/lib/listings/ebay-fulfillment-policy-match";
import { fetchListingProductSource } from "@/lib/listings/product-source";
import {
  calculatePricingBreakdown,
  resolveBaseAliPrice,
} from "@/lib/listings/pricing";
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

export async function runEbayAutoListPipeline(
  userId: string,
  productUrl: string,
  rawSettings: Partial<EbayAutoListingSettings>,
  options?: { acknowledgeVero?: boolean; fulfillmentPolicyId?: string },
): Promise<EbayAutoListResult> {
  const settings = normalizeEbayAutoListingSettings(rawSettings);
  const acknowledgeVero = Boolean(options?.acknowledgeVero);

  const token = await getEbayUserAccessToken(userId);
  if (!token) {
    throw new Error("eBay account is not connected or token expired. Reconnect eBay.");
  }

  await requireConfirmedLocation(userId);

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

  let draft = buildInitialDraft(product, listing, {
    pricing: pricing.prefs,
    pricingBreakdown: pricing.breakdown,
    manualPriceOverride: null,
    promotions: settings.promotions,
  });

  draft = applyStockLimits(draft, settings.minStock, settings.maxStock);

  const aliExpressShipping = await fetchAliExpressShippingDays(product.productUrl);
  if (aliExpressShipping) {
    draft = {
      ...draft,
      product: {
        ...draft.product,
        shippingDaysLabel: aliExpressShipping.label,
      },
    };
  }

  const marketplaceId = await getSellerMarketplaceId(userId);
  const policies = await fetchSellerPolicies(token, marketplaceId, { userId });

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
    fulfillmentPolicy = selectFulfillmentPolicyForAliExpress(
      policies.fulfillment,
      aliExpressShipping?.maxDays ?? null,
    );

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
  const failedCritical = quality.checks.filter(
    (check) => !check.passed && ["title", "photos", "variants"].includes(check.id),
  );
  if (failedCritical.length > 0) {
    throw new Error(
      `Listing quality check failed: ${failedCritical.map((check) => check.label).join(", ")}.`,
    );
  }

  draft = await assignSkusToDraft(userId, draft);

  const listResult = await listDraftOnEbay(userId, draft);

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
