"use client";

import { useState } from "react";
import {
  DEFAULT_HUNT_LOOKBACK_DAYS,
  HUNT_LOOKBACK_OPTIONS,
  type HuntLookbackDays,
} from "@/features/hunting/constants";
import type { HuntAmazefResponse } from "@/types/hunting";

interface HuntKeywordFormProps {
  userId: string;
  lookbackDays: HuntLookbackDays;
  onClose: () => void;
  onSuccess: (data: HuntAmazefResponse) => void;
}

export function HuntKeywordForm({
  userId,
  lookbackDays: initialLookbackDays,
  onClose,
  onSuccess,
}: HuntKeywordFormProps) {
  const [keyword, setKeyword] = useState("");
  const [lookbackDays, setLookbackDays] = useState<HuntLookbackDays>(initialLookbackDays);
  const [notice, setNotice] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleHunt() {
    if (!keyword.trim()) {
      setNotice("Please enter a keyword to hunt.");
      setIsSuccess(false);
      return;
    }

    setIsSubmitting(true);
    setNotice("");
    setIsSuccess(false);

    try {
      const response = await fetch("/api/hunt/amazef", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, query: keyword.trim(), lookbackDays }),
      });

      const data = (await response.json()) as HuntAmazefResponse & { error?: string };

      if (!response.ok) {
        setNotice(data.error ?? "Hunt failed. Please try again.");
        return;
      }

      setIsSuccess(true);
      setNotice(data.message ?? "Hunt completed successfully!");
      onSuccess(data);
      setKeyword("");
    } catch {
      setNotice("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-brand/20 bg-gradient-to-br from-brand-light/80 to-white p-6 shadow-sm">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-[#111827]">Hunt a new product</h3>
          <p className="mt-1 text-sm text-[#6B7280]">
            Find the most sold product for your keyword within the selected time range.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9CA3AF] transition-colors hover:bg-gray-100 hover:text-[#374151]"
          aria-label="Close"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
            <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="hunt-keyword" className="mb-1.5 block text-sm font-semibold text-[#374151]">
            Product Keyword
          </label>
          <input
            id="hunt-keyword"
            type="text"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setNotice("");
              setIsSuccess(false);
            }}
            placeholder="e.g. wireless headphones, yoga mat, smart watch..."
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[15px] text-[#111827] shadow-sm outline-none transition-all placeholder:text-[#9CA3AF] focus:border-brand focus:ring-4 focus:ring-brand/10"
          />
        </div>

        <div>
          <label htmlFor="hunt-lookback" className="mb-1.5 block text-sm font-semibold text-[#374151]">
            Time Range
          </label>
          <select
            id="hunt-lookback"
            value={lookbackDays}
            onChange={(e) => setLookbackDays(Number(e.target.value) as HuntLookbackDays)}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[15px] text-[#111827] shadow-sm outline-none transition-all focus:border-brand focus:ring-4 focus:ring-brand/10"
          >
            {HUNT_LOOKBACK_OPTIONS.map((days) => (
              <option key={days} value={days}>
                Last {days} days
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-[#9CA3AF]">
            Defaults to {DEFAULT_HUNT_LOOKBACK_DAYS} days. We pick the product with the highest order count.
          </p>
        </div>

        {notice && (
          <div
            className={`rounded-xl px-4 py-3 text-sm font-medium ${
              isSuccess
                ? "border border-emerald-100 bg-emerald-50 text-emerald-700"
                : "border border-red-100 bg-red-50 text-red-600"
            }`}
          >
            {notice}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleHunt}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(88,66,244,0.35)] transition-all hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Hunting...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                  <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Hunt
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-[#374151] transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
