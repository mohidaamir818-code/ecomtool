"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import {
  PlatformQuotaWidget,
  usePlatformQuota,
} from "@/features/quota/components/PlatformQuotaWidget";
import { QUOTA_EXCEEDED_MESSAGE } from "@/lib/quota/constants";
import type {
  SupplierProduct,
  SupplierSearchMode,
  SupplierSearchResponse,
  SupplierStockRegion,
} from "@/types/supplier-finder";

const PAGE_SIZE = 20;
const PHOTO_PAGE_SIZE = 50;

function formatPrice(price: number, currency: string): string {
  const symbol = currency === "USD" ? "$" : currency === "GBP" ? "£" : `${currency} `;
  return `${symbol}${price.toFixed(2)}`;
}

function formatOrders(orders: number | null): string {
  if (orders == null) return "—";
  if (orders >= 10000) return `${Math.floor(orders / 1000)}k+`;
  if (orders >= 1000) return `${(orders / 1000).toFixed(1).replace(/\.0$/, "")}k+`;
  return orders.toLocaleString();
}

function formatRating(rating: string | null): string {
  if (!rating?.trim()) return "—";
  const value = rating.trim();
  if (value.includes("%")) return value;
  if (value.includes("★")) return value;
  return `${value}%`;
}

function stockLabel(region: SupplierStockRegion): string {
  if (region === "uk") return "UK stock (3-day delivery)";
  if (region === "us") return "USA stock (3-day delivery)";
  if (region === "uk_random") return "Random UK stock (confirmed)";
  if (region === "us_random") return "Random USA stock (confirmed)";
  return "All suppliers";
}

function isRandomStockBrowse(region: SupplierStockRegion): boolean {
  return region === "uk_random" || region === "us_random";
}

function priceCurrency(region: SupplierStockRegion): string {
  if (region === "us" || region === "us_random") return "USD";
  return "GBP";
}

function priceSymbol(region: SupplierStockRegion): string {
  if (region === "us" || region === "us_random") return "$";
  return "£";
}

function formatPriceRangeLabel(
  minPrice: number | null | undefined,
  maxPrice: number | null | undefined,
  region: SupplierStockRegion,
): string | null {
  const symbol = priceSymbol(region);
  if (minPrice != null && maxPrice != null) {
    return `${symbol}${minPrice.toFixed(2)} – ${symbol}${maxPrice.toFixed(2)}`;
  }
  if (minPrice != null) return `from ${symbol}${minPrice.toFixed(2)}`;
  if (maxPrice != null) return `up to ${symbol}${maxPrice.toFixed(2)}`;
  return null;
}

