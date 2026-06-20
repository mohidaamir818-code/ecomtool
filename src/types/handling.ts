export type HandlingUpdateMode = "auto_24h" | "custom" | "manual";

export interface HandlingProductVariant {
  id: string;
  label: string;
  price: number;
  currency: string;
  stock: number | null;
  imageUrl?: string | null;
}

export interface HandlingProductData {
  source: "aliexpress";
  externalId: string;
  productUrl: string;
  title: string;
  imageUrl: string | null;
  price: number;
  currency: string;
  stock: number | null;
  orders: string | null;
  rating: number | null;
  variants?: HandlingProductVariant[];
  selectedVariantId?: string;
  description?: string | null;
  images?: string[];
}

export interface HandlingProduct {
  id: string;
  source: string;
  externalId: string;
  productUrl: string;
  title: string;
  imageUrl: string | null;
  price: string;
  currency: string;
  stock: number | null;
  orders: string | null;
  rating: number | null;
  variants?: HandlingProductVariant[];
  selectedVariantId?: string | null;
  updateMode: HandlingUpdateMode;
  updateIntervalHours: number | null;
  nextUpdateAt: string | null;
  lastCheckedAt: string | null;
  status: string;
  addedAt: string;
}

export interface HandlingProductLog {
  id: string;
  changeSummary: string;
  price: string | null;
  stock: number | null;
  createdAt: string;
}

export interface HandlingPreviewResponse {
  success: boolean;
  error?: string;
  product?: HandlingProductData;
}

export interface HandlingListResponse {
  success: boolean;
  error?: string;
  products?: HandlingProduct[];
}

export interface HandlingAddPayload {
  userId: string;
  product: HandlingProductData;
  updateMode: HandlingUpdateMode;
  customHours?: number;
}

export interface HandlingCheckResponse {
  success: boolean;
  error?: string;
  message?: string;
  product?: HandlingProduct;
  changes?: string[];
}
