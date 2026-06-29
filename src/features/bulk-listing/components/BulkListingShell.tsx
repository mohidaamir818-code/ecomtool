"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { AmazefAutoListingSettingsModal } from "@/features/listings/components/AmazefAutoListingSettingsModal";
import { EbayAutoListingSettingsModal } from "@/features/listings/components/EbayAutoListingSettingsModal";
import {
  loadAutoListingSettings,
  normalizeAutoListingSettings,
  saveAutoListingSettings,
  type AmazefAutoListingSettings,
} from "@/features/listings/lib/amazef-auto-listing";
import {
  loadEbayAutoListingSettings,
  normalizeEbayAutoListingSettings,
  saveEbayAutoListingSettings,
  type EbayAutoListingSettings,
} from "@/features/listings/lib/ebay-auto-listing";
import type { BulkListingJob } from "@/types/bulk-listing";
import type { ListingPlatform } from "@/types/listing-generator";

const PROCESS_DELAY_MS = 1500;
const MAX_URLS = 50;

function formatStatus(status: BulkListingJob["status"]): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "listing":
      return "Listing…";
    case "listed":
      return "Listed";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

function statusClass(status: BulkListingJob["status"]): string {
  switch (status) {
    case "queued":
      return "bg-amber-100 text-amber-700";
    case "listing":
      return "bg-sky-100 text-sky-700";
    case "listed":
      return "bg-emerald-100 text-emerald-700";
    case "failed":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseUrls(text: string): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const token of text.split(/\s+/)) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    urls.push(trimmed);
  }
  return urls;
}

function isLikelyAliExpressUrl(url: string): boolean {
  return /aliexpress\./i.test(url) && /^https?:\/\//i.test(url);
}

