export interface ListingProductVariant {
  id: string;
  label: string;
  price: number;
  currency: string;
  stock: number | null;
}

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
  variants?: ListingProductVariant[];
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

export interface ListingVariantDraft {
  id: string;
  label: string;
  imageUrl: string;
  price: number;
  stock: number;
}

export interface ListingPhotoDraft {
  url: string;
  selected: boolean;
}

export interface VolumePromotionTier {
  enabled: boolean;
  quantity: 2 | 3 | 5;
  discountPercent: number;
}

export interface ListingDraft {
  product: ListingProductSource;
  listing: GeneratedListing;
  photos: ListingPhotoDraft[];
  variants: ListingVariantDraft[];
  promotions: VolumePromotionTier[];
}

export interface EbayCategorySuggestion {
  categoryId: string;
  categoryName: string;
  categoryPath: string;
}

export interface ListOnEbayPayload {
  userId: string;
  draft: ListingDraft;
}

export interface ListOnEbayResult {
  sku: string;
  offerId: string;
  listingId: string | null;
  listingUrl: string | null;
}

export const DEFAULT_PROMOTIONS: VolumePromotionTier[] = [
  { enabled: false, quantity: 2, discountPercent: 10 },
  { enabled: false, quantity: 3, discountPercent: 15 },
  { enabled: false, quantity: 5, discountPercent: 20 },
];

export const LISTING_WIZARD_STEPS = [
  "VeRO Check",
  "Preview & Edit",
  "Photos",
  "Variants",
  "Promotions",
  "Confirm & List",
] as const;

export type ListingWizardStep = (typeof LISTING_WIZARD_STEPS)[number];
