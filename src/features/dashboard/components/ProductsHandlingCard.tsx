import type { ProductHandlingStat } from "../types";
import { DashboardIcon } from "./DashboardIcon";

export function ProductsHandlingCard({
  stats,
  isEmpty,
}: {
  stats: ProductHandlingStat[];
  isEmpty: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#111827]">Products Handling</h3>
      </div>

      {isEmpty ? (
        <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-[#FAFAFA] px-4 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-light text-brand">
            <DashboardIcon name="box" className="h-4 w-4" />
          </div>
          <p className="text-sm font-semibold text-[#374151]">No handling products yet</p>
          <p className="mt-1 text-xs text-[#9CA3AF]">
            Products you handle will show up here once you start managing listings.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {stats.map((stat) => (
            <li key={stat.label} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.iconColor}`}>
                  <DashboardIcon name="box" className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#374151]">{stat.label}</p>
                  <p className="text-lg font-bold text-[#111827]">{stat.value}</p>
                </div>
              </div>
              <span
                className={`text-sm font-semibold ${
                  stat.changeType === "up" ? "text-emerald-500" : "text-red-500"
                }`}
              >
                {stat.change}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
