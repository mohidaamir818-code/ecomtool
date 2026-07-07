"use client";

import { useCallback, useEffect, useState } from "react";
import { AddAliUrlModal } from "./AddAliUrlModal";
import type { ListingPlatform } from "@/types/listing-generator";
import type { StoreImportListing, StoreImportSuggestedMatch } from "@/types/store-import";

interface ImportStoreModalProps {
  userId: string;
  platform: ListingPlatform;
  onClose: () => void;
  onLinked: () => void;
}

const SUGGEST_BATCH_SIZE = 5;

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

export function ImportStoreModal({ userId, platform, onClose, onLinked }: ImportStoreModalProps) {
  const [listings, setListings] = useState<StoreImportListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [addUrlListing, setAddUrlListing] = useState<StoreImportListing | null>(null);
  const [addUrlInitial, setAddUrlInitial] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [showAllLinkedPopup, setShowAllLinkedPopup] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<string, StoreImportSuggestedMatch | null>>({});
  const [suggestionUrls, setSuggestionUrls] = useState<Record<string, string>>({});
  const [selectedToSave, setSelectedToSave] = useState<Record<string, boolean>>({});
  const [findingMatches, setFindingMatches] = useState(false);
  const [findingProgress, setFindingProgress] = useState("");
  const [savingBatch, setSavingBatch] = useState(false);

  const runAutoSuggest = useCallback(
    async (rows: StoreImportListing[]) => {
      const unlinkedIds = rows.filter((listing) => !listing.linked).map((listing) => listing.listingId);
      if (unlinkedIds.length === 0) return;

      setFindingMatches(true);
      setFindingProgress(`Finding AliExpress matches (0/${unlinkedIds.length})…`);

      const nextSuggestions: Record<string, StoreImportSuggestedMatch | null> = {};
      const nextUrls: Record<string, string> = {};
      const nextSelected: Record<string, boolean> = {};
      setSuggestions({});
      setSuggestionUrls({});
      setSelectedToSave({});

      try {
        for (let index = 0; index < unlinkedIds.length; index += SUGGEST_BATCH_SIZE) {
          const batch = unlinkedIds.slice(index, index + SUGGEST_BATCH_SIZE);
          setFindingProgress(
            `Finding AliExpress matches (${Math.min(index + batch.length, unlinkedIds.length)}/${unlinkedIds.length})…`,
          );

          const response = await fetch("/api/listings/import-store/suggest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, platform, listingIds: batch }),
          });
          const data = (await response.json()) as {
            error?: string;
            suggestions?: Record<string, StoreImportSuggestedMatch | null>;
          };

          if (!response.ok) {
            throw new Error(data.error ?? "Failed to find AliExpress matches.");
          }

          for (const listingId of batch) {
            const match = data.suggestions?.[listingId] ?? null;
            nextSuggestions[listingId] = match;
            if (match) {
              nextUrls[listingId] = match.aliexpressUrl;
              nextSelected[listingId] = true;
            }
          }

          setSuggestions((current) => ({ ...current, ...nextSuggestions }));
          setSuggestionUrls((current) => {
            const updated = { ...current };
            for (const [listingId, url] of Object.entries(nextUrls)) {
              if (!updated[listingId]?.trim()) {
                updated[listingId] = url;
              }
            }
            return updated;
          });
          setSelectedToSave((current) => ({ ...current, ...nextSelected }));
        }

        const foundCount = Object.values(nextSuggestions).filter(Boolean).length;
        if (foundCount > 0) {
          setNotice(
            `Found ${foundCount} suggested AliExpress match${foundCount === 1 ? "" : "es"}. Review and save to enable auto-sync.`,
          );
        }
      } catch (suggestError) {
        setError(
          suggestError instanceof Error
            ? suggestError.message
            : "Failed to find AliExpress matches.",
        );
      } finally {
        setFindingMatches(false);
        setFindingProgress("");
      }
    },
    [platform, userId],
  );

  const loadStore = useCallback(async (): Promise<StoreImportListing[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/listings/import-store?userId=${encodeURIComponent(userId)}&platform=${encodeURIComponent(platform)}`,
      );
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
      void runAutoSuggest(rows);
      return rows;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load your store.");
      return [];
    } finally {
      setLoading(false);
    }
  }, [platform, runAutoSuggest, userId]);

  useEffect(() => {
    void loadStore();
  }, [loadStore]);

  const unlinkedCount = listings.filter((listing) => !listing.linked).length;
  const linkedCount = listings.length - unlinkedCount;
  const selectedCount = listings.filter(
    (listing) => !listing.linked && selectedToSave[listing.listingId] && suggestionUrls[listing.listingId]?.trim(),
  ).length;

  const sortedListings = [...listings].sort((a, b) => {
    if (a.linked === b.linked) return a.title.localeCompare(b.title);
    return a.linked ? 1 : -1;
  });

  function handleUrlLinked() {
    setNotice("AliExpress URL added — price and stock will now auto-update when the supplier changes.");
    onLinked();
    void loadStore().then((rows) => {
      const stillUnlinked = rows.filter((listing) => !listing.linked).length;
      if (rows.length > 0 && stillUnlinked === 0) {
        setShowAllLinkedPopup(true);
      }
    });
  }

  async function handleSaveSelected() {
    const links = listings
      .filter((listing) => !listing.linked && selectedToSave[listing.listingId])
      .map((listing) => {
        const draftUrl = suggestionUrls[listing.listingId]?.trim() ?? "";
        const suggestedUrl = suggestions[listing.listingId]?.aliexpressUrl?.trim() ?? "";
        return {
          listingId: listing.listingId,
          aliexpressUrl: draftUrl,
          skipMatchValidation: !suggestedUrl || draftUrl !== suggestedUrl,
        };
      })
      .filter((link) => link.aliexpressUrl);

    if (links.length === 0) {
      setError("Select at least one listing with an AliExpress URL to save.");
      return;
    }

    setSavingBatch(true);
    setError(null);
    try {
      const response = await fetch("/api/listings/import-store/link-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, platform, links }),
      });
      const data = (await response.json()) as {
        error?: string;
        linked?: string[];
        failed?: Array<{ listingId: string; error: string }>;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save selected links.");
      }

      const linked = data.linked?.length ?? 0;
      const failed = data.failed?.length ?? 0;

      if (linked > 0) {
        setNotice(
          `${linked} listing${linked === 1 ? "" : "s"} linked for auto-sync${failed > 0 ? ` (${failed} could not be matched)` : ""}.`,
        );
        onLinked();
      }

      if (failed > 0 && linked === 0) {
        setError(data.failed?.[0]?.error ?? "Could not link the selected listings.");
      }

      await loadStore();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save selected links.");
    } finally {
      setSavingBatch(false);
    }
  }

  function openAddUrl(listing: StoreImportListing) {
    setAddUrlInitial(suggestionUrls[listing.listingId] ?? "");
    setAddUrlListing(listing);
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">
          <div className="border-b border-gray-100 bg-gradient-to-r from-brand/10 via-violet-50 to-white px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#111827]">
                  Import your {platform === "amazef" ? "Amazef" : "eBay"} store
                </h2>
                <p className="mt-1 text-sm text-[#6B7280]">
                  We find matching AliExpress URLs automatically. Review, tick the ones that look
                  right, then save to enable auto-sync.
                </p>
                {!loading && listings.length > 0 ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">
                      {linkedCount} linked
                    </span>
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">
                      {unlinkedCount} to review
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => void handleSaveSelected()}
                    disabled={savingBatch || findingMatches}
                    className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
                  >
                    {savingBatch ? "Saving…" : `Save ${selectedCount} selected`}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#374151] hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {notice ? (
              <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                <span>{notice}</span>
                <button
                  type="button"
                  onClick={() => setNotice(null)}
                  className="shrink-0 text-emerald-600 hover:text-emerald-800"
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
            ) : null}

            {findingMatches && findingProgress ? (
              <p className="mb-4 text-sm font-medium text-brand">{findingProgress}</p>
            ) : null}

            {loading ? (
              <p className="text-sm text-[#6B7280]">
                Loading your {platform === "amazef" ? "Amazef" : "eBay"} store…
              </p>
            ) : error ? (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            ) : listings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-5 py-10 text-center">
                <p className="text-sm font-medium text-[#374151]">
                  No active {platform === "amazef" ? "Amazef" : "eBay"} listings found
                </p>
                <p className="mt-1 text-xs text-[#6B7280]">
                  Publish listings on {platform === "amazef" ? "Amazef" : "eBay"} first, then return here to link AliExpress URLs.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {sortedListings.map((listing) => {
                  const selectedOfferId =
                    selectedVariants[listing.listingId] ?? listing.variants[0]?.offerId ?? "";
                  const selectedVariant =
                    listing.variants.find((variant) => variant.offerId === selectedOfferId) ??
                    listing.variants[0];
                  const needsUrl = !listing.linked;
                  const suggestion = suggestions[listing.listingId];
                  const draftUrl = suggestionUrls[listing.listingId] ?? "";

                  return (
                    <article
                      key={listing.listingId}
                      className={`flex gap-4 rounded-xl border p-4 transition-shadow ${
                        needsUrl
                          ? "border-amber-200 bg-amber-50/30 shadow-sm"
                          : "border-emerald-200 bg-emerald-50/30"
                      }`}
                    >
                      {needsUrl ? (
                        <input
                          type="checkbox"
                          checked={Boolean(selectedToSave[listing.listingId] && draftUrl.trim())}
                          disabled={!draftUrl.trim()}
                          onChange={(event) =>
                            setSelectedToSave((current) => ({
                              ...current,
                              [listing.listingId]: event.target.checked,
                            }))
                          }
                          className="mt-1 h-4 w-4 shrink-0 accent-brand"
                          aria-label={`Select ${listing.title} for auto-sync`}
                        />
                      ) : (
                        <div className="w-4 shrink-0" />
                      )}

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
                                ? suggestion
                                  ? "bg-brand/10 text-brand"
                                  : "bg-amber-100 text-amber-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {needsUrl
                              ? suggestion
                                ? `${suggestion.confidence}% match`
                                : findingMatches
                                  ? "Searching…"
                                  : "No match"
                              : "Linked"}
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

                        {needsUrl && suggestion ? (
                          <div className="mt-3 rounded-lg border border-brand/20 bg-white p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-brand">
                              Suggested AliExpress match
                            </p>
                            <div className="mt-2 flex gap-3">
                              {suggestion.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={suggestion.imageUrl.replace(/^http:\/\//, "https://")}
                                  alt={suggestion.title}
                                  className="h-14 w-14 shrink-0 rounded-md object-cover"
                                />
                              ) : null}
                              <div className="min-w-0 flex-1">
                                <p className="line-clamp-2 text-xs font-medium text-[#111827]">
                                  {suggestion.title}
                                </p>
                                <p className="mt-1 text-xs text-[#6B7280]">
                                  {formatPrice(suggestion.price, suggestion.currency)}
                                </p>
                              </div>
                            </div>
                            <input
                              type="url"
                              value={draftUrl}
                              onChange={(event) =>
                                setSuggestionUrls((current) => ({
                                  ...current,
                                  [listing.listingId]: event.target.value,
                                }))
                              }
                              className="mt-2 w-full rounded-lg border border-gray-200 px-2.5 py-2 text-xs text-[#111827] outline-none focus:border-brand"
                            />
                          </div>
                        ) : null}

                        {listing.linked && listing.aliexpressUrl ? (
                          <p className="mt-2 truncate text-xs text-emerald-700">
                            AliExpress linked · auto-sync active
                          </p>
                        ) : null}

                        <div className="mt-3 flex flex-wrap gap-2">
                          {needsUrl ? (
                            <button
                              type="button"
                              onClick={() => openAddUrl(listing)}
                              className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#374151] hover:bg-gray-50"
                            >
                              {suggestion ? "Edit URL" : "Add URL manually"}
                            </button>
                          ) : null}
                          <a
                            href={listing.listingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#374151] hover:bg-gray-50"
                          >
                            View on {platform === "amazef" ? "Amazef" : "eBay"}
                          </a>
                          {draftUrl ? (
                            <a
                              href={draftUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#374151] hover:bg-gray-50"
                            >
                              View on AliExpress
                            </a>
                          ) : null}
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
          platform={platform}
          initialUrl={addUrlInitial}
          onClose={() => setAddUrlListing(null)}
          onLinked={handleUrlLinked}
        />
      ) : null}

      {showAllLinkedPopup ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-600">
              ✓
            </div>
            <h3 className="mt-4 text-lg font-bold text-[#111827]">All products linked</h3>
            <p className="mt-2 text-sm text-[#6B7280]">
              Every listing now has an AliExpress URL. We will automatically update price and stock
              whenever your supplier changes them.
            </p>
            <button
              type="button"
              onClick={() => setShowAllLinkedPopup(false)}
              className="mt-5 w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand/90"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
