"use client";

import type { EbayListing } from "@/types/ebay";

interface EbayListingsTableProps {
  listings: EbayListing[];
  total: number;
  offerCount: number;
  offset: number;
  limit: number;
  sort: "asc" | "desc";
  alertBelow: number | null;
  query: string;
  isLoading: boolean;
  onSortChange: (sort: "asc" | "desc") => void;
  onPageChange: (offset: number) => void;
}

export function EbayListingsTable({
  listings,
  total,
  offerCount,
  offset,
  limit,
  sort,
  alertBelow,
  query,
  isLoading,
  onSortChange,
  onPageChange,
}: EbayListingsTableProps) {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const alertCount =
    alertBelow !== null
      ? listings.filter((listing) => listing.totalPrice <= alertBelow).length
      : 0;

  if (offerCount === 0 && !isLoading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-lg font-bold text-[#111827]">No listings found</p>
        <p className="mt-2 text-sm text-[#6B7280]">
          No eBay listings matched &quot;{query}&quot;. Try a shorter keyword.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-[#111827]">
            {total.toLocaleString()} listing{total === 1 ? "" : "s"} on eBay UK
          </p>
          <p className="mt-0.5 text-xs text-[#6B7280]">
            {offerCount} offer{offerCount === 1 ? "" : "s"} · &quot;eBay price&quot; matches the listing page for that variant (VAT included)
            {" · "}
            Listings {offset + 1}–{Math.min(offset + limit, total)} of {total.toLocaleString()}
            {alertBelow !== null && alertCount > 0 && (
              <span className="ml-2 font-medium text-amber-600">
                · {alertCount} below £{alertBelow.toFixed(2)}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[#6B7280]">Sort by total price:</span>
          <button
            type="button"
            onClick={() => onSortChange(sort === "asc" ? "desc" : "asc")}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#374151] transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
          >
            {sort === "asc" ? "Lowest first" : "Highest first"}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path
                d={sort === "asc" ? "M7 3v8M4 8l3 3 3-3" : "M7 11V3M4 6l3-3 3 3"}
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                <th className="px-4 py-3">Seller</th>
                <th className="px-4 py-3">Listing</th>
                <th className="px-4 py-3">Variant</th>
                <th className="px-4 py-3">Condition</th>
                <th className="px-4 py-3">eBay price</th>
                <th className="px-4 py-3">Postage</th>
                <th className="px-4 py-3">+ Postage</th>
                <th className="px-4 py-3">eBay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && listings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-[#6B7280]">
                    <svg
                      className="mx-auto mb-3 h-7 w-7 animate-spin text-brand"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Loading accurate eBay prices...
                  </td>
                </tr>
              ) : (
                listings.map((listing) => {
                  const isAlert =
                    alertBelow !== null && listing.totalPrice <= alertBelow;

                  return (
                    <tr
                      key={listing.id}
                      className={
                        isAlert
                          ? "bg-amber-50/80 ring-1 ring-inset ring-amber-200"
                          : "hover:bg-gray-50/50"
                      }
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isAlert && (
                            <span
                              className="inline-flex h-2 w-2 shrink-0 rounded-full bg-amber-500"
                              title="Below alert threshold"
                            />
                          )}
                          <span className="font-medium text-[#111827]">{listing.sellerName}</span>
                        </div>
                      </td>
                      <td className="max-w-[220px] px-4 py-3">
                        <div className="space-y-1.5">
                          {listing.hasVariations && (
                            <span className="inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                              Variations
                            </span>
                          )}
                          {listing.listingUrl ? (
                            <a
                              href={listing.listingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="line-clamp-2 font-medium text-[#374151] hover:text-brand hover:underline"
                              title={listing.title}
                            >
                              {listing.title}
                            </a>
                          ) : (
                            <p className="line-clamp-2 text-[#374151]" title={listing.title}>
                              {listing.title}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#6B7280]">
                        {listing.variantLabel ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-[#6B7280]">{listing.condition}</td>
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-semibold text-[#111827]">{listing.priceLabel}</span>
                          {listing.priceNote && (
                            <p className="mt-0.5 text-[10px] text-[#9CA3AF]">{listing.priceNote}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#6B7280]">{listing.shippingLabel}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-bold ${isAlert ? "text-amber-700" : "text-[#111827]"}`}
                        >
                          {listing.totalPriceLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {listing.listingUrl ? (
                          <a
                            href={listing.listingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#0064D2]/20 bg-[#0064D2]/5 px-3 py-1.5 text-xs font-semibold text-[#0064D2] transition-colors hover:border-[#0064D2]/40 hover:bg-[#0064D2]/10"
                          >
                            View on eBay
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                              <path
                                d="M3 9h6V3M9 3L3 9"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(0, offset - limit))}
              disabled={offset === 0 || isLoading}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-[#374151] transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs font-medium text-[#6B7280]">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(offset + limit)}
              disabled={offset + limit >= total || isLoading}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-[#374151] transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
