import type { RecentRequest } from "../types";
import { DashboardIcon } from "./DashboardIcon";

const statusStyles = {
  Completed: "bg-emerald-50 text-emerald-600",
  Processing: "bg-orange-50 text-orange-600",
  Pending: "bg-gray-100 text-gray-600",
  Failed: "bg-red-50 text-red-600",
};

export function RecentRequestsCard({ requests }: { requests: RecentRequest[] }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm lg:col-span-2">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#111827]">Recent Requests</h3>
      </div>

      {requests.length === 0 ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-dashed border-gray-200 bg-[#FAFAFA] px-4 py-4 text-center">
            <p className="text-sm font-semibold text-[#374151]">No recent requests yet</p>
            <p className="mt-1 text-xs text-[#9CA3AF]">
              Start a hunt to see your latest activity here.
            </p>
          </div>
          <ul className="space-y-2 text-xs text-[#9CA3AF]">
            <li>No handling products yet</li>
            <li>No competitor check yet</li>
          </ul>
        </div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {requests.map((req) => (
            <li key={req.id} className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand">
                  <DashboardIcon
                    name={req.icon as Parameters<typeof DashboardIcon>[0]["name"]}
                    className="h-4 w-4"
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#111827]">{req.title}</p>
                  <p className="truncate text-xs text-[#9CA3AF]">{req.subtitle}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyles[req.status]}`}
                >
                  {req.status}
                </span>
                <span className="hidden text-xs text-[#9CA3AF] sm:block">{req.time}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
