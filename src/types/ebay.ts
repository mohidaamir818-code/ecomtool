export interface EbayListing {
  id: string;
  title: string;
  sellerName: string;
  hasVariations: boolean;
  priceMin: number;
  priceMax: number;
  priceLabel: string;
  shippingCost: number | null;
  shippingLabel: string;
  totalPrice: number;
  totalPriceMax: number;
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
  total?: number;
  offset?: number;
  limit?: number;
  sort?: "asc" | "desc";
}
