"use client";

import { useState } from "react";

export type EbaySearchParams = {
  query: string;
  alertBelow: number | null;
};

interface EbaySearchFormProps {
  onSearch: (params: EbaySearchParams) => void;
  isSearching: boolean;
}

export function EbaySearchForm({ onSearch, isSearching }: EbaySearchFormProps) {
  const [productQuery, setProductQuery] = useState("");
  const [alertBelow, setAlertBelow] = useState("");
  const [notice, setNotice] = useState("");
  const [isError, setIsError] = useState(false);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!productQuery.trim()) {
      setNotice("Please enter a product keyword or full title.");
      setIsError(true);
      return;
    }

    let threshold: number | null = null;
    if (alertBelow.trim()) {
      const parsed = Number.parseFloat(alertBelow);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setNotice("Alert price must be a valid number greater than 0.");
        setIsError(true);
        return;
      }
      threshold = parsed;
    }

    setNotice("");
    setIsError(false);
    onSearch({ query: productQuery.trim(), alertBelow: threshold });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-br from-brand-light/60 via-white to-white shadow-[0_20px_60px_rgba(88,66,244,0.08)]"
    >
      <div className="border-b border-brand/10 bg-white/70 px-6 py-5 backdrop-blur-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0064D2] text-white shadow-[0_8px_24px_rgba(0,100,210,0.35)]">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
              <path
                d="M3 4h16l-1.5 10.5H4.5L3 4z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <circle cx="8" cy="18.5" r="1.5" fill="currentColor" />
              <circle cx="15" cy="18.5" r="1.5" fill="currentColor" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#111827]">Search eBay listings</h2>
            <p className="mt-1 text-sm leading-relaxed text-[#6B7280]">
              Enter a product keyword or title. We&apos;ll list all current eBay sellers with price,
              shipping, condition, and listing links.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-6">
        <div>
          <label htmlFor="ebay-product" className="mb-1.5 block text-sm font-semibold text-[#374151]">
            Product keyword or full title
          </label>
          <textarea
            id="ebay-product"
            value={productQuery}
            onChange={(event) => {
              setProductQuery(event.target.value);
              setNotice("");
              setIsError(false);
            }}
            rows={3}
            placeholder="e.g. wireless earbuds"
            className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-[15px] leading-relaxed text-[#111827] shadow-sm outline-none transition-all placeholder:text-[#9CA3AF] focus:border-brand focus:ring-4 focus:ring-brand/10"
          />
        </div>

        <div>
          <label htmlFor="ebay-alert" className="mb-1.5 block text-sm font-semibold text-[#374151]">
            Alert below this price <span className="font-normal text-[#9CA3AF]">(optional)</span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-semibold text-[#6B7280]">
              £
            </span>
            <input
              id="ebay-alert"
              type="number"
              min="0.01"
              step="0.01"
              value={alertBelow}
              onChange={(event) => {
                setAlertBelow(event.target.value);
                setNotice("");
                setIsError(false);
              }}
              placeholder="10.00"
              className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-9 pr-4 text-[15px] text-[#111827] shadow-sm outline-none transition-all placeholder:text-[#9CA3AF] focus:border-brand focus:ring-4 focus:ring-brand/10"
            />
          </div>
          <p className="mt-1.5 text-xs text-[#9CA3AF]">
            Listings at or below this total price (item + shipping) will be highlighted.
          </p>
        </div>

        {notice && (
          <div
            className={`rounded-xl px-4 py-3 text-sm font-medium ${
              isError
                ? "border border-red-100 bg-red-50 text-red-600"
                : "border border-emerald-100 bg-emerald-50 text-emerald-700"
            }`}
          >
            {notice}
          </div>
        )}

        <button
          type="submit"
          disabled={isSearching}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(88,66,244,0.35)] transition-all hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {isSearching ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Searching eBay...
            </>
          ) : (
            "Search eBay"
          )}
        </button>
      </div>
    </form>
  );
}
