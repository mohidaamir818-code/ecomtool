export type SellerCalculatorOrderStatus =
  | "completed"
  | "cancelled"
  | "refunded"
  | "partial_refund";

export interface SellerCalculatorOrderRow {
  id: string;
  ebayOrderId: string;
  orderDate: string;
  orderDateLabel: string;
  supplierOrderId: string | null;
  buyerName: string | null;
  costPrice: number;
  sellingPrice: number;
  fees: number;
  netSale: number;
  profit: number;
  roi: number | null;
  refundAmount: number;
  payoutAmount: number | null;
  orderStatus: SellerCalculatorOrderStatus;
  currency: string;
  costPriceLabel: string;
  sellingPriceLabel: string;
  feesLabel: string;
  netSaleLabel: string;
  profitLabel: string;
  refundAmountLabel: string;
}

export interface SellerCalculatorTotals {
  costPrice: number;
  sellingPrice: number;
  fees: number;
  netSale: number;
  profit: number;
  roi: number | null;
  refundAmount: number;
  costPriceLabel: string;
  sellingPriceLabel: string;
  feesLabel: string;
  netSaleLabel: string;
  profitLabel: string;
  refundAmountLabel: string;
  roiLabel: string;
}

export interface SellerCalculatorMonth {
  id: string;
  year: number;
  month: number;
  monthLabel: string;
  status: "open" | "closed";
  lastSyncedAt: string | null;
  orderCount: number;
  totals: SellerCalculatorTotals;
  orders: SellerCalculatorOrderRow[];
}

export interface SellerCalculatorResponse {
  success: boolean;
  error?: string;
  connected?: boolean;
  month?: SellerCalculatorMonth;
  message?: string;
  addedCount?: number;
  skippedNoNote?: number;
}
