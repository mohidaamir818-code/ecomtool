"use client";

import { useCallback, useEffect, useState } from "react";
import { AddAliUrlModal } from "./AddAliUrlModal";
import type { StoreImportListing } from "@/types/store-import";

interface ImportStoreModalProps {
  userId: string;
  onClose: () => void;
  onLinked: () => void;
}

function formatPrice(price: number, currency: string): string {
  if (currency === "GBP") return `£${price.toFixed(2)}`;
  if (currency === "USD") return `$${price.toFixed(2)}`;
  return `${currency} ${price.toFixed(2)}`;
}

function displayPrice(listing: StoreImportListing): string {
  const prices = listing.variants.map((variant) => variant.price);
  if (prices.length === 0) return formatPrice(0, listing.currency);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return formatPrice(min, listing.currency);
  return `${formatPrice(min, listing.currency)} – ${formatPrice(max, listing.currency)}`;
}

export function ImportStoreModal({ userId, onClose, onLinked }: ImportStoreModalProps) {
  const [listings, setListings] = useState<StoreImportListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [addUrlListing, setAddUrlListing] = useState<StoreImportListing | null>(null);

  const loadStore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/listings/import-store?userId=${encodeURIComponent(userId)}`);
      const raw = await response.text();
      let data: { error?: string; listings?: StoreImportListing[] } = {};
      try {
        data = JSON.parse(raw) as typeof data;
      } catch {
        throw new Error(
          raw.trim().startsWith("{")
            ? "Failed to load your store."
            : raw.trim().slice(0, 180) || "Failed to load your store. Please try again.",
        );
      }
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load your store.");
      }
      const rows = (data.listings ?? []) as StoreImportListing[];
      setListings(rows);
      const defaults: Record<string, string> = {};
      for (const listing of rows) {
        defaults[listing.listingId] = listing.variants[0]?.offerId ?? "";
      }
      setSelectedVariants(defaults);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load your store.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadStore();
  }, [loadStore]);

  const unlinkedCount = listings.filter((listing) => !listing.linked).length;
  const linkedCount = listings.length - unlinkedCount;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">
          <div className="border-b border-gray-100 bg-gradient-to-r from-brand/10 via-violet-50 to-white px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#111827]">Import your eBay store</h2>
                <p className="mt-1 text-sm text-[#6B7280]">
                  All active listings with price, image, and variants. Add AliExpress URLs to enable
                  handling and auto updates.
                </p>
                {!loading && listings.length > 0 ? (
                  <p className="mt-2 text-xs font-medium text-[#374151]">
                    {linkedCount} linked · {unlinkedCount} need AliExpress URL
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#374151] hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {loading ? (
              <p className="text-sm text-[#6B7280]">Loading your eBay store…</p>
            ) : error ? (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            ) : listings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-5 py-10 text-center">
                <p className="text-sm font-medium text-[#374151]">No active eBay listings found</p>
                <p className="mt-1 text-xs text-[#6B7280]">
                  Publish listings on eBay first, then return here to link AliExpress URLs.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {listings.map((listing) => {
                  const selectedOfferId =
                    selectedVariants[listing.listingId] ?? listing.variants[0]?.offerId ?? "";
                  const selectedVariant =
                    listing.variants.find((variant) => variant.offerId === selectedOfferId) ??
                    listing.variants[0];
                  const needsUrl = !listing.linked;

                  return (
                    <article
                      key={listing.listingId}
                      className={`flex gap-4 rounded-xl border p-4 transition-shadow ${
                        needsUrl
                          ? "border-red-200 bg-red-50/40 shadow-sm"
                          : "border-emerald-200 bg-emerald-50/30"
                      }`}
                    >
                      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-white bg-white">
                        {listing.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={listing.imageUrl.replace(/^http:\/\//, "https://")}
                            alt={listing.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-[#9CA3AF]">
                            No image
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="line-clamp-2 text-sm font-semibold text-[#111827]">
                              {listing.title}
                            </h3>
                            <p className="mt-1 text-base font-bold text-brand">{displayPrice(listing)}</p>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                              needsUrl
                                ? "bg-red-100 text-red-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {needsUrl ? "Needs URL" : "Linked"}
                          </span>
                        </div>

                        {listing.variants.length > 1 ? (
                          <label className="mt-3 block text-xs font-medium text-[#6B7280]">
                            Variant
                            <select
                              value={selectedOfferId}
                              onChange={(event) =>
                                setSelectedVariants((current) => ({
                                  ...current,
                                  [listing.listingId]: event.target.value,
                                }))
                              }
                              className="mt-1 w-full max-w-xs rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm text-[#111827]"
                            >
                              {listing.variants.map((variant) => (
                                <option key={variant.offerId} value={variant.offerId}>
                                  {variant.label} · {formatPrice(variant.price, listing.currency)} ·
                                  qty {variant.quantity}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : selectedVariant ? (
                          <p className="mt-2 text-xs text-[#6B7280]">
                            {selectedVariant.label} · qty {selectedVariant.quantity}
                          </p>
                        ) : null}

                        {listing.linked && listing.aliexpressUrl ? (
                          <p className="mt-2 truncate text-xs text-emerald-700">
                            AliExpress linked · handling active
                          </p>
                        ) : null}

                        <div className="mt-3 flex flex-wrap gap-2">
                          {needsUrl ? (
                            <button
                              type="button"
                              onClick={() => setAddUrlListing(listing)}
                              className="rounded-lg bg-brand px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand/90"
                            >
                              Add URL
                            </button>
                          ) : null}
                          <a
                            href={listing.listingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#374151] hover:bg-gray-50"
                          >
                            View on eBay
                          </a>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {addUrlListing ? (
        <AddAliUrlModal
          listing={addUrlListing}
          userId={userId}
          onClose={() => setAddUrlListing(null)}
          onLinked={() => {
            void loadStore();
            onLinked();
          }}
        />
      ) : null}
    </>
  );
}
