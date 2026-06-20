"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ListingPricingPreferences,
  ListingProductSource,
  PricingBreakdown,
  SellerPreferences,
} from "@/types/listing-generator";
import { defaultFeePreferencesForCurrency, defaultSellerPreferences } from "@/types/listing-generator";
import { calculatePricingBreakdown, resolveBaseAliPrice } from "@/lib/listings/pricing";
import {
  feePrefsToSellerPreferences,
  sellerPreferencesToFeePrefs,
} from "@/lib/listings/seller-preferences-mappers";
import { formatListingPrice } from "@/features/listings/lib/draft-utils";
import { persistSellerPreferences } from "@/features/listings/lib/seller-preferences-client";

interface ListingProfitCalculatorStepProps {
  userId: string;
  product: ListingProductSource;
  preferences: ListingPricingPreferences | null;
  manualPriceOverride: number | null;
  sellerPreferences: SellerPreferences | null;
  sellerPreferencesLoading: boolean;
  onChange: (prefs: ListingPricingPreferences, breakdown: PricingBreakdown, manualPrice: number | null) => void;
  onSellerPreferencesChange: (preferences: SellerPreferences) => void;
  onSaved?: () => void;
}

export function ListingProfitCalculatorStep({
  userId,
  product,
  preferences,
  manualPriceOverride,
  sellerPreferences,
  sellerPreferencesLoading,
  onChange,
  onSellerPreferencesChange,
  onSaved,
}: ListingProfitCalculatorStepProps) {
  const currency = product.currency === "USD" ? "GBP" : product.currency;
  const symbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$";

  const [prefs, setPrefs] = useState<ListingPricingPreferences>(
    preferences ?? defaultFeePreferencesForCurrency(currency),
  );
  const [manualPrice, setManualPrice] = useState<string>(
    manualPriceOverride != null ? String(manualPriceOverride) : "",
  );
  const sellerPrefsRef = useRef<SellerPreferences>(defaultSellerPreferences(currency));
  const saveTimerRef = useRef<number | null>(null);
  const skipAutoSaveRef = useRef(true);

  useEffect(() => {
    if (!sellerPreferences) return;
    sellerPrefsRef.current = sellerPreferences;
    setPrefs(sellerPreferencesToFeePrefs(sellerPreferences));
    skipAutoSaveRef.current = true;
    window.setTimeout(() => {
      skipAutoSaveRef.current = false;
    }, 0);
  }, [sellerPreferences]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  const baseAliPrice = resolveBaseAliPrice(product);
  const breakdown = calculatePricingBreakdown(baseAliPrice, prefs);
  const displayPrice =
    manualPrice && Number.isFinite(Number(manualPrice)) && Number(manualPrice) > 0
      ? Number(manualPrice)
      : breakdown.recommendedPrice;

  function scheduleSave(nextSellerPrefs: SellerPreferences) {
    sellerPrefsRef.current = nextSellerPrefs;
    onSellerPreferencesChange(nextSellerPrefs);
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void persistSellerPreferences(userId, nextSellerPrefs)
        .then(() => onSaved?.())
        .catch(() => undefined);
    }, 1500);
  }

  function updatePref<K extends keyof ListingPricingPreferences>(
    key: K,
    value: ListingPricingPreferences[K],
  ) {
    setPrefs((current) => {
      const next = { ...current, [key]: value };
      if (!skipAutoSaveRef.current) {
        scheduleSave(feePrefsToSellerPreferences(next, sellerPrefsRef.current));
      }
      return next;
    });
  }

  function handleApply() {
    const nextBreakdown = {
      ...calculatePricingBreakdown(baseAliPrice, prefs),
      recommendedPrice: displayPrice,
    };
    onChange(prefs, nextBreakdown, manualPrice ? displayPrice : null);

    const merged = feePrefsToSellerPreferences(prefs, sellerPrefsRef.current);
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    sellerPrefsRef.current = merged;
    onSellerPreferencesChange(merged);
    void persistSellerPreferences(userId, merged)
      .then(() => onSaved?.())
      .catch(() => undefined);
  }

  if (sellerPreferencesLoading) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <p className="text-sm text-[#6B7280]">Loading your pricing preferences...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-[#111827]">Set Your Pricing Preferences</h2>
        <p className="mt-1 text-sm text-[#6B7280]">
          Configure fees and profit margin. We&apos;ll calculate your recommended eBay price automatically.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-[#111827]">
          eBay Final Value Fee (%)
          <input
            type="number"
            step="0.01"
            value={prefs.ebayFinalValueFeePercent}
            onChange={(e) => updatePref("ebayFinalValueFeePercent", Number(e.target.value) || 0)}
            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
          />
        </label>
        <label className="block text-sm font-medium text-[#111827]">
          eBay Transaction Fee ({symbol})
          <input
            type="number"
            step="0.01"
            value={prefs.ebayTransactionFee}
            onChange={(e) => updatePref("ebayTransactionFee", Number(e.target.value) || 0)}
            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
          />
        </label>
        <label className="block text-sm font-medium text-[#111827]">
          PayPal / Payment Fee (%)
          <input
            type="number"
            step="0.01"
            value={prefs.paymentFeePercent}
            onChange={(e) => updatePref("paymentFeePercent", Number(e.target.value) || 0)}
            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
          />
        </label>
        <label className="block text-sm font-medium text-[#111827]">
          Your Profit Margin (%)
          <input
            type="number"
            step="0.1"
            value={prefs.profitMarginPercent}
            onChange={(e) => updatePref("profitMarginPercent", Number(e.target.value) || 0)}
            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
          />
        </label>
        <label className="block text-sm font-medium text-[#111827] sm:col-span-2">
          Shipping Cost ({symbol})
          <input
            type="number"
            step="0.01"
            value={prefs.shippingCost}
            onChange={(e) => updatePref("shippingCost", Number(e.target.value) || 0)}
            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
          />
        </label>
      </div>

      <div className="rounded-xl border border-brand/20 bg-brand-light/30 p-5">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-[#6B7280]">AliExpress Cost</dt>
            <dd className="font-semibold text-[#111827]">{formatListingPrice(baseAliPrice, currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#6B7280]">eBay + Payment Fees</dt>
            <dd className="font-semibold text-[#111827]">{formatListingPrice(breakdown.ebayFees, currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#6B7280]">Your Profit</dt>
            <dd className="font-semibold text-emerald-700">
              {formatListingPrice(breakdown.profit, currency)} ({breakdown.profitPercent}%)
            </dd>
          </div>
          <div className="flex justify-between border-t border-brand/10 pt-2">
            <dt className="font-semibold text-[#111827]">Recommended eBay Price</dt>
            <dd className="text-lg font-bold text-brand">
              {formatListingPrice(breakdown.recommendedPrice, currency)}
            </dd>
          </div>
        </dl>
      </div>

      <label className="block text-sm font-medium text-[#111827]">
        Manual price override (optional)
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={manualPrice}
          onChange={(e) => setManualPrice(e.target.value)}
          placeholder={breakdown.recommendedPrice.toFixed(2)}
          className="mt-2 w-full max-w-xs rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
        />
      </label>

      <button
        type="button"
        onClick={handleApply}
        className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
      >
        Apply pricing
      </button>
    </div>
  );
}
