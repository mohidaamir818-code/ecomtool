export type SupplierSearchMode = "keyword" | "title" | "photo";

export type SupplierStockRegion = "any" | "uk" | "us";

export interface SupplierProduct {
  productId: string;
  title: string;
  imageUrl: string | null;
  productUrl: string | null;
  price: number;
  currency: string;
  originalPrice: number | null;
  commissionRate: string | null;
  orders: number | null;
  rating: string | null;
  discount: string | null;
  deliveryDays: string | null;
  shopUrl: string | null;
}

export interface SupplierSearchResponse {
  success: boolean;
  mode: SupplierSearchMode;
  query: string;
  stockRegion: SupplierStockRegion;
  products: SupplierProduct[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  /** When photo search was used, the AI-generated keywords from the image. */
  derivedKeywords?: string;
}
