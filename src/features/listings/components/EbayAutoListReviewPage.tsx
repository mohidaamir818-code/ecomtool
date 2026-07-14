"use client";

import { useEffect, useState } from "react";
import type {
  EbayCategorySuggestion,
  ListingDraft,
  ListingPhotoDraft,
  ListingVariantDraft,
  VolumePromotionTier,
} from "@/types/listing-generator";
import type { EbayConditionOption } from "@/lib/listings/item-specifics";
import { ebayPrimaryButtonClass, ebaySecondaryButtonClass } from "@/features/listings/lib/ebay-ui";
import { EbayConditionSelector } from "./EbayConditionSelector";
import { EbayDescriptionImagesPanel } from "./EbayDescriptionImagesPanel";
import { EbayItemSpecificsForm } from "./EbayItemSpecificsForm";
import { EbayPhotosPanel } from "./EbayPhotosPanel";
import { EbayVariationPhotosPanel } from "./EbayVariationPhotosPanel";
import { EbayVariationsTable } from "./EbayVariationsTable";
import { ListingDescriptionEditor } from "./ListingDescriptionEditor";
import { ListingShippingReturnsStep } from "./ListingShippingReturnsStep";

const DISCOUNT_OPTIONS = [0, 2, 5, 10, 15, 20, 25, 30];

interface EbayAutoListReviewPageProps {
  userId: string;
  draft: ListingDraft;
  addressConfirmed?: boolean;
  onChange: (patch: Partial<ListingDraft>) => void;
  onCancel: () => void;
  onListed: (listingUrl: string | null) => void;
}