export function SupplierFinderShell() {
  const [userId, setUserId] = useState<string | null>(null);
  const [mode, setMode] = useState<SupplierSearchMode>("keyword");
  const [query, setQuery] = useState("");
  const [stockRegion, setStockRegion] = useState<SupplierStockRegion>("any");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SupplierSearchResponse | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const aliQuota = usePlatformQuota(userId, "aliexpress");

  useEffect(() => {
    const id = sessionStorage.getItem("ecomtools_user_id");
    if (id) setUserId(id);
  }, []);

  const runSearch = useCallback(
    async (page: number, append: boolean) => {
      if (!userId) {
        setError("Please sign in again.");
        return;
      }

      if (!isRandomStockBrowse(stockRegion) && mode !== "photo" && query.trim().length < 2) {
        setError(mode === "title" ? "Enter a product title to search." : "Enter a keyword to search.");
        return;
      }

      if (mode === "photo" && !photoDataUrl) {
        setError("Upload a product photo first.");
        return;
      }

      const parsedMin = minPrice.trim() ? Number(minPrice) : null;
      const parsedMax = maxPrice.trim() ? Number(maxPrice) : null;

      if (parsedMin != null && (!Number.isFinite(parsedMin) || parsedMin < 0)) {
        setError("Enter a valid minimum price.");
        return;
      }

      if (parsedMax != null && (!Number.isFinite(parsedMax) || parsedMax < 0)) {
        setError("Enter a valid maximum price.");
        return;
      }

      if (parsedMin != null && parsedMax != null && parsedMin > parsedMax) {
        setError("Minimum price cannot be higher than maximum price.");
        return;
      }

      if (append) {
        setLoadingMore(true);
      } else {
        setSearching(true);
        setError("");
      }

      try {
        const response = await fetch("/api/suppliers/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            mode,
            query: mode === "photo" ? undefined : query.trim(),
            stockRegion,
            page,
            pageSize: mode === "photo" ? PHOTO_PAGE_SIZE : PAGE_SIZE,
            ...(parsedMin != null ? { minPrice: parsedMin } : {}),
            ...(parsedMax != null ? { maxPrice: parsedMax } : {}),
            ...(mode === "photo" && photoDataUrl ? { imageDataUrl: photoDataUrl } : {}),
          }),
        });

        const data = (await response.json()) as SupplierSearchResponse & { error?: string; message?: string };

        if (response.status === 429) {
          setError(data.message ?? QUOTA_EXCEEDED_MESSAGE);
          void aliQuota.reload();
          return;
        }

        if (!response.ok) {
          setError(data.error ?? "Supplier search failed.");
          return;
        }

        setResult((current) => {
          if (append && current) {
            return {
              ...data,
              products: [...current.products, ...data.products],
            };
          }
          return data;
        });

        void aliQuota.reload();
      } catch {
        setError("Network error while searching suppliers.");
      } finally {
        setSearching(false);
        setLoadingMore(false);
      }
    },
    [aliQuota, maxPrice, minPrice, mode, photoDataUrl, query, stockRegion, userId],
  );

  function handleSearch() {
    void runSearch(1, false);
  }

  function handleLoadMore() {
    if (!result?.hasMore || loadingMore) return;
    void runSearch((result.page ?? 1) + 1, true);
  }

  function applyPhotoFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPG, PNG, or WebP).");
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setError("Photo must be under 4 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      setPhotoDataUrl(dataUrl);
      setPhotoPreview(dataUrl);
      setError("");
      setResult(null);
    };
    reader.readAsDataURL(file);
  }

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    applyPhotoFile(file);
  }

  function handlePhotoDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    applyPhotoFile(file);
  }

  function handlePhotoDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handlePhotoDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
  }

  function clearPhoto() {
    setPhotoDataUrl(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand">Suppliers Finder</p>
            <h1 className="mt-2 text-2xl font-bold text-[#111827] lg:text-3xl">
              Find AliExpress suppliers
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#6B7280]">
              Search by keyword or title across the full AliExpress catalog. Upload a photo for
              visual search — results match your image like AliExpress search-by-image.
            </p>
          </div>
          {userId ? (
            <PlatformQuotaWidget userId={userId} platform="aliexpress" />
          ) : null}
        </div>

        <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["keyword", "Keyword"],
                ["title", "Title"],
                ["photo", "Photo"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setMode(value);
                  setError("");
                  setResult(null);
                }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  mode === value
                    ? "bg-brand text-white"
                    : "border border-gray-200 text-[#374151] hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "photo" ? (
            <div className="mt-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handlePhotoChange}
              />
              {photoPreview ? (
                <div
                  className={`flex flex-wrap items-start gap-4 rounded-xl border-2 border-dashed p-3 transition ${
                    isDragging ? "border-brand bg-brand/5" : "border-transparent"
                  }`}
                  onDragOver={handlePhotoDragOver}
                  onDragLeave={handlePhotoDragLeave}
                  onDrop={handlePhotoDrop}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoPreview}
                    alt="Uploaded product"
                    className="h-32 w-32 rounded-xl border border-gray-200 object-cover"
                  />
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-[#374151] hover:bg-gray-50"
                    >
                      Change photo
                    </button>
                    <button
                      type="button"
                      onClick={clearPhoto}
                      className="rounded-lg px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      Remove
                    </button>
                    <span className="text-xs text-[#6B7280]">Or drag & drop a new photo here</span>
                  </div>
                </div>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  onDragOver={handlePhotoDragOver}
                  onDragLeave={handlePhotoDragLeave}
                  onDrop={handlePhotoDrop}
                  className={`flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
                    isDragging
                      ? "border-brand bg-brand/10"
                      : "border-gray-200 hover:border-brand hover:bg-brand/5"
                  }`}
                >
                  <span className="text-sm font-semibold text-[#111827]">
                    {isDragging ? "Drop photo here" : "Upload or drag & drop a product photo"}
                  </span>
                  <span className="mt-1 text-xs text-[#6B7280]">
                    Visual search — finds products that look like your photo on AliExpress
                  </span>
                </div>
              )}
            </div>
          ) : (
            <label className="mt-4 block">
              <span className="text-sm font-medium text-[#111827]">
                {mode === "title" ? "Product title" : "Keyword"}
              </span>
              <input
                type="text"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setError("");
                  setResult(null);
                }}
                placeholder={
                  mode === "title"
                    ? "e.g. Wireless Bluetooth Earbuds with Charging Case"
                    : "e.g. wireless earbuds"
                }
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-brand"
              />
            </label>
          )}

          <div className="mt-4">
            <span className="text-sm font-medium text-[#111827]">Price range ({priceCurrency(stockRegion)})</span>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs text-[#6B7280]">Min price</span>
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#9CA3AF]">
                    {priceSymbol(stockRegion)}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={minPrice}
                    onChange={(event) => {
                      setMinPrice(event.target.value);
                      setError("");
                      setResult(null);
                    }}
                    placeholder="e.g. 10"
                    className="w-full rounded-xl border border-gray-200 py-3 pl-8 pr-4 text-sm outline-none focus:border-brand"
                  />
                </div>
              </label>
              <label className="block">
                <span className="text-xs text-[#6B7280]">Max price</span>
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#9CA3AF]">
                    {priceSymbol(stockRegion)}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={maxPrice}
                    onChange={(event) => {
                      setMaxPrice(event.target.value);
                      setError("");
                      setResult(null);
                    }}
                    placeholder="e.g. 15"
                    className="w-full rounded-xl border border-gray-200 py-3 pl-8 pr-4 text-sm outline-none focus:border-brand"
                  />
                </div>
              </label>
            </div>
            <p className="mt-2 text-xs text-[#6B7280]">
              Optional. Only products within your min–max price will be shown (e.g. {priceSymbol(stockRegion)}10 to {priceSymbol(stockRegion)}15).
            </p>
          </div>

          <div className="mt-4">
            <span className="text-sm font-medium text-[#111827]">Stock filter</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  ["any", "All"],
                  ["uk", "UK stock"],
                  ["us", "USA stock"],
                  ["uk_random", "Random UK"],
                  ["us_random", "Random USA"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStockRegion(value)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    stockRegion === value
                      ? "border border-brand bg-brand/10 text-brand"
                      : "border border-gray-200 text-[#374151] hover:bg-gray-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-[#6B7280]">
              UK / USA stock filters search results with 3–5 day local delivery. Random UK / USA
              browses confirmed local-stock products without a keyword.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSearch}
              disabled={searching}
              className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {searching
                ? "Searching…"
                : isRandomStockBrowse(stockRegion)
                  ? "Browse stock"
                  : "Find suppliers"}
            </button>
            {searching ? (
              <span className="text-xs text-[#6B7280]">
                {isRandomStockBrowse(stockRegion)
                  ? "Finding confirmed local stock on AliExpress…"
                  : "Searching AliExpress…"}
              </span>
            ) : null}
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </div>

        {result ? (
          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#111827]">
                  {result.minPrice != null || result.maxPrice != null
                    ? result.products.length > 0
                      ? `${result.products.length} products in your price range`
                      : "No products in your price range"
                    : result.total > 0
                      ? `${result.total} matches found`
                      : "No matches found"}
                </h2>
                <p className="mt-1 text-sm text-[#6B7280]">
                  {result.mode === "photo" && result.derivedKeywords
                    ? `From photo → “${result.derivedKeywords}” · ${stockLabel(result.stockRegion)}`
                    : `“${result.query}” · ${stockLabel(result.stockRegion)}`}
                  {formatPriceRangeLabel(result.minPrice, result.maxPrice, result.stockRegion)
                    ? ` · ${formatPriceRangeLabel(result.minPrice, result.maxPrice, result.stockRegion)}`
                    : ""}
                </p>
              </div>
            </div>

            {result.products.length > 0 ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {result.products.map((product) => (
                  <SupplierProductCard key={product.productId} product={product} />
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-gray-100 bg-white px-4 py-8 text-center text-sm text-[#6B7280]">
                {result.minPrice != null || result.maxPrice != null
                  ? "No products in this price range. Try a wider min/max, different keyword, or photo."
                  : result.stockRegion === "uk" ||
                      result.stockRegion === "us" ||
                      result.stockRegion === "uk_random" ||
                      result.stockRegion === "us_random"
                    ? "No confirmed local-stock suppliers found. Try Random UK/USA, All suppliers, or a different search."
                    : "Try a different keyword, title, or photo — or switch the stock filter."}
              </div>
            )}

            {result.hasMore ? (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-[#374151] hover:bg-gray-50 disabled:opacity-60"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-gray-200 bg-white px-4 py-10 text-center text-sm text-[#6B7280]">
            {isRandomStockBrowse(stockRegion)
              ? "Select Random UK or Random USA and click Browse stock — no keyword needed."
              : "Enter a keyword, title, or photo and click Find suppliers. Results will appear here."}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function SupplierProductCard({ product }: { product: SupplierProduct }) {
  const aliUrl =
    product.productUrl ??
    `https://www.aliexpress.com/item/${product.productId}.html`;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="aspect-square bg-[#F9FAFB]">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-[#9CA3AF]">
            No image
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-sm font-semibold text-[#111827]">{product.title}</h3>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-lg font-bold text-brand">
            {formatPrice(product.price, product.currency)}
          </span>
          {product.originalPrice != null && product.originalPrice > product.price ? (
            <span className="text-xs text-[#9CA3AF] line-through">
              {formatPrice(product.originalPrice, product.currency)}
            </span>
          ) : null}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-[#F9FAFB] px-3 py-2.5 text-xs">
          <div>
            <p className="text-[#9CA3AF]">Orders</p>
            <p className="mt-0.5 font-semibold text-[#111827]">{formatOrders(product.orders)}</p>
          </div>
          <div>
            <p className="text-[#9CA3AF]">Seller rating</p>
            <p className="mt-0.5 font-semibold text-[#111827]">{formatRating(product.rating)}</p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#6B7280]">
          {product.deliveryDays ? <span>{product.deliveryDays} days delivery</span> : null}
          {product.discount ? <span>{product.discount} off</span> : null}
        </div>
        <a
          href={aliUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-[#111827] px-4 py-2 text-sm font-semibold text-white hover:bg-black"
        >
          View on AliExpress
        </a>
      </div>
    </article>
  );
}
