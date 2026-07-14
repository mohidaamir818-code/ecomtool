"use client";

import type { ListingPhotoDraft, ListingProductSource } from "@/types/listing-generator";
import { ProxiedImage } from "./ProxiedImage";

interface EbayDescriptionImagesPanelProps {
  descriptionPhotos: ListingPhotoDraft[];
  product: ListingProductSource;
  onChange: (photos: ListingPhotoDraft[]) => void;
}

export function EbayDescriptionImagesPanel({
  descriptionPhotos,
  onChange,
}: EbayDescriptionImagesPanelProps) {
  if (descriptionPhotos.length === 0) return null;

  const flaggedCount = descriptionPhotos.filter((photo) => photo.flagged).length;
  const selectedCount = descriptionPhotos.filter((photo) => photo.selected).length;

  function toggleSelected(index: number) {
    onChange(
      descriptionPhotos.map((photo, i) =>
        i === index ? { ...photo, selected: !photo.selected } : photo,
      ),
    );
  }

  return (
    <section className="mt-6 rounded border border-[#E5E5E5] bg-white">
      <div className="border-b border-[#E5E5E5] px-4 py-3">
        <h3 className="text-sm font-semibold text-[#191919]">Description Images</h3>
        <p className="mt-1 text-sm text-[#707070]">
          These images will appear at the bottom of your listing description
        </p>
        <p className="mt-2 text-xs font-medium text-[#707070]">
          {descriptionPhotos.length} description image
          {descriptionPhotos.length === 1 ? "" : "s"} · {selectedCount} selected for listing
        </p>
        {flaggedCount > 0 ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {flaggedCount} image{flaggedCount === 1 ? "" : "s"} flagged (country name, platform name,
            or dropshipping text). Unchecked by default — tick any you still want to list.
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4">
        {descriptionPhotos.map((photo, index) => (
          <label
            key={`${photo.url}-${index}`}
            className={`relative block aspect-square cursor-pointer overflow-hidden border bg-[#F7F7F7] ${
              photo.selected ? "border-[#3665F3] ring-2 ring-[#3665F3]/30" : "border-[#E5E5E5]"
            } ${photo.flagged ? "ring-2 ring-amber-400/70" : ""}`}
          >
            <input
              type="checkbox"
              checked={photo.selected}
              onChange={() => toggleSelected(index)}
              className="absolute left-2 top-2 z-10 h-4 w-4 rounded border-gray-300 text-[#3665F3]"
            />
            {photo.flagged ? (
              <span
                className="absolute right-2 top-2 z-10 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white shadow"
                title={photo.flagReason ?? "Flagged content"}
              >
                Flagged
              </span>
            ) : null}
            <ProxiedImage src={photo.url} alt="" className="h-full w-full object-cover" />
            {photo.flagged && photo.flagReason ? (
              <span className="absolute inset-x-0 bottom-0 z-10 bg-amber-900/85 px-1.5 py-1 text-[10px] leading-snug text-white">
                {photo.flagReason}
              </span>
            ) : null}
          </label>
        ))}
      </div>
    </section>
  );
}
