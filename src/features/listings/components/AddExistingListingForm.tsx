"use client";

import { useState } from "react";
import type { HandlingProductVariant } from "@/types/handling";
import type { LinkExistingVariantInput } from "@/types/listed-products";
import type { ListingPlatform } from "@/types/listing-generator";

interface AddExistingListingFormProps {
  userId: string;
  defaultPlatform?: ListingPlatform;
  onLinked?: () => void;
}

function suggestListedPrice(aliPrice: number): number {
  return Number((aliPrice * 2.5).toFixed(2));
}

function toVariantInputs(variants: HandlingProductVariant[]): LinkExistingVariantInput[] {
  return variants.map((variant) => ({
    aliVariantId: variant.id,
    label: variant.label,
    listedPrice: suggestListedPrice(variant.price),
    listedQuantity: Math.max(0, variant.stock ?? 1),
    sku: "",
    offerId: "",
  }));
}

export function AddExistingListingForm({
  userId,
  defaultPlatform = "ebay",
  onLinked,
}: AddExistingListingFormProps) {
  const [aliexpressUrl, setAliexpressUrl] = useState("");
  const [listingUrl, setListingUrl] = useState("");
  const [platform, setPlatform] = useState<ListingPlatform>(defaultPlatform);
  const [variants, setVariants] = useState<LinkExistingVariantInput[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [linking, setLinking] = useState(false);
  const [notice, setNotice] = useState("");
  const [isError, setIsError] = useState(false);

  async function loadVariants() {
    if (!aliexpressUrl.trim()) {
      setNotice("Paste an AliExpress product URL first.");
      setIsError(true);
      return;
    }

    setLoadingPreview(true);
    setNotice("");
    setIsError(false);

    try {
      const response = await fetch("/api/handling/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, url: aliexpressUrl.trim() }),
      });
      const data = await response.json();

      if (!response.ok) {
        setNotice(data.error ?? "Failed to load AliExpress variants.");
        setIsError(true);
        return;
      }

      const aliVariants = (data.product?.variants ?? []) as HandlingProductVariant[];
      if (aliVariants.length === 0 && data.product) {
        setVariants([
          {
            aliVariantId: "default",
            label: "Default",
            listedPrice: suggestListedPrice(Number(data.product.price ?? 0)),
            listedQuantity: Math.max(0, Number(data.product.stock ?? 1)),
            sku: "",
            offerId: "",
          },
        ]);
      } else {
        setVariants(toVariantInputs(aliVariants));
      }

      setNotice("Variants loaded. Set your live listing price and quantity for each, then add.");
      setIsError(false);
    } catch {
      setNotice("Network error while loading variants.");
      setIsError(true);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleLink() {
    if (!listingUrl.trim()) {
      setNotice("Paste your live eBay or Amazef listing URL.");
      setIsError(true);
      return;
    }
    if (variants.length === 0) {
      setNotice("Load variants from AliExpress first.");
      setIsError(true);
      return;
    }

    setLinking(true);
    setNotice("");
    setIsError(false);

    try {
      const response = await fetch("/api/listings/published/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          aliexpressUrl: aliexpressUrl.trim(),
          listingUrl: listingUrl.trim(),
          platform,
          variants,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setNotice(data.error ?? "Failed to link listing.");
        setIsError(true);
        return;
      }

      setAliexpressUrl("");
      setListingUrl("");
      setVariants([]);
      setNotice(data.message ?? "Listing linked.");
      setIsError(false);
      onLinked?.();
    } catch {
      setNotice("Network error while linking listing.");
      setIsError(true);
    } finally {
      setLinking(false);
    }
  }

  function updateVariant(index: number, patch: Partial<LinkExistingVariantInput>) {
    setVariants((current) =>
      current.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, ...patch } : variant,
      ),
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/40 p-5">
      <h3 className="text-sm font-semibold text-[#111827]">Add existing listing</h3>
      <p className="mt-1 text-xs text-[#6B7280]">
        Link a product you listed outside this tool. We monitor AliExpress and sync price/stock per
        variant.
      </p>

      <div className="mt-4 space-y-3">
        <label className="block text-xs font-medium text-[#374151]">
          AliExpress product URL
          <input
            type="url"
            value={aliexpressUrl}
            onChange={(event) => setAliexpressUrl(event.target.value)}
            placeholder="https://www.aliexpress.com/item/..."
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-[#374151]">
            Platform
            <select
              value={platform}
              onChange={(event) => setPlatform(event.target.value as ListingPlatform)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
            >
              <option value="ebay">eBay</option>
              <option value="amazef">Amazef</option>
            </select>
          </label>

          <label className="block text-xs font-medium text-[#374151]">
            Live listing URL
            <input
              type="url"
              value={listingUrl}
              onChange={(event) => setListingUrl(event.target.value)}
              placeholder={
                platform === "ebay"
                  ? "https://www.ebay.co.uk/itm/..."
                  : "https://amazef.com/products/..."
              }
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={() => void loadVariants()}
          disabled={loadingPreview}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-[#374151] hover:bg-gray-50 disabled:opacity-60"
        >
          {loadingPreview ? "Loading variants…" : "Load variants from AliExpress"}
        </button>

        {variants.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-gray-50 text-[#6B7280]">
                <tr>
                  <th className="px-3 py-2 font-medium">Variant</th>
                  <th className="px-3 py-2 font-medium">Your price</th>
                  <th className="px-3 py-2 font-medium">Qty</th>
                  <th className="px-3 py-2 font-medium">SKU (optional)</th>
                  {platform === "ebay" ? (
                    <th className="px-3 py-2 font-medium">Offer ID (optional)</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {variants.map((variant, index) => (
                  <tr key={variant.aliVariantId} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-[#111827]">{variant.label}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={variant.listedPrice}
                        onChange={(event) =>
                          updateVariant(index, { listedPrice: Number(event.target.value) })
                        }
                        className="w-24 rounded border border-gray-200 px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={variant.listedQuantity}
                        onChange={(event) =>
                          updateVariant(index, { listedQuantity: Number(event.target.value) })
                        }
                        className="w-20 rounded border border-gray-200 px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={variant.sku ?? ""}
                        onChange={(event) => updateVariant(index, { sku: event.target.value })}
                        className="w-28 rounded border border-gray-200 px-2 py-1"
                      />
                    </td>
                    {platform === "ebay" ? (
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={variant.offerId ?? ""}
                          onChange={(event) => updateVariant(index, { offerId: event.target.value })}
                          placeholder="For auto price sync"
                          className="w-32 rounded border border-gray-200 px-2 py-1"
                        />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {variants.length > 0 ? (
          <button
            type="button"
            onClick={() => void handleLink()}
            disabled={linking}
            className="rounded-lg bg-brand px-4 py-2.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {linking ? "Adding…" : "Add to monitoring"}
          </button>
        ) : null}

        {notice ? (
          <p className={`text-xs ${isError ? "text-red-600" : "text-emerald-700"}`}>{notice}</p>
        ) : null}
      </div>
    </div>
  );
}
