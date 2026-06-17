"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import type { CompetitorCheck, CompetitorCheckResponse, CompetitorMatch } from "@/types/competitor";
import type { EbayListing, EbaySearchResponse } from "@/types/ebay";
import { CompetitorCheckForm } from "./CompetitorCheckForm";
import { CompetitorMatchCard } from "./CompetitorMatchCard";
import { CompetitorResultBanner } from "./CompetitorResultBanner";
import { EbayListingsTable } from "./EbayListingsTable";
import { EbaySearchForm } from "./EbaySearchForm";
import { RecentCompetitorChecks } from "./RecentCompetitorChecks";

type Platform = "amazef" | "ebay";

type CheckResult = {
  message: string;
  userPriceLabel: string;
  matches: CompetitorMatch[];
  totalSearched: number;
};

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
  const [recentChecks, setRecentChecks] = useState<CompetitorCheck[]>([]);
  const [selectedCheckId, setSelectedCheckId] = useState<string | null>(null);
  const [loadingCheckId, setLoadingCheckId] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);

  const [ebaySearch, setEbaySearch] = useState<EbaySearchState | null>(null);
  const [ebayLoading, setEbayLoading] = useState(false);

  const loadRecentChecks = useCallback(async (id: string) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/competitors/check?userId=${encodeURIComponent(id)}`);
      const data = (await response.json()) as CompetitorCheckResponse;

      if (!response.ok) {
        setError(data.error ?? "Failed to load competitor checks.");
        return;
      }

      setRecentChecks(data.recentChecks ?? []);
    } catch {
      setError("Network error while loading competitor checks.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCheckDetails = useCallback(async (id: string, checkId: string) => {
    setLoadingCheckId(checkId);
    setError("");

    try {
      const response = await fetch(
        `/api/competitors/check?userId=${encodeURIComponent(id)}&checkId=${encodeURIComponent(checkId)}`,
      );
      const data = (await response.json()) as CompetitorCheckResponse;

      if (!response.ok) {
        setError(data.error ?? "Failed to load competitor check.");
        setSelectedCheckId(null);
        return;
      }

      setResult({
        message: data.message ?? "",
        userPriceLabel: data.userPriceLabel ?? "",
        matches: data.matches ?? [],
        totalSearched: data.totalSearched ?? 0,
      });
    } catch {
      setError("Network error while loading competitor check.");
      setSelectedCheckId(null);
    } finally {
      setLoadingCheckId(null);
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
      loadRecentChecks(id);
    } else {
      setLoading(false);
    }
  }, [loadRecentChecks]);

  function handlePlatformChange(next: Platform) {
    setPlatform(next);
    setError("");
    setResult(null);
    setSelectedCheckId(null);
    setEbaySearch(null);
  }

  function handleSelectCheck(checkId: string | null) {
    setSelectedCheckId(checkId);

    if (!checkId) {
      setResult(null);
      return;
    }

    if (userId) {
      loadCheckDetails(userId, checkId);
    }
  }

  function handleAmazefSuccess(data: CompetitorCheckResponse) {
    setResult({
      message: data.message ?? "",
      userPriceLabel: data.userPriceLabel ?? "",
      matches: data.matches ?? [],
      totalSearched: data.totalSearched ?? 0,
    });
    setRecentChecks(data.recentChecks ?? []);
    setSelectedCheckId(data.check?.id ?? null);
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

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1200px] p-6 lg:p-8">
        <header className="mb-8">
          <span className="inline-flex rounded-full border border-[#DDD6FE] bg-brand-light px-3 py-1 text-xs font-semibold text-brand">
            Price Intelligence
          </span>
          <h1 className="mt-3 text-2xl font-bold text-[#111827] lg:text-3xl">Check Competitors</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#6B7280]">
            Compare prices across marketplaces. Search Amazef for undercuts on your price, or browse
            all eBay sellers for a product keyword.
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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {platform === "amazef" ? (
              <>
                {userId && (
                  <CompetitorCheckForm userId={userId} onSuccess={handleAmazefSuccess} />
                )}

                {loadingCheckId && !result && (
                  <div className="flex items-center justify-center rounded-2xl border border-gray-100 bg-white py-16 shadow-sm">
                    <svg className="h-7 w-7 animate-spin text-brand" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                )}

                {result && (
                  <div className="space-y-5">
                    {selectedCheckId && (
                      <p className="text-sm font-medium text-brand">Viewing selected check only</p>
                    )}

                    <CompetitorResultBanner
                      message={result.message}
                      userPriceLabel={result.userPriceLabel}
                      matches={result.matches}
                      totalSearched={result.totalSearched}
                    />

                    {result.matches.length > 0 ? (
                      <div>
                        <h3 className="mb-4 text-base font-semibold text-[#111827]">
                          Sellers under your price
                        </h3>
                        <div className="space-y-4">
                          {result.matches.map((match) => (
                            <CompetitorMatchCard
                              key={match.id}
                              match={match}
                              userPriceLabel={result.userPriceLabel}
                            />
                          ))}
                        </div>
                      </div>
                    ) : result.totalSearched > 0 ? (
                      <div className="rounded-2xl border border-emerald-100 bg-white p-8 text-center shadow-sm">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
                          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
                            <path
                              d="M8 14l4 4 8-8"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                        <p className="text-lg font-bold text-[#111827]">You&apos;re competitively priced</p>
                        <p className="mt-2 text-sm text-[#6B7280]">
                          No sellers on Amazef are listing this product below {result.userPriceLabel}.
                        </p>
                      </div>
                    ) : null}
                  </div>
                )}
              </>
            ) : (
              <>
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
              </>
            )}
          </div>

          <div>
            {platform === "amazef" ? (
              loading ? (
                <div className="flex items-center justify-center rounded-2xl border border-gray-100 bg-white py-16 shadow-sm">
                  <svg className="h-7 w-7 animate-spin text-brand" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : (
                <RecentCompetitorChecks
                  checks={recentChecks}
                  selectedCheckId={selectedCheckId}
                  onSelectCheck={handleSelectCheck}
                  loadingCheckId={loadingCheckId}
                />
              )
            ) : (
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-[#111827]">eBay Browse API</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">
                  Prices come from eBay UK sellers — they will not match AliExpress source prices.
                  Click any title or &quot;View on eBay&quot; to open the live listing and verify.
                </p>
                <ul className="mt-4 space-y-2 text-xs text-[#6B7280]">
                  <li>· Click listing title → opens on eBay</li>
                  <li>· &quot;View on eBay&quot; → direct link with variant selected</li>
                  <li>· Buy it now matches eBay.co.uk (incl. VAT when charged)</li>
                  <li>· Add-on accessories (sim pins, cables) are filtered out</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
