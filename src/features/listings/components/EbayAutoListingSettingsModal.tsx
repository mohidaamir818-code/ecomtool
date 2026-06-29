"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_EBAY_AUTO_LISTING_SETTINGS,
  normalizeEbayAutoListingSettings,
  validateEbayAutoListingSettingsInput,
  type EbayAutoListingSettings,
} from "@/features/listings/lib/ebay-auto-listing";
import type { VolumePromotionTier } from "@/types/listing-generator";

interface EbayAutoListingSettingsModalProps {
  initialSettings: EbayAutoListingSettings;
  onSave: (settings: EbayAutoListingSettings) => void;
  onClose: () => void;
}

export function EbayAutoListingSettingsModal({
  initialSettings,
  onSave,
  onClose,
}: EbayAutoListingSettingsModalProps) {
  const [form, setForm] = useState<EbayAutoListingSettings>(() =>
    normalizeEbayAutoListingSettings(initialSettings),
  );
  const [error, setError] = useState("");
  const alreadyEnabled = initialSettings.enabled;

  useEffect(() => {
    setForm(normalizeEbayAutoListingSettings(initialSettings));
  }, [initialSettings]);

  function updateField<K extends keyof EbayAutoListingSettings>(
    key: K,
    value: EbayAutoListingSettings[K],
  ) {
    setForm((current) => normalizeEbayAutoListingSettings({ ...current, [key]: value }));
    setError("");
  }

  function updatePromotion(index: number, patch: Partial<VolumePromotionTier>) {
    setForm((current) => {
      const promotions = current.promotions.map((tier, i) =>
        i === index ? { ...tier, ...patch } : tier,
      );
      return normalizeEbayAutoListingSettings({ ...current, promotions });
    });
    setError("");
  }

  function handleSubmit() {
    const next = normalizeEbayAutoListingSettings(form);
    const validationError = validateEbayAutoListingSettingsInput(next);
    if (validationError) {
      setError(validationError);
      return;
    }
    onSave(next);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-[#111827]">eBay auto listing settings</h2>
        <p className="mt-2 text-sm text-[#6B7280]">
          Set your rules once. AI will apply them automatically for every URL you submit.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-[#111827]">eBay platform fee %</span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={form.platformFeePercent}
              onChange={(event) => updateField("platformFeePercent", Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <span className="mt-1 block text-xs text-[#6B7280]">
              Deducted from the price first, then your profit margin is applied on top.
            </span>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[#111827]">Min profit %</span>
            <input
              type="number"
              min={1}
              max={90}
              value={form.minProfitPercent}
              onChange={(event) => updateField("minProfitPercent", Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[#111827]">Max profit %</span>
            <input
              type="number"
              min={1}
              max={95}
              value={form.maxProfitPercent}
              onChange={(event) => updateField("maxProfitPercent", Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[#111827]">Min stock</span>
            <input
              type="number"
              min={1}
              value={form.minStock}
              onChange={(event) => updateField("minStock", Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[#111827]">Max stock</span>
            <input
              type="number"
              min={1}
              value={form.maxStock}
              onChange={(event) => updateField("maxStock", Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-[#111827]">Volume discounts</h3>
          <p className="mt-1 text-xs text-[#6B7280]">
            Enable any tier to include volume discounts on your eBay listings.
          </p>
          <div className="mt-3 space-y-2">
            {form.promotions.map((tier, index) => (
              <div
                key={tier.quantity}
                className="flex flex-col gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <label className="flex items-center gap-2 text-sm font-medium text-[#111827]">
                  <input
                    type="checkbox"
                    checked={tier.enabled}
                    onChange={(event) => updatePromotion(index, { enabled: event.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
                  />
                  Buy {tier.quantity}, get discount
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={90}
                    disabled={!tier.enabled}
                    value={tier.discountPercent}
                    onChange={(event) =>
                      updatePromotion(index, { discountPercent: Number(event.target.value) || 0 })
                    }
                    className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-brand disabled:bg-white"
                  />
                  <span className="text-xs text-[#6B7280]">% off</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-emerald-100 bg-emerald-50/60 px-4 py-3">
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
              checked={form.smartPricingEnabled}
              onChange={(event) => updateField("smartPricingEnabled", event.target.checked)}
            />
            <span>
              <span className="font-medium text-[#111827]">Smart pricing (recommended)</span>
              <span className="mt-1 block text-xs text-[#6B7280]">
                AI checks the live eBay average price for each product and lists just below it
                to sell faster — while always keeping your minimum profit. If the market is too
                cheap, it falls back to your profit % rules.
              </span>
            </span>
          </label>
          {form.smartPricingEnabled ? (
            <label className="mt-3 block text-sm">
              <span className="font-medium text-[#111827]">Undercut market by %</span>
              <input
                type="number"
                min={0}
                max={50}
                step={0.5}
                value={form.marketUndercutPercent}
                onChange={(event) =>
                  updateField("marketUndercutPercent", Number(event.target.value))
                }
                className="mt-1 w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
              />
              <span className="mt-1 block text-xs text-[#6B7280]">
                e.g. 3% lists a bit below the average competitor price.
              </span>
            </label>
          ) : null}
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
            checked={form.listVeroProducts}
            onChange={(event) => updateField("listVeroProducts", event.target.checked)}
          />
          <span>
            <span className="font-medium text-[#111827]">List VeRO products</span>
            <span className="mt-1 block text-xs text-[#6B7280]">
              When off, products that fail VeRO are stopped automatically.
            </span>
          </span>
        </label>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-[#374151] hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Save{alreadyEnabled ? " settings" : " & enable auto listing"}
          </button>
        </div>

        <p className="mt-4 text-xs text-[#9CA3AF]">
          Defaults: profit {DEFAULT_EBAY_AUTO_LISTING_SETTINGS.minProfitPercent}–
          {DEFAULT_EBAY_AUTO_LISTING_SETTINGS.maxProfitPercent}%, stock{" "}
          {DEFAULT_EBAY_AUTO_LISTING_SETTINGS.minStock}–{DEFAULT_EBAY_AUTO_LISTING_SETTINGS.maxStock}.
        </p>
      </div>
    </div>
  );
}
