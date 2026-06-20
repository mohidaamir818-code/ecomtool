"use client";

import { useState } from "react";
import type { ListingDraft, ListingPhotoDraft, ListingVariantDraft, VariationPhotoAttribute } from "@/types/listing-generator";
import {
  ebayPrimaryButtonClass,
  ebaySecondaryButtonClass,
  ebayTextButtonClass,
} from "@/features/listings/lib/ebay-ui";
import { EbayPhotosPanel } from "./EbayPhotosPanel";
import { EbayVariationsTable } from "./EbayVariationsTable";
import { ListingPreviewModal } from "./ListingPreviewModal";

interface ListingPhotosVariantsStepProps {
  draft: ListingDraft;
  onChange: (patch: Partial<ListingDraft>) => void;
  onSaveAndClose: () => void | Promise<void>;
  onSaveAndPreview: () => boolean | Promise<boolean>;
  onCancel: () => void;
  validationError?: string | null;
}

export function ListingPhotosVariantsStep({
  draft,
  onChange,
  onSaveAndClose,
  onSaveAndPreview,
  onCancel,
  validationError,
}: ListingPhotosVariantsStepProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const variationPhotoAttribute = draft.variationPhotoAttribute ?? "default";
  const allowVariantPhotos = variationPhotoAttribute === "color";

  function handlePhotosChange(photos: ListingPhotoDraft[]) {
    onChange({ photos });
  }

  function handleVariantsChange(variants: ListingVariantDraft[]) {
    onChange({ variants });
  }

  function handleVariationPhotoAttribute(value: VariationPhotoAttribute) {
    onChange({ variationPhotoAttribute: value });
  }

  async function handleSaveAndClose() {
    setSaving(true);
    try {
      await onSaveAndClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndPreview() {
    setSaving(true);
    try {
      const ok = await onSaveAndPreview();
      if (ok) setShowPreview(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-0">
      <EbayPhotosPanel
        photos={draft.photos}
        product={draft.product}
        variants={draft.variants}
        onChange={handlePhotosChange}
      />

      <section className="mt-6 rounded border border-[#E5E5E5] bg-white px-4 py-4">
        <h3 className="text-sm font-semibold text-[#191919]">Add variation photos</h3>
        <p className="mt-1 text-sm text-[#707070]">
          Change photos in your listing based on this attribute. This determines which photos buyers
          see when they select a variation option.
        </p>
        <select
          value={variationPhotoAttribute}
          onChange={(event) =>
            handleVariationPhotoAttribute(event.target.value as VariationPhotoAttribute)
          }
          className="mt-3 w-full max-w-xs rounded border border-[#C5C5C5] bg-white px-3 py-2 text-sm text-[#191919] outline-none focus:border-[#3665F3] sm:w-auto"
        >
          <option value="default">Use default photos</option>
          <option value="color">Color</option>
        </select>
      </section>

      <EbayVariationsTable
        draft={draft}
        onChange={handleVariantsChange}
        allowVariantPhotos={allowVariantPhotos}
      />

      {validationError ? (
        <p className="mt-4 rounded border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {validationError}
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-[#E5E5E5] pt-6">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSaveAndClose()}
          className={ebayPrimaryButtonClass}
        >
          Save and close
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSaveAndPreview()}
          className={ebaySecondaryButtonClass}
        >
          Save and preview
        </button>
        <button type="button" onClick={onCancel} className={ebayTextButtonClass}>
          Cancel
        </button>
      </div>

      {showPreview ? <ListingPreviewModal draft={draft} onClose={() => setShowPreview(false)} /> : null}
    </div>
  );
}
