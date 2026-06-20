"use client";

import { useState } from "react";
import type { ListingDraft, ListingVariantDraft } from "@/types/listing-generator";
import { ProxiedImage } from "./ProxiedImage";

interface ListingVariantsStepProps {
  draft: ListingDraft;
  onChange: (variants: ListingVariantDraft[]) => void;
}

export function ListingVariantsStep({ draft, onChange }: ListingVariantsStepProps) {
  const availableImages = draft.photos.map((photo) => photo.url);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  function updateVariant(index: number, patch: Partial<ListingVariantDraft>) {
    onChange(
      draft.variants.map((variant, i) => (i === index ? { ...variant, ...patch } : variant)),
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-[#111827]">Configure variants</h2>
        <p className="mt-1 text-sm text-[#6B7280]">
          In-stock AliExpress variants only. Prices maintain the same ratio as AliExpress. Assign a photo per variant.
        </p>
      </div>

      {draft.variants.length === 0 ? (
        <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No in-stock variants found for this product.
        </p>
      ) : null}

      <div className="space-y-4">
        {draft.variants.map((variant, index) => (
          <div key={variant.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row">
              <ProxiedImage
                src={variant.imageUrl}
                alt={variant.label}
                className="h-24 w-24 rounded-lg border border-gray-100 object-cover"
              />

              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-[#111827] sm:col-span-2">
                  Name
                  <input
                    type="text"
                    value={variant.label}
                    readOnly
                    className="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-[#374151]"
                  />
                </label>

                <label className="block text-sm font-medium text-[#111827]">
                  Price
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={variant.price}
                    onChange={(event) =>
                      updateVariant(index, { price: Number(event.target.value) || 0 })
                    }
                    className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                </label>

                <label className="block text-sm font-medium text-[#111827]">
                  Stock
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={variant.stock}
                    readOnly
                    className="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-[#374151]"
                  />
                </label>

                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={() => setPickerIndex(index)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-[#374151] hover:border-brand/30 hover:text-brand"
                  >
                    Assign Photo
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {pickerIndex != null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#111827]">Choose variant photo</h3>
              <button
                type="button"
                onClick={() => setPickerIndex(null)}
                className="text-sm text-[#6B7280] hover:text-[#111827]"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {availableImages.map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => {
                    updateVariant(pickerIndex, { imageUrl: url });
                    setPickerIndex(null);
                  }}
                  className="overflow-hidden rounded-lg border border-gray-200 hover:border-brand"
                >
                  <ProxiedImage src={url} alt="" className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
