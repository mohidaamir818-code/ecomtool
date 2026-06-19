"use client";

import { useCallback, useEffect, useState } from "react";
import { QuotaCard } from "@/features/quota/components/QuotaCard";
import type { UserQuotasResponse } from "@/types/quota";

export function DashboardQuotaRow({ userId }: { userId: string | null }) {
  const [data, setData] = useState<UserQuotasResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/quota/${encodeURIComponent(userId)}`);
      if (!response.ok) return;
      const payload = (await response.json()) as UserQuotasResponse;
      setData(payload);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  if (!userId || loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {data.quotas.map((quota) => (
        <QuotaCard key={quota.platform} quota={quota} resetsAt={data.resetsAt} variant="light" />
      ))}
    </div>
  );
}
