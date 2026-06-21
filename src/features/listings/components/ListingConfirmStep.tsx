"use client";

import { useCallback, useEffect, useState } from "react";
import type { EbayConnectionStatus, ListingDraft } from "@/types/listing-generator";
import {
  formatListingPrice,
  getSelectedPhotos,
  summarizeDeals,
} from "@/features/listings/lib/draft-utils";

interface ListingConfirmStepProps {
  userId: string;
  draft: ListingDraft;
  disabled?: boolean;
  addressConfirmed?: boolean;
  onListed: (listingUrl: string | null) => void;
}

export function ListingConfirmStep({
  userId,
  draft,
  disabled = false,
  addressConfirmed = false,
  onListed,
}: ListingConfirmStepProps) {
  const [status, setStatus] = useState<EbayConnectionStatus>({
    connected: false,
    ebayUsername: null,
    accessTokenExpiresAt: null,
    addressConfirmed: false,
  });
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [listingLoading, setListingLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [listingUrl, setListingUrl] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const response = await fetch(`/api/ebay/status?userId=${encodeURIComponent(userId)}`);
      const data = await response.json();
      if (response.ok) {
        setStatus({
          connected: Boolean(data.connected),
          ebayUsername: data.ebayUsername ?? null,
          accessTokenExpiresAt: data.accessTokenExpiresAt ?? null,
          addressConfirmed: Boolean(data.addressConfirmed),
        });
      }
    } finally {
      setLoadingStatus(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  function handleConnect() {
    window.location.href = `/api/ebay/auth?userId=${encodeURIComponent(userId)}`;
  }

  async function handleListOnEbay() {
    setListingLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch("/api/ebay/list-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, draft }),
      });

      const data = (await response.json()) as {
        error?: string;
        details?: string;
        status?: number;
        result?: { listingUrl?: string | null };
      };

      if (!response.ok) {
        const parts = [data.error ?? "Failed to list on eBay."];
        if (data.details) {
          const detailsText = String(data.details);
          parts.push(detailsText.length > 2000 ? `${detailsText.slice(0, 2000)}...` : detailsText);
        }
        if (data.status) parts.push(`HTTP ${data.status}`);
        setMessage(parts.join("\n\n"));
        setIsError(true);
        return;
      }

      const url = data.result?.listingUrl ?? null;
      setListingUrl(url);
      setMessage(url ? "Listed on eBay successfully." : "Listing submitted to eBay.");
      onListed(url);
    } catch {
      setMessage("Network error while listing on eBay.");
      setIsError(true);
    } finally {
      setListingLoading(false);
    }
  }

  const selectedPhotos = getSelectedPhotos(draft).length;
  const dealsSummary = summarizeDeals(draft.promotions);

  const canList =
    status.connected &&
    (addressConfirmed || status.addressConfirmed) &&
    !disabled &&
    !listingLoading &&
    !listingUrl;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-[#111827]">Review and list</h2>
        <p className="mt-1 text-sm text-[#6B7280]">
          Confirm your listing details before publishing to eBay.
        </p>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-[#6B7280]">Title</dt>
            <dd className="text-right font-medium text-[#111827]">{draft.listing.seoTitle}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#6B7280]">Price</dt>
            <dd className="font-medium text-[#111827]">
              {formatListingPrice(draft.listing.suggestedPrice, draft.listing.currency)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#6B7280]">Variants</dt>
            <dd className="font-medium text-[#111827]">{draft.variants.length}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#6B7280]">Photos</dt>
            <dd className="font-medium text-[#111827]">{selectedPhotos}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#6B7280]">Deals</dt>
            <dd className="text-right font-medium text-[#111827]">{dealsSummary}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#6B7280]">Brand</dt>
            <dd className="font-medium text-[#111827]">Unbranded</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#6B7280]">Product SKU</dt>
            <dd className="font-mono text-right text-sm font-medium text-[#111827]">
              {draft.product.internalProductSku ?? "—"}
            </dd>
          </div>
          {draft.variants.length > 0 ? (
            <div className="border-t border-gray-100 pt-3">
              <dt className="mb-2 text-[#6B7280]">eBay variant SKUs</dt>
              <dd>
                <ul className="space-y-1 text-right font-mono text-xs text-[#111827]">
                  {draft.variants.map((variant) => (
                    <li key={variant.id}>
                      {variant.label}: {variant.sku || "—"}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
        </dl>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#111827]">eBay account</p>
            <p className="mt-1 text-sm text-[#6B7280]">
              {loadingStatus
                ? "Checking connection..."
                : status.connected
                  ? `Connected${status.ebayUsername ? ` as ${status.ebayUsername}` : ""}`
                  : "Not connected"}
            </p>
          </div>

          {!status.connected ? (
            <button
              type="button"
              disabled={disabled || loadingStatus}
              onClick={handleConnect}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
            >
              Connect eBay Account
            </button>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        disabled={!canList}
        onClick={() => void handleListOnEbay()}
        className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {listingLoading ? "Listing on eBay..." : "List on eBay"}
      </button>

      {!addressConfirmed && !status.addressConfirmed && status.connected ? (
        <p className="text-sm text-amber-700">
          Complete warehouse address setup before listing.
        </p>
      ) : null}

      {message ? (
        <p
          className={`text-sm whitespace-pre-wrap break-words ${isError ? "text-red-600" : "text-emerald-700"}`}
        >
          {message}
        </p>
      ) : null}

      {listingUrl ? (
        <a
          href={listingUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex text-sm font-semibold text-brand hover:underline"
        >
          View listing on eBay
        </a>
      ) : null}
    </div>
  );
}
