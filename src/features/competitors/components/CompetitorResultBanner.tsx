import type { CompetitorMatch } from "@/types/competitor";

interface CompetitorResultBannerProps {
  message: string;
  userPriceLabel: string;
  matches: CompetitorMatch[];
  totalSearched: number;
}

export function CompetitorResultBanner({
  message,
  userPriceLabel,
  matches,
  totalSearched,
}: CompetitorResultBannerProps) {
  const hasMatches = matches.length > 0;
  const noProducts = totalSearched === 0;

  return (
    <div
      className={`rounded-2xl border p-6 ${
        noProducts
          ? "border-gray-200 bg-gray-50"
          : hasMatches
            ? "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50"
            : "border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50"
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
            noProducts
              ? "bg-gray-200 text-gray-600"
              : hasMatches
                ? "bg-amber-500 text-white"
                : "bg-emerald-500 text-white"
          }`}
        >
          {noProducts ? (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11 7v4M11 15h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          ) : hasMatches ? (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
              <path
                d="M11 3l2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L3.8 8.2l5-.7L11 3z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
              <path
                d="M6 11l3 3 7-7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`text-lg font-bold ${
              noProducts
                ? "text-[#374151]"
                : hasMatches
                  ? "text-amber-900"
                  : "text-emerald-900"
            }`}
          >
            {message}
          </p>
          {!noProducts && (
            <p className="mt-2 text-sm text-[#6B7280]">
              Your price: <span className="font-semibold text-[#111827]">{userPriceLabel}</span>
              {" · "}
              Scanned {totalSearched} listing{totalSearched === 1 ? "" : "s"} on Amazef
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
