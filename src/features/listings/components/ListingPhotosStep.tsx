"use client";

import type { ListingPhotoDraft } from "@/types/listing-generator";

interface ListingPhotosStepProps {
  photos: ListingPhotoDraft[];
  onChange: (photos: ListingPhotoDraft[]) => void;
}

export function ListingPhotosStep({ photos, onChange }: ListingPhotosStepProps) {
  const selectedCount = photos.filter((photo) => photo.selected).length;

  function togglePhoto(index: number) {
    const next = photos.map((photo, i) =>
      i === index ? { ...photo, selected: !photo.selected } : photo,
    );

    if (next.filter((photo) => photo.selected).length > 24) return;
    onChange(next);
  }

  function movePhoto(from: number, to: number) {
    if (to < 0 || to >= photos.length) return;
    const next = [...photos];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[#111827]">Select listing photos</h2>
          <p className="mt-1 text-sm text-[#6B7280]">
            First selected photo becomes the main eBay image. Maximum 24 photos.
          </p>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-[#374151]">
          {selectedCount}/24 selected
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo, index) => (
          <div
            key={`${photo.url}-${index}`}
            className={`overflow-hidden rounded-xl border ${
              photo.selected ? "border-brand ring-2 ring-brand/20" : "border-gray-200"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="" className="aspect-square w-full object-cover" />
            <div className="space-y-2 p-3">
              <button
                type="button"
                onClick={() => togglePhoto(index)}
                className={`w-full rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  photo.selected
                    ? "bg-brand text-white"
                    : "border border-gray-200 bg-white text-[#374151]"
                }`}
              >
                {photo.selected ? "Selected" : "Select"}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => movePhoto(index, index - 1)}
                  className="flex-1 rounded-lg border border-gray-200 px-2 py-1 text-xs disabled:opacity-40"
                >
                  Up
                </button>
                <button
                  type="button"
                  disabled={index === photos.length - 1}
                  onClick={() => movePhoto(index, index + 1)}
                  className="flex-1 rounded-lg border border-gray-200 px-2 py-1 text-xs disabled:opacity-40"
                >
                  Down
                </button>
              </div>
              {index === 0 && photo.selected ? (
                <p className="text-center text-[10px] font-semibold uppercase tracking-wide text-brand">
                  Main photo
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
