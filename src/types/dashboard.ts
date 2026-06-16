import type {
  ProductHandlingStat,
  RecentRequest,
  StatCardData,
} from "@/features/dashboard/types";

export interface DashboardRequestUsage {
  usedPercent: number;
  dailyUsed: number;
  dailyLimit: number;
  monthlyUsed: number;
  monthlyLimit: number;
  chartDates: string[];
  chartValues: number[];
}

export interface DashboardPlanOverview {
  planName: string;
  status: "Active";
  renewsOn: string;
  dailyLimit: number;
  monthlyLimit: number;
  dailyUsed: number;
  monthlyUsed: number;
}

export interface DashboardData {
  userName: string;
  statCards: StatCardData[];
  requestUsage: DashboardRequestUsage;
  productHandlingStats: ProductHandlingStat[];
  productHandlingEmpty: boolean;
  recentRequests: RecentRequest[];
  planOverview: DashboardPlanOverview;
  dateRangeLabel: string;
}

export interface DashboardResponse {
  success: boolean;
  error?: string;
  data?: DashboardData;
}
