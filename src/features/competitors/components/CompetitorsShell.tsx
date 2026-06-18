"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import type { CompetitorWatch, CompetitorWatchListResponse } from "@/types/competitor";
import type { EbayListing, EbaySearchResponse } from "@/types/ebay";
import { AddCompetitorWatchFlow } from "./AddCompetitorWatchFlow";
import { CompetitorWatchCard } from "./CompetitorWatchCard";
import { EbayListingsTable } from "./EbayListingsTable";
import { EbaySearchForm } from "./EbaySearchForm";

type Platform = "amazef" | "ebay";

type EbaySearchState = {
  query: string;
  alertBelow: number | null;
  listings: EbayListing[];
  total: number;
  offerCount: number;
  offset: number;
  limit: number;
  sort: "asc" | "desc";
};

const PAGE_SIZE = 25;

export function CompetitorsShell() {
  const [platform, setPlatform] = useState<Platform>("amazef");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [watches, setWatches] = useState<CompetitorWatch[]>([]);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const [ebaySearch, setEbaySearch] = useState<EbaySearchState | null>(null);
  const [ebayLoading, setEbayLoading] = useState(false);

  const loadWatches = useCallback(async (id: string) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/competitors/watch?userId=${encodeURIComponent(id)}`);
      const data = (await response.json()) as CompetitorWatchListResponse;

      if (!response.ok) {
        setError(data.error ?? "Failed to load competitor watches.");
        return;
      }

      setWatches(data.watches ?? []);
    } catch {
      setError("Network error while loading competitor watches.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEbayListings = useCallback(
    async (params: {
      query: string;
      alertBelow: number | null;
      offset?: number;
      sort?: "asc" | "desc";
    }) => {
      setEbayLoading(true);
      setError("");

      const offset = params.offset ?? 0;
      const sort = params.sort ?? "asc";

      try {
        const url = new URL("/api/competitors/ebay/search", window.location.origin);
        url.searchParams.set("q", params.query);
        url.searchParams.set("offset", String(offset));
        url.searchParams.set("limit", String(PAGE_SIZE));
        url.searchParams.set("sort", sort);

        const response = await fetch(url.toString());
        const data = (await response.json()) as EbaySearchResponse;

        if (!response.ok) {
          setError(data.error ?? "eBay search failed.");
          return;
        }

        setEbaySearch({
          query: params.query,
          alertBelow: params.alertBelow,
          listings: data.listings ?? [],
          total: data.total ?? 0,
          offerCount: data.offerCount ?? data.listings?.length ?? 0,
          offset: data.offset ?? offset,
          limit: data.limit ?? PAGE_SIZE,
          sort: data.sort ?? sort,
        });
      } catch {
        setError("Network error while searching eBay.");
      } finally {
        setEbayLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const id = sessionStorage.getItem("ecomtools_user_id");
    if (id) {
      setUserId(id);
      loadWatches(id);
    } else {
      setLoading(false);
    }
  }, [loadWatches]);

  function handlePlatformChange(next: Platform) {
    setPlatform(next);
    setError("");
    setNotice("");
    setEbaySearch(null);
  }

  async function handleCheck(watchId: string) {
    if (!userId) return;

    setCheckingId(watchId);
    setNotice("");

    try {
      const response = await fetch("/api/competitors/watch/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, watchId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setNotice(data.error ?? "Update check failed.");
        return;
      }

      setWatches(data.watches ?? []);
      setNotice(data.message ?? "Update check completed. Email sent with results.");
    } catch {
      setNotice("Network error while checking update.");
    } finally {
      setCheckingId(null);
    }
  }

  async function handleRemove(watchId: string) {
    if (!userId) return;

    try {
      const response = await fetch(
        `/api/competitors/watch?userId=${encodeURIComponent(userId)}&watchId=${encodeURIComponent(watchId)}`,
        { method: "DELETE" },
      );

      const data = await response.json();

      if (!response.ok) {
        setNotice(data.error ?? "Failed to remove watch.");
        return;
      }

      setWatches(data.watches ?? []);
      setNotice("Competitor watch removed.");
    } catch {
      setNotice("Network error while removing watch.");
    }
  }

  function handleEbaySearch(params: { query: string; alertBelow: number | null }) {
    fetchEbayListings({ ...params, offset: 0, sort: "asc" });
  }

  function handleEbaySortChange(sort: "asc" | "desc") {
    if (!ebaySearch) return;
    fetchEbayListings({
      query: ebaySearch.query,
      alertBelow: ebaySearch.alertBelow,
      offset: ebaySearch.offset,
      sort,
    });
  }

  function handleEbayPageChange(offset: number) {
    if (!ebaySearch) return;
    fetchEbayListings({
      query: ebaySearch.query,
      alertBelow: ebaySearch.alertBelow,
      offset,
      sort: ebaySearch.sort,
    });
  }

  const platformWatches = watches.filter((watch) => watch.platform === platform);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1200px] p-6 lg:p-8">
        <header className="mb-8">
          <span className="inline-flex rounded-full border border-[#DDD6FE] bg-brand-light px-3 py-1 text-xs font-semibold text-brand">
            Price Intelligence
          </span>
          <h1 className="mt-3 text-2xl font-bold text-[#111827] lg:text-3xl">Check Competitors</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#6B7280]">
            {platform === "amazef"
              ? "Track your product title and price on Amazef. We check on your schedule and email you when sellers list below your price."
              : "Track your product title and price on eBay (item + postage). We check on your schedule and email you when sellers list below your price."}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <label htmlFor="platform-select" className="text-sm font-semibold text-[#374151]">
              Platform
            </label>
            <select
              id="platform-select"
              value={platform}
              onChange={(event) => handlePlatformChange(event.target.value as Platform)}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-[#111827] shadow-sm outline-none transition-all focus:border-brand focus:ring-4 focus:ring-brand/10"
            >
              <option value="amazef">Amazef</option>
              <option value="ebay">eBay</option>
            </select>
          </div>
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
            <AddCompetitorWatchFlow
              userId={userId}
              platform={platform}
              onAdded={(watches) => setWatches(watches)}
            />
          </div>
        )}

        <div className={platform === "ebay" ? "mb-8" : ""}>
          <div className="mb-5">
            <h2 className="text-lg font-bold text-[#111827]">Your competitor watches</h2>
            <p className="text-sm text-[#6B7280]">
              {platformWatches.length} watch{platformWatches.length === 1 ? "" : "es"} · alerts shown
              in red on top
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <svg className="h-8 w-8 animate-spin text-brand" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : platformWatches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-[#FAFAFA] px-6 py-12 text-center">
              <p className="text-sm font-semibold text-[#374151]">No competitor watches yet</p>
              <p className="mt-1 text-xs text-[#9CA3AF]">
                Add your product title and price above to start tracking{" "}
                {platform === "ebay" ? "eBay" : "Amazef"} sellers.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {platformWatches.map((watch) => (
                <CompetitorWatchCard
                  key={watch.id}
                  watch={watch}
                  checking={checkingId === watch.id}
                  onCheck={() => handleCheck(watch.id)}
                  onRemove={() => handleRemove(watch.id)}
                  onUpdated={(message, watches) => {
                    if (watches) setWatches(watches);
                    if (message) setNotice(message);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {platform === "ebay" && (
          <div className="space-y-6">
            <EbaySearchForm onSearch={handleEbaySearch} isSearching={ebayLoading && !ebaySearch} />

            {ebaySearch && (
              <EbayListingsTable
                listings={ebaySearch.listings}
                total={ebaySearch.total}
                offerCount={ebaySearch.offerCount}
                offset={ebaySearch.offset}
                limit={ebaySearch.limit}
                sort={ebaySearch.sort}
                alertBelow={ebaySearch.alertBelow}
                query={ebaySearch.query}
                isLoading={ebayLoading}
                onSortChange={handleEbaySortChange}
                onPageChange={handleEbayPageChange}
              />
            )}

            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-[#111827]">eBay Browse API</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">
                Each row is priced from eBay&apos;s item API for that exact variant. The
                &quot;eBay price&quot; column matches what you see on the listing page (including
                VAT). Pick the variant row, then click through to verify.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-[#6B7280]">
                <li>· One row per variant (colour/size) with its own price</li>
                <li>· eBay price = listing page Buy it now (VAT included)</li>
                <li>· + Postage = eBay price + cheapest delivery</li>
                <li>· Click title or View on eBay — opens that variant</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
