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
      <div className="overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/80 via-white to-indigo-50/60 p-6 shadow-md shadow-violet-100/40">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-indigo-600 shadow-md shadow-brand/25">
            <svg className="h-5 w-5 animate-spin text-white" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#111827]">AI is crafting your listing</p>
            <p className="mt-0.5 text-sm text-[#6B7280]">Generating optimized {platformName} content…</p>
          </div>
        </div>
      </div>,
    );
  }

  if (!product || !listing) {
    if (product && errorMessage) {
      return withAutoListingPanel(
        autoListingPanel,
        <div className="overflow-hidden rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 to-rose-50/80 p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
              !
            </span>
            <div>
              <p className="text-sm font-semibold text-red-800">Generation failed</p>
              <p className="mt-1 text-sm text-red-700">{errorMessage}</p>
              {onRetry ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-4 rounded-xl bg-gradient-to-r from-brand to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand/20 transition hover:shadow-lg"
                >
                  Retry
                </button>
              ) : null}
            </div>
          </div>
        </div>,
      );
    }

    return withAutoListingPanel(
      autoListingPanel,
      <div className="rounded-2xl border border-dashed border-violet-200/80 bg-gradient-to-br from-violet-50/40 to-white p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-xl">
          ✨
        </div>
        <p className="mt-4 text-sm font-medium text-[#374151]">
          Complete the VeRO check to generate your editable listing preview.
        </p>
      </div>,
    );
  }

  return withAutoListingPanel(
    autoListingPanel,
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-violet-100 bg-white p-6 shadow-md shadow-violet-100/30">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-violet-100/70 to-indigo-100/40" />
        <div className="relative flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-sm text-white shadow-sm">
            📦
          </span>
          <h2 className="text-base font-bold text-[#111827]">Source product</h2>
        </div>
        <div className="relative mt-4 flex gap-4">
          {product.imageUrl ? (
            <ProxiedImage
              src={product.imageUrl}
              alt={product.title}
              className="h-24 w-24 rounded-xl border-2 border-white object-cover shadow-md ring-2 ring-violet-100"
            />
          ) : null}
          <div className="min-w-0">
            <p className="font-semibold leading-snug text-[#111827]">{product.title}</p>
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[#6B7280]">{product.description}</p>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-white via-violet-50/30 to-indigo-50/40 p-6 shadow-md shadow-indigo-100/30">
        <div className="mb-5 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-indigo-600 text-sm text-white shadow-sm">
            ✨
          </span>
          <h2 className="text-base font-bold text-[#111827]">Edit listing preview</h2>
          <span className="ml-auto rounded-full bg-brand/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
            AI generated
          </span>
        </div>
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
