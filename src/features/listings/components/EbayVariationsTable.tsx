"use client";

import { useState } from "react";
import type { ListingDraft, ListingVariantDraft } from "@/types/listing-generator";
import {
  currencySymbol,
  ebayBulkButtonClass,
  ebayInputClass,
  ebayTableHeaderClass,
  ebayTextButtonClass,
} from "@/features/listings/lib/ebay-ui";
import { ProxiedImage } from "./ProxiedImage";

type BulkField = "price" | "quantity" | "sku";

interface EbayVariationsTableProps {
  draft: ListingDraft;
  onChange: (variants: ListingVariantDraft[]) => void;
  allowVariantPhotos: boolean;
}

export function EbayVariationsTable({ draft, onChange, allowVariantPhotos }: EbayVariationsTableProps) {
  const { variants, listing, photos } = draft;
  const symbol = currencySymbol(listing.currency);
  const availableImages = photos.map((photo) => photo.url);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkField, setBulkField] = useState<BulkField | null>(null);
  const [bulkValue, setBulkValue] = useState("");
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  const allSelected = variants.length > 0 && selectedIds.size === variants.length;

  function updateVariant(index: number, patch: Partial<ListingVariantDraft>) {
    onChange(variants.map((variant, i) => (i === index ? { ...variant, ...patch } : variant)));
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(variants.map((variant) => variant.id)) : new Set());
  }

  function toggleRow(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function deleteSelected() {
    onChange(variants.filter((variant) => !selectedIds.has(variant.id)));
    setSelectedIds(new Set());
  }

  function deleteRow(index: number) {
    onChange(variants.filter((_, i) => i !== index));
    setSelectedIds((current) => {
      const id = variants[index]?.id;
      if (!id) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  function applyBulk() {
    if (!bulkField || selectedIds.size === 0) return;

    const next = variants.map((variant) => {
      if (!selectedIds.has(variant.id)) return variant;
      if (bulkField === "price") {
        const price = Number(bulkValue);
        if (!Number.isFinite(price) || price <= 0) return variant;
        return { ...variant, price };
      }
      if (bulkField === "quantity") {
        const quantity = Number.parseInt(bulkValue, 10);
        if (!Number.isFinite(quantity) || quantity < 1) return variant;
        return { ...variant, quantity };
      }
      return { ...variant, sku: bulkValue.trim() || variant.sku };
    });

    onChange(next);
    setBulkField(null);
    setBulkValue("");
  }

  return (
    <section className="mt-6 rounded border border-[#E5E5E5] bg-white">
      <div className="border-b border-[#E5E5E5] px-4 py-3">
        <h2 className="text-base font-semibold text-[#191919]">Variations</h2>
        <p className="mt-1 text-sm text-[#707070]">
          Variation combinations ({variants.length})
        </p>
      </div>

      {variants.length === 0 ? (
        <p className="px-4 py-6 text-sm text-amber-800">
          No in-stock variants found for this product.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 border-b border-[#E5E5E5] px-4 py-3">
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() => {
                setBulkField("price");
                setBulkValue("");
              }}
              className={ebayBulkButtonClass}
            >
              Enter price
            </button>
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() => {
                setBulkField("quantity");
                setBulkValue("");
              }}
              className={ebayBulkButtonClass}
            >
              Enter quantity
            </button>
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() => {
                setBulkField("sku");
                setBulkValue("");
              }}
              className={ebayBulkButtonClass}
            >
              Enter SKU
            </button>
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={deleteSelected}
              className={ebayBulkButtonClass}
            >
              Delete
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[880px] w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className={`${ebayTableHeaderClass} w-10`}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(event) => toggleAll(event.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-[#3665F3]"
                    />
                  </th>
                  <th className={`${ebayTableHeaderClass} w-20`}>Actions</th>
                  <th className={`${ebayTableHeaderClass} w-16`}>Photos</th>
                  <th className={`${ebayTableHeaderClass} min-w-[120px]`}>SKU</th>
                  <th className={`${ebayTableHeaderClass} min-w-[120px]`}>EAN</th>
                  <th className={`${ebayTableHeaderClass} min-w-[100px]`}>Color</th>
                  <th className={`${ebayTableHeaderClass} w-24`}>Quantity</th>
                  <th className={`${ebayTableHeaderClass} w-28`}>Price</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((variant, index) => (
                  <tr key={variant.id} className="border-b border-[#E5E5E5] hover:bg-[#FAFAFA]">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(variant.id)}
                        onChange={() => toggleRow(variant.id)}
                        className="h-4 w-4 rounded border-gray-300 text-[#3665F3]"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => deleteRow(index)}
                        className={ebayTextButtonClass}
                      >
                        Delete
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        disabled={!allowVariantPhotos}
                        onClick={() => allowVariantPhotos && setPickerIndex(index)}
                        className="block h-12 w-12 overflow-hidden border border-[#E5E5E5] disabled:cursor-default"
                      >
                        <ProxiedImage
                          src={variant.imageUrl}
                          alt={variant.label}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={variant.sku}
                        onChange={(event) => updateVariant(index, { sku: event.target.value })}
                        className={ebayInputClass}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="relative">
                        <input
                          type="text"
                          value={variant.ean}
                          onChange={(event) => updateVariant(index, { ean: event.target.value })}
                          placeholder="Does not apply"
                          className={`${ebayInputClass} pr-7`}
                        />
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#707070]">
                          ▾
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[#191919]">{variant.label}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={variant.quantity}
                        onChange={(event) =>
                          updateVariant(index, {
                            quantity: Math.max(1, Number.parseInt(event.target.value, 10) || 1),
                          })
                        }
                        className={ebayInputClass}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#707070]">
                          {symbol}
                        </span>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={variant.price}
                          onChange={(event) =>
                            updateVariant(index, { price: Number(event.target.value) || 0 })
                          }
                          className={`${ebayInputClass} pl-6`}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {bulkField ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-[#191919]">
              {bulkField === "price"
                ? "Enter price for selected"
                : bulkField === "quantity"
                  ? "Enter quantity for selected"
                  : "Enter SKU for selected"}
            </h3>
            <input
              type={bulkField === "sku" ? "text" : "number"}
              min={bulkField === "quantity" ? "1" : bulkField === "price" ? "0.01" : undefined}
              step={bulkField === "price" ? "0.01" : "1"}
              value={bulkValue}
              onChange={(event) => setBulkValue(event.target.value)}
              className="mt-3 w-full rounded border border-[#C5C5C5] px-3 py-2 text-sm outline-none focus:border-[#3665F3]"
              autoFocus
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={applyBulk}
                className="rounded-full bg-[#3665F3] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2850D4]"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={() => {
                  setBulkField(null);
                  setBulkValue("");
                }}
                className="text-sm font-semibold text-[#707070] hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pickerIndex != null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#191919]">Choose variant photo</h3>
              <button
                type="button"
                onClick={() => setPickerIndex(null)}
                className="text-sm text-[#707070] hover:text-[#191919]"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {availableImages.map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => {
                    updateVariant(pickerIndex, { imageUrl: url });
                    setPickerIndex(null);
                  }}
                  className="overflow-hidden border border-[#E5E5E5] hover:border-[#3665F3]"
                >
                  <ProxiedImage src={url} alt="" className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
