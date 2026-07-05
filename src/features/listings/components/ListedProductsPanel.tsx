"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ImportStoreModal } from "./ImportStoreModal";
import { ListedProductEditModal } from "./ListedProductEditModal";
import { ProxiedImage } from "./ProxiedImage";
import type { ListedProduct } from "@/types/listed-products";
import type { ListingPlatform } from "@/types/listing-generator";

interface ListedProductsPanelProps {
  userId: string | null;
  platform: ListingPlatform;
  refreshKey?: number;
}

function formatPrice(price: number, currency: string): string {
  if (currency === "GBP") return `£${price.toFixed(2)}`;
  if (currency === "USD") return `$${price.toFixed(2)}`;
  return `${currency} ${price.toFixed(2)}`;
}

function displayPrice(product: ListedProduct): string {
  if (product.variants.length === 0) return formatPrice(0, product.currency);
  const prices = product.variants.map((variant) => variant.listedPrice);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return formatPrice(min, product.currency);
  return `${formatPrice(min, product.currency)} – ${formatPrice(max, product.currency)}`;
}

export function ListedProductsPanel({ userId, platform, refreshKey = 0 }: ListedProductsPanelProps) {
  const [products, setProducts] = useState<ListedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [showImportStore, setShowImportStore] = useState(false);

  const platformLabel = platform === "ebay" ? "eBay" : "Amazef";

  const loadProducts = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/listings/published?userId=${encodeURIComponent(userId)}`);
      const data = await response.json();
      if (response.ok && data.products) {
        setProducts(data.products as ListedProduct[]);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts, refreshKey]);

  const filteredProducts = useMemo(
    () => products.filter((product) => product.platform === platform),
    [platform, products],
  );

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

  if (!userId) {
    return null;
  }

  return (
    <>
      <section className="mt-10 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/30 via-white to-indigo-50/20 p-6 pt-8">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand">Your store</p>
            <h2 className="mt-1 text-lg font-bold text-[#111827]">Your {platformLabel} listings</h2>
            <p className="mt-1 text-sm text-[#6B7280]">
              Products listed through ecomtool. AliExpress changes auto-update price and stock.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowImportStore(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand/20 transition hover:shadow-lg hover:shadow-brand/30"
          >
            <span aria-hidden>↓</span>
            Import store
          </button>
        </div>

        {loading && filteredProducts.length === 0 ? (
          <p className="text-sm text-[#6B7280]">Loading listings…</p>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-violet-200/80 bg-white/60 px-5 py-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-xl">
              📋
            </div>
            <p className="mt-3 text-sm font-semibold text-[#374151]">No {platformLabel} listings yet</p>
            <p className="mt-1 text-xs text-[#6B7280]">
              List a product above and it will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredProducts.map((product) => {
              const imageUrl = product.imageUrl ?? product.variants[0]?.imageUrl ?? "";
              const viewUrl = product.listingUrl;

              return (
                <article
                  key={product.id}
                  className="flex gap-4 rounded-xl border border-violet-100/80 bg-white p-4 shadow-sm transition-all hover:border-violet-200 hover:shadow-md"
                >
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                    {imageUrl ? (
                      <ProxiedImage
                        src={imageUrl}
                        alt={product.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-[#9CA3AF]">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-[#111827]">{product.title}</h3>
                      <p className="mt-1 text-lg font-bold text-brand">{displayPrice(product)}</p>
                      {product.variants.length > 1 ? (
                        <p className="mt-1 text-xs text-[#6B7280]">
                          {product.variants.length} variants
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingProductId(product.id)}
                        className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#374151] hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={removingId === product.id}
                        onClick={() => void handleRemove(product.id)}
                        className="rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                      >
                        {removingId === product.id ? "Removing…" : "Remove"}
                      </button>
                      {viewUrl ? (
                        <a
                          href={viewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-brand/20 bg-brand/5 px-3.5 py-2 text-xs font-semibold text-brand hover:bg-brand/10"
                        >
                          View
                        </a>
                      ) : (
                        <span className="rounded-lg border border-gray-100 px-3.5 py-2 text-xs font-semibold text-[#9CA3AF]">
                          View
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {editingProductId ? (
        <ListedProductEditModal
          userId={userId}
          productId={editingProductId}
          platformLabel={platformLabel}
          onClose={() => setEditingProductId(null)}
          onSaved={() => {
            setEditingProductId(null);
            void loadProducts();
          }}
        />
      ) : null}

      {showImportStore ? (
        <ImportStoreModal
          userId={userId}
          platform={platform}
          onClose={() => setShowImportStore(false)}
          onLinked={() => {
            void loadProducts();
          }}
        />
      ) : null}
    </>
  );
}
