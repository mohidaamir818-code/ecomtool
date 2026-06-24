export interface StoreImportVariant {
  sku: string;
  offerId: string;
  label: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
}

export interface StoreImportListing {
  listingId: string;
  listingUrl: string;
  title: string;
  imageUrl: string | null;
  currency: string;
  variants: StoreImportVariant[];
  groupSku: string | null;
  linked: boolean;
  listedProductId: string | null;
  aliexpressUrl: string | null;
}
