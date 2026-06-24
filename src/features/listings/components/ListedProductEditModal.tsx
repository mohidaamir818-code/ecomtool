"use client";

import { useEffect, useState } from "react";
import { ListingDescriptionEditor } from "./ListingDescriptionEditor";
import type { ListedProductDetail } from "@/types/listed-products";
import type { ListingDraft, ListingVariantDraft } from "@/types/listing-generator";

interface ListedProductEditModalProps {
  userId: string;
  productId: string;
  platformLabel: string;
  onClose: () => void;
  onSaved: () => void;
}

function formatPrice(price: number, currency: string): string {
  if (currency === "GBP") return `£${price.toFixed(2)}`;
  if (currency === "USD") return `$${price.toFixed(2)}`;
  return `${currency} ${price.toFixed(2)}`;
}

export function ListedProductEditModal({
  userId,
  productId,
  platformLabel,
  onClose,
  onSaved,
}: ListedProductEditModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ListingDraft | null>(null);
  const [currency, setCurrency] = useState("GBP");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/listings/published/${encodeURIComponent(productId)}?userId=${encodeURIComponent(userId)}`,
        );
        const data = await response.json();
        if (!response.ok || !data.product) {
          throw new Error(data.error ?? "Failed to load listing.");
        }
        if (!cancelled) {
          const product = data.product as ListedProductDetail;
          setDraft(product.draft);
          setCurrency(product.currency);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load listing.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [productId, userId]);

  function updateVariant(index: number, patch: Partial<ListingVariantDraft>) {
    if (!draft) return;
    setDraft({
      ...draft,
      variants: draft.variants.map((variant, i) => (i === index ? { ...variant, ...patch } : variant)),
    });
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/listings/published/${encodeURIComponent(productId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, draft }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save changes.");
      }
      onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-gray-100 bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[#111827]">Edit listing</h2>
            <p className="mt-0.5 text-xs text-[#6B7280]">
              Changes sync to {platformLabel} when you save.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-[#374151] hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          {loading ? (
            <p className="text-sm text-[#6B7280]">Loading listing…</p>
          ) : draft ? (
            <>
              <div>
                <label className="block text-sm font-medium text-[#111827]">
                  Title
                  <input
                    type="text"
                    value={draft.listing.seoTitle}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        listing: { ...draft.listing, seoTitle: event.target.value },
                      })
                    }
                    className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
                  />
                </label>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-[#111827]">Description</p>
                <ListingDescriptionEditor
                  value={draft.listing.descriptionHtml}
                  onChange={(descriptionHtml) =>
                    setDraft({
                      ...draft,
                      listing: { ...draft.listing, descriptionHtml },
                    })
                  }
                  descriptionPhotos={draft.descriptionPhotos}
                />
              </div>

              <div className="rounded-xl border border-gray-100">
                <div className="border-b border-gray-100 px-4 py-3">
                  <h3 className="text-sm font-semibold text-[#111827]">Variants</h3>
                  <p className="mt-0.5 text-xs text-[#6B7280]">Update price and stock per variant.</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {draft.variants.map((variant, index) => (
                    <div key={variant.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_120px_120px]">
                      <div>
                        <p className="text-sm font-medium text-[#111827]">{variant.label}</p>
                        <p className="mt-0.5 text-xs text-[#6B7280]">SKU {variant.sku}</p>
                      </div>
                      <label className="text-xs font-medium text-[#6B7280]">
                        Price
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={variant.price}
                          onChange={(event) =>
                            updateVariant(index, { price: Number(event.target.value) || variant.price })
                          }
                          className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm text-[#111827]"
                        />
                      </label>
                      <label className="text-xs font-medium text-[#6B7280]">
                        Stock
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={variant.quantity}
                          onChange={(event) =>
                            updateVariant(index, {
                              quantity: Math.max(0, Number.parseInt(event.target.value, 10) || 0),
                              stock: Math.max(0, Number.parseInt(event.target.value, 10) || 0),
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm text-[#111827]"
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {draft.variants.length === 1 ? (
                <p className="text-xs text-[#6B7280]">
                  Listed price: {formatPrice(draft.variants[0]?.price ?? 0, currency)}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-red-600">{error ?? "Listing could not be loaded."}</p>
          )}

          {error && draft ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-100 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-[#374151] hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || loading || !draft}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
