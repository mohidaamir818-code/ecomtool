"use client";

import { useMemo, useState } from "react";
import type {
  ListingDraft,
  ListingVariantDraft,
  VariationPhotoAttribute,
} from "@/types/listing-generator";
import { ProxiedImage } from "./ProxiedImage";

const MAX_VARIANT_PHOTO_SLOTS = 12;

interface EbayVariationPhotosPanelProps {
  draft: ListingDraft;
  onChange: (patch: Partial<ListingDraft>) => void;
}

function extractColorValue(label: string): string {
  const parts = label.split(/\s*\/\s*/).map((part) => part.trim()).filter(Boolean);
  for (const part of parts) {
    const match = part.match(/^(?:color|colour)\s*:\s*(.+)$/i);
    if (match?.[1]) return match[1].trim();
  }
  // Prefer first token when labels look like "Khaki / S" or single color names
  if (parts.length >= 1) return parts[0];
  return label.trim() || "Default";
}

function groupVariantsByColor(variants: ListingVariantDraft[]): Array<{
  color: string;
  variants: ListingVariantDraft[];
  imageUrl: string;
}> {
  const map = new Map<string, ListingVariantDraft[]>();
  for (const variant of variants) {
    const color = extractColorValue(variant.label);
    const list = map.get(color) ?? [];
    list.push(variant);
    map.set(color, list);
  }

  return Array.from(map.entries()).map(([color, group]) => ({
    color,
    variants: group,
    imageUrl: group.find((variant) => variant.imageUrl)?.imageUrl ?? "",
  }));
}

