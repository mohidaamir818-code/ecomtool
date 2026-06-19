"use client";

import type { ListingDraft, ListingVariantDraft } from "@/types/listing-generator";

interface ListingVariantsStepProps {
  draft: ListingDraft;
  onChange: (variants: ListingVariantDraft[]) => void;
}

export function ListingVariantsStep({ draft, onChange }: ListingVariantsStepProps) {
  const availableImages = draft.photos.map((photo) => photo.url);

  function updateVariant(index: number, patch: Partial<ListingVariantDraft>) {
    onChange(
      draft.variants.map((variant, i) => (i === index ? { ...variant, ...patch } : variant)),
    );
  }

  function addVariant() {
    onChange([
      ...draft.variants,
      {
        id: `custom-${Date.now()}`,
        label: `Variant ${draft.variants.length + 1}`,
        imageUrl: availableImages[0] ?? "",
        price: draft.listing.suggestedPrice,
        stock: 1,
      },
    ]);
  }

  function removeVariant(index: number) {
    if (draft.variants.length <= 1) return;
    onChange(draft.variants.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#111827]">Variants</h2>
          <p className="mt-1 text-sm text-[#6B7280]">
            Set a photo, price, and stock quantity for each variant.
          </p>
        </div>
        <button
          type="button"
          onClick={addVariant}
          className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-[#374151] hover:bg-gray-50"
        >
          Add variant
        </button>
      </div>

      <div className="space-y-4">
        {draft.variants.map((variant, index) => (
          <div key={variant.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={variant.imageUrl}
                alt={variant.label}
                className="h-24 w-24 rounded-lg border border-gray-100 object-cover"
              />

              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-[#111827] sm:col-span-2">
                  Label
                  <input
                    type="text"
                    value={variant.label}
                    onChange={(event) => updateVariant(index, { label: event.target.value })}
                    className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                </label>

                <label className="block text-sm font-medium text-[#111827]">
                  Price
                  <input
                    type="number"
                    min="0"
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
                    onChange={(event) =>
                      updateVariant(index, { stock: Number(event.target.value) || 0 })
                    }
                    className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                </label>

                <label className="block text-sm font-medium text-[#111827] sm:col-span-2">
                  Photo
                  <select
                    value={variant.imageUrl}
                    onChange={(event) => updateVariant(index, { imageUrl: event.target.value })}
                    className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                  >
                    {availableImages.map((url) => (
                      <option key={url} value={url}>
                        {url.slice(-40)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {draft.variants.length > 1 ? (
              <button
                type="button"
                onClick={() => removeVariant(index)}
                className="mt-4 text-xs font-semibold text-red-600 hover:underline"
              >
                Remove variant
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
