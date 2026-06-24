import type { ListingPlatform } from "@/types/listing-generator";

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
