"use client";

import { useEffect, useState } from "react";
import type { EbayCategorySuggestion, GeneratedListing } from "@/types/listing-generator";
import { ListingDescriptionEditor } from "./ListingDescriptionEditor";

interface ListingPreviewEditorProps {
  userId: string;
  listing: GeneratedListing;
  onChange: (listing: GeneratedListing) => void;
}

const CONDITIONS = ["New", "New other", "Used"];

export function ListingPreviewEditor({ userId, listing, onChange }: ListingPreviewEditorProps) {
  const [categoryQuery, setCategoryQuery] = useState(listing.categorySuggestion);
  const [categories, setCategories] = useState<EbayCategorySuggestion[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  useEffect(() => {
    if (categoryQuery.trim().length < 2) {
      setCategories([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setLoadingCategories(true);
      try {
        const params = new URLSearchParams({
          userId,
          query: categoryQuery.trim(),
        });
        const response = await fetch(`/api/ebay/categories?${params.toString()}`);
        const data = await response.json();
        setCategories(response.ok ? (data.categories ?? []) : []);
      } finally {
        setLoadingCategories(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [categoryQuery, userId]);

  function updateSpecific(index: number, field: "name" | "value", value: string) {
    const itemSpecifics = listing.itemSpecifics.map((specific, i) =>
      i === index ? { ...specific, [field]: value } : specific,
    );
    onChange({ ...listing, itemSpecifics });
  }

  function addSpecific() {
    onChange({
      ...listing,
      itemSpecifics: [...listing.itemSpecifics, { name: "", value: "" }],
    });
  }

  function removeSpecific(index: number) {
    onChange({
      ...listing,
      itemSpecifics: listing.itemSpecifics.filter((_, i) => i !== index),
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-[#111827]">
          Title
          <input
            type="text"
            maxLength={80}
            value={listing.seoTitle}
            onChange={(event) => onChange({ ...listing, seoTitle: event.target.value })}
            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
          />
        </label>
        <p className="mt-1 text-xs text-[#9CA3AF]">{listing.seoTitle.length}/80 characters</p>
      </div>

      <div>
        <p className="text-sm font-medium text-[#111827]">Description</p>
        <div className="mt-2">
          <ListingDescriptionEditor
            value={listing.descriptionHtml}
            onChange={(descriptionHtml) => onChange({ ...listing, descriptionHtml })}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-[#111827]">
          Price
          <input
            type="number"
            min="0"
            step="0.01"
            value={listing.suggestedPrice}
            onChange={(event) =>
              onChange({ ...listing, suggestedPrice: Number(event.target.value) || 0 })
            }
            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
          />
        </label>

        <label className="block text-sm font-medium text-[#111827]">
          Condition
          <select
            value={listing.condition}
            onChange={(event) => onChange({ ...listing, condition: event.target.value })}
            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
          >
            {CONDITIONS.map((condition) => (
              <option key={condition} value={condition}>
                {condition}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#111827]">
          Brand
          <input
            type="text"
            value="Unbranded"
            readOnly
            className="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-[#6B7280]"
          />
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#111827]">
          Category
          <input
            type="text"
            value={categoryQuery}
            onChange={(event) => {
              setCategoryQuery(event.target.value);
              onChange({
                ...listing,
                categorySuggestion: event.target.value,
                categoryId: null,
              });
            }}
            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
          />
        </label>
        {loadingCategories ? (
          <p className="mt-2 text-xs text-[#9CA3AF]">Loading categories...</p>
        ) : categories.length > 0 ? (
          <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white">
            {categories.map((category) => (
              <button
                key={category.categoryId}
                type="button"
                onClick={() => {
                  setCategoryQuery(category.categoryPath);
                  onChange({
                    ...listing,
                    categorySuggestion: category.categoryPath,
                    categoryId: category.categoryId,
                  });
                }}
                className="block w-full border-b border-gray-100 px-3 py-2 text-left text-sm text-[#374151] hover:bg-gray-50 last:border-b-0"
              >
                {category.categoryPath}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-[#111827]">Item specifics</p>
          <button
            type="button"
            onClick={addSpecific}
            className="text-xs font-semibold text-brand hover:underline"
          >
            Add specific
          </button>
        </div>

        <div className="space-y-3">
          {listing.itemSpecifics.map((specific, index) => {
            const isBrand = specific.name.toLowerCase() === "brand";
            return (
              <div key={`${specific.name}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <input
                  type="text"
                  value={specific.name}
                  readOnly={isBrand}
                  onChange={(event) => updateSpecific(index, "name", event.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                  placeholder="Name"
                />
                <input
                  type="text"
                  value={isBrand ? "Unbranded" : specific.value}
                  readOnly={isBrand}
                  onChange={(event) => updateSpecific(index, "value", event.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
                  placeholder="Value"
                />
                {!isBrand ? (
                  <button
                    type="button"
                    onClick={() => removeSpecific(index)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-[#6B7280] hover:bg-gray-50"
                  >
                    Remove
                  </button>
                ) : (
                  <span />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
