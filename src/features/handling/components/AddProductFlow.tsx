"use client";

import { useState } from "react";
import type { HandlingProductData, HandlingUpdateMode } from "@/types/handling";

interface AddProductFlowProps {
  userId: string;
  onAdded: () => void;
}

function formatPreviewPrice(price: number, currency: string): string {
  if (currency === "GBP") return `£${price.toFixed(2)}`;
  if (currency === "USD") return `$${price.toFixed(2)}`;
  return `${currency} ${price.toFixed(2)}`;
}

export function AddProductFlow({ userId, onAdded }: AddProductFlowProps) {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<HandlingProductData | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [updateMode, setUpdateMode] = useState<HandlingUpdateMode>("auto_24h");
  const [customHours, setCustomHours] = useState("12");
  const [notice, setNotice] = useState("");
  const [isError, setIsError] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");

  function resetPreview() {
    setPreview(null);
    setShowSchedule(false);
    setNotice("");
    setIsError(false);
  }

  async function handleFetch() {
    if (!url.trim()) {
      setNotice("Please enter an AliExpress product URL.");
      setIsError(true);
      return;
    }

    setLoadingPreview(true);
    setNotice("");
    setIsError(false);
    resetPreview();
    setPreview(null);

    try {
      const response = await fetch("/api/handling/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, url: url.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setNotice(data.error ?? "Failed to fetch product.");
        setIsError(true);
        return;
      }

      setPreview(data.product);
      setSelectedVariantId(data.product?.selectedVariantId ?? data.product?.variants?.[0]?.id ?? "");
    } catch {
      setNotice("Network error while fetching product.");
      setIsError(true);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleAdd() {
    if (!preview) return;

    if (updateMode === "custom") {
      const hours = Number(customHours);
      if (!Number.isFinite(hours) || hours <= 0) {
        setNotice("Enter valid custom hours.");
        setIsError(true);
        return;
      }
    }

    setSaving(true);
    setNotice("");
    setIsError(false);

    try {
      const response = await fetch("/api/handling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          product: preview,
          updateMode,
          customHours: updateMode === "custom" ? Number(customHours) : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setNotice(data.error ?? "Failed to add product.");
        setIsError(true);
        return;
      }

      setUrl("");
      resetPreview();
      setNotice("Product added for handling!");
      setIsError(false);
      onAdded();
    } catch {
      setNotice("Network error while adding product.");
      setIsError(true);
    } finally {
      setSaving(false);
    }
  }

  function handleVariantChange(variantId: string) {
    if (!preview?.variants?.length) return;
    const variant = preview.variants.find((item) => item.id === variantId);
    if (!variant) return;

    setSelectedVariantId(variantId);
    setPreview({
      ...preview,
      price: variant.price,
      currency: variant.currency,
      stock: variant.stock,
      selectedVariantId: variant.id,
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-br from-brand-light/60 via-white to-white shadow-sm">
      <div className="border-b border-brand/10 bg-white/70 px-6 py-5">
        <h2 className="text-lg font-bold text-[#111827]">Add AliExpress product</h2>
        <p className="mt-1 text-sm text-[#6B7280]">
          Paste a product URL. We fetch price, stock, and orders, then track changes for you.
        </p>
      </div>

      <div className="space-y-5 p-6">
        <div>
          <label htmlFor="handling-url" className="mb-1.5 block text-sm font-semibold text-[#374151]">
            AliExpress product URL
          </label>
          <input
            id="handling-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.aliexpress.com/item/..."
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[15px] text-[#111827] shadow-sm outline-none transition-all placeholder:text-[#9CA3AF] focus:border-brand focus:ring-4 focus:ring-brand/10"
          />
        </div>

        {!preview && (
          <button
            type="button"
            onClick={handleFetch}
            disabled={loadingPreview}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(88,66,244,0.35)] transition-all hover:bg-brand-dark disabled:opacity-60"
          >
            {loadingPreview ? "Fetching..." : "Fetch product"}
          </button>
        )}

        {preview && (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row">
              {preview.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.imageUrl}
                  alt={preview.title}
                  className="h-32 w-32 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-xl bg-brand-light text-brand">
                  No image
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-3 text-base font-bold text-[#111827]">{preview.title}</h3>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <p className="text-[10px] font-medium uppercase text-[#9CA3AF]">Price</p>
                    <p className="text-sm font-bold">{formatPreviewPrice(preview.price, preview.currency)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase text-[#9CA3AF]">Max qty</p>
                    <p className="text-sm font-bold">{preview.stock ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase text-[#9CA3AF]">Orders</p>
                    <p className="text-sm font-bold">{preview.orders ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase text-[#9CA3AF]">Rating</p>
                    <p className="text-sm font-bold">{preview.rating ?? "—"}</p>
                  </div>
                </div>
                {preview.variants && preview.variants.length > 0 ? (
                  <div className="mt-4">
                    <label className="mb-1 block text-[10px] font-medium uppercase text-[#9CA3AF]">
                      Variant
                    </label>
                    <select
                      value={selectedVariantId}
                      onChange={(event) => handleVariantChange(event.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#111827] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                    >
                      {preview.variants.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {variant.label} - {formatPreviewPrice(variant.price, variant.currency)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            </div>

            {!showSchedule ? (
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setShowSchedule(true)}
                  className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
                >
                  Add for handling
                </button>
                <button
                  type="button"
                  onClick={resetPreview}
                  className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-[#374151] hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="mt-5 space-y-4 border-t border-gray-100 pt-5">
                <p className="text-sm font-semibold text-[#374151]">How often should we check for updates?</p>
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 hover:border-brand/30">
                    <input
                      type="radio"
                      name="updateMode"
                      checked={updateMode === "auto_24h"}
                      onChange={() => setUpdateMode("auto_24h")}
                    />
                    <span className="text-sm text-[#374151]">Every 24 hours (email on changes)</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 hover:border-brand/30">
                    <input
                      type="radio"
                      name="updateMode"
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
                      onChange={(e) => setCustomHours(e.target.value)}
                      className="ml-7 w-32 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      placeholder="Hours"
                    />
                  )}
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 hover:border-brand/30">
                    <input
                      type="radio"
                      name="updateMode"
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
                    disabled={saving}
                    className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
                  >
                    {saving ? "Adding..." : "Confirm add"}
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
