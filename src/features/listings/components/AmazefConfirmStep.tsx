"use client";

import { useCallback, useEffect, useState } from "react";
import type { AmazefConnectionStatus, ListingDraft } from "@/types/listing-generator";
import {
  formatListingPrice,
  getSelectedPhotos,
} from "@/features/listings/lib/draft-utils";
import { writeSavedAmazefHandlingTime } from "@/features/listings/lib/amazef-auto-listing";
import { ensureAmazefOffers } from "@/features/listings/lib/amazef-offers";
import { AmazefBestOffersPanel } from "./AmazefBestOffersPanel";

interface AmazefConfirmStepProps {
  userId: string;
  draft: ListingDraft;
  disabled?: boolean;
  refreshKey?: number;
  onChange?: (patch: Partial<ListingDraft>) => void;
  onConnectRequest: () => void;
  onListed: (listingUrl: string | null) => void;
}

export function AmazefConfirmStep({
  userId,
  draft,
  disabled = false,
  refreshKey = 0,
  onChange,
  onConnectRequest,
  onListed,
}: AmazefConfirmStepProps) {
  const [status, setStatus] = useState<AmazefConnectionStatus>({
    connected: false,
    amazefEmail: null,
  });
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [listingLoading, setListingLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [listingUrl, setListingUrl] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const response = await fetch(`/api/amazef/status?userId=${encodeURIComponent(userId)}`);
      const data = await response.json();
      if (response.ok) {
        setStatus({
          connected: Boolean(data.connected),
          amazefEmail: data.amazefEmail ?? null,
        });
      }
    } finally {
      setLoadingStatus(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus, refreshKey]);

  async function handleListOnAmazef() {
    setListingLoading(true);
    setMessage("");
    setIsError(false);

    const handlingTimeLabel = writeSavedAmazefHandlingTime(
      userId,
      draft.product.handlingTimeLabel,
    );
    const draftToList = ensureAmazefOffers({
      ...draft,
      product: {
        ...draft.product,
        handlingTimeLabel,
      },
    });

    try {
      const response = await fetch("/api/amazef/list-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, draft: draftToList }),
      });

      const data = (await response.json()) as {
        error?: string;
        status?: number;
        result?: { listingUrl?: string | null };
      };

      if (!response.ok) {
        const parts = [data.error ?? "Failed to list on Amazef."];
        if (data.status) parts.push(`HTTP ${data.status}`);
        setMessage(parts.join("\n\n"));
        setIsError(true);
        return;
      }

      const url = data.result?.listingUrl ?? null;
      setListingUrl(url);
      setMessage(url ? "Listed on Amazef successfully." : "Listing submitted to Amazef.");
      onListed(url);
    } catch {
      setMessage("Network error while listing on Amazef.");
      setIsError(true);
    } finally {
      setListingLoading(false);
    }
  }

  const selectedPhotos = getSelectedPhotos(draft).length;
  const listingDraft = ensureAmazefOffers(draft);

  const canList = status.connected && !disabled && !listingLoading && !listingUrl;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-[#111827]">Review and list</h2>
        <p className="mt-1 text-sm text-[#6B7280]">
          Confirm your listing details before publishing to Amazef.
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
            <dt className="text-[#6B7280]">Product SKU</dt>
            <dd className="font-mono text-right text-sm font-medium text-[#111827]">
              {draft.product.internalProductSku ?? "—"}
            </dd>
          </div>
          {draft.variants.length > 0 ? (
            <div className="border-t border-gray-100 pt-3">
              <dt className="mb-2 text-[#6B7280]">Variant SKUs</dt>
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
            <p className="text-sm font-semibold text-[#111827]">Amazef account</p>
            <p className="mt-1 text-sm text-[#6B7280]">
              {loadingStatus
                ? "Checking connection..."
                : status.connected
                  ? `Connected${status.amazefEmail ? ` as ${status.amazefEmail}` : ""}`
                  : "Not connected"}
            </p>
          </div>

          {!status.connected ? (
            <button
              type="button"
              disabled={disabled || loadingStatus}
              onClick={onConnectRequest}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
            >
              Connect Amazef Account
            </button>
          ) : null}
        </div>
      </div>

      {onChange ? (
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-[#111827]">Best offer</h3>
          <AmazefBestOffersPanel
            userId={userId}
            draft={listingDraft}
            onChange={onChange}
          />
        </div>
      ) : null}

      <button
        type="button"
        disabled={!canList}
        onClick={() => void handleListOnAmazef()}
        className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {listingLoading ? "Listing on Amazef..." : "List on Amazef"}
      </button>

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
          View listing on Amazef
        </a>
      ) : null}
    </div>
  );
}
