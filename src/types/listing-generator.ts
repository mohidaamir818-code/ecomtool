export interface ListingProductVariant {
  id: string;
  label: string;
  price: number;
  currency: string;
  stock: number | null;
  imageUrl?: string | null;
}

export interface ListingImageFilterMeta {
  galleryRemoved: number;
  descriptionRemoved: number;
}

export interface ListingProductSource {
  source: "aliexpress";
  externalId: string;
  productUrl: string;
  title: string;
  imageUrl: string | null;
  images: string[];
  descriptionImages: string[];
  imageFilterMeta?: ListingImageFilterMeta;
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
  sku: string;
  ean: string;
  quantity: number;
  aliExpressPrice?: number;
}

export type VariationPhotoAttribute = "default" | "color";

export interface ListingPhotoDraft {
  url: string;
  selected: boolean;
}

export type VolumePromotionQuantity = 2 | 3 | 5 | 10;

export interface VolumePromotionTier {
  enabled: boolean;
  quantity: VolumePromotionQuantity;
  discountPercent: number;
}

export interface ListingPricingPreferences {
  ebayFinalValueFeePercent: number;
  ebayTransactionFee: number;
  paymentFeePercent: number;
  profitMarginPercent: number;
  shippingCost: number;
  currency: string;
}

export interface SellerPreferences {
  ebayFinalValueFeePercent: number;
  transactionFeeAmount: number;
  paymentFeePercent: number;
  profitMarginPercent: number;
  shippingCost: number;
  currency: string;
  buy2DiscountPercent: number;
  buy3DiscountPercent: number;
  buy5DiscountPercent: number;
  buy10DiscountPercent: number;
  buy2Enabled: boolean;
  buy3Enabled: boolean;
  buy5Enabled: boolean;
  buy10Enabled: boolean;
}

export interface PricingBreakdown {
  aliExpressCost: number;
  shippingCost: number;
  baseCost: number;
  ebayFees: number;
  profit: number;
  profitPercent: number;
  recommendedPrice: number;
  currency: string;
}

export interface EbayPolicyOption {
  policyId: string;
  name: string;
}

export interface EbayBusinessPolicies {
  fulfillmentPolicyId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
}

export interface EbayPoliciesResponse {
  fulfillment: EbayPolicyOption[];
  payment: EbayPolicyOption[];
  return: EbayPolicyOption[];
  selected: EbayBusinessPolicies;
}

export interface ListingDraft {
  product: ListingProductSource;
  listing: GeneratedListing;
  photos: ListingPhotoDraft[];
  descriptionPhotos?: ListingPhotoDraft[];
  variants: ListingVariantDraft[];
  promotions: VolumePromotionTier[];
  variationPhotoAttribute?: VariationPhotoAttribute;
  pricing?: ListingPricingPreferences;
  pricingBreakdown?: PricingBreakdown;
  manualPriceOverride?: number | null;
  ebayPolicies?: EbayBusinessPolicies;
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

export interface ListingQualityCheck {
  id: string;
  label: string;
  passed: boolean;
  points: number;
  maxPoints: number;
  tip?: string;
}

export interface ListingQualityScore {
  total: number;
  maxTotal: number;
  checks: ListingQualityCheck[];
  tips: string[];
}

export const DEFAULT_FEE_PREFERENCES: Omit<ListingPricingPreferences, "currency"> = {
  ebayFinalValueFeePercent: 13.25,
  ebayTransactionFee: 0.3,
  paymentFeePercent: 2.9,
  profitMarginPercent: 30,
  shippingCost: 0,
};

export function defaultFeePreferencesForCurrency(currency: string): ListingPricingPreferences {
  return {
    ...DEFAULT_FEE_PREFERENCES,
    currency,
  };
}

export function defaultSellerPreferences(currency = "GBP"): SellerPreferences {
  return {
    ebayFinalValueFeePercent: DEFAULT_FEE_PREFERENCES.ebayFinalValueFeePercent,
    transactionFeeAmount: DEFAULT_FEE_PREFERENCES.ebayTransactionFee,
    paymentFeePercent: DEFAULT_FEE_PREFERENCES.paymentFeePercent,
    profitMarginPercent: DEFAULT_FEE_PREFERENCES.profitMarginPercent,
    shippingCost: DEFAULT_FEE_PREFERENCES.shippingCost,
    currency,
    buy2DiscountPercent: 0,
    buy3DiscountPercent: 0,
    buy5DiscountPercent: 0,
    buy10DiscountPercent: 0,
    buy2Enabled: false,
    buy3Enabled: false,
    buy5Enabled: false,
    buy10Enabled: false,
  };
}

export const DEFAULT_PROMOTIONS: VolumePromotionTier[] = [
  { enabled: false, quantity: 2, discountPercent: 10 },
  { enabled: false, quantity: 3, discountPercent: 15 },
  { enabled: false, quantity: 5, discountPercent: 20 },
  { enabled: false, quantity: 10, discountPercent: 25 },
];

export const LISTING_WIZARD_STEPS = [
  "Product URL",
  "VeRO Check",
  "Profit & Fees",
  "AI Generate",
  "Edit Listing",
  "Photos & Variations",
  "Shipping & Returns",
  "Volume Discounts",
  "Quality Score",
  "Confirm & List",
] as const;

export type ListingWizardStep = (typeof LISTING_WIZARD_STEPS)[number];
