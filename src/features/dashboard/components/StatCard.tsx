import type { StatCardData } from "../types";
import { DashboardIcon } from "./DashboardIcon";

export function StatCard({ data }: { data: StatCardData }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <p className="text-sm font-medium text-[#6B7280]">{data.title}</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-light text-brand">
          <DashboardIcon name={data.icon as Parameters<typeof DashboardIcon>[0]["name"]} className="h-4 w-4" />
        </div>
      </div>

      <p className="text-xl font-bold text-[#111827]">{data.value}</p>

      {data.subtitle && (
        <p className="mt-1 text-xs text-[#9CA3AF]">{data.subtitle}</p>
      )}

      {data.progress !== undefined && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full ${data.progressColor ?? "bg-brand"}`}
              style={{ width: `${data.progress}%` }}
            />
          </div>
        </div>
      )}

      {data.change && (
        <p
          className={`mt-2 text-xs font-medium ${
            data.changeType === "up"
              ? "text-emerald-500"
              : data.changeType === "down"
                ? "text-red-500"
                : "text-[#6B7280]"
          }`}
        >
          {data.change}
        </p>
      )}
    </div>
  );
}
