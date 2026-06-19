export interface ListingProductSource {
  source: "aliexpress";
  externalId: string;
  productUrl: string;
  title: string;
  imageUrl: string | null;
  images: string[];
  price: number;
  currency: string;
  description: string | null;
  stock: number | null;
}

export interface GeneratedListingItemSpecific {
  name: string;
  value: string;
}

export interface GeneratedListing {
  seoTitle: string;
  descriptionHtml: string;
  suggestedPrice: number;
  currency: string;
  itemSpecifics: GeneratedListingItemSpecific[];
  categorySuggestion: string;
  categoryId: string | null;
  condition: string;
  brand: string;
}

export interface VeroCheckResult {
  safe: boolean;
  isCounterfeitOrBranded: boolean;
  isBannedCategory: boolean;
  hasRestrictedWords: boolean;
  warnings: string[];
  summary: string;
}

export interface EbayConnectionStatus {
  connected: boolean;
  ebayUsername: string | null;
  accessTokenExpiresAt: string | null;
}

export interface ListOnEbayPayload {
  userId: string;
  listing: GeneratedListing;
  product: ListingProductSource;
  quantity?: number;
}

export interface ListOnEbayResult {
  sku: string;
  offerId: string;
  listingId: string | null;
  listingUrl: string | null;
}
