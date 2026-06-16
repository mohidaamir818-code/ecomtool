import type { HuntRequest } from "@/types/hunting";
import { EmptyState } from "./EmptyState";

const statusStyles = {
  Completed: "bg-emerald-50 text-emerald-600",
  Processing: "bg-orange-50 text-orange-600",
  Pending: "bg-gray-100 text-gray-600",
  Failed: "bg-red-50 text-red-600",
};

export function RecentHuntRequests({
  requests,
  lookbackDays,
  selectedRequestId,
  onSelectRequest,
}: {
  requests: HuntRequest[];
  lookbackDays: number;
  selectedRequestId: string | null;
  onSelectRequest: (requestId: string | null) => void;
}) {
  function handleSelect(requestId: string) {
    onSelectRequest(selectedRequestId === requestId ? null : requestId);
  }

  return (
    <div className="mb-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#111827]">Recent Hunt Requests</h2>
          <p className="text-sm text-[#6B7280]">
            Click a hunt to view only that result below.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedRequestId && (
            <button
              type="button"
              onClick={() => onSelectRequest(null)}
              className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-[#374151] transition-colors hover:bg-gray-50"
            >
              Show all hunts
            </button>
          )}
          {requests.length > 0 && (
            <span className="rounded-full bg-brand-light px-3 py-1 text-xs font-semibold text-brand">
              {requests.length} request{requests.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M16 16l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
          title={`No hunt requests in the last ${lookbackDays} days`}
          description="Click Hunt Product above and enter a keyword to start a new product search."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <ul className="divide-y divide-gray-50">
            {requests.map((req) => {
              const isSelected = selectedRequestId === req.id;

              return (
                <li key={req.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(req.id)}
                    className={`flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left transition-colors ${
                      isSelected
                        ? "bg-brand-light/60 ring-2 ring-inset ring-brand/20"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#111827]">{req.keyword}</p>
                      <p className="text-xs text-[#9CA3AF]">
                        {req.createdAt}
                        {req.lookbackDays ? ` · ${req.lookbackDays}-day filter` : ""}
                      </p>
                      {req.errorMessage && (
                        <p className="mt-1 text-xs text-red-500">{req.errorMessage}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#6B7280]">
                        {req.productCount} product{req.productCount === 1 ? "" : "s"}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyles[req.status]}`}
                      >
                        {req.status}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