export function EbayAutoListReviewPage({
  userId,
  draft,
  addressConfirmed = false,
  onChange,
  onCancel,
  onListed,
}: EbayAutoListReviewPageProps) {
  const [categoryQuery, setCategoryQuery] = useState(draft.listing.categorySuggestion);
  const [categories, setCategories] = useState<EbayCategorySuggestion[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [editingCategory, setEditingCategory] = useState(false);
  const [listingLoading, setListingLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const offersEnabled = draft.promotions.some((tier) => tier.enabled);

  useEffect(() => {
    setCategoryQuery(draft.listing.categorySuggestion);
  }, [draft.listing.categorySuggestion]);

  useEffect(() => {
    if (!editingCategory || categoryQuery.trim().length < 2) {
      setCategories([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setLoadingCategories(true);
      try {
        const params = new URLSearchParams({
          userId,
          query: categoryQuery.trim(),
        });
        const response = await fetch(`/api/ebay/categories?${params.toString()}`);
        const data = await response.json();
        setCategories(response.ok ? (data.categories ?? []) : []);
      } finally {
        setLoadingCategories(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [categoryQuery, userId, editingCategory]);

  function updateListing(patch: Partial<ListingDraft["listing"]>) {
    onChange({ listing: { ...draft.listing, ...patch } });
  }

  function handleConditionChange(condition: EbayConditionOption) {
    updateListing({ condition });
  }

  function handlePhotosChange(photos: ListingPhotoDraft[]) {
    onChange({ photos });
  }

  function handleDescriptionPhotosChange(descriptionPhotos: ListingPhotoDraft[]) {
    onChange({ descriptionPhotos });
  }

  function handleVariantsChange(variants: ListingVariantDraft[]) {
    onChange({ variants });
  }

  function setOffersEnabled(enabled: boolean) {
    const promotions = draft.promotions.map((tier) => ({
      ...tier,
      enabled: enabled ? tier.enabled || tier.quantity === 2 || tier.quantity === 3 : false,
    }));
    if (enabled && !promotions.some((tier) => tier.enabled)) {
      onChange({
        promotions: promotions.map((tier) =>
          tier.quantity === 2 || tier.quantity === 3 ? { ...tier, enabled: true } : tier,
        ),
      });
      return;
    }
    onChange({ promotions });
  }

  function updatePromotion(quantity: number, patch: Partial<VolumePromotionTier>) {
    onChange({
      promotions: draft.promotions.map((tier) =>
        tier.quantity === quantity ? { ...tier, ...patch } : tier,
      ),
    });
  }

  async function handleListOnEbay() {
    setListingLoading(true);
    setMessage("");
    setIsError(false);

    const hasPendingLocalPhotos = draft.photos.some((photo) => photo.url.startsWith("blob:"));
    if (hasPendingLocalPhotos) {
      setMessage("Photos are still saving. Wait a second, then list again.");
      setIsError(true);
      setListingLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/ebay/list-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, draft }),
      });

      const data = (await response.json()) as {
        error?: string;
        details?: string;
        result?: { listingUrl?: string | null };
      };

      if (!response.ok) {
        const parts = [data.error ?? "Failed to list on eBay."];
        if (data.details) {
          const detailsText = String(data.details);
          parts.push(detailsText.length > 1200 ? `${detailsText.slice(0, 1200)}...` : detailsText);
        }
        setMessage(parts.join("\n\n"));
        setIsError(true);
        return;
      }

      const url = data.result?.listingUrl ?? null;
      setMessage(url ? "Listed on eBay successfully." : "Listing submitted to eBay.");
      onListed(url);
    } catch {
      setMessage("Network error while listing on eBay.");
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

      {/* 1. Product photos */}
      <section className="border-b border-[#E5E5E5] pb-8">
        <EbayPhotosPanel
          photos={draft.photos}
          product={draft.product}
          variants={draft.variants}
          removedCount={draft.product.imageFilterMeta?.galleryRemoved ?? 0}
          onChange={handlePhotosChange}
          userId={userId}
        />
        <div className="mt-6">
          <EbayDescriptionImagesPanel
            descriptionPhotos={draft.descriptionPhotos ?? []}
            product={draft.product}
            onChange={handleDescriptionPhotosChange}
          />
        </div>
      </section>

      {/* 2. Title + SKU + Category */}
      <section className="border-b border-[#E5E5E5] py-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#191919]">Title</h2>
        </div>

        <label className="mt-5 block">
          <span className="text-sm font-medium text-[#191919]">Item title</span>
          <div className="relative mt-2">
            <input
              type="text"
              maxLength={80}
              value={draft.listing.seoTitle}
              onChange={(event) => updateListing({ seoTitle: event.target.value })}
              className="w-full rounded-lg border border-[#C5C5C5] bg-white px-3 py-3 pr-16 text-sm text-[#191919] outline-none focus:border-[#3665F3]"
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
              className="w-full rounded-lg border border-[#C5C5C5] bg-white px-3 py-3 pr-14 text-sm text-[#191919] outline-none focus:border-[#3665F3]"
            />
            <span className="pointer-events-none absolute bottom-2 right-3 text-xs text-[#707070]">
              {skuValue.length}/50
            </span>
          </div>
        </label>

        <div className="mt-8 border-t border-[#E5E5E5] pt-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#191919]">
              Item category
            </h2>
            <button
              type="button"
              onClick={() => setEditingCategory((value) => !value)}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#3665F3] hover:underline"
            >
              Edit
            </button>
          </div>

          {!editingCategory ? (
            <div className="mt-4">
              <p className="text-sm font-semibold text-[#3665F3]">{categoryLeaf || "No category"}</p>
              {categoryParent ? (
                <p className="mt-1 text-sm text-[#707070]">in {categoryParent}</p>
              ) : null}
            </div>
          ) : (
            <div className="mt-4">
              <input
                type="text"
                value={categoryQuery}
                onChange={(event) => {
                  setCategoryQuery(event.target.value);
                  updateListing({
                    categorySuggestion: event.target.value,
                    categoryId: null,
                  });
                }}
                className="w-full rounded-lg border border-[#C5C5C5] bg-white px-3 py-3 text-sm text-[#191919] outline-none focus:border-[#3665F3]"
                placeholder="Search category"
              />
              {loadingCategories ? (
                <p className="mt-2 text-xs text-[#707070]">Loading categories…</p>
              ) : categories.length > 0 ? (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-[#E5E5E5] bg-white">
                  {categories.map((category) => (
                    <button
                      key={category.categoryId}
                      type="button"
                      onClick={() => {
                        setCategoryQuery(category.categoryPath);
                        updateListing({
                          categorySuggestion: category.categoryPath,
                          categoryId: category.categoryId,
                        });
                        setEditingCategory(false);
                      }}
                      className="block w-full border-b border-[#F2F2F2] px-3 py-2.5 text-left text-sm text-[#191919] hover:bg-[#F7F7F7] last:border-b-0"
                    >
                      {category.categoryPath}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>

      {/* 3. Condition */}
      <section className="border-b border-[#E5E5E5] py-8">
        <EbayConditionSelector
          value={draft.listing.condition}
          onChange={handleConditionChange}
        />
      </section>

      {/* 4. Description */}
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

      {/* 5. Item specifics */}
      <section className="border-b border-[#E5E5E5] py-8">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#191919]">Item specifics</h2>
        <div className="mt-4">
          <EbayItemSpecificsForm
            userId={userId}
            categoryId={draft.listing.categoryId}
            itemSpecifics={draft.listing.itemSpecifics}
            onChange={(itemSpecifics) => updateListing({ itemSpecifics })}
          />
        </div>
      </section>

      {/* 6. Variations */}
      <section className="border-b border-[#E5E5E5] py-8">
        <h2 className="text-xl font-bold text-[#191919]">Variations</h2>
        <div className="mt-4">
          <EbayVariationPhotosPanel draft={draft} onChange={onChange} />
        </div>

        <div className="mt-4">
          <EbayVariationsTable
            draft={draft}
            onChange={handleVariantsChange}
            allowVariantPhotos={(draft.variationPhotoAttribute ?? "default") === "color"}
          />
        </div>
      </section>

      {/* 7. Best offer / volume discounts */}
      <section className="border-b border-[#E5E5E5] py-8">
        <div className="rounded-xl border border-[#E5E5E5] bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#191919]">Best offer</h2>
              <p className="mt-1 text-sm text-[#707070]">
                Allow a discount when buyers purchase more than one item.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={offersEnabled}
              onClick={() => setOffersEnabled(!offersEnabled)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                offersEnabled ? "bg-[#3665F3]" : "bg-[#C5C5C5]"
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  offersEnabled ? "left-5" : "left-0.5"
                }`}
              />
            </button>
          </div>

          {offersEnabled ? (
            <>
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-[#E8F1FF] px-3 py-2.5 text-sm text-[#191919]">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#3665F3] text-[11px] font-bold text-white">
                  i
                </span>
                <p>
                  When you set Buy 2 items or more, we&apos;ll include them in the multi-buy purchase
                  experience.
                </p>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {draft.promotions.map((tier) => (
                  <label key={tier.quantity} className="block">
                    <span className="text-sm font-medium text-[#191919]">
                      Buy {tier.quantity} items or more
                    </span>
                    <select
                      value={tier.enabled ? tier.discountPercent : 0}
                      onChange={(event) => {
                        const discountPercent = Number(event.target.value);
                        updatePromotion(tier.quantity, {
                          enabled: discountPercent > 0,
                          discountPercent: discountPercent > 0 ? discountPercent : tier.discountPercent,
                        });
                      }}
                      className="mt-2 w-full rounded border border-[#C5C5C5] bg-white px-3 py-2.5 text-sm text-[#191919] outline-none focus:border-[#3665F3]"
                    >
                      <option value={0}>Off</option>
                      {DISCOUNT_OPTIONS.filter((value) => value > 0).map((value) => (
                        <option key={value} value={value}>
                          {value}%
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </section>

      {/* 8. Policies */}
      <section className="border-b border-[#E5E5E5] py-8">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-[#191919]">Policies</h2>
        <ListingShippingReturnsStep userId={userId} draft={draft} onChange={onChange} />
      </section>

      {/* List */}
      <section className="py-8">
        {!addressConfirmed ? (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Confirm your eBay warehouse address before listing.
          </p>
        ) : null}

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
            disabled={listingLoading || !addressConfirmed}
            onClick={() => void handleListOnEbay()}
            className={ebayPrimaryButtonClass}
          >
            {listingLoading ? "Listing…" : "List on eBay"}
          </button>
          <button type="button" onClick={onCancel} className={ebaySecondaryButtonClass}>
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}
