export type HuntStatus = "Completed" | "Processing" | "Pending" | "Failed";

export interface HuntProduct {
  id: string;
  huntRequestId: string;
  keyword: string;
  productName: string;
  price: string;
  score: number | null;
  orders: string | null;
  status: HuntStatus;
  huntedAt: string;
  imageUrl: string | null;
  productUrl: string | null;
  source: string;
}

export interface HuntRequest {
  id: string;
  keyword: string;
  status: HuntStatus;
  productCount: number;
  lookbackDays: number;
  errorMessage: string | null;
  createdAt: string;
}

export interface HuntStats {
  totalHunts: number;
  winningProducts: number;
  avgScore: number;
  totalProducts: number;
}

export interface HuntAmazefResponse {
  success: boolean;
  message?: string;
  request?: HuntRequest;
  products?: HuntProduct[];
  stats?: HuntStats;
  requests?: HuntRequest[];
}

export interface HuntAmazefPayload {
  userId: string;
  query: string;
  lookbackDays?: number;
}

export interface HuntAmazefQuery {
  userId: string;
  lookbackDays?: number;
}
