import type { CompetitorCheck } from "@/types/competitor";

export function RecentCompetitorChecks({
  checks,
  selectedCheckId,
  onSelectCheck,
  loadingCheckId,
}: {
  checks: CompetitorCheck[];
  selectedCheckId: string | null;
  onSelectCheck: (checkId: string | null) => void;
  loadingCheckId: string | null;
}) {
  function handleSelect(checkId: string) {
    onSelectCheck(selectedCheckId === checkId ? null : checkId);
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-[#111827]">Recent Checks</h3>
          <p className="mt-0.5 text-xs text-[#9CA3AF]">Click to view that check only.</p>
        </div>
        {selectedCheckId && (
          <button
            type="button"
            onClick={() => onSelectCheck(null)}
            className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-[#374151] transition-colors hover:bg-gray-50"
          >
            Show all
          </button>
        )}
      </div>

      {checks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-[#FAFAFA] px-4 py-8 text-center">
          <p className="text-sm font-semibold text-[#374151]">No competitor checks yet</p>
          <p className="mt-1 text-xs text-[#9CA3AF]">
            Run your first check above to see history here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {checks.map((check) => {
            const isSelected = selectedCheckId === check.id;
            const isLoading = loadingCheckId === check.id;

            return (
              <li key={check.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(check.id)}
                  disabled={isLoading}
                  className={`flex w-full items-start justify-between gap-3 py-3.5 text-left transition-colors first:pt-0 last:pb-0 ${
                    isSelected
                      ? "rounded-xl bg-brand-light/60 px-3 ring-2 ring-inset ring-brand/20"
                      : "hover:opacity-80"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#111827]">{check.productQuery}</p>
                    <p className="mt-0.5 text-xs text-[#9CA3AF]">
                      Your price {check.userPriceLabel} · {check.checkedAt}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      check.matchesFound > 0
                        ? "bg-amber-50 text-amber-700"
                        : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {isLoading
                      ? "..."
                      : check.matchesFound > 0
                        ? `${check.matchesFound} under`
                        : "Clear"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
