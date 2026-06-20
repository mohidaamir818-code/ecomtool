"use client";

import type { ListingDraft } from "@/types/listing-generator";
import { formatListingPrice } from "@/features/listings/lib/draft-utils";
import { ProxiedImage } from "./ProxiedImage";

interface ListingPreviewModalProps {
  draft: ListingDraft;
  onClose: () => void;
}

export function ListingPreviewModal({ draft, onClose }: ListingPreviewModalProps) {
  const mainPhoto = draft.photos[0]?.url;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#E5E5E5] px-5 py-4">
          <h3 className="text-lg font-semibold text-[#191919]">Listing preview</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-[#707070] hover:text-[#191919]"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 p-5">
          {mainPhoto ? (
            <div className="mx-auto h-48 w-48 overflow-hidden border border-[#E5E5E5]">
              <ProxiedImage src={mainPhoto} alt="" className="h-full w-full object-cover" />
            </div>
          ) : null}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#707070]">Title</p>
            <p className="mt-1 text-sm font-medium text-[#191919]">{draft.listing.seoTitle}</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#707070]">
              Variations ({draft.variants.length})
            </p>
            <ul className="mt-2 space-y-1 text-sm text-[#191919]">
              {draft.variants.map((variant) => (
                <li key={variant.id} className="flex justify-between gap-4">
                  <span>{variant.label}</span>
                  <span className="font-medium">
                    {formatListingPrice(variant.price, draft.listing.currency)} × {variant.quantity}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#707070]">Description</p>
            <div
              className="prose prose-sm mt-2 max-w-none text-[#191919]"
              dangerouslySetInnerHTML={{ __html: draft.listing.descriptionHtml }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
