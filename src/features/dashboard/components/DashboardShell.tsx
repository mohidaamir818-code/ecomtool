"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { DashboardHeader } from "@/features/dashboard/components/DashboardHeader";
import { PlanOverviewCard } from "@/features/dashboard/components/PlanOverviewCard";
import { ProductsHandlingCard } from "@/features/dashboard/components/ProductsHandlingCard";
import { QuickActionsCard } from "@/features/dashboard/components/QuickActionsCard";
import { RecentRequestsCard } from "@/features/dashboard/components/RecentRequestsCard";
import { RequestUsageCard } from "@/features/dashboard/components/RequestUsageCard";
import { StatCardsRow } from "@/features/dashboard/components/StatCardsRow";
import { DashboardQuotaRow } from "@/features/quota/components/DashboardQuotaRow";
import type { DashboardData } from "@/types/dashboard";

export function DashboardShell() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async (userId: string) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/dashboard?userId=${encodeURIComponent(userId)}`);
      const payload = (await response.json()) as {
        success?: boolean;
        data?: DashboardData;
        error?: string;
      };

      if (!response.ok || !payload.data) {
        setError(payload.error ?? "Failed to load dashboard data.");
        return;
      }

      setData(payload.data);
    } catch {
      setError("Network error while loading dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = sessionStorage.getItem("ecomtools_user_id");
    if (id) {
      setUserId(id);
      loadDashboard(id);
    } else {
      setLoading(false);
    }
  }, [loadDashboard]);

  const userName = data?.userName ?? "User";

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1200px] p-6 lg:p-8">
        <DashboardHeader userName={userName} dateRangeLabel={data?.dateRangeLabel} />

        {error && (
          <div className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <svg className="h-8 w-8 animate-spin text-brand" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : data ? (
          <div className="space-y-6">
            <DashboardQuotaRow userId={userId} />
            <StatCardsRow cards={data.statCards} />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <RequestUsageCard usage={data.requestUsage} />
              <ProductsHandlingCard
                stats={data.productHandlingStats}
                isEmpty={data.productHandlingEmpty}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <RecentRequestsCard requests={data.recentRequests} />
              <div className="space-y-6">
                <QuickActionsCard />
                <PlanOverviewCard plan={data.planOverview} />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
