export type CompetitorUpdateMode = "auto_24h" | "custom" | "manual";

export type CompetitorPlatform = "amazef" | "ebay";

export interface CompetitorMatchVariant {
  id: string;
  label: string;
  price: number;
  priceLabel: string;
  priceDifference: number;
  priceDifferenceLabel: string;
  productUrl: string | null;
}

export interface CompetitorMatch {
  id: string;
  productName: string;
  sellerName: string | null;
  price: number;
  priceLabel: string;
  priceMax?: number;
  currency: string;
  priceDifference: number;
  priceDifferenceLabel: string;
  imageUrl: string | null;
  productUrl: string | null;
  variants?: CompetitorMatchVariant[];
}

export interface CompetitorWatchUpgradePayload {
  userId: string;
  watchId: string;
  userPrice: number;
}

export interface CompetitorCheck {
  id: string;
  productQuery: string;
  userPrice: number;
  userPriceLabel: string;
  currency: string;
  matchesFound: number;
  productsSearched: number;
  checkedAt: string;
}

export interface CompetitorCheckPayload {
  userId: string;
  productQuery: string;
  userPrice: number;
}

export interface CompetitorWatch {
  id: string;
  platform: CompetitorPlatform;
  productQuery: string;
  userPrice: number;
  userPriceLabel: string;
  currency: string;
  matchesFound: number;
  productsSearched: number;
  updateMode: CompetitorUpdateMode;
  updateIntervalHours: number | null;
  nextUpdateAt: string | null;
  lastCheckedAt: string | null;
  addedAt: string;
  hasAlert: boolean;
}

export interface CompetitorWatchAddPayload {
  userId: string;
  platform?: CompetitorPlatform;
  productQuery: string;
  userPrice: number;
  updateMode: CompetitorUpdateMode;
  customHours?: number;
}

export interface CompetitorWatchListResponse {
  success: boolean;
  error?: string;
  watches?: CompetitorWatch[];
  message?: string;
}

export interface CompetitorWatchDetailResponse {
  success: boolean;
  error?: string;
  watch?: CompetitorWatch;
  matches?: CompetitorMatch[];
  message?: string;
  userPriceLabel?: string;
  totalSearched?: number;
  watches?: CompetitorWatch[];
}

export interface CompetitorCheckResponse {
  success: boolean;
  message?: string;
  error?: string;
  userPrice?: number;
  userPriceLabel?: string;
  currency?: string;
  matches?: CompetitorMatch[];
  totalSearched?: number;
  check?: CompetitorCheck;
  recentChecks?: CompetitorCheck[];
  selectedCheck?: CompetitorCheck;
}
