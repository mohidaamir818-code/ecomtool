import type { ListingProductSource } from "@/types/listing-generator";
import type { StoreImportListing } from "@/types/store-import";

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleWordOverlap(aliTitle: string, ebayTitle: string): number {
  const aliWords = new Set(
    normalizeTitle(aliTitle)
      .split(" ")
      .filter((word) => word.length > 2),
  );
  const ebayWords = new Set(
    normalizeTitle(ebayTitle)
      .split(" ")
      .filter((word) => word.length > 2),
  );

  if (aliWords.size === 0 || ebayWords.size === 0) return 0;

  let overlap = 0;
  for (const word of aliWords) {
    if (ebayWords.has(word)) overlap += 1;
  }

  return overlap / Math.max(aliWords.size, ebayWords.size);
}

function normalizeVariantLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function mapAliVariantsToStoreVariants(
  aliProduct: ListingProductSource,
  storeListing: StoreImportListing,
): Array<{ aliVariantId: string; storeVariant: StoreImportListing["variants"][number] }> {
  const aliVariants =
    aliProduct.variants?.length && aliProduct.variants.length > 0
      ? aliProduct.variants
      : [
          {
            id: "default",
            label: "Default",
            price: aliProduct.price,
            currency: aliProduct.currency,
            stock: aliProduct.stock,
            imageUrl: aliProduct.imageUrl,
          },
        ];

  if (storeListing.variants.length === 1 && aliVariants.length >= 1) {
    return [{ aliVariantId: aliVariants[0]!.id, storeVariant: storeListing.variants[0]! }];
  }

  const mappings: Array<{ aliVariantId: string; storeVariant: StoreImportListing["variants"][number] }> =
    [];

  for (const storeVariant of storeListing.variants) {
    const storeLabel = normalizeVariantLabel(storeVariant.label);
    const match =
      aliVariants.find((variant) => {
        const aliLabel = normalizeVariantLabel(variant.label);
        return (
          aliLabel === storeLabel ||
          aliLabel.includes(storeLabel) ||
          storeLabel.includes(aliLabel)
        );
      }) ?? null;

    if (!match) {
      throw new Error(
        `Variant "${storeVariant.label}" on your eBay listing does not match any AliExpress variant. Please paste the exact AliExpress product URL.`,
      );
    }

    mappings.push({ aliVariantId: match.id, storeVariant });
  }

  return mappings;
}

export function validateAliMatchesStoreListing(
  aliProduct: ListingProductSource,
  storeListing: StoreImportListing,
): void {
  const overlap = titleWordOverlap(aliProduct.title, storeListing.title);
  if (overlap < 0.3) {
    throw new Error(
      "This AliExpress product does not match your eBay listing. Please paste the exact AliExpress URL for this item.",
    );
  }

  mapAliVariantsToStoreVariants(aliProduct, storeListing);
}
