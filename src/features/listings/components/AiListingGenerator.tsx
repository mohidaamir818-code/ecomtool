"use client";

import type { GeneratedListing, ListingProductSource } from "@/types/listing-generator";
import { ListingPreviewEditor } from "./ListingPreviewEditor";
import { ProxiedImage } from "./ProxiedImage";

interface AiListingGeneratorProps {
  userId: string;
  product: ListingProductSource | null;
  listing: GeneratedListing | null;
  loading?: boolean;
  onListingChange?: (listing: GeneratedListing) => void;
}

export function AiListingGenerator({
  userId,
  product,
  listing,
  loading = false,
  onListingChange,
}: AiListingGeneratorProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <svg className="h-5 w-5 animate-spin text-brand" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-[#6B7280]">Generating eBay listing with AI...</p>
        </div>
      </div>
    );
  }

  if (!product || !listing) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-sm text-[#6B7280]">
        Complete the VeRO check to generate your editable listing preview.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-[#111827]">Source product</h2>
        <div className="mt-4 flex gap-4">
          {product.imageUrl ? (
            <ProxiedImage
              src={product.imageUrl}
              alt={product.title}
              className="h-24 w-24 rounded-lg border border-gray-100 object-cover"
            />
          ) : null}
          <div className="min-w-0">
            <p className="font-medium text-[#111827]">{product.title}</p>
            <p className="mt-1 line-clamp-3 text-sm text-[#6B7280]">{product.description}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-[#111827]">Edit listing preview</h2>
        <ListingPreviewEditor
          userId={userId}
          listing={listing}
          onChange={(next) => onListingChange?.(next)}
        />
      </div>
    </div>
  );
}
