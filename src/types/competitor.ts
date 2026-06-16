export interface CompetitorMatch {
  id: string;
  productName: string;
  price: number;
  priceLabel: string;
  currency: string;
  priceDifference: number;
  priceDifferenceLabel: string;
  imageUrl: string | null;
  productUrl: string | null;
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
