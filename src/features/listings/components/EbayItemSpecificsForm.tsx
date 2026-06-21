"use client";

import { useEffect, useMemo, useState } from "react";
import type { GeneratedListingItemSpecific } from "@/types/listing-generator";
import {
  filterSpecificsForCategory,
  getFieldDef,
  ITEM_SPECIFIC_FIELD_DEFS,
  MPN_DOES_NOT_APPLY,
  sortClothingSpecificsFirst,
  UNBRANDED,
} from "@/lib/listings/item-specifics";

interface EbayItemSpecificsFormProps {
  userId: string;
  categoryId: string | null;
  itemSpecifics: GeneratedListingItemSpecific[];
  onChange: (itemSpecifics: GeneratedListingItemSpecific[]) => void;
}

const ebayFieldClass =
  "w-full rounded-lg border border-[#C5C5C5] bg-[#F7F7F7] px-3 py-2.5 text-sm text-[#191919] outline-none focus:border-[#3665F3]";

export function EbayItemSpecificsForm({
  userId,
  categoryId,
  itemSpecifics,
  onChange,
}: EbayItemSpecificsFormProps) {
  const [categoryAspectNames, setCategoryAspectNames] = useState<string[]>([]);

  useEffect(() => {
    if (!categoryId) {
      setCategoryAspectNames([]);
      return;
    }

    async function loadAspects() {
      try {
        const params = new URLSearchParams({ userId, categoryId: categoryId! });
        const response = await fetch(`/api/ebay/category-aspects?${params.toString()}`);
        const data = await response.json();
        setCategoryAspectNames(response.ok ? (data.aspectNames ?? []) : []);
      } catch {
        setCategoryAspectNames([]);
      }
    }

    void loadAspects();
  }, [userId, categoryId]);

  const visibleSpecifics = useMemo(
    () =>
      sortClothingSpecificsFirst(
        filterSpecificsForCategory(itemSpecifics, categoryAspectNames),
        categoryAspectNames,
      ),
    [itemSpecifics, categoryAspectNames],
  );

  function updateValue(name: string, value: string) {
    onChange(
      itemSpecifics.map((specific) =>
        specific.name === name ? { ...specific, value } : specific,
      ),
    );
  }

  function renderField(specific: GeneratedListingItemSpecific) {
    const def = getFieldDef(specific.name) ?? ITEM_SPECIFIC_FIELD_DEFS.find((f) => f.name === specific.name);
    const locked = def?.locked || specific.name === "Brand" || specific.name === "MPN";
    const value =
      specific.name === "Brand"
        ? UNBRANDED
        : specific.name === "MPN"
          ? MPN_DOES_NOT_APPLY
          : specific.value;

    if (def?.kind === "select" && def.options && def.options.length > 0) {
      const options = def.options.includes(value) ? def.options : [value, ...def.options];
      return (
        <div className="relative">
          <select
            value={value}
            disabled={locked}
            onChange={(event) => updateValue(specific.name, event.target.value)}
            className={`${ebayFieldClass} appearance-none pr-8 disabled:cursor-not-allowed disabled:opacity-70`}
          >
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#707070]">
            ▾
          </span>
        </div>
      );
    }

    return (
      <input
        type="text"
        value={value}
        readOnly={locked}
        onChange={(event) => updateValue(specific.name, event.target.value)}
        className={`${ebayFieldClass} disabled:cursor-not-allowed disabled:opacity-70`}
      />
    );
  }

  return (
    <section className="rounded border border-[#E5E5E5] bg-white px-4 py-5">
      <h3 className="text-base font-semibold text-[#191919]">Item specifics</h3>
      <p className="mt-1 text-sm text-[#707070]">
        AI has pre-filled these fields. Edit any value before listing.
      </p>

      <div className="mt-4 space-y-3">
        {visibleSpecifics.map((specific) => (
          <div
            key={specific.name}
            className="grid gap-2 border-b border-[#F0F0F0] pb-3 last:border-b-0 sm:grid-cols-[180px_1fr] sm:items-center"
          >
            <label className="text-sm font-medium text-[#191919]">{specific.name}</label>
            {renderField(specific)}
          </div>
        ))}
      </div>
    </section>
  );
}
