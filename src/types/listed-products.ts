import type { ListingDraft, ListingPlatform } from "@/types/listing-generator";

export interface LinkExistingVariantInput {
  aliVariantId: string;
  label: string;
  listedPrice: number;
  listedQuantity: number;
  sku?: string;
  offerId?: string;
  variationSpecifics?: Array<{ name: string; value: string }>;
}

export interface ListedProductDetail extends ListedProduct {
  draft: ListingDraft;
}

export interface ListedProductVariant {
  id: string;
  aliVariantId: string;
  label: string;
  sku: string;
  offerId: string | null;
  listedPrice: number;
  listedQuantity: number;
  aliPrice: number;
  aliStock: number | null;
  imageUrl: string | null;
}

export interface ListedProduct {
  id: string;
  platform: ListingPlatform;
  aliexpressUrl: string;
  title: string;
  imageUrl: string | null;
  currency: string;
  listingUrl: string | null;
  listingId: string | null;
  groupSku: string | null;
  variants: ListedProductVariant[];
  createdAt: string;
}

export interface ListedVariantResult {
  sku: string;
  offerId: string;
  label: string;
  price: number;
  quantity: number;
  aliVariantId: string;
  aliPrice: number;
  aliStock: number | null;
}
