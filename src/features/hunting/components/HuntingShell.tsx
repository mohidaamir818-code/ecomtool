"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import {
  DEFAULT_HUNT_LOOKBACK_DAYS,
  HUNT_LOOKBACK_OPTIONS,
  type HuntLookbackDays,
} from "@/features/hunting/constants";
import type { HuntAmazefResponse, HuntProduct, HuntRequest, HuntStats } from "@/types/hunting";
import { HuntKeywordForm } from "./HuntKeywordForm";
import { RecentHuntRequests } from "./RecentHuntRequests";
import { RecentHuntsGrid } from "./RecentHuntsGrid";

const defaultStats: HuntStats = {
  totalHunts: 0,
  winningProducts: 0,
  avgScore: 0,
  totalProducts: 0,
};

export function HuntingShell() {
  const [showHuntForm, setShowHuntForm] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [lookbackDays, setLookbackDays] = useState<HuntLookbackDays>(DEFAULT_HUNT_LOOKBACK_DAYS);
  const [products, setProducts] = useState<HuntProduct[]>([]);
  const [requests, setRequests] = useState<HuntRequest[]>([]);
  const [stats, setStats] = useState<HuntStats>(defaultStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  const loadHuntData = useCallback(async (id: string, days: HuntLookbackDays) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/hunt/amazef?userId=${encodeURIComponent(id)}&lookbackDays=${days}`,
      );
      const data = (await response.json()) as HuntAmazefResponse & { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Failed to load hunt data.");
        return;
      }

      setProducts(data.products ?? []);
      setRequests(data.requests ?? []);
      setStats(data.stats ?? defaultStats);
      setSelectedRequestId(null);
    } catch {
      setError("Network error while loading hunt data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = sessionStorage.getItem("ecomtools_user_id");
    if (id) {
      setUserId(id);
      loadHuntData(id, lookbackDays);
    } else {
      setLoading(false);
    }
  }, [loadHuntData, lookbackDays]);

  function handleHuntSuccess(data: HuntAmazefResponse) {
    setProducts(data.products ?? []);
    setRequests(data.requests ?? []);
    setStats(data.stats ?? defaultStats);
    setSelectedRequestId(null);
  }

  const selectedRequest = requests.find((request) => request.id === selectedRequestId) ?? null;
  const visibleProducts = selectedRequestId
    ? products.filter((product) => product.huntRequestId === selectedRequestId)
    : products;

  const statCards = [
    { label: "Total Hunts", value: String(stats.totalHunts), sub: `Last ${lookbackDays} days` },
    { label: "Winning Products", value: String(stats.winningProducts), sub: "Score 80+" },
    { label: "Avg. Score", value: stats.avgScore > 0 ? String(stats.avgScore) : "—", sub: "Out of 100" },
    { label: "Top Products", value: String(stats.totalProducts), sub: `Last ${lookbackDays} days` },
  ];

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1200px] p-6 lg:p-8">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex rounded-full border border-[#DDD6FE] bg-brand-light px-3 py-1 text-xs font-semibold text-brand">
              Product Discovery
            </span>
            <h1 className="mt-3 text-2xl font-bold text-[#111827] lg:text-3xl">
              Product Hunting
            </h1>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-[#6B7280]">
              Search Amazef by keyword and see the most sold product per hunt for your selected time range.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label htmlFor="page-lookback" className="sr-only">
                Show hunts from
              </label>
              <select
                id="page-lookback"
                value={lookbackDays}
                onChange={(e) => setLookbackDays(Number(e.target.value) as HuntLookbackDays)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-[#374151] shadow-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
              >
                {HUNT_LOOKBACK_OPTIONS.map((days) => (
                  <option key={days} value={days}>
                    Last {days} days
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowHuntForm(true)}
              disabled={!userId}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(88,66,244,0.35)] transition-all hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Hunt Product
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {error}
          </div>
        )}

        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {statCards.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
            >
              <p className="text-xs font-medium text-[#9CA3AF]">{stat.label}</p>
              <p className="mt-1 text-2xl font-bold text-[#111827]">
                {loading ? "…" : stat.value}
              </p>
              <p className="mt-0.5 text-xs text-[#6B7280]">{stat.sub}</p>
            </div>
          ))}
        </div>

        {showHuntForm && userId && (
          <div className="mb-8">
            <HuntKeywordForm
              userId={userId}
              lookbackDays={lookbackDays}
              onClose={() => setShowHuntForm(false)}
              onSuccess={handleHuntSuccess}
            />
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="h-8 w-8 animate-spin text-brand" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : (
          <>
            <RecentHuntRequests
              requests={requests}
              lookbackDays={lookbackDays}
              selectedRequestId={selectedRequestId}
              onSelectRequest={setSelectedRequestId}
            />
            <RecentHuntsGrid
              products={visibleProducts}
              lookbackDays={lookbackDays}
              selectedRequest={selectedRequest}
            />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
