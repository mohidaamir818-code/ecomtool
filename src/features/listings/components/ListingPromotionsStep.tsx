"use client";

import { useEffect, useRef } from "react";
import type { ListingPlatform, SellerPreferences, VolumePromotionTier } from "@/types/listing-generator";
import { promotionsToSellerPreferences } from "@/lib/listings/seller-preferences-mappers";
import { listingPlatformLabel } from "@/features/listings/lib/vero-platform";
import { persistSellerPreferences } from "@/features/listings/lib/seller-preferences-client";

interface ListingPromotionsStepProps {
  userId: string;
  promotions: VolumePromotionTier[];
  sellerPreferences: SellerPreferences;
  platform?: ListingPlatform;
  onChange: (promotions: VolumePromotionTier[]) => void;
  onSellerPreferencesChange: (preferences: SellerPreferences) => void;
  onSaved?: () => void;
}

export function ListingPromotionsStep({
  userId,
  promotions,
  sellerPreferences,
  platform = "ebay",
  onChange,
  onSellerPreferencesChange,
  onSaved,
}: ListingPromotionsStepProps) {
  const platformName = listingPlatformLabel(platform);
  const saveTimerRef = useRef<number | null>(null);
  const sellerPrefsRef = useRef(sellerPreferences);

  useEffect(() => {
    sellerPrefsRef.current = sellerPreferences;
  }, [sellerPreferences]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  function scheduleSave(nextPromotions: VolumePromotionTier[]) {
    const merged = promotionsToSellerPreferences(nextPromotions, sellerPrefsRef.current);
    sellerPrefsRef.current = merged;
    onSellerPreferencesChange(merged);
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void persistSellerPreferences(userId, sellerPrefsRef.current)
        .then(() => onSaved?.())
        .catch(() => undefined);
    }, 1500);
  }

  function updateTier(index: number, patch: Partial<VolumePromotionTier>) {
    const next = promotions.map((tier, i) => (i === index ? { ...tier, ...patch } : tier));
    onChange(next);
    scheduleSave(next);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-[#111827]">Volume discounts</h2>
        <p className="mt-1 text-sm text-[#6B7280]">
          Would you like to add volume discounts? Enable any tier to include in your {platformName}{" "}
          listing.
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
