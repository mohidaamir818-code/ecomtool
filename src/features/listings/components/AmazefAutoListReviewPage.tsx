"use client";

import { useEffect, useState } from "react";
import type {
  ListingDraft,
  ListingPhotoDraft,
  ListingVariantDraft,
} from "@/types/listing-generator";
import { ensureAmazefOffers } from "@/features/listings/lib/amazef-offers";
import { ebayPrimaryButtonClass, ebaySecondaryButtonClass } from "@/features/listings/lib/ebay-ui";
import { AmazefBestOffersPanel } from "./AmazefBestOffersPanel";
import { EbayDescriptionImagesPanel } from "./EbayDescriptionImagesPanel";
import { EbayPhotosPanel } from "./EbayPhotosPanel";
import { EbayVariationPhotosPanel } from "./EbayVariationPhotosPanel";
import { EbayVariationsTable } from "./EbayVariationsTable";
import { ListingDescriptionEditor } from "./ListingDescriptionEditor";

interface AmazefAutoListReviewPageProps {
  userId: string;
  draft: ListingDraft;
  onChange: (patch: Partial<ListingDraft>) => void;
  onCancel: () => void;
  onListed: (listingUrl: string | null) => void;
}

export function AmazefAutoListReviewPage({
  userId,
  draft,
  onChange,
  onCancel,
  onListed,
}: AmazefAutoListReviewPageProps) {
  const [listingLoading, setListingLoading] = useState(false);
  const [flaggingDescriptionPhotos, setFlaggingDescriptionPhotos] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!draft.amazefOffers) {
      onChange(ensureAmazefOffers(draft));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const photos = draft.descriptionPhotos ?? [];
    if (photos.length === 0 || !photos.some((photo) => photo.flagged === undefined)) return;

    let cancelled = false;
    setFlaggingDescriptionPhotos(true);

    void (async () => {
      try {
        const response = await fetch("/api/listings/flag-description-photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, photos }),
        });
        const data = (await response.json()) as { photos?: ListingPhotoDraft[] };
        if (cancelled) return;
        if (!response.ok || !data.photos) {
          onChange({
            descriptionPhotos: photos.map((photo) => ({
              ...photo,
              flagged: photo.flagged ?? false,
              flagReason: photo.flagReason ?? null,
            })),
          });
          return;
        }
        onChange({ descriptionPhotos: data.photos });
      } catch {
        if (!cancelled) {
          onChange({
            descriptionPhotos: photos.map((photo) => ({
              ...photo,
              flagged: photo.flagged ?? false,
              flagReason: photo.flagReason ?? null,
            })),
          });
        }
      } finally {
        if (!cancelled) setFlaggingDescriptionPhotos(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, draft.descriptionPhotos]);

  function updateListing(patch: Partial<ListingDraft["listing"]>) {
    onChange({ listing: { ...draft.listing, ...patch } });
  }

  async function handleListOnAmazef() {
    setListingLoading(true);
    setMessage("");
    setIsError(false);

    if (draft.photos.some((photo) => photo.url.startsWith("blob:"))) {
      setMessage("Photos are still saving. Wait a second, then list again.");
      setIsError(true);
      setListingLoading(false);
      return;
    }

    if (flaggingDescriptionPhotos) {
      setMessage("Description images are still scanning. Wait a few seconds, then list again.");
      setIsError(true);
      setListingLoading(false);
      return;
    }

    const listingDraft = ensureAmazefOffers(draft);

    try {
      const response = await fetch("/api/amazef/list-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, draft: listingDraft }),
      });

      const data = (await response.json()) as {
        error?: string;
        result?: { listingUrl?: string | null };
      };

      if (!response.ok) {
        setMessage(data.error ?? "Failed to list on Amazef.");
        setIsError(true);
        return;
      }

      const url = data.result?.listingUrl ?? null;
      setMessage(url ? "Listed on Amazef successfully." : "Listing submitted to Amazef.");
      onListed(url);
    } catch {
      setMessage("Network error while listing on Amazef.");
      setIsError(true);
    } finally {
      setListingLoading(false);
    }
  }

  const categoryParts = draft.listing.categorySuggestion.split(">").map((part) => part.trim());
  const categoryLeaf = categoryParts[categoryParts.length - 1] || draft.listing.categorySuggestion;
  const categoryParent =
    categoryParts.length > 1 ? categoryParts.slice(0, -1).join(" > ") : null;
  const skuValue = draft.product.internalProductSku ?? "";

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-0 bg-white px-2 sm:px-4 lg:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-[#E5E5E5] pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#707070]">
            Review before listing
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#191919]">List your item</h1>
          <p className="mt-1 text-sm text-[#707070]">
            Everything is editable. Scroll through each section, then list when ready.
          </p>
        </div>
        <button type="button" onClick={onCancel} className={ebaySecondaryButtonClass}>
          Cancel
        </button>
      </div>

      <section className="border-b border-[#E5E5E5] pb-8">
        <EbayPhotosPanel
          photos={draft.photos}
          product={draft.product}
          variants={draft.variants}
          removedCount={draft.product.imageFilterMeta?.galleryRemoved ?? 0}
          onChange={(photos) => onChange({ photos })}
          userId={userId}
        />
        <div className="mt-6">
          {flaggingDescriptionPhotos ? (
            <p className="mb-2 text-xs text-[#707070]">Scanning description images…</p>
          ) : null}
          <EbayDescriptionImagesPanel
            descriptionPhotos={draft.descriptionPhotos ?? []}
            product={draft.product}
            onChange={(descriptionPhotos) => onChange({ descriptionPhotos })}
          />
        </div>
      </section>

      <section className="border-b border-[#E5E5E5] py-8">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#191919]">Title</h2>
        <label className="mt-5 block">
          <span className="text-sm font-medium text-[#191919]">Item title</span>
          <div className="relative mt-2">
            <input
              type="text"
              maxLength={80}
              value={draft.listing.seoTitle}
              onChange={(event) => updateListing({ seoTitle: event.target.value })}
              className="w-full rounded-lg border border-[#C5C5C5] bg-white px-3 py-3 pr-16 text-sm outline-none focus:border-[#3665F3]"
            />
            <span className="pointer-events-none absolute bottom-2 right-3 text-xs text-[#707070]">
              {draft.listing.seoTitle.length}/80
            </span>
          </div>
        </label>

        <label className="mt-5 block max-w-md">
          <span className="text-sm font-medium text-[#191919]">Custom label (SKU)</span>
          <div className="relative mt-2">
            <input
              type="text"
              maxLength={50}
              value={skuValue}
              onChange={(event) =>
                onChange({
                  product: {
                    ...draft.product,
                    internalProductSku: event.target.value.slice(0, 50),
                  },
                })
              }
              className="w-full rounded-lg border border-[#C5C5C5] bg-white px-3 py-3 pr-14 text-sm outline-none focus:border-[#3665F3]"
            />
            <span className="pointer-events-none absolute bottom-2 right-3 text-xs text-[#707070]">
              {skuValue.length}/50
            </span>
          </div>
        </label>

        <div className="mt-8 border-t border-[#E5E5E5] pt-8">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#191919]">Item category</h2>
          <div className="mt-4">
            <p className="text-sm font-semibold text-[#3665F3]">{categoryLeaf || "No category"}</p>
            {categoryParent ? (
              <p className="mt-1 text-sm text-[#707070]">in {categoryParent}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="border-b border-[#E5E5E5] py-8">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#191919]">Description</h2>
        <div className="mt-4">
          <ListingDescriptionEditor
            value={draft.listing.descriptionHtml}
            onChange={(descriptionHtml) => updateListing({ descriptionHtml })}
            descriptionPhotos={draft.descriptionPhotos}
          />
        </div>
      </section>

      <section className="border-b border-[#E5E5E5] py-8">
        <h2 className="text-xl font-bold text-[#191919]">Variations</h2>
        <div className="mt-4">
          <EbayVariationPhotosPanel draft={draft} onChange={onChange} />
        </div>
        <div className="mt-4">
          <EbayVariationsTable
            draft={draft}
            onChange={(variants: ListingVariantDraft[]) => onChange({ variants })}
            allowVariantPhotos={(draft.variationPhotoAttribute ?? "default") === "color"}
          />
        </div>
      </section>

      <section className="border-b border-[#E5E5E5] py-8">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-[#191919]">Best offer</h2>
        <AmazefBestOffersPanel userId={userId} draft={ensureAmazefOffers(draft)} onChange={onChange} />
      </section>

      <section className="py-8">
        {message ? (
          <p
            className={`mb-4 whitespace-pre-wrap rounded-lg border px-4 py-3 text-sm ${
              isError
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {message}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={listingLoading}
            onClick={() => void handleListOnAmazef()}
            className={ebayPrimaryButtonClass}
          >
            {listingLoading ? "Listing…" : "List on Amazef"}
          </button>
          <button type="button" onClick={onCancel} className={ebaySecondaryButtonClass}>
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}
