"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EbayBusinessPolicies, EbayPoliciesResponse, ListingDraft } from "@/types/listing-generator";

interface ListingShippingReturnsStepProps {
  userId: string;
  draft: ListingDraft;
  onChange: (patch: Partial<ListingDraft>) => void;
}

export function ListingShippingReturnsStep({
  userId,
  draft,
  onChange,
}: ListingShippingReturnsStepProps) {
  const [policies, setPolicies] = useState<EbayPoliciesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const initialPoliciesSet = useRef(false);
  const draftPoliciesRef = useRef(draft.ebayPolicies);

  useEffect(() => {
    draftPoliciesRef.current = draft.ebayPolicies;
  }, [draft.ebayPolicies]);

  const loadPolicies = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/ebay/policies?userId=${encodeURIComponent(userId)}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load eBay policies.");
      }
      const snapshot = data as EbayPoliciesResponse & { success?: boolean };
      setPolicies(snapshot);

      if (!initialPoliciesSet.current && !draftPoliciesRef.current) {
        initialPoliciesSet.current = true;
        onChange({ ebayPolicies: snapshot.selected });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load eBay policies.");
    } finally {
      setLoading(false);
    }
  }, [userId, onChange]);

  useEffect(() => {
    void loadPolicies();
  }, [loadPolicies]);

  function updatePolicy(patch: Partial<EbayBusinessPolicies>) {
    const current = draft.ebayPolicies ?? policies?.selected;
    if (!current) return;
    onChange({ ebayPolicies: { ...current, ...patch } });
  }

  const selected = draft.ebayPolicies ?? policies?.selected;

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-[#111827]">Shipping &amp; Returns</h2>
          <p className="mt-1 text-sm text-[#6B7280]">Loading your eBay business policies…</p>
        </div>
        <div className="h-24 animate-pulse rounded border border-[#E5E5E5] bg-[#F9FAFB]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-[#111827]">Shipping &amp; Returns</h2>
          <p className="mt-1 text-sm text-[#6B7280]">
            Select shipping, payment, and return policies for this listing.
          </p>
        </div>
        <p className="rounded border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => void loadPolicies()}
          className="rounded border border-[#C5C5C5] bg-white px-4 py-2 text-sm font-medium text-[#191919] hover:bg-[#F7F7F7]"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!policies || !selected) {
    return null;
  }

  const selectClassName =
    "mt-2 w-full rounded border border-[#C5C5C5] bg-white px-3 py-2 text-sm text-[#191919] outline-none focus:border-[#3665F3]";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-[#111827]">Shipping &amp; Returns</h2>
        <p className="mt-1 text-sm text-[#6B7280]">
          Choose the business policies eBay will use when this listing goes live.
        </p>
      </div>

      <div className="space-y-4 rounded border border-[#E5E5E5] bg-white px-4 py-4">
        <label className="block">
          <span className="text-sm font-medium text-[#191919]">Shipping Policy</span>
          <select
            value={selected.fulfillmentPolicyId}
            onChange={(event) => updatePolicy({ fulfillmentPolicyId: event.target.value })}
            className={selectClassName}
          >
            {policies.fulfillment.map((policy) => (
              <option key={policy.policyId} value={policy.policyId}>
                {policy.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[#191919]">Payment Policy</span>
          <select
            value={selected.paymentPolicyId}
            onChange={(event) => updatePolicy({ paymentPolicyId: event.target.value })}
            className={selectClassName}
          >
            {policies.payment.map((policy) => (
              <option key={policy.policyId} value={policy.policyId}>
                {policy.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[#191919]">Return Policy</span>
          <select
            value={selected.returnPolicyId}
            onChange={(event) => updatePolicy({ returnPolicyId: event.target.value })}
            className={selectClassName}
          >
            {policies.return.map((policy) => (
              <option key={policy.policyId} value={policy.policyId}>
                {policy.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
