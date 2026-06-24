"use client";

import type { ReactNode } from "react";
import type { GeneratedListing, ListingPhotoDraft, ListingPlatform, ListingProductSource } from "@/types/listing-generator";
import { listingPlatformLabel } from "@/features/listings/lib/vero-platform";
import { ListingPreviewEditor } from "./ListingPreviewEditor";
import { ProxiedImage } from "./ProxiedImage";

interface AiListingGeneratorProps {
  userId: string;
  product: ListingProductSource | null;
  listing: GeneratedListing | null;
  loading?: boolean;
  platform?: ListingPlatform;
  errorMessage?: string;
  onRetry?: () => void;
  onListingChange?: (listing: GeneratedListing) => void;
  descriptionPhotos?: ListingPhotoDraft[];
  autoListingPanel?: ReactNode;
}

function withAutoListingPanel(panel: ReactNode | undefined, content: ReactNode) {
  if (!panel) return content;
  return (
    <div className="space-y-4">
      {panel}
      {content}
    </div>
  );
}

export function AiListingGenerator({
  userId,
  product,
  listing,
  loading = false,
  platform = "ebay",
  errorMessage,
  onRetry,
  onListingChange,
  descriptionPhotos,
  autoListingPanel,
}: AiListingGeneratorProps) {
  const platformName = listingPlatformLabel(platform);
  if (loading) {
    return withAutoListingPanel(
      autoListingPanel,
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <svg className="h-5 w-5 animate-spin text-brand" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-[#6B7280]">Generating {platformName} listing with AI...</p>
        </div>
      </div>,
    );
  }

  if (!product || !listing) {
    if (product && errorMessage) {
      return withAutoListingPanel(
        autoListingPanel,
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-800">{errorMessage}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Retry
            </button>
          ) : null}
        </div>,
      );
    }

    return withAutoListingPanel(
      autoListingPanel,
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-sm text-[#6B7280]">
        Complete the VeRO check to generate your editable listing preview.
      </div>,
    );
  }

  return withAutoListingPanel(
    autoListingPanel,
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
          descriptionPhotos={descriptionPhotos}
        />
      </div>
    </div>,
  );
}
