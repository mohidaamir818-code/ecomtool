"use client";

import { parseDeliveryDaysFromText } from "@/lib/listings/ebay-fulfillment-policy-match";
import type { EbayPolicyOption } from "@/types/listing-generator";

interface EbayAutoListingFulfillmentPickerProps {
  aliExpressShippingLabel: string;
  policies: EbayPolicyOption[];
  selectedPolicyId: string;
  onSelect: (policyId: string) => void;
}

function formatPolicyLabel(policy: EbayPolicyOption): string {
  const days = parseDeliveryDaysFromText(`${policy.name} ${policy.description ?? ""}`);
  if (!days) return policy.name;
  if (days.minDays === days.maxDays) {
    return `${policy.name} (${days.maxDays} days)`;
  }
  return `${policy.name} (${days.minDays}–${days.maxDays} days)`;
}

export function EbayAutoListingFulfillmentPicker({
  aliExpressShippingLabel,
  policies,
  selectedPolicyId,
  onSelect,
}: EbayAutoListingFulfillmentPickerProps) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-[#111827]">Choose a shipping policy</h3>
      <p className="mt-2 text-sm text-amber-900">
        AliExpress delivery for this product is{" "}
        <span className="font-semibold">{aliExpressShippingLabel}</span>. None of your eBay
        postage policies are automatically longer than that. Select the policy you want to use,
        then click <span className="font-semibold">Continue listing</span>.
      </p>

      {policies.length > 0 ? (
        <label className="mt-4 block">
          <span className="text-sm font-medium text-[#111827]">Postage policy</span>
          <select
            value={selectedPolicyId}
            onChange={(event) => onSelect(event.target.value)}
            className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#111827] outline-none focus:border-brand"
          >
            {policies.map((policy) => (
              <option key={policy.policyId} value={policy.policyId}>
                {formatPolicyLabel(policy)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="mt-4 text-sm text-red-600">
          No postage policies found on your eBay account. Create one in eBay Seller Hub, then try
          again.
        </p>
      )}
    </div>
  );
}
