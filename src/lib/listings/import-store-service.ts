import "server-only";

import { fetchSellerEbayStore } from "@/lib/ebay/seller-store";
import { suggestAliExpressMatchForListing } from "@/lib/listings/import-store-match";
import { linkExistingListing } from "@/lib/listings/link-existing-listing";
import {
  mapAliVariantsToStoreVariants,
  validateAliMatchesStoreListing,
} from "@/lib/listings/match-ali-listing";
import { fetchListingProductSource } from "@/lib/listings/product-source";
import type { LinkExistingVariantInput } from "@/types/listed-products";
import type { StoreImportListing, StoreImportSuggestedMatch } from "@/types/store-import";

export async function getImportStoreListings(userId: string): Promise<StoreImportListing[]> {
  return fetchSellerEbayStore(userId);
}

export async function suggestImportStoreMatches(
  userId: string,
  listingIds: string[],
): Promise<Record<string, StoreImportSuggestedMatch | null>> {
  const listings = await fetchSellerEbayStore(userId);
  const targets = listings.filter(
    (listing) => listingIds.includes(listing.listingId) && !listing.linked,
  );

  const results: Record<string, StoreImportSuggestedMatch | null> = {};
  for (const listing of targets) {
    results[listing.listingId] = await suggestAliExpressMatchForListing(listing);
  }

  return results;
}

export async function linkImportStoreListingsBatch(
  userId: string,
  links: Array<{ listingId: string; aliexpressUrl: string }>,
): Promise<{ linked: string[]; failed: Array<{ listingId: string; error: string }> }> {
  const linked: string[] = [];
  const failed: Array<{ listingId: string; error: string }> = [];

  for (const link of links) {
    try {
      await linkImportStoreListing(userId, link.listingId, link.aliexpressUrl);
      linked.push(link.listingId);
    } catch (error) {
      failed.push({
        listingId: link.listingId,
        error: error instanceof Error ? error.message : "Failed to link listing.",
      });
    }
  }

  return { linked, failed };
}

export async function linkImportStoreListing(
  userId: string,
  listingId: string,
  aliexpressUrl: string,
): Promise<void> {
  const listings = await fetchSellerEbayStore(userId);
  const storeListing = listings.find((listing) => listing.listingId === listingId);
  if (!storeListing) {
    throw new Error("eBay listing not found in your store.");
  }
  if (storeListing.linked) {
    throw new Error("This listing is already linked.");
  }

  const aliProduct = await fetchListingProductSource(aliexpressUrl.trim());
  validateAliMatchesStoreListing(aliProduct, storeListing);

  const mappings = mapAliVariantsToStoreVariants(aliProduct, storeListing);
  const variants: LinkExistingVariantInput[] = mappings.map(({ aliVariantId, storeVariant }) => {
    const aliVariant =
      aliProduct.variants?.find((entry) => entry.id === aliVariantId) ??
      ({
        id: aliVariantId,
        label: storeVariant.label,
        price: aliProduct.price,
        currency: aliProduct.currency,
        stock: aliProduct.stock,
      } as const);

    return {
      aliVariantId,
      label: aliVariant.label,
      listedPrice: storeVariant.price,
      listedQuantity: storeVariant.quantity,
      sku: storeVariant.sku,
      offerId: storeVariant.offerId,
    };
  });

  await linkExistingListing(
    userId,
    "ebay",
    aliProduct.productUrl,
    storeListing.listingUrl,
    variants,
  );
}
