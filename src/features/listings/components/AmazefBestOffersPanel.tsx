"use client";

import { useRef, useState } from "react";
import type { AmazefCustomGift, ListingDraft, ListingVariantDraft } from "@/types/listing-generator";
import {
  calcFlashSaleDiscountPercent,
  calcFlashSalePriceFromDiscount,
  emptyCustomGift,
} from "@/features/listings/lib/amazef-offers";
import { ProxiedImage } from "./ProxiedImage";

interface AmazefBestOffersPanelProps {
  userId: string;
  draft: ListingDraft;
  onChange: (patch: Partial<ListingDraft>) => void;
}

export function AmazefBestOffersPanel({ userId, draft, onChange }: AmazefBestOffersPanelProps) {
  const offers = draft.amazefOffers;
  const giftUploadRef = useRef<HTMLInputElement>(null);
  const [pendingGiftId, setPendingGiftId] = useState<string | null>(null);
  const [uploadingGiftId, setUploadingGiftId] = useState<string | null>(null);
  const [discountManual, setDiscountManual] = useState(false);

  if (!offers) return null;

  function patchOffers(next: Partial<NonNullable<ListingDraft["amazefOffers"]>>) {
    onChange({
      amazefOffers: {
        flashSale: { ...offers!.flashSale, ...(next.flashSale ?? {}) },
        bogo: { ...offers!.bogo, ...(next.bogo ?? {}) },
      },
    });
  }

  function updateFlashSale(patch: Partial<NonNullable<ListingDraft["amazefOffers"]>["flashSale"]>) {
    const flashSale = { ...offers!.flashSale, ...patch };
    if (!discountManual && (patch.originalPrice != null || patch.flashSalePrice != null)) {
      flashSale.discountPercent = calcFlashSaleDiscountPercent(
        flashSale.originalPrice,
        flashSale.flashSalePrice,
      );
    }
    patchOffers({ flashSale });
  }

  function updateDiscountPercent(value: number) {
    setDiscountManual(true);
    const discountPercent = Math.min(Math.max(value, 0), 99);
    patchOffers({
      flashSale: {
        ...offers!.flashSale,
        discountPercent,
        flashSalePrice: calcFlashSalePriceFromDiscount(
          offers!.flashSale.originalPrice,
          discountPercent,
        ),
      },
    });
  }

  function toggleVariant(variantId: string) {
    const selected = new Set(offers!.bogo.eligibleVariantIds);
    if (selected.has(variantId)) selected.delete(variantId);
    else selected.add(variantId);
    patchOffers({ bogo: { ...offers!.bogo, eligibleVariantIds: [...selected] } });
  }

  function updateCustomGift(giftId: string, patch: Partial<AmazefCustomGift>) {
    patchOffers({
      bogo: {
        ...offers!.bogo,
        customGifts: offers!.bogo.customGifts.map((gift) =>
          gift.id === giftId ? { ...gift, ...patch } : gift,
        ),
      },
    });
  }

  function addCustomGift() {
    const gift = emptyCustomGift();
    setPendingGiftId(gift.id);
    patchOffers({
      bogo: { ...offers!.bogo, customGifts: [...offers!.bogo.customGifts, gift] },
    });
  }

  function removeCustomGift(giftId: string) {
    patchOffers({
      bogo: {
        ...offers!.bogo,
        customGifts: offers!.bogo.customGifts.filter((gift) => gift.id !== giftId),
      },
    });
  }

  async function uploadGiftImage(giftId: string, file: File) {
    setUploadingGiftId(giftId);
    try {
      const form = new FormData();
      form.append("userId", userId);
      form.append("files", file);
      const response = await fetch("/api/listings/upload-photos", { method: "POST", body: form });
      const data = (await response.json()) as { urls?: string[] };
      if (!response.ok || !data.urls?.[0]) return;
      updateCustomGift(giftId, { imageUrl: data.urls[0] });
    } finally {
      setUploadingGiftId(null);
      setPendingGiftId(null);
    }
  }

  const currency = draft.listing.currency;

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-[#E5E5E5] bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">⭐</span>
              <h2 className="text-lg font-bold text-[#191919]">Flash Sale</h2>
            </div>
            <p className="mt-1 text-sm text-[#707070]">
              List this product in the home page Flash Deals carousel after approval.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#191919]">
            <input
              type="checkbox"
              checked={offers.flashSale.enabled}
              onChange={(event) => {
                if (event.target.checked) setDiscountManual(false);
                updateFlashSale({ enabled: event.target.checked });
              }}
              className="h-4 w-4 rounded border-gray-300 text-[#3665F3]"
            />
            Flash Sale
          </label>
        </div>

        {offers.flashSale.enabled ? (
          <>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm font-medium text-[#191919]">Original price (price to cut)</span>
                <div className="relative mt-2">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#707070]">
                    {currency}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={offers.flashSale.originalPrice || ""}
                    onChange={(event) => {
                      setDiscountManual(false);
                      updateFlashSale({ originalPrice: Number(event.target.value) || 0 });
                    }}
                    className="w-full rounded-lg border border-[#C5C5C5] bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#3665F3]"
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-[#191919]">Flash sale price</span>
                <div className="relative mt-2">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#707070]">
                    {currency}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={offers.flashSale.flashSalePrice || ""}
                    onChange={(event) => {
                      setDiscountManual(false);
                      updateFlashSale({ flashSalePrice: Number(event.target.value) || 0 });
                    }}
                    className="w-full rounded-lg border border-[#C5C5C5] bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#3665F3]"
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-[#191919]">Discount %</span>
                <input
                  type="number"
                  min={0}
                  max={99}
                  step={1}
                  value={offers.flashSale.discountPercent || ""}
                  onChange={(event) => updateDiscountPercent(Number(event.target.value) || 0)}
                  className="mt-2 w-full rounded-lg border border-[#C5C5C5] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3665F3]"
                />
              </label>
            </div>
            <p className="mt-3 text-xs text-[#707070]">
              Discount is calculated automatically from your prices. Edit the % field to override.
            </p>
          </>
        ) : null}
      </div>

      <div className="rounded-xl border border-[#E5E5E5] bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🎁</span>
              <h2 className="text-lg font-bold text-[#191919]">Buy One Get One Free</h2>
            </div>
            <p className="mt-1 text-sm text-[#707070]">
              List in the home page BOGO section. Buyers pick a paid variant, then choose their free
              gift.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#191919]">
            <input
              type="checkbox"
              checked={offers.bogo.enabled}
              onChange={(event) =>
                patchOffers({ bogo: { ...offers.bogo, enabled: event.target.checked } })
              }
              className="h-4 w-4 rounded border-gray-300 text-[#3665F3]"
            />
            Buy One Get One Free
          </label>
        </div>

        {offers.bogo.enabled ? (
          <>
            <div className="mt-5">
              <p className="text-sm font-semibold text-[#191919]">Eligible variants (this product)</p>
              <p className="mt-1 text-xs text-[#707070]">
                All variants are selected by default. Untick any the buyer should not receive free.
              </p>
              <div className="mt-3 space-y-2">
                {draft.variants.map((variant) => (
                  <VariantRow
                    key={variant.id}
                    variant={variant}
                    checked={offers.bogo.eligibleVariantIds.includes(variant.id)}
                    onToggle={() => toggleVariant(variant.id)}
                  />
                ))}
              </div>
            </div>

            <div className="mt-6 border-t border-[#E5E5E5] pt-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#191919]">Custom free gifts</p>
                  <p className="mt-1 text-xs text-[#707070]">
                    Add a different product or gift the buyer can choose for free.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addCustomGift}
                  className="rounded-lg border border-[#C5C5C5] bg-white px-3 py-2 text-sm font-semibold hover:bg-[#F7F7F7]"
                >
                  + Add custom gift
                </button>
              </div>

              {offers.bogo.customGifts.length > 0 ? (
                <div className="mt-4 space-y-4">
                  {offers.bogo.customGifts.map((gift) => (
                    <div key={gift.id} className="rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-4">
                      <div className="flex flex-wrap items-start gap-4">
                        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border bg-white">
                          {gift.imageUrl ? (
                            <ProxiedImage src={gift.imageUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-[#707070]">
                              No image
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-3">
                          <input
                            type="text"
                            value={gift.title}
                            onChange={(event) => updateCustomGift(gift.id, { title: event.target.value })}
                            placeholder="Gift title"
                            className="w-full rounded-lg border border-[#C5C5C5] bg-white px-3 py-2 text-sm outline-none focus:border-[#3665F3]"
                          />
                          <textarea
                            value={gift.description}
                            onChange={(event) =>
                              updateCustomGift(gift.id, { description: event.target.value })
                            }
                            placeholder="Gift description"
                            rows={2}
                            className="w-full rounded-lg border border-[#C5C5C5] bg-white px-3 py-2 text-sm outline-none focus:border-[#3665F3]"
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={uploadingGiftId === gift.id}
                              onClick={() => {
                                setPendingGiftId(gift.id);
                                giftUploadRef.current?.click();
                              }}
                              className="rounded-lg border border-[#3665F3] px-3 py-1.5 text-xs font-semibold text-[#3665F3] hover:bg-[#E8F1FF] disabled:opacity-50"
                            >
                              {uploadingGiftId === gift.id ? "Uploading…" : "Upload image"}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeCustomGift(gift.id)}
                              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      <input
        ref={giftUploadRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          const giftId = pendingGiftId;
          if (file && giftId) void uploadGiftImage(giftId, file);
          event.target.value = "";
        }}
      />
    </section>
  );
}

function VariantRow({
  variant,
  checked,
  onToggle,
}: {
  variant: ListingVariantDraft;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5">
      <span className="flex items-center gap-3">
        <input type="checkbox" checked={checked} onChange={onToggle} className="h-4 w-4" />
        <span className="text-sm font-medium text-[#191919]">{variant.label}</span>
      </span>
      {variant.imageUrl ? (
        <ProxiedImage src={variant.imageUrl} alt="" className="h-10 w-10 rounded object-cover" />
      ) : null}
    </label>
  );
}
