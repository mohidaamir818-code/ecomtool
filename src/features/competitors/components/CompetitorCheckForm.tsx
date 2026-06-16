"use client";

import { useState } from "react";
import type { CompetitorCheckResponse } from "@/types/competitor";

interface CompetitorCheckFormProps {
  userId: string;
  onSuccess: (data: CompetitorCheckResponse) => void;
}

export function CompetitorCheckForm({ userId, onSuccess }: CompetitorCheckFormProps) {
  const [productQuery, setProductQuery] = useState("");
  const [userPrice, setUserPrice] = useState("");
  const [notice, setNotice] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!productQuery.trim()) {
      setNotice("Please enter a product keyword or full product name.");
      setIsError(true);
      return;
    }

    const price = parseFloat(userPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setNotice("Please enter a valid selling price greater than 0.");
      setIsError(true);
      return;
    }

    setIsSubmitting(true);
    setNotice("");
    setIsError(false);

    try {
      const response = await fetch("/api/competitors/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          productQuery: productQuery.trim(),
          userPrice: price,
        }),
      });

      const data = (await response.json()) as CompetitorCheckResponse;

      if (!response.ok) {
        setNotice(data.error ?? "Competitor check failed. Please try again.");
        setIsError(true);
        return;
      }

      onSuccess(data);
    } catch {
      setNotice("Network error. Please check your connection and try again.");
      setIsError(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-br from-brand-light/60 via-white to-white shadow-[0_20px_60px_rgba(88,66,244,0.08)]"
    >
      <div className="border-b border-brand/10 bg-white/70 px-6 py-5 backdrop-blur-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-[0_8px_24px_rgba(88,66,244,0.35)]">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
              <path
                d="M11 2a6 6 0 00-6 6v1.5H4a1.5 1.5 0 000 3h1v3.5a6 6 0 0012 0V12.5h1a1.5 1.5 0 000-3h-1V8a6 6 0 00-6-6z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <circle cx="11" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#111827]">Compare your price</h2>
            <p className="mt-1 text-sm leading-relaxed text-[#6B7280]">
              Enter your product name and selling price. We&apos;ll scan Amazef sellers and flag anyone
              listing the same product cheaper than you.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-6">
        <div>
          <label htmlFor="competitor-product" className="mb-1.5 block text-sm font-semibold text-[#374151]">
            Product keyword or full name
          </label>
          <textarea
            id="competitor-product"
            value={productQuery}
            onChange={(event) => {
              setProductQuery(event.target.value);
              setNotice("");
              setIsError(false);
            }}
            rows={3}
            placeholder="e.g. wireless headphones, or paste the full long product title..."
            className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-[15px] leading-relaxed text-[#111827] shadow-sm outline-none transition-all placeholder:text-[#9CA3AF] focus:border-brand focus:ring-4 focus:ring-brand/10"
          />
        </div>

        <div>
          <label htmlFor="competitor-price" className="mb-1.5 block text-sm font-semibold text-[#374151]">
            Your selling price
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-semibold text-[#6B7280]">
              £
            </span>
            <input
              id="competitor-price"
              type="number"
              min="0.01"
              step="0.01"
              value={userPrice}
              onChange={(event) => {
                setUserPrice(event.target.value);
                setNotice("");
                setIsError(false);
              }}
              placeholder="9.00"
              className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-9 pr-4 text-[15px] text-[#111827] shadow-sm outline-none transition-all placeholder:text-[#9CA3AF] focus:border-brand focus:ring-4 focus:ring-brand/10"
            />
          </div>
          <p className="mt-1.5 text-xs text-[#9CA3AF]">
            We&apos;ll tell you if any seller on Amazef is listing below this price.
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
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(88,66,244,0.35)] transition-all hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {isSubmitting ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Checking competitors...
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                <circle cx="7" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="M1 16c0-3.3 2.7-6 6-6s6 2.7 6 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path d="M13 8h4M15 6v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Check Competitor
            </>
          )}
        </button>
      </div>
    </form>
  );
}
