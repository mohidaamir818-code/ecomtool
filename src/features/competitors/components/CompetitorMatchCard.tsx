"use client";

import { useEffect, useState } from "react";
import type { CompetitorMatch, CompetitorMatchVariant } from "@/types/competitor";

export function CompetitorMatchCard({
  match,
  userPriceLabel,
  viewLabel = "View listing",
}: {
  match: CompetitorMatch;
  userPriceLabel: string;
  viewLabel?: string;
}) {
  const hasVariants = Boolean(match.variants && match.variants.length > 1);
  const [selectedVariantId, setSelectedVariantId] = useState(
    match.variants?.[0]?.id ?? match.id,
  );

  useEffect(() => {
    setSelectedVariantId(match.variants?.[0]?.id ?? match.id);
  }, [match.id, match.variants]);

  const selectedVariant: CompetitorMatchVariant | null =
    match.variants?.find((variant) => variant.id === selectedVariantId) ??
    match.variants?.[0] ??
    null;

  const displayPriceLabel = hasVariants
    ? match.priceLabel
    : selectedVariant?.priceLabel ?? match.priceLabel;
  const displayDifferenceLabel =
    selectedVariant?.priceDifferenceLabel ?? match.priceDifferenceLabel;
  const displayUrl = selectedVariant?.productUrl ?? match.productUrl;

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
              Cheaper by {displayDifferenceLabel}
            </span>
            <h3 className="mt-2 line-clamp-2 text-base font-bold text-[#111827] group-hover:text-brand">
              {displayUrl ? (
                <a href={displayUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {match.productName}
                </a>
              ) : (
                match.productName
              )}
            </h3>
            {match.sellerName ? (
              <p className="mt-2 text-sm text-[#6B7280]">
                Store{" "}
                <span className="font-semibold text-[#374151]">{match.sellerName}</span>
              </p>
            ) : null}
          </div>

          {hasVariants && match.variants ? (
            <div className="mt-4">
              <label
                htmlFor={`variant-${match.id}`}
                className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-[#9CA3AF]"
              >
                Variant
              </label>
              <select
                id={`variant-${match.id}`}
                value={selectedVariantId}
                onChange={(event) => setSelectedVariantId(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-[#111827] outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
              >
                {match.variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.label} — {variant.priceLabel}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-gray-50 pt-4">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                Competitor price
              </p>
              <p className="text-xl font-bold text-amber-600">
                {hasVariants && selectedVariant ? selectedVariant.priceLabel : displayPriceLabel}
              </p>
              {hasVariants && match.priceMax != null && match.priceMax !== match.price ? (
                <p className="mt-0.5 text-xs text-[#6B7280]">Range {match.priceLabel}</p>
              ) : null}
            </div>
            <div className="text-right">
              <p className="text-[10px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                Your price
              </p>
              <p className="text-sm font-semibold text-[#6B7280] line-through">{userPriceLabel}</p>
              {selectedVariant && selectedVariant.price < match.price ? (
                <p className="mt-0.5 text-xs text-amber-600">Selected variant</p>
              ) : null}
            </div>
          </div>

          {displayUrl ? (
            <a
              href={displayUrl}
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
