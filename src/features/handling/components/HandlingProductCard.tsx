"use client";

import { useEffect, useMemo, useState } from "react";
import type { HandlingProduct, HandlingProductVariant } from "@/types/handling";

function scheduleLabel(product: HandlingProduct): string {
  if (product.updateMode === "auto_24h") return "Updates every 24 hours";
  if (product.updateMode === "custom") {
    return `Updates every ${product.updateIntervalHours ?? "—"} hours`;
  }
  return "Manual updates";
}

function formatVariantPrice(variant: HandlingProductVariant): string {
  if (variant.currency === "GBP") return `£${variant.price.toFixed(2)}`;
  if (variant.currency === "USD") return `$${variant.price.toFixed(2)}`;
  if (variant.currency === "EUR") return `€${variant.price.toFixed(2)}`;
  return `${variant.currency} ${variant.price.toFixed(2)}`;
}

export function HandlingProductCard({
  product,
  onCheck,
  onRemove,
  checking,
  checkDisabled = false,
}: {
  product: HandlingProduct;
  onCheck: () => void;
  onRemove: () => void;
  checking: boolean;
  checkDisabled?: boolean;
}) {
  const defaultVariantId =
    product.selectedVariantId ?? product.variants?.[0]?.id ?? "";
  const [selectedVariantId, setSelectedVariantId] = useState(defaultVariantId);

  useEffect(() => {
    setSelectedVariantId(product.selectedVariantId ?? product.variants?.[0]?.id ?? "");
  }, [product.id, product.selectedVariantId, product.variants]);

  const selectedVariant = useMemo(() => {
    if (!product.variants?.length) return null;
    return (
      product.variants.find((variant) => variant.id === selectedVariantId) ??
      product.variants[0]
    );
  }, [product.variants, selectedVariantId]);

  const displayPrice = selectedVariant
    ? formatVariantPrice(selectedVariant)
    : product.price;
  const displayStock = selectedVariant?.stock ?? product.stock;

  return (
    <article className="flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:border-brand/20 hover:shadow-md">
      <div className="mb-4 flex items-start gap-3">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.title}
            className="h-16 w-16 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-brand-light text-xs text-brand">
            No image
          </div>
        )}
        <span className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-semibold text-brand">
          {scheduleLabel(product)}
        </span>
      </div>

      <h3 className="mb-3 line-clamp-2 text-base font-bold text-[#111827]">
        <a
          href={product.productUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-brand hover:underline"
        >
          {product.title}
        </a>
      </h3>

      {product.variants && product.variants.length > 0 ? (
        <div className="mb-4">
          <label className="mb-1 block text-[10px] font-medium uppercase text-[#9CA3AF]">
            Variant
          </label>
          <select
            value={selectedVariant?.id ?? ""}
            onChange={(event) => setSelectedVariantId(event.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#111827] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            {product.variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.label} - {formatVariantPrice(variant)}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-3 gap-2 border-t border-gray-50 pt-4">
        <div>
          <p className="text-[10px] font-medium uppercase text-[#9CA3AF]">Price</p>
          <p className="text-sm font-bold text-[#111827]">{displayPrice}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase text-[#9CA3AF]">Max qty</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-bold text-[#111827]">{displayStock ?? "—"}</p>
            {product.stockChangeDirection === "up" ? (
              <span className="text-sm font-bold text-emerald-600" aria-label="Stock increased">
                ↑
              </span>
            ) : null}
            {product.stockChangeDirection === "down" ? (
              <span className="text-sm font-bold text-red-600" aria-label="Stock decreased">
                ↓
              </span>
            ) : null}
            {displayStock === 0 ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">
                OUT OF STOCK
              </span>
            ) : null}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase text-[#9CA3AF]">Orders</p>
          <p className="text-sm font-bold text-[#111827]">{product.orders ?? "—"}</p>
        </div>
      </div>

      <p className="text-xs text-[#9CA3AF]">
        Last checked {product.lastCheckedAt ?? "never"}
      </p>

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        {product.updateMode === "manual" && (
          <button
            type="button"
            onClick={onCheck}
            disabled={checking || checkDisabled}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {checking ? "Checking..." : "Check update"}
          </button>
        )}
        <a
          href={product.productUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-xl border border-brand/20 bg-brand-light px-4 py-2.5 text-sm font-semibold text-brand hover:bg-brand/10"
        >
          View on AliExpress
        </a>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100"
        >
          Remove
        </button>
      </div>
    </article>
  );
}
