import type { HuntProduct } from "@/types/hunting";

const statusStyles = {
  Completed: "bg-emerald-50 text-emerald-600",
  Processing: "bg-orange-50 text-orange-600",
  Pending: "bg-gray-100 text-gray-600",
  Failed: "bg-red-50 text-red-600",
};

function getViewLabel(source: string): string {
  if (source.toLowerCase() === "ebay") return "View on eBay";
  return "View on Amazef";
}

export function HuntProductCard({ hunt }: { hunt: HuntProduct }) {
  const productUrl = hunt.productUrl;
  const viewLabel = getViewLabel(hunt.source);

  return (
    <article className="group flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:border-brand/20 hover:shadow-md">
      <div className="mb-4 flex items-start justify-between gap-3">
        {hunt.imageUrl ? (
          productUrl ? (
            <a
              href={productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 overflow-hidden rounded-xl ring-0 transition-all hover:ring-2 hover:ring-brand/30"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={hunt.imageUrl}
                alt={hunt.productName}
                className="h-16 w-16 object-cover"
              />
            </a>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hunt.imageUrl}
              alt={hunt.productName}
              className="h-16 w-16 shrink-0 rounded-xl object-cover"
            />
          )
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-brand-light text-brand">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 8h16l-1.5 10H5.5L4 8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </div>
        )}
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyles[hunt.status]}`}>
          {hunt.status}
        </span>
      </div>

      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-brand">{hunt.keyword}</p>

      <h3 className="mb-3 line-clamp-2 text-base font-bold text-[#111827]">
        {productUrl ? (
          <a
            href={productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-brand hover:underline"
          >
            {hunt.productName}
          </a>
        ) : (
          hunt.productName
        )}
      </h3>

      <div className="mb-4 grid grid-cols-3 gap-2 border-t border-gray-50 pt-4">
        <div>
          <p className="text-[10px] font-medium uppercase text-[#9CA3AF]">Price</p>
          <p className="text-sm font-bold text-[#111827]">{hunt.price}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase text-[#9CA3AF]">Score</p>
          <p className="text-sm font-bold text-emerald-500">
            {hunt.score != null ? `${hunt.score}/100` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase text-[#9CA3AF]">Orders</p>
          <p className="text-sm font-bold text-[#111827]">{hunt.orders}</p>
        </div>
      </div>

      <div className="mt-auto space-y-3">
        {productUrl && (
          <a
            href={productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand/20 bg-brand-light px-4 py-2.5 text-sm font-semibold text-brand transition-all hover:border-brand/40 hover:bg-brand/10"
          >
            {viewLabel}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path
                d="M3 7h8M8 4l3 3-3 3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        )}

        <p className="text-xs text-[#9CA3AF]">Hunted {hunt.huntedAt}</p>
      </div>
    </article>
  );
}
