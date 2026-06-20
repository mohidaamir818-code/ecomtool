"use client";

import {
  EBAY_CONDITION_OPTIONS,
  type EbayConditionOption,
} from "@/lib/listings/item-specifics";

interface EbayConditionSelectorProps {
  value: string;
  onChange: (condition: EbayConditionOption) => void;
}

export function EbayConditionSelector({ value, onChange }: EbayConditionSelectorProps) {
  const selected = EBAY_CONDITION_OPTIONS.includes(value as EbayConditionOption)
    ? (value as EbayConditionOption)
    : "New with tags";

  return (
    <section className="rounded border border-[#E5E5E5] bg-white px-4 py-5">
      <h3 className="text-base font-semibold text-[#191919]">Add the condition of your item</h3>
      <div className="mt-4 flex flex-wrap gap-2">
        {EBAY_CONDITION_OPTIONS.map((option) => {
          const active = selected === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                active
                  ? "border-[#3665F3] bg-[#3665F3] text-white"
                  : "border-[#C5C5C5] bg-[#F7F7F7] text-[#191919] hover:border-[#3665F3]"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </section>
  );
}
