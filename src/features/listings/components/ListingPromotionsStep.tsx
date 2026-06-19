"use client";

import type { VolumePromotionTier } from "@/types/listing-generator";

interface ListingPromotionsStepProps {
  promotions: VolumePromotionTier[];
  onChange: (promotions: VolumePromotionTier[]) => void;
}

export function ListingPromotionsStep({ promotions, onChange }: ListingPromotionsStepProps) {
  function updateTier(index: number, patch: Partial<VolumePromotionTier>) {
    onChange(promotions.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)));
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-[#111827]">Volume discounts</h2>
        <p className="mt-1 text-sm text-[#6B7280]">
          Optional eBay volume pricing. Enable any deal you want included on the listing.
        </p>
      </div>

      <div className="space-y-3">
        {promotions.map((tier, index) => (
          <div
            key={tier.quantity}
            className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <label className="flex items-center gap-3 text-sm font-medium text-[#111827]">
              <input
                type="checkbox"
                checked={tier.enabled}
                onChange={(event) => updateTier(index, { enabled: event.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
              />
              Buy {tier.quantity}, get discount
            </label>

            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="90"
                disabled={!tier.enabled}
                value={tier.discountPercent}
                onChange={(event) =>
                  updateTier(index, { discountPercent: Number(event.target.value) || 0 })
                }
                className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand disabled:bg-gray-50"
              />
              <span className="text-sm text-[#6B7280]">% off</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
