"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import type { HandlingProduct } from "@/types/handling";
import { AddProductFlow } from "./AddProductFlow";
import { HandlingProductCard } from "./HandlingProductCard";

export function ProductsHandlingShell() {
  const [userId, setUserId] = useState<string | null>(null);
  const [products, setProducts] = useState<HandlingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const loadProducts = useCallback(async (id: string) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/handling?userId=${encodeURIComponent(id)}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to load handling products.");
        return;
      }

      setProducts(data.products ?? []);
    } catch {
      setError("Network error while loading products.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = sessionStorage.getItem("ecomtools_user_id");
    if (id) {
      setUserId(id);
      loadProducts(id);
    } else {
      setLoading(false);
    }
  }, [loadProducts]);

  async function handleCheck(productId: string) {
    if (!userId) return;

    setCheckingId(productId);
    setNotice("");

    try {
      const response = await fetch("/api/handling/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, productId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setNotice(data.error ?? "Update check failed.");
        return;
      }

      setProducts(data.products ?? []);
      setNotice(data.message ?? "Update check completed.");
    } catch {
      setNotice("Network error while checking update.");
    } finally {
      setCheckingId(null);
    }
  }

  async function handleRemove(productId: string) {
    if (!userId) return;

    try {
      const response = await fetch(
        `/api/handling?userId=${encodeURIComponent(userId)}&productId=${encodeURIComponent(productId)}`,
        { method: "DELETE" },
      );

      const data = await response.json();

      if (!response.ok) {
        setNotice(data.error ?? "Failed to remove product.");
        return;
      }

      setProducts(data.products ?? []);
      setNotice("Product removed.");
    } catch {
      setNotice("Network error while removing product.");
    }
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1200px] p-6 lg:p-8">
        <header className="mb-8">
          <span className="inline-flex rounded-full border border-[#DDD6FE] bg-brand-light px-3 py-1 text-xs font-semibold text-brand">
            Inventory Tracking
          </span>
          <h1 className="mt-3 text-2xl font-bold text-[#111827] lg:text-3xl">Products Handling</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#6B7280]">
            Add AliExpress products by URL. Track price, stock, and order changes with automatic or
            manual updates. Email alerts are sent when something changes.
          </p>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {error}
          </div>
        )}

        {notice && (
          <div className="mb-6 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {notice}
          </div>
        )}

        {userId && (
          <div className="mb-8">
            <AddProductFlow userId={userId} onAdded={() => loadProducts(userId)} />
          </div>
        )}

        <div>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#111827]">Your handled products</h2>
              <p className="text-sm text-[#6B7280]">
                {products.length} product{products.length === 1 ? "" : "s"} being tracked
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <svg className="h-8 w-8 animate-spin text-brand" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-[#FAFAFA] px-6 py-12 text-center">
              <p className="text-sm font-semibold text-[#374151]">No handling products yet</p>
              <p className="mt-1 text-xs text-[#9CA3AF]">
                Add an AliExpress URL above to start tracking price and stock changes.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => (
                <HandlingProductCard
                  key={product.id}
                  product={product}
                  checking={checkingId === product.id}
                  onCheck={() => handleCheck(product.id)}
                  onRemove={() => handleRemove(product.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
