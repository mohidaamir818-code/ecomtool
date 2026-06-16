import type { DashboardPlanOverview } from "@/types/dashboard";

export function PlanOverviewCard({ plan }: { plan: DashboardPlanOverview }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#111827]">Plan Overview</h3>
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
          {plan.status}
        </span>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-light">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M4 16V6l6-3 6 3v10H4z" stroke="#5842F4" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-[#111827]">{plan.planName}</p>
          <p className="text-xs text-[#9CA3AF]">Renews on {plan.renewsOn}</p>
        </div>
      </div>

      <div className="space-y-3 border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#6B7280]">Daily Requests</span>
          <span className="font-semibold text-[#111827]">
            {plan.dailyUsed} / {plan.dailyLimit}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#6B7280]">Monthly Requests</span>
          <span className="font-semibold text-[#111827]">
            {plan.monthlyUsed.toLocaleString()} / {plan.monthlyLimit.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
