"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import type { HuntProProduct, HuntProResult } from "@/types/huntpro";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 90000;

const HUNTPRO_EXTENSION_URL =
  "https://chromewebstore.google.com/search/HuntPro";
const HUNTPRO_CONNECT_URL = "/api/huntpro/connect";
const ONBOARDED_STORAGE_KEY = "huntpro_onboarded";

const DAY_FILTER_OPTIONS = [5, 10, 15, 20, 25, 30] as const;
const DEFAULT_DAY_FILTER = 30;

type OnboardStep = "install" | "connect" | null;

function formatPrice(value: number): string {
  return `£${Number(value || 0).toFixed(2)}`;
}

function aliExpressSearchUrl(title: string): string {
  return `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(title)}`;
}

export function HuntProShell() {
  const [userId, setUserId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<HuntProResult | null>(null);
  const [onboardStep, setOnboardStep] = useState<OnboardStep>(null);
  const [connecting, setConnecting] = useState(false);
  const [days, setDays] = useState<number>(DEFAULT_DAY_FILTER);
  // The day window that produced the currently-displayed result.
  const [resultDays, setResultDays] = useState<number>(DEFAULT_DAY_FILTER);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchStartedAtRef = useRef<number>(0);
  // Snapshot of the latest result id when a search starts, so we can detect a
  // newly-arrived result without relying on the browser clock (avoids skew).
  const baselineResultIdRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const fetchLatest = useCallback(
    async (id: string, searchKeyword: string): Promise<HuntProResult | null> => {
      const response = await fetch(
        `/api/hunting/receive?userId=${encodeURIComponent(id)}&keyword=${encodeURIComponent(searchKeyword)}`,
      );
      const data = (await response.json()) as { result?: HuntProResult | null; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load hunting results.");
      }
      return data.result ?? null;
    },
    [],
  );

  useEffect(() => {
    const id = sessionStorage.getItem("ecomtools_user_id");
    if (id) setUserId(id);

    const onboarded = localStorage.getItem(ONBOARDED_STORAGE_KEY) === "true";
    if (!onboarded) setOnboardStep("install");
  }, []);

  const completeOnboarding = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDED_STORAGE_KEY, "true");
    } catch {
      // Ignore storage errors; onboarding still closes for this session.
    }
    setConnecting(false);
    setOnboardStep(null);
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // Listen for the connect confirmation from the HuntPro extension / connect tab.
  useEffect(() => {
    function onConnectMessage(event: MessageEvent) {
      const data = event.data as { type?: string; userId?: string } | null;
      if (!data || data.type !== "ECOMTOOL_HUNTPRO_CONNECT") return;
      if (data.userId) setUserId(data.userId);
      completeOnboarding();
    }

    window.addEventListener("message", onConnectMessage);
    return () => window.removeEventListener("message", onConnectMessage);
  }, [completeOnboarding]);

  // Listen for results pushed directly by the HuntPro extension.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string } | null;
      if (!data || data.type !== "HUNTPRO_RESULTS") return;
      if (!userId || !keyword.trim()) return;
      void (async () => {
        try {
          const latest = await fetchLatest(userId, keyword.trim());
          if (latest && latest.id !== baselineResultIdRef.current) {
            setResult(latest);
            setSearching(false);
            setNotice("");
            stopPolling();
          }
        } catch {
          // Ignore; polling will continue to retry.
        }
      })();
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [userId, keyword, fetchLatest, stopPolling]);

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    if (!userId) {
      setError("We could not find your session. Please sign in again.");
      return;
    }
    const trimmed = keyword.trim();
    if (trimmed.length < 2) {
      setError("Enter a keyword with at least 2 characters.");
      return;
    }

    stopPolling();
    setError("");
    setResult(null);
    setSearching(true);
    setNotice("Asking HuntPro to scrape eBay… keep this tab open.");
    searchStartedAtRef.current = Date.now();

    // Snapshot the current latest result so we only show a freshly-scraped one.
    // Using the result id (not timestamps) avoids browser/server clock skew.
    try {
      const existing = await fetchLatest(userId, trimmed);
      baselineResultIdRef.current = existing?.id ?? null;
    } catch {
      baselineResultIdRef.current = null;
    }

    setResultDays(days);

    // Tell the HuntPro Chrome extension to start scraping eBay for this keyword.
    window.postMessage(
      {
        type: "HUNTPRO_SEARCH",
        source: "huntpro-extension",
        userId,
        keyword: trimmed,
        days,
      },
      "*",
    );

    pollRef.current = setInterval(() => {
      void (async () => {
        try {
          const latest = await fetchLatest(userId, trimmed);
          if (latest && latest.id !== baselineResultIdRef.current) {
            setResult(latest);
            setSearching(false);
            setNotice("");
            stopPolling();
          }
        } catch (pollError) {
          setError(pollError instanceof Error ? pollError.message : "Failed to load results.");
        }
      })();
    }, POLL_INTERVAL_MS);

    timeoutRef.current = setTimeout(() => {
      void (async () => {
        stopPolling();
        setSearching(false);
        // Last-chance: if any result for this keyword exists, show it rather
        // than leaving the page blank.
        try {
          const latest = await fetchLatest(userId, trimmed);
          if (latest) {
            setResult(latest);
            setNotice("");
            return;
          }
        } catch {
          // fall through to the error message below
        }
        setResult((current) => {
          if (!current) {
            setNotice("");
            setError(
              "No results yet. Make sure the HuntPro extension is installed and try again.",
            );
          }
          return current;
        });
      })();
    }, POLL_TIMEOUT_MS);
  }

  const statistics = result?.statistics;
  // Most-sold products first, then by sold price as a tiebreaker.
  const products = [...(result?.products ?? [])].sort((a, b) => {
    const countDiff = (b.soldCount ?? 0) - (a.soldCount ?? 0);
    if (countDiff !== 0) return countDiff;
    return (b.soldPrice ?? 0) - (a.soldPrice ?? 0);
  });

  const statCards = [
    {
      label: `Total sold in last ${resultDays} days`,
      value: statistics ? String(statistics.totalSold) : "—",
    },
    { label: "Average price", value: statistics ? formatPrice(statistics.avgPrice) : "—" },
    {
      label: "Price range",
      value: statistics
        ? `${formatPrice(statistics.minPrice)} – ${formatPrice(statistics.maxPrice)}`
        : "—",
    },
    {
      label: "Daily average sales",
      value: statistics ? statistics.dailyAverage.toFixed(1) : "—",
    },
  ];

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1200px] p-6 lg:p-8">
        <header className="mb-6">
          <span className="inline-flex rounded-full border border-[#DDD6FE] bg-brand-light px-3 py-1 text-xs font-semibold text-brand">
            Product Discovery
          </span>
          <h1 className="mt-3 text-2xl font-bold text-[#111827] lg:text-3xl">Product Hunting</h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-[#6B7280]">
            Search a keyword and pick a day range. HuntPro scrapes eBay sold listings and shows the
            most-sold products on top — only items listed in the last month.
          </p>
        </header>

        <form
          onSubmit={handleSearch}
          className="mb-6 flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center"
        >
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <input
              type="text"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="e.g. wireless earbuds"
              className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm font-medium text-[#374151] outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
            />
          </div>
          <div>
            <label htmlFor="hunt-days" className="sr-only">
              Sold within
            </label>
            <select
              id="hunt-days"
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-[#374151] outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 sm:w-auto"
            >
              {DAY_FILTER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  Last {option} days
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={searching || !userId}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(88,66,244,0.35)] transition-all hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {searching ? "Searching…" : "Search"}
          </button>
        </form>

        {error && (
          <div className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {error}
          </div>
        )}
        {notice && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-brand/20 bg-brand-light px-4 py-3 text-sm font-medium text-brand">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {notice}
          </div>
        )}

        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {statCards.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-[#9CA3AF]">{stat.label}</p>
              <p className="mt-1 text-2xl font-bold text-[#111827]">{stat.value}</p>
            </div>
          ))}
        </div>

        {products.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product, index) => (
              <HuntProResultCard
                key={product.itemId || `${product.title}-${index}`}
                product={product}
                days={resultDays}
              />
            ))}
          </div>
        ) : !searching ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#374151]">No results yet</p>
            <p className="mt-1 text-xs text-[#6B7280]">
              Enter a keyword and click Search. HuntPro will scrape eBay and results will show here.
            </p>
          </div>
        ) : null}
      </div>

      {onboardStep === "install" ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-brand">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M4 8h16l-1.5 10H5.5L4 8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M9 8V6a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-bold text-[#111827]">Add the HuntPro extension</h3>
            <p className="mt-2 text-sm text-[#6B7280]">
              To hunt products, install the free HuntPro Chrome extension. It scrapes eBay sold
              listings and sends the results straight here.
            </p>
            <a
              href={HUNTPRO_EXTENSION_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-dark"
            >
              Add Extension
            </a>
            <button
              type="button"
              onClick={() => setOnboardStep("connect")}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#374151] transition-all hover:bg-gray-50"
            >
              I&apos;ve added it
            </button>
          </div>
        </div>
      ) : null}

      {onboardStep === "connect" ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-brand">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M9 12l2 2 4-4M7.5 5.5l-2 2a3 3 0 000 4l3 3M16.5 18.5l2-2a3 3 0 000-4l-3-3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-bold text-[#111827]">Connect the extension</h3>
            <p className="mt-2 text-sm text-[#6B7280]">
              Click connect and HuntPro will link to your EcomTool account automatically. Then you
              can start hunting products.
            </p>
            <a
              href={HUNTPRO_CONNECT_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setConnecting(true)}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-dark"
            >
              {connecting ? "Connecting…" : "Connect"}
            </a>
            <button
              type="button"
              onClick={completeOnboarding}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#374151] transition-all hover:bg-gray-50"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}

function HuntProResultCard({ product, days }: { product: HuntProProduct; days: number }) {
  const listUrl = `/dashboard/listings?url=${encodeURIComponent(aliExpressSearchUrl(product.title))}`;
  const soldCount = product.soldCount ?? 0;
  const windowDays = product.daysWindow || days;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:border-brand/20 hover:shadow-md">
      <div className="relative aspect-square w-full overflow-hidden bg-gray-50">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.title}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-[#9CA3AF]">
            No image
          </div>
        )}
        {soldCount > 0 ? (
          <span className="absolute left-3 top-3 rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
            {soldCount} sold
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-sm font-semibold text-[#111827]">{product.title}</h3>

        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-50 pt-3">
          <div>
            <p className="text-[10px] font-medium uppercase text-[#9CA3AF]">Avg sold price</p>
            <p className="text-sm font-bold text-brand">{formatPrice(product.soldPrice)}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase text-[#9CA3AF]">
              Sold in last {windowDays} days
            </p>
            <p className="text-sm font-bold text-emerald-600">{soldCount}</p>
          </div>
        </div>

        {product.listedDate ? (
          <p className="mt-2 text-[11px] text-[#6B7280]">
            Listed: <span className="font-semibold text-[#374151]">{product.listedDate}</span>
          </p>
        ) : null}

        <div className="mt-4 flex flex-col gap-2">
          {product.listingUrl ? (
            <a
              href={product.listingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-600 transition-all hover:bg-blue-100"
            >
              Show on eBay
            </a>
          ) : null}
          <a
            href={aliExpressSearchUrl(product.title)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-semibold text-orange-600 transition-all hover:bg-orange-100"
          >
            Find on AliExpress
          </a>
          <a
            href={listUrl}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-dark"
          >
            List This Product
          </a>
        </div>
      </div>
    </article>
  );
}
