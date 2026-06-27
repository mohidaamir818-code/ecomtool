export interface HuntProStatistics {
  totalSold: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  totalRevenue: number;
  dailyAverage: number;
}

export interface HuntProProduct {
  title: string;
  soldPrice: number;
  soldDate: string;
  imageUrl: string;
  itemId: string;
  condition: string;
  shippingCost: number;
  totalPrice: number;
  listingUrl: string;
  // Number of times this product sold within the seller-selected day window.
  soldCount?: number;
  // The day window (e.g. 10) the extension used when counting sales.
  daysWindow?: number;
}

export interface HuntProReceivePayload {
  keyword: string;
  userId: string;
  source: "huntpro-extension";
  timestamp: number;
  statistics: HuntProStatistics;
  products: HuntProProduct[];
}

export interface HuntProResult {
  id: string;
  keyword: string;
  source: string;
  statistics: HuntProStatistics;
  products: HuntProProduct[];
  createdAt: string;
}
