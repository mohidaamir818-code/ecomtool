"use client";

import { PLATFORM_LABELS } from "@/lib/quota/constants";
import { QuotaProgressBar } from "@/features/quota/components/QuotaProgressBar";
import { CountdownTimer } from "@/features/quota/components/CountdownTimer";
import type { PlatformQuota } from "@/types/quota";

export function QuotaCard({
  quota,
  resetsAt,
  variant = "light",
}: {
  quota: PlatformQuota;
  resetsAt: string;
  variant?: "light" | "dark";
}) {
  const label = PLATFORM_LABELS[quota.platform];
  const isDark = variant === "dark";

  return (
    <div
      className={`rounded-xl border p-5 ${
        isDark ? "border-white/10 bg-black/20" : "border-gray-100 bg-white shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
          {label}
        </h3>
        {quota.unlimited ? (
          <span className={`text-lg font-bold ${isDark ? "text-[#a89bff]" : "text-brand"}`}>
            ∞
          </span>
        ) : (
          <span className={`text-xs ${isDark ? "text-white/50" : "text-gray-500"}`}>
            Resets in <CountdownTimer resetsAt={resetsAt} />
          </span>
        )}
      </div>

      {quota.unlimited ? (
        <p className={`mt-2 text-sm ${isDark ? "text-white/60" : "text-gray-500"}`}>
          Unlimited requests
        </p>
      ) : (
        <>
          <p className={`mt-3 text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
            {quota.usedToday}{" "}
            <span className={`text-base font-normal ${isDark ? "text-white/50" : "text-gray-400"}`}>
              / {quota.dailyLimit}
            </span>
          </p>
          <p className={`mt-1 text-sm ${isDark ? "text-white/60" : "text-gray-500"}`}>
            {quota.remaining ?? 0} remaining today
          </p>
          <div className="mt-3">
            <QuotaProgressBar
              used={quota.usedToday}
              limit={quota.dailyLimit}
              variant={variant}
            />
          </div>
        </>
      )}
    </div>
  );
}
