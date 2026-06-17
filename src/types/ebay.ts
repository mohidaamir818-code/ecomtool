export interface EbayListing {
  id: string;
  title: string;
  variantLabel: string | null;
  sellerName: string;
  hasVariations: boolean;
  price: number;
  priceLabel: string;
  shippingCost: number | null;
  shippingLabel: string;
  totalPrice: number;
  totalPriceLabel: string;
  currency: string;
  condition: string;
  listingUrl: string;
  imageUrl: string | null;
}

export interface EbaySearchResponse {
  success: boolean;
  error?: string;
  query?: string;
  listings?: EbayListing[];
  /** eBay search hit count (parent listings) */
  total?: number;
  /** Expanded row count returned for this page */
  offerCount?: number;
  offset?: number;
  limit?: number;
  sort?: "asc" | "desc";
}