export function BulkListingShell() {
  const [userId, setUserId] = useState<string | null>(null);
  const [platform, setPlatform] = useState<ListingPlatform>("ebay");
  const [urlsText, setUrlsText] = useState("");
  const [priceMode, setPriceMode] = useState<"profit" | "fixed">("profit");
  const [profitPercent, setProfitPercent] = useState("");
  const [fixedPrice, setFixedPrice] = useState("");
  const [jobs, setJobs] = useState<BulkListingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [pendingList, setPendingList] = useState(false);
  const [ebaySettings, setEbaySettings] = useState<EbayAutoListingSettings>(() =>
    normalizeEbayAutoListingSettings(null),
  );
  const [amazefSettings, setAmazefSettings] = useState<AmazefAutoListingSettings>(() =>
    normalizeAutoListingSettings(null),
  );
  const processingRef = useRef(false);
  const resumedRef = useRef(false);

  useEffect(() => {
    if (!userId) return;
    setEbaySettings(loadEbayAutoListingSettings(userId));
    setAmazefSettings(loadAutoListingSettings(userId));
  }, [userId]);

  const parsedUrls = useMemo(() => parseUrls(urlsText), [urlsText]);
  const validUrls = useMemo(() => parsedUrls.filter(isLikelyAliExpressUrl), [parsedUrls]);
  const invalidCount = parsedUrls.length - validUrls.length;

  const platformEnabled = platform === "ebay" ? ebaySettings.enabled : amazefSettings.enabled;

  useEffect(() => {
    const id =
      sessionStorage.getItem("ecomtools_user_id") ||
      localStorage.getItem("ecomtools_user_id");
    setUserId(id);
  }, []);

  const loadJobs = useCallback(async () => {
    if (!userId) return;
    try {
      const response = await fetch(`/api/bulk-listing?userId=${encodeURIComponent(userId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Failed to load jobs.");
      setJobs(data.jobs ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load jobs.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) void loadJobs();
    else setLoading(false);
  }, [userId, loadJobs]);

  const activeBatchId = useMemo(() => jobs[0]?.batchId ?? null, [jobs]);

  const activeBatchJobs = useMemo(() => {
    if (!activeBatchId) return [];
    return jobs
      .filter((job) => job.batchId === activeBatchId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [jobs, activeBatchId]);

  const stats = useMemo(() => {
    const base = { total: 0, listed: 0, failed: 0, pending: 0 };
    for (const job of activeBatchJobs) {
      base.total += 1;
      if (job.status === "listed") base.listed += 1;
      else if (job.status === "failed") base.failed += 1;
      else base.pending += 1;
    }
    return base;
  }, [activeBatchJobs]);

  const runProcessor = useCallback(async () => {
    if (!userId || processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);

    try {
      while (true) {
        const response = await fetch("/api/bulk-listing/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            ebaySettings,
            amazefSettings,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error ?? "Processing failed.");

        setJobs(data.jobs ?? []);

        if (!data.processed) break;
        await sleep(PROCESS_DELAY_MS);
      }
    } catch (processError) {
      setError(processError instanceof Error ? processError.message : "Processing failed.");
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }, [userId, ebaySettings, amazefSettings]);

  useEffect(() => {
    if (loading || !userId || resumedRef.current) return;
    resumedRef.current = true;
    if (jobs.some((job) => job.status === "queued")) void runProcessor();
  }, [loading, userId, jobs, runProcessor]);

  const handleListAll = useCallback(async () => {
    if (!userId) return;

    if (validUrls.length === 0) {
      setError("Paste at least one valid AliExpress URL.");
      return;
    }

    if (validUrls.length > MAX_URLS) {
      setError(`You can list up to ${MAX_URLS} products at once. Found ${validUrls.length}.`);
      return;
    }

    if (!platformEnabled) {
      // Auto listing is off for this platform — prompt the seller to set it up.
      // Once enabled, the listing continues automatically.
      setError(null);
      setPendingList(true);
      setShowSettingsModal(true);
      return;
    }

    const profit = priceMode === "profit" && profitPercent.trim() ? Number(profitPercent) : null;
    const fixed = priceMode === "fixed" && fixedPrice.trim() ? Number(fixedPrice) : null;

    if (priceMode === "fixed" && (fixed == null || !Number.isFinite(fixed) || fixed <= 0)) {
      setError("Enter a valid fixed listing price, or switch to Profit %.");
      return;
    }

    const rowsToSubmit = validUrls.map((url) => ({
      productUrl: url,
      platform,
      profitPercent: profit,
      fixedPrice: fixed,
    }));

    setListing(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/bulk-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, rows: rowsToSubmit }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Failed to start bulk listing.");

      setJobs(data.jobs ?? []);
      setUrlsText("");
      setNotice(`${rowsToSubmit.length} URL(s) saved. Listing started…`);

      const refresh = await fetch(`/api/bulk-listing?userId=${encodeURIComponent(userId)}`);
      const refreshData = await refresh.json();
      if (refresh.ok) setJobs(refreshData.jobs ?? []);

      await runProcessor();
    } catch (listError) {
      setError(listError instanceof Error ? listError.message : "Failed to start bulk listing.");
    } finally {
      setListing(false);
    }
  }, [
    userId,
    validUrls,
    platform,
    platformEnabled,
    priceMode,
    profitPercent,
    fixedPrice,
    runProcessor,
  ]);

  // After the seller enables auto listing from the popup, continue the queued list.
  useEffect(() => {
    if (!pendingList || !platformEnabled) return;
    setPendingList(false);
    void handleListAll();
  }, [pendingList, platformEnabled, handleListAll]);

  function handleSaveSettings(next: EbayAutoListingSettings | AmazefAutoListingSettings) {
    if (!userId) return;
    const enabled = { ...next, enabled: true };

    if (platform === "ebay") {
      const settings = enabled as EbayAutoListingSettings;
      saveEbayAutoListingSettings(userId, settings);
      setEbaySettings(settings);
    } else {
      const settings = enabled as AmazefAutoListingSettings;
      saveAutoListingSettings(userId, settings);
      setAmazefSettings(settings);
    }

    setShowSettingsModal(false);
  }

  function handleCloseSettings() {
    setShowSettingsModal(false);
    setPendingList(false);
  }

  async function handleRetry(jobId: string) {
    if (!userId) return;
    setError(null);

    try {
      const response = await fetch("/api/bulk-listing/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, jobId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Retry failed.");

      setJobs(data.jobs ?? []);
      await runProcessor();
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Retry failed.");
    }
  }

  if (!userId && !loading) {
    return (
      <DashboardLayout>
        <div className="p-8 text-sm text-[#6B7280]">Please sign in to use bulk listing.</div>
      </DashboardLayout>
    );
  }

  const busy = listing || processing;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1180px] p-6 lg:p-8">
        {/* Hero header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand via-brand to-[#3b2bb5] p-7 text-white shadow-lg">
          <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 -left-6 h-48 w-48 rounded-full bg-white/5" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
              ⚡ Bulk Listing
            </span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">List your whole store at once</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/80">
              Pick your platform, paste all your AliExpress URLs in one go, and hit list. Every
              product is listed automatically with your saved profit &amp; fee settings.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <div className="rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur">
                <p className="text-[11px] uppercase tracking-wide text-white/60">Listed</p>
                <p className="text-lg font-bold">{stats.listed}</p>
              </div>
              <div className="rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur">
                <p className="text-[11px] uppercase tracking-wide text-white/60">In queue</p>
                <p className="text-lg font-bold">{stats.pending}</p>
              </div>
              <div className="rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur">
                <p className="text-[11px] uppercase tracking-wide text-white/60">Failed</p>
                <p className="text-lg font-bold">{stats.failed}</p>
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
            {processing ? " Processing next items…" : null}
          </div>
        ) : null}

        {/* Compose card */}
        <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            {/* Top platform dropdown */}
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                Platform
              </span>
              <div className="relative">
                <select
                  value={platform}
                  onChange={(event) => setPlatform(event.target.value as ListingPlatform)}
                  className="appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-4 pr-10 text-sm font-semibold text-[#111827] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                >
                  <option value="ebay">🛒 eBay</option>
                  <option value="amazef">📦 Amazef</option>
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
                  ▾
                </span>
              </div>
            </label>

            <div className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                Pricing
              </span>
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
                  <button
                    type="button"
                    onClick={() => setPriceMode("profit")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      priceMode === "profit"
                        ? "bg-white text-brand shadow-sm"
                        : "text-[#6B7280] hover:text-[#374151]"
                    }`}
                  >
                    Profit %
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriceMode("fixed")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      priceMode === "fixed"
                        ? "bg-white text-brand shadow-sm"
                        : "text-[#6B7280] hover:text-[#374151]"
                    }`}
                  >
                    Fixed price
                  </button>
                </div>

                {priceMode === "profit" ? (
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={95}
                      value={profitPercent}
                      onChange={(event) => setProfitPercent(event.target.value)}
                      placeholder="Use settings"
                      className="w-36 rounded-xl border border-gray-200 px-4 py-2.5 pr-8 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#9CA3AF]">
                      %
                    </span>
                  </div>
                ) : (
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={fixedPrice}
                    onChange={(event) => setFixedPrice(event.target.value)}
                    placeholder="e.g. 24.99"
                    className="w-36 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                )}
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2 text-xs">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold ${
                  platformEnabled
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-amber-50 text-amber-600"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    platformEnabled ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
                Auto listing {platformEnabled ? "ON" : "OFF"}
              </span>
            </div>
          </div>

          {/* Bulk paste box */}
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                Paste AliExpress URLs
              </span>
              <span className="text-xs text-[#9CA3AF]">One per line — paste them all at once</span>
            </div>
            <textarea
              value={urlsText}
              onChange={(event) => setUrlsText(event.target.value)}
              rows={9}
              placeholder={
                "https://www.aliexpress.com/item/1005001234567890.html\nhttps://www.aliexpress.com/item/1005009876543210.html\nhttps://www.aliexpress.com/item/..."
              }
              className="w-full resize-y rounded-xl border border-gray-200 bg-[#FCFCFD] px-4 py-3 font-mono text-[13px] leading-relaxed text-[#374151] focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
            />

            <div className="mt-3 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="rounded-lg bg-brand/10 px-3 py-1.5 font-bold text-brand">
                  {validUrls.length}
                </span>
                <span className="text-[#6B7280]">valid URL(s) detected</span>
              </div>
              {invalidCount > 0 ? (
                <span className="text-xs font-medium text-amber-600">
                  {invalidCount} line(s) ignored (not an AliExpress link)
                </span>
              ) : null}

              <button
                type="button"
                onClick={() => void handleListAll()}
                disabled={busy || validUrls.length === 0}
                className="ml-auto inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Listing…
                  </>
                ) : (
                  <>List {validUrls.length > 0 ? validUrls.length : "all"} on {platform === "ebay" ? "eBay" : "Amazef"}</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Live results */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-bold text-[#111827]">Listing progress</h2>
            {stats.total > 0 ? (
              <span className="text-xs text-[#6B7280]">
                {stats.listed}/{stats.total} listed
              </span>
            ) : null}
          </div>

          {stats.total > 0 ? (
            <div className="h-1.5 w-full bg-gray-100">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${Math.round((stats.listed / stats.total) * 100)}%` }}
              />
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-gray-100 bg-[#F9FAFB] text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
                <tr>
                  <th className="px-5 py-3">#</th>
                  <th className="min-w-[340px] px-5 py-3">AliExpress URL</th>
                  <th className="px-5 py-3">Platform</th>
                  <th className="px-5 py-3">Pricing</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="min-w-[200px] px-5 py-3">Result</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-sm text-[#6B7280]">
                      Loading…
                    </td>
                  </tr>
                ) : activeBatchJobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center">
                      <p className="text-sm font-medium text-[#374151]">No products listed yet</p>
                      <p className="mt-1 text-xs text-[#9CA3AF]">
                        Paste your AliExpress URLs above and click List to get started.
                      </p>
                    </td>
                  </tr>
                ) : (
                  activeBatchJobs.map((job, index) => (
                    <tr key={job.id} className="border-b border-gray-50 hover:bg-[#FAFBFC]">
                      <td className="px-5 py-3 text-[#9CA3AF]">{index + 1}</td>
                      <td className="px-5 py-3">
                        <p className="max-w-[420px] truncate text-sm text-[#374151]" title={job.productUrl}>
                          {job.productUrl}
                        </p>
                      </td>
                      <td className="px-5 py-3 capitalize text-[#374151]">{job.platform}</td>
                      <td className="px-5 py-3 text-[#374151]">
                        {job.fixedPrice != null
                          ? `${job.fixedPrice.toFixed(2)} fixed`
                          : job.profitPercent != null
                            ? `${job.profitPercent}% profit`
                            : "Default"}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(job.status)}`}
                        >
                          {job.status === "listing" ? (
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
                          ) : null}
                          {formatStatus(job.status)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {job.status === "listed" && job.listingUrl ? (
                          <a
                            href={job.listingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold text-brand hover:underline"
                          >
                            {job.listedTitle ?? "View listing"}
                          </a>
                        ) : job.status === "failed" ? (
                          <p className="max-w-[260px] text-xs text-red-600">
                            {job.errorMessage ?? "Failed"}
                          </p>
                        ) : job.status === "listing" ? (
                          <p className="text-xs text-sky-600">Auto listing in progress…</p>
                        ) : (
                          <p className="text-xs text-[#9CA3AF]">Waiting…</p>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {job.status === "failed" ? (
                          <button
                            type="button"
                            onClick={() => void handleRetry(job.id)}
                            disabled={processing}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/5 disabled:opacity-50"
                          >
                            Retry
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showSettingsModal ? (
        platform === "ebay" ? (
          <EbayAutoListingSettingsModal
            initialSettings={ebaySettings}
            onSave={handleSaveSettings}
            onClose={handleCloseSettings}
          />
        ) : (
          <AmazefAutoListingSettingsModal
            initialSettings={amazefSettings}
            onSave={handleSaveSettings}
            onClose={handleCloseSettings}
          />
        )
      ) : null}
    </DashboardLayout>
  );
}
