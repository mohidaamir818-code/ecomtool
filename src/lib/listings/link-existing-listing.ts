import "server-only";

import { fetchListingProductSource } from "@/lib/listings/product-source";
import { ensureInternalSkus } from "@/lib/listings/internal-sku-service";
import { mergeInternalSkusIntoDraft } from "@/lib/listings/internal-sku";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { ListingPlatform, ListingDraft } from "@/types/listing-generator";
import { ensureHandlingForListedProduct } from "@/lib/listings/listed-products-service";
import type { LinkExistingVariantInput } from "@/types/listed-products";

export interface ParsedListingUrl {
  listingId: string | null;
  listingUrl: string;
}

export function parseMarketplaceListingUrl(
  platform: ListingPlatform,
  rawUrl: string,
): ParsedListingUrl {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error("Listing URL is required.");
  }

  if (platform === "ebay") {
    const idMatch =
      trimmed.match(/\/itm\/(?:[^/]+\/)?(\d{9,15})/i) ??
      trimmed.match(/[?&]item=(\d{9,15})/i) ??
      trimmed.match(/^(\d{9,15})$/);
    const listingId = idMatch?.[1] ?? null;
    const listingUrl = listingId ? `https://www.ebay.co.uk/itm/${listingId}` : trimmed;
    if (!listingId) {
      throw new Error("Could not read eBay item ID from that URL.");
    }
    return { listingId, listingUrl };
  }

  const amazefMatch =
    trimmed.match(/\/products\/(\d+)/i) ??
    trimmed.match(/[?&]productId=(\d+)/i) ??
    trimmed.match(/^(\d+)$/);
  const listingId = amazefMatch?.[1] ?? null;
  const listingUrl = listingId ? `https://amazef.com/products/${listingId}` : trimmed;
  if (!listingId) {
    throw new Error("Could not read Amazef product ID from that URL.");
  }
  return { listingId, listingUrl };
}

async function buildDraftForLinkedListing(
  userId: string,
  product: Awaited<ReturnType<typeof fetchListingProductSource>>,
  variants: LinkExistingVariantInput[],
): Promise<ListingDraft> {
  const skuResult = await ensureInternalSkus({
    userId,
    productUrl: product.productUrl,
    variants: variants.map((variant) => ({
      id: variant.aliVariantId,
      label: variant.label,
    })),
  });

  let draft: ListingDraft = {
    product,
    listing: {
      seoTitle: product.title.slice(0, 80),
      descriptionHtml: `<p>${product.description ?? product.title}</p>`,
      suggestedPrice: variants[0]?.listedPrice ?? product.price,
      currency: product.currency === "USD" ? "GBP" : product.currency,
      itemSpecifics: [],
      categorySuggestion: "General",
      categoryId: null,
      condition: "New with tags",
      brand: "Unbranded",
    },
    photos: (product.images.length > 0 ? product.images : product.imageUrl ? [product.imageUrl] : []).map(
      (url) => ({ url, selected: true }),
    ),
    variants: variants.map((variant) => {
      const source = product.variants?.find((entry) => entry.id === variant.aliVariantId);
      const sku = variant.sku?.trim() || skuResult.variantSkus[variant.aliVariantId] || "";
      return {
        id: variant.aliVariantId,
        label: variant.label,
        imageUrl: source?.imageUrl ?? product.imageUrl ?? "",
        price: variant.listedPrice,
        stock: variant.listedQuantity,
        quantity: variant.listedQuantity,
        sku,
        ean: "",
        aliExpressPrice: source?.price ?? product.price,
      };
    }),
    promotions: [],
  };

  draft = mergeInternalSkusIntoDraft(draft, skuResult.baseSku, skuResult.variantSkus);
  return draft;
}

export async function linkExistingListing(
  userId: string,
  platform: ListingPlatform,
  aliexpressUrl: string,
  listingUrlRaw: string,
  variants: LinkExistingVariantInput[],
): Promise<void> {
  if (variants.length === 0) {
    throw new Error("Add at least one variant.");
  }

  for (const variant of variants) {
    if (variant.listedPrice <= 0) {
      throw new Error(`Price must be greater than 0 for ${variant.label}.`);
    }
    if (variant.listedQuantity < 0) {
      throw new Error(`Quantity cannot be negative for ${variant.label}.`);
    }
  }

  const product = await fetchListingProductSource(aliexpressUrl.trim());
  const parsedListing = parseMarketplaceListingUrl(platform, listingUrlRaw);
  const draft = await buildDraftForLinkedListing(userId, product, variants);
  const handlingProductId = await ensureHandlingForListedProduct(userId, draft);

  const supabase = getSupabaseAdmin();
  const primaryOfferId = variants.find((variant) => variant.offerId?.trim())?.offerId?.trim() ?? "";
  const groupSku = draft.product.internalProductSku ?? variants[0]?.sku ?? "";

  const { data: productRow, error: productError } = await supabase
    .from("listed_products")
    .insert({
      user_id: userId,
      platform,
      aliexpress_url: product.productUrl,
      aliexpress_external_id: product.externalId,
      handling_product_id: handlingProductId,
      title: draft.listing.seoTitle,
      image_url: draft.variants[0]?.imageUrl ?? product.imageUrl,
      currency: draft.listing.currency,
      listing_url: parsedListing.listingUrl,
      listing_id: parsedListing.listingId,
      group_sku: groupSku,
      offer_id: primaryOfferId || parsedListing.listingId,
      draft_json: draft,
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (productError) {
    throw new Error(productError.message);
  }

  const variantInserts = variants.map((variant) => {
    const source = product.variants?.find((entry) => entry.id === variant.aliVariantId);
    const draftVariant = draft.variants.find((entry) => entry.id === variant.aliVariantId);
    return {
      listed_product_id: productRow.id,
      ali_variant_id: variant.aliVariantId,
      label: variant.label,
      sku: variant.sku?.trim() || draftVariant?.sku || "",
      offer_id: variant.offerId?.trim() || primaryOfferId || null,
      listed_price: variant.listedPrice,
      listed_quantity: variant.listedQuantity,
      ali_price: source?.price ?? product.price,
      ali_stock: source?.stock ?? product.stock,
      image_url: source?.imageUrl ?? product.imageUrl,
      updated_at: new Date().toISOString(),
    };
  });

  const { error: variantError } = await supabase.from("listed_product_variants").insert(variantInserts);
  if (variantError) {
    throw new Error(variantError.message);
  }
}
