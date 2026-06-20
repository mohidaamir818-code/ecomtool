"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CreatePolicyType,
  EbayBusinessPolicies,
  EbayPoliciesResponse,
  ListingDraft,
} from "@/types/listing-generator";

interface ListingShippingReturnsStepProps {
  userId: string;
  draft: ListingDraft;
  onChange: (patch: Partial<ListingDraft>) => void;
}

type CreatingPolicyType = CreatePolicyType | null;

export function ListingShippingReturnsStep({
  userId,
  draft,
  onChange,
}: ListingShippingReturnsStepProps) {
  const [policies, setPolicies] = useState<EbayPoliciesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creatingPolicy, setCreatingPolicy] = useState<CreatingPolicyType>(null);
  const initialPoliciesSet = useRef(false);
  const draftPoliciesRef = useRef(draft.ebayPolicies);

  useEffect(() => {
    draftPoliciesRef.current = draft.ebayPolicies;
  }, [draft.ebayPolicies]);

  const loadPolicies = useCallback(async (refresh = false) => {
    setLoading(true);
    setError("");
    try {
      const refreshParam = refresh ? "&refresh=true" : "";
      const response = await fetch(
        `/api/ebay/policies?userId=${encodeURIComponent(userId)}${refreshParam}`,
      );
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

  async function handleCreatePolicy(policyType: CreatePolicyType) {
    setCreatingPolicy(policyType);
    setError("");
    try {
      const response = await fetch("/api/ebay/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, policyType }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create eBay policy.");
      }

      const snapshot = data as EbayPoliciesResponse & { success?: boolean };
      setPolicies(snapshot);

      const createdPolicy =
        policyType === "fulfillment"
          ? snapshot.fulfillment[snapshot.fulfillment.length - 1]
          : policyType === "payment"
            ? snapshot.payment[snapshot.payment.length - 1]
            : snapshot.return[snapshot.return.length - 1];

      const current = draft.ebayPolicies ?? snapshot.selected;
      if (createdPolicy) {
        if (policyType === "fulfillment") {
          onChange({ ebayPolicies: { ...current, fulfillmentPolicyId: createdPolicy.policyId } });
        } else if (policyType === "payment") {
          onChange({ ebayPolicies: { ...current, paymentPolicyId: createdPolicy.policyId } });
        } else {
          onChange({ ebayPolicies: { ...current, returnPolicyId: createdPolicy.policyId } });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create eBay policy.");
    } finally {
      setCreatingPolicy(null);
    }
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
        <p className="break-words rounded border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
        <button
          type="button"
          onClick={() => void loadPolicies(true)}
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

  const createButtonClassName =
    "mt-2 text-sm font-semibold text-[#3665F3] hover:underline disabled:cursor-not-allowed disabled:text-[#9CA3AF]";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-[#111827]">Shipping &amp; Returns</h2>
        <p className="mt-1 text-sm text-[#6B7280]">
          Choose the business policies eBay will use when this listing goes live.
        </p>
      </div>

      {creatingPolicy ? (
        <p className="text-sm text-[#6B7280]">Creating new policy…</p>
      ) : null}

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
          <button
            type="button"
            disabled={creatingPolicy !== null}
            onClick={() => void handleCreatePolicy("fulfillment")}
            className={createButtonClassName}
          >
            + Create New Policy
          </button>
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
          <button
            type="button"
            disabled={creatingPolicy !== null}
            onClick={() => void handleCreatePolicy("payment")}
            className={createButtonClassName}
          >
            + Create New Policy
          </button>
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
          <button
            type="button"
            disabled={creatingPolicy !== null}
            onClick={() => void handleCreatePolicy("return")}
            className={createButtonClassName}
          >
            + Create New Policy
          </button>
        </label>
      </div>
    </div>
  );
}
