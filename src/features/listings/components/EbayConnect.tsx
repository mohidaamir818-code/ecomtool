"use client";

import { useCallback, useEffect, useState } from "react";
import type { EbayConnectionStatus, GeneratedListing, ListingProductSource } from "@/types/listing-generator";

interface EbayConnectProps {
  userId: string;
  listing: GeneratedListing | null;
  product: ListingProductSource | null;
  veroSafe: boolean;
  disabled?: boolean;
  onListed?: (listingUrl: string | null) => void;
}

export function EbayConnect({
  userId,
  listing,
  product,
  veroSafe,
  disabled = false,
  onListed,
}: EbayConnectProps) {
  const [status, setStatus] = useState<EbayConnectionStatus>({
    connected: false,
    ebayUsername: null,
    accessTokenExpiresAt: null,
  });
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [listingLoading, setListingLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

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
    if (!listing || !product) return;

    setListingLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch("/api/ebay/list-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, listing, product }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Failed to list on eBay.");
        setIsError(true);
        return;
      }

      const listingUrl = data.result?.listingUrl ?? null;
      setMessage(
        listingUrl
          ? `Listed on eBay successfully.`
          : "Listing submitted to eBay. It may take a moment to appear in your store.",
      );
      onListed?.(listingUrl);
    } catch {
      setMessage("Network error while listing on eBay.");
      setIsError(true);
    } finally {
      setListingLoading(false);
    }
  }

  const canList = Boolean(listing && product && veroSafe && status.connected && !disabled);

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-[#111827]">eBay connection</h2>
          <p className="mt-1 text-sm text-[#6B7280]">
            Connect your seller account to publish AI-generated listings.
          </p>
        </div>

        {loadingStatus ? (
          <span className="text-xs text-[#9CA3AF]">Checking...</span>
        ) : status.connected ? (
          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Connected{status.ebayUsername ? ` · ${status.ebayUsername}` : ""}
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-[#6B7280]">
            Not connected
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {!status.connected ? (
          <button
            type="button"
            disabled={disabled || loadingStatus}
            onClick={handleConnect}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            Connect eBay Account
          </button>
        ) : (
          <button
            type="button"
            disabled={!canList || listingLoading}
            onClick={() => void handleListOnEbay()}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {listingLoading ? "Listing..." : "List on eBay"}
          </button>
        )}
      </div>

      {!veroSafe && listing ? (
        <p className="mt-3 text-xs text-red-600">
          VeRO check must pass before you can list this product.
        </p>
      ) : null}

      {message ? (
        <p className={`mt-3 text-sm ${isError ? "text-red-600" : "text-emerald-700"}`}>{message}</p>
      ) : null}
    </div>
  );
}
