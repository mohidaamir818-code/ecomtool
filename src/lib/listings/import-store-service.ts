import "server-only";

import { fetchSellerAmazefStore } from "@/lib/amazef/seller-store";
import { fetchSellerEbayStore } from "@/lib/ebay/seller-store";
import { suggestAliExpressMatchForListing } from "@/lib/listings/import-store-match";
import { linkExistingListing } from "@/lib/listings/link-existing-listing";
import {
  mapAliVariantsToStoreVariants,
  validateAliMatchesStoreListing,
} from "@/lib/listings/match-ali-listing";
import { fetchListingProductSource } from "@/lib/listings/product-source";
import type { LinkExistingVariantInput } from "@/types/listed-products";
import type { ListingPlatform } from "@/types/listing-generator";
import type { StoreImportListing, StoreImportSuggestedMatch } from "@/types/store-import";

async function fetchStoreListings(
  userId: string,
  platform: ListingPlatform,
): Promise<StoreImportListing[]> {
  return platform === "amazef" ? fetchSellerAmazefStore(userId) : fetchSellerEbayStore(userId);
}

export async function getImportStoreListings(
  userId: string,
  platform: ListingPlatform,
): Promise<StoreImportListing[]> {
  return fetchStoreListings(userId, platform);
}

export async function suggestImportStoreMatches(
  userId: string,
  platform: ListingPlatform,
  listingIds: string[],
): Promise<Record<string, StoreImportSuggestedMatch | null>> {
  const listings = await fetchStoreListings(userId, platform);
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
  platform: ListingPlatform,
  links: Array<{ listingId: string; aliexpressUrl: string; skipMatchValidation?: boolean }>,
): Promise<{ linked: string[]; failed: Array<{ listingId: string; error: string }> }> {
  const linked: string[] = [];
  const failed: Array<{ listingId: string; error: string }> = [];

  for (const link of links) {
    try {
      await linkImportStoreListing(userId, platform, link.listingId, link.aliexpressUrl, {
        skipMatchValidation: link.skipMatchValidation === true,
      });
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
  platform: ListingPlatform,
  listingId: string,
  aliexpressUrl: string,
  options?: { skipMatchValidation?: boolean },
): Promise<void> {
  const listings = await fetchStoreListings(userId, platform);
  const storeListing = listings.find((listing) => listing.listingId === listingId);
  if (!storeListing) {
    throw new Error(`${platform === "amazef" ? "Amazef" : "eBay"} listing not found in your store.`);
  }
  if (storeListing.linked) {
    throw new Error("This listing is already linked.");
  }

  const aliProduct = await fetchListingProductSource(aliexpressUrl.trim(), { forImport: true });
  if (!options?.skipMatchValidation) {
    validateAliMatchesStoreListing(aliProduct, storeListing);
  }

  const mappings = mapAliVariantsToStoreVariants(aliProduct, storeListing, {
    relaxed: options?.skipMatchValidation === true,
  });
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
      variationSpecifics: storeVariant.variationSpecifics,
    };
  });

  await linkExistingListing(
    userId,
    platform,
    aliProduct.productUrl,
    storeListing.listingUrl,
    variants,
    {
      tradingImport:
        platform === "ebay"
          ? {
              listingId: storeListing.listingId,
              variants: storeListing.variants.map((variant) => ({
                label: variant.label,
                sku: variant.sku,
                variationSpecifics: variant.variationSpecifics,
              })),
            }
          : undefined,
      fromStoreImport: true,
    },
  );
}
