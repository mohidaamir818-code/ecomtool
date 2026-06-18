"use client";

import { useState } from "react";
import type { CompetitorUpdateMode, CompetitorWatchDetailResponse } from "@/types/competitor";

interface AddCompetitorWatchFlowProps {
  userId: string;
  onAdded: () => void;
}

export function AddCompetitorWatchFlow({ userId, onAdded }: AddCompetitorWatchFlowProps) {
  const [productQuery, setProductQuery] = useState("");
  const [userPrice, setUserPrice] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [updateMode, setUpdateMode] = useState<CompetitorUpdateMode>("auto_24h");
  const [customHours, setCustomHours] = useState("24");
  const [notice, setNotice] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resetForm() {
    setShowSchedule(false);
    setNotice("");
    setIsError(false);
  }

  async function handleAdd() {
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

    if (updateMode === "custom") {
      const hours = Number(customHours);
      if (!Number.isFinite(hours) || hours <= 0) {
        setNotice("Enter valid custom hours.");
        setIsError(true);
        return;
      }
    }

    setIsSubmitting(true);
    setNotice("");
    setIsError(false);

    try {
      const response = await fetch("/api/competitors/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          productQuery: productQuery.trim(),
          userPrice: price,
          updateMode,
          customHours: updateMode === "custom" ? Number(customHours) : undefined,
        }),
      });

      const data = (await response.json()) as CompetitorWatchDetailResponse;

      if (!response.ok) {
        setNotice(data.error ?? "Failed to add competitor watch.");
        setIsError(true);
        return;
      }

      setProductQuery("");
      setUserPrice("");
      resetForm();
      setNotice(data.message ?? "Competitor watch added. Check your email for the first report.");
      setIsError(false);
      onAdded();
    } catch {
      setNotice("Network error while adding competitor watch.");
      setIsError(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-br from-brand-light/60 via-white to-white shadow-sm">
      <div className="border-b border-brand/10 bg-white/70 px-6 py-5">
        <h2 className="text-lg font-bold text-[#111827]">Add competitor watch</h2>
        <p className="mt-1 text-sm text-[#6B7280]">
          Enter your product title and price. We check Amazef on your schedule and email you when
          sellers list below your price.
        </p>
      </div>

      <div className="space-y-5 p-6">
        <div>
          <label htmlFor="watch-product" className="mb-1.5 block text-sm font-semibold text-[#374151]">
            Product keyword or full name
          </label>
          <textarea
            id="watch-product"
            value={productQuery}
            onChange={(event) => setProductQuery(event.target.value)}
            rows={3}
            placeholder="e.g. wireless headphones, or paste the full long product title..."
            className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-[15px] leading-relaxed text-[#111827] shadow-sm outline-none transition-all placeholder:text-[#9CA3AF] focus:border-brand focus:ring-4 focus:ring-brand/10"
          />
        </div>

        <div>
          <label htmlFor="watch-price" className="mb-1.5 block text-sm font-semibold text-[#374151]">
            Your selling price
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-semibold text-[#6B7280]">
              £
            </span>
            <input
              id="watch-price"
              type="number"
              min="0.01"
              step="0.01"
              value={userPrice}
              onChange={(event) => setUserPrice(event.target.value)}
              placeholder="9.00"
              className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-9 pr-4 text-[15px] text-[#111827] shadow-sm outline-none transition-all placeholder:text-[#9CA3AF] focus:border-brand focus:ring-4 focus:ring-brand/10"
            />
          </div>
        </div>

        {!showSchedule ? (
          <button
            type="button"
            onClick={() => setShowSchedule(true)}
            disabled={!productQuery.trim() || !userPrice}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(88,66,244,0.35)] transition-all hover:bg-brand-dark disabled:opacity-60"
          >
            Add for tracking
          </button>
        ) : (
          <div className="space-y-4 border-t border-gray-100 pt-5">
            <p className="text-sm font-semibold text-[#374151]">How often should we check competitors?</p>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 hover:border-brand/30">
                <input
                  type="radio"
                  name="watchUpdateMode"
                  checked={updateMode === "auto_24h"}
                  onChange={() => setUpdateMode("auto_24h")}
                />
                <span className="text-sm text-[#374151]">Every 24 hours (email on each check)</span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 hover:border-brand/30">
                <input
                  type="radio"
                  name="watchUpdateMode"
                  checked={updateMode === "custom"}
                  onChange={() => setUpdateMode("custom")}
                />
                <span className="text-sm text-[#374151]">Custom interval (hours)</span>
              </label>
              {updateMode === "custom" && (
                <input
                  type="number"
                  min="1"
                  value={customHours}
                  onChange={(event) => setCustomHours(event.target.value)}
                  className="ml-7 w-32 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="Hours"
                />
              )}
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 hover:border-brand/30">
                <input
                  type="radio"
                  name="watchUpdateMode"
                  checked={updateMode === "manual"}
                  onChange={() => setUpdateMode("manual")}
                />
                <span className="text-sm text-[#374151]">Manual — I will check updates myself</span>
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleAdd}
                disabled={isSubmitting}
                className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
              >
                {isSubmitting ? "Adding..." : "Confirm add"}
              </button>
              <button
                type="button"
                onClick={() => setShowSchedule(false)}
                className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-[#374151] hover:bg-gray-50"
              >
                Back
              </button>
            </div>
          </div>
        )}

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
      </div>
    </div>
  );
}
