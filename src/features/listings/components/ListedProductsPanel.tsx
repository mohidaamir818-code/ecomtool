"use client";

import { useCallback, useEffect, useState } from "react";
import type { ListedProduct } from "@/types/listed-products";

interface ListedProductsPanelProps {
  userId: string | null;
  refreshKey?: number;
}

function formatPrice(price: number, currency: string): string {
  if (currency === "GBP") return `£${price.toFixed(2)}`;
  if (currency === "USD") return `$${price.toFixed(2)}`;
  return `${currency} ${price.toFixed(2)}`;
}

function reviseUrl(product: ListedProduct): string | null {
  if (!product.listingUrl) return null;
  if (product.platform === "ebay" && product.listingId) {
    return `https://www.ebay.co.uk/sl/list?itemId=${encodeURIComponent(product.listingId)}`;
  }
  return product.listingUrl;
}

export function ListedProductsPanel({ userId, refreshKey = 0 }: ListedProductsPanelProps) {
  const [products, setProducts] = useState<ListedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/listings/published?userId=${encodeURIComponent(userId)}`);
      const data = await response.json();
      if (response.ok && data.products) {
        setProducts(data.products as ListedProduct[]);
        const defaults: Record<string, string> = {};
        for (const product of data.products as ListedProduct[]) {
          defaults[product.id] = product.variants[0]?.id ?? "";
        }
        setSelectedVariants(defaults);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts, refreshKey]);

  async function handleRemove(productId: string) {
    if (!userId) return;
    setRemovingId(productId);
    try {
      const response = await fetch("/api/listings/published", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, listedProductId: productId }),
      });
      if (response.ok) {
        setProducts((current) => current.filter((product) => product.id !== productId));
      }
    } finally {
      setRemovingId(null);
    }
  }

  if (!userId || (!loading && products.length === 0)) {
    return null;
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-[#111827]">Your listed products</h3>
      <p className="mt-1 text-xs text-[#6B7280]">
        Saved after successful listing. AliExpress changes auto-update price and stock per variant.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-[#6B7280]">Loading…</p>
      ) : (
        <div className="mt-4 space-y-4">
          {products.map((product) => {
            const selectedId = selectedVariants[product.id] ?? product.variants[0]?.id ?? "";
            const selectedVariant =
              product.variants.find((variant) => variant.id === selectedId) ?? product.variants[0];
            const displayPrice = selectedVariant?.listedPrice ?? 0;
            const editUrl = reviseUrl(product);

            return (
              <div key={product.id} className="rounded-lg border border-gray-100 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#111827]">{product.title}</p>
                    <p className="mt-1 text-sm text-brand">
                      {formatPrice(displayPrice, product.currency)}
                    </p>
                    {product.variants.length > 1 ? (
                      <label className="mt-2 block text-xs text-[#6B7280]">
                        Variant
                        <select
                          value={selectedId}
                          onChange={(event) =>
                            setSelectedVariants((current) => ({
                              ...current,
                              [product.id]: event.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5 text-sm text-[#111827]"
                        >
                          {product.variants.map((variant) => (
                            <option key={variant.id} value={variant.id}>
                              {variant.label} · {formatPrice(variant.listedPrice, product.currency)} ·
                              qty {variant.listedQuantity}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : selectedVariant ? (
                      <p className="mt-1 text-xs text-[#6B7280]">
                        {selectedVariant.label} · qty {selectedVariant.listedQuantity}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {product.listingUrl ? (
                    <a
                      href={product.listingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded border border-gray-200 px-3 py-1.5 text-xs font-semibold text-[#374151] hover:bg-gray-50"
                    >
                      See listing
                    </a>
                  ) : null}
                  {editUrl ? (
                    <a
                      href={editUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded border border-gray-200 px-3 py-1.5 text-xs font-semibold text-[#374151] hover:bg-gray-50"
                    >
                      Revise / Edit
                    </a>
                  ) : null}
                  <a
                    href={product.listingUrl ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded border border-brand/20 bg-brand/5 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/10"
                  >
                    View on {product.platform === "ebay" ? "eBay" : "Amazef"}
                  </a>
                  <button
                    type="button"
                    disabled={removingId === product.id}
                    onClick={() => void handleRemove(product.id)}
                    className="rounded border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