export function EbayVariationPhotosPanel({ draft, onChange }: EbayVariationPhotosPanelProps) {
  const variationPhotoAttribute = draft.variationPhotoAttribute ?? "default";
  const groups = useMemo(() => groupVariantsByColor(draft.variants), [draft.variants]);
  const [selectedColor, setSelectedColor] = useState<string>(groups[0]?.color ?? "");
  const [showPicker, setShowPicker] = useState(false);

  const activeColor = groups.some((group) => group.color === selectedColor)
    ? selectedColor
    : groups[0]?.color ?? "";
  const activeGroup = groups.find((group) => group.color === activeColor) ?? null;
  const availablePhotos = draft.photos.filter((photo) => photo.selected || photo.url).map((photo) => photo.url);
  const photoCount = activeGroup?.imageUrl ? 1 : 0;

  function setAttribute(value: VariationPhotoAttribute) {
    onChange({ variationPhotoAttribute: value });
    if (value === "color" && groups[0] && !selectedColor) {
      setSelectedColor(groups[0].color);
    }
  }

  function assignPhotoToColor(color: string, imageUrl: string) {
    onChange({
      variants: draft.variants.map((variant) =>
        extractColorValue(variant.label) === color ? { ...variant, imageUrl } : variant,
      ),
      variationPhotoAttribute: "color",
    });
    setShowPicker(false);
  }

  function clearPhotoForColor(color: string) {
    onChange({
      variants: draft.variants.map((variant) =>
        extractColorValue(variant.label) === color ? { ...variant, imageUrl: "" } : variant,
      ),
    });
  }

  return (
    <section className="rounded-lg border border-[#E5E5E5] bg-white">
      <div className="border-b border-[#E5E5E5] px-4 py-4">
        <h3 className="text-sm font-semibold text-[#191919]">Add variation photos</h3>
        <p className="mt-1 text-sm text-[#707070]">
          Buyers see these photos when they select a variation option.
        </p>
        <select
          value={variationPhotoAttribute}
          onChange={(event) => setAttribute(event.target.value as VariationPhotoAttribute)}
          className="mt-3 w-full max-w-xs rounded border border-[#C5C5C5] bg-white px-3 py-2 text-sm text-[#191919] outline-none focus:border-[#3665F3]"
        >
          <option value="default">Use default photos</option>
          <option value="color">Color</option>
        </select>
      </div>

      {variationPhotoAttribute === "color" && groups.length > 0 ? (
        <div className="flex flex-col md:flex-row">
          <aside className="w-full shrink-0 border-b border-[#E5E5E5] md:w-52 md:border-b-0 md:border-r">
            <ul className="max-h-80 overflow-y-auto py-2">
              {groups.map((group) => {
                const selected = group.color === activeColor;
                const count = group.imageUrl ? 1 : 0;
                return (
                  <li key={group.color}>
                    <button
                      type="button"
                      onClick={() => setSelectedColor(group.color)}
                      className={`relative flex w-full items-center justify-between px-4 py-3 text-left text-sm transition ${
                        selected
                          ? "bg-[#E8F1FF] font-semibold text-[#191919]"
                          : "text-[#191919] hover:bg-[#F7F7F7]"
                      }`}
                    >
                      <span className="pr-2">{group.color}</span>
                      <span className="whitespace-nowrap text-xs font-normal text-[#707070]">
                        ({count}/{MAX_VARIANT_PHOTO_SLOTS} photos)
                      </span>
                      {selected ? (
                        <span className="absolute right-0 top-1/2 hidden h-0 w-0 -translate-y-1/2 border-y-8 border-l-8 border-y-transparent border-l-[#E8F1FF] md:block" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <div className="flex-1 p-4">
            {activeGroup ? (
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="w-full max-w-[220px]">
                  <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-[#E5E5E5] bg-[#F7F7F7]">
                    {activeGroup.imageUrl ? (
                      <>
                        <ProxiedImage
                          src={activeGroup.imageUrl}
                          alt={activeGroup.color}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => clearPhotoForColor(activeGroup.color)}
                          className="absolute right-2 top-2 rounded bg-white/90 px-2 py-1 text-xs font-semibold text-[#191919] shadow hover:bg-white"
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowPicker(true)}
                        className="flex h-full w-full flex-col items-center justify-center gap-2 text-sm text-[#3665F3]"
                      >
                        <span className="text-2xl" aria-hidden>
                          +
                        </span>
                        Add main photo
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-center text-xs font-semibold text-[#191919]">Main</p>
                </div>

                <div className="grid flex-1 grid-cols-3 gap-2 sm:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => setShowPicker(true)}
                    className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[#C5C5C5] bg-[#FAFAFA] text-xs font-semibold text-[#3665F3] hover:border-[#3665F3] hover:bg-[#F0F5FF]"
                  >
                    <span className="text-lg" aria-hidden>
                      🖼
                    </span>
                    Add
                  </button>
                  {Array.from({ length: MAX_VARIANT_PHOTO_SLOTS - 1 }).map((_, index) => (
                    <div
                      key={`slot-${index}`}
                      className="aspect-square rounded-lg border border-[#E5E5E5] bg-white"
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <p className="mt-3 text-xs text-[#707070]">
              {photoCount}/{MAX_VARIANT_PHOTO_SLOTS} photos for {activeGroup?.color ?? "this color"}.
              Choose a photo to set as the main image for this variation.
            </p>
          </div>
        </div>
      ) : null}

      {showPicker ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#191919]">
                Choose photo for {activeGroup?.color ?? "variation"}
              </h3>
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                className="text-sm text-[#707070] hover:text-[#191919]"
              >
                Close
              </button>
            </div>
            {availablePhotos.length === 0 ? (
              <p className="text-sm text-[#707070]">No product photos available. Add photos above first.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {availablePhotos.map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => activeGroup && assignPhotoToColor(activeGroup.color, url)}
                    className={`overflow-hidden rounded border hover:border-[#3665F3] ${
                      activeGroup?.imageUrl === url
                        ? "border-[#3665F3] ring-2 ring-[#3665F3]/40"
                        : "border-[#E5E5E5]"
                    }`}
                  >
                    <ProxiedImage src={url} alt="" className="aspect-square w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
