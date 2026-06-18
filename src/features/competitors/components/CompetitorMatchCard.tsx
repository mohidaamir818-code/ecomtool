import type { CompetitorMatch } from "@/types/competitor";

export function CompetitorMatchCard({
  match,
  userPriceLabel,
  viewLabel = "View listing",
}: {
  match: CompetitorMatch;
  userPriceLabel: string;
  viewLabel?: string;
}) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm transition-all hover:border-amber-200 hover:shadow-md">
      <div className="flex flex-col sm:flex-row">
        {match.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={match.imageUrl}
            alt={match.productName}
            className="h-40 w-full object-cover sm:h-auto sm:w-36 sm:shrink-0"
          />
        ) : (
          <div className="flex h-40 w-full items-center justify-center bg-amber-50 sm:h-auto sm:w-36 sm:shrink-0">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-amber-400" aria-hidden>
              <path d="M6 10h20l-2 14H8L6 10z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </div>
        )}

        <div className="flex flex-1 flex-col justify-between p-5">
          <div>
            <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              Cheaper by {match.priceDifferenceLabel}
            </span>
            <h3 className="mt-2 line-clamp-2 text-base font-bold text-[#111827] group-hover:text-brand">
              {match.productUrl ? (
                <a href={match.productUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {match.productName}
                </a>
              ) : (
                match.productName
              )}
            </h3>
          </div>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-gray-50 pt-4">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                Competitor price
              </p>
              <p className="text-xl font-bold text-amber-600">{match.priceLabel}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                Your price
              </p>
              <p className="text-sm font-semibold text-[#6B7280] line-through">{userPriceLabel}</p>
            </div>
          </div>

          {match.productUrl ? (
            <a
              href={match.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center justify-center rounded-xl border border-brand/20 bg-brand-light px-4 py-2.5 text-sm font-semibold text-brand hover:bg-brand/10"
            >
              {viewLabel}
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
