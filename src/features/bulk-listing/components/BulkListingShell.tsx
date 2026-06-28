"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import {
  loadAutoListingSettings,
  normalizeAutoListingSettings,
} from "@/features/listings/lib/amazef-auto-listing";
import {
  loadEbayAutoListingSettings,
  normalizeEbayAutoListingSettings,
} from "@/features/listings/lib/ebay-auto-listing";
import type { BulkListingJob } from "@/types/bulk-listing";
import type { ListingPlatform } from "@/types/listing-generator";

const DEFAULT_ROW_COUNT = 5;
const PROCESS_DELAY_MS = 1500;

interface DraftRow {
  id: string;
  productUrl: string;
  platform: ListingPlatform;
  profitPercent: string;
}

function createDraftRow(index = 0): DraftRow {
  return {
    id: `draft-${Date.now()}-${index}`,
    productUrl: "",
    platform: "ebay",
    profitPercent: "",
  };
}

function createDraftRows(count: number): DraftRow[] {
  return Array.from({ length: count }, (_, index) => createDraftRow(index));
}

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

export function BulkListingShell() {
  const [userId, setUserId] = useState<string | null>(null);
  const [draftRows, setDraftRows] = useState<DraftRow[]>(() => createDraftRows(DEFAULT_ROW_COUNT));
  const [jobs, setJobs] = useState<BulkListingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const processingRef = useRef(false);

  const ebaySettings = useMemo(() => {
    if (!userId) return normalizeEbayAutoListingSettings(null);
    return loadEbayAutoListingSettings(userId);
  }, [userId]);

  const amazefSettings = useMemo(() => {
    if (!userId) return normalizeAutoListingSettings(null);
    return loadAutoListingSettings(userId);
  }, [userId]);

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

  const resumedRef = useRef(false);

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

  const queuedCount = useMemo(
    () => jobs.filter((job) => job.status === "queued" || job.status === "listing").length,
    [jobs],
  );

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

  function updateDraftRow(id: string, patch: Partial<DraftRow>) {
    setDraftRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addDraftRow() {
    setDraftRows((rows) => [...rows, createDraftRow(rows.length)]);
  }

  function removeDraftRow(id: string) {
    setDraftRows((rows) => (rows.length <= 1 ? rows : rows.filter((row) => row.id !== id)));
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>, rowId: string) {
    const pasted = event.clipboardData.getData("text");
    const lines = pasted
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length <= 1) return;

    event.preventDefault();
    setDraftRows((rows) => {
      const index = rows.findIndex((row) => row.id === rowId);
      if (index < 0) return rows;

      const next = [...rows];
      lines.forEach((line, offset) => {
        const targetIndex = index + offset;
        if (targetIndex < next.length) {
          next[targetIndex] = { ...next[targetIndex], productUrl: line };
        } else {
          next.push({ ...createDraftRow(targetIndex), productUrl: line });
        }
      });
      return next;
    });
  }

  async function handleListAll() {
    if (!userId) return;

    const rowsToSubmit = draftRows
      .filter((row) => row.productUrl.trim())
      .map((row) => ({
        productUrl: row.productUrl.trim(),
        platform: row.platform,
        profitPercent: row.profitPercent.trim() ? Number(row.profitPercent) : null,
      }));

    if (rowsToSubmit.length === 0) {
      setError("Add at least one AliExpress URL in the sheet.");
      return;
    }

    const needsEbay = rowsToSubmit.some((row) => row.platform === "ebay");
    const needsAmazef = rowsToSubmit.some((row) => row.platform === "amazef");

    if (needsEbay && !ebaySettings.enabled) {
      setError("Turn on eBay auto listing in AI Listing settings first.");
      return;
    }
    if (needsAmazef && !amazefSettings.enabled) {
      setError("Turn on Amazef auto listing in AI Listing settings first.");
      return;
    }

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
      setDraftRows(createDraftRows(DEFAULT_ROW_COUNT));
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

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1200px] p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">Bulk Listing</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#6B7280]">
              Paste AliExpress URLs into the sheet, choose platform and optional profit %, then
              click <span className="font-semibold text-[#374151]">List all</span>. Each row is
              saved and listed automatically using your auto listing settings.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addDraftRow}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-[#374151] hover:bg-gray-50"
            >
              Add row
            </button>
            <button
              type="button"
              onClick={() => void handleListAll()}
              disabled={listing || processing}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
            >
              {listing || processing ? "Listing…" : "List all"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
            {processing ? " Processing next items…" : null}
          </div>
        ) : null}

        <div className="mt-6 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-gray-100 bg-[#F9FAFB] text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="min-w-[320px] px-4 py-3">AliExpress URL</th>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">Profit %</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="min-w-[180px] px-4 py-3">Result</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {draftRows.map((row, index) => (
                  <tr key={row.id} className="border-b border-gray-50">
                    <td className="px-4 py-3 text-[#9CA3AF]">{index + 1}</td>
                    <td className="px-4 py-3">
                      <input
                        type="url"
                        value={row.productUrl}
                        onChange={(event) =>
                          updateDraftRow(row.id, { productUrl: event.target.value })
                        }
                        onPaste={(event) => handlePaste(event, row.id)}
                        placeholder="https://www.aliexpress.com/item/..."
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={row.platform}
                        onChange={(event) =>
                          updateDraftRow(row.id, {
                            platform: event.target.value as ListingPlatform,
                          })
                        }
                        className="rounded-lg border border-gray-200 px-2 py-2 text-sm focus:border-brand focus:outline-none"
                      >
                        <option value="ebay">eBay</option>
                        <option value="amazef">Amazef</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={1}
                        max={95}
                        value={row.profitPercent}
                        onChange={(event) =>
                          updateDraftRow(row.id, { profitPercent: event.target.value })
                        }
                        placeholder="Default"
                        className="w-24 rounded-lg border border-gray-200 px-2 py-2 text-sm focus:border-brand focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-[#6B7280]">
                        Draft
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#9CA3AF]">Not saved yet</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => removeDraftRow(row.id)}
                        className="text-xs font-medium text-red-500 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}

                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-sm text-[#6B7280]">
                      Loading saved jobs…
                    </td>
                  </tr>
                ) : activeBatchJobs.length > 0 ? (
                  activeBatchJobs.map((job, index) => (
                    <tr key={job.id} className="border-b border-gray-50 bg-[#FAFBFC]">
                      <td className="px-4 py-3 text-[#9CA3AF]">{draftRows.length + index + 1}</td>
                      <td className="px-4 py-3">
                        <p className="truncate text-sm text-[#374151]" title={job.productUrl}>
                          {job.productUrl}
                        </p>
                      </td>
                      <td className="px-4 py-3 capitalize text-[#374151]">{job.platform}</td>
                      <td className="px-4 py-3 text-[#374151]">
                        {job.profitPercent != null ? `${job.profitPercent}%` : "Default"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(job.status)}`}
                        >
                          {formatStatus(job.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
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
                          <p className="text-xs text-red-600">{job.errorMessage ?? "Failed"}</p>
                        ) : job.status === "listing" ? (
                          <p className="text-xs text-sky-600">Auto listing in progress…</p>
                        ) : (
                          <p className="text-xs text-[#9CA3AF]">Waiting…</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {job.status === "failed" ? (
                          <button
                            type="button"
                            onClick={() => void handleRetry(job.id)}
                            disabled={processing}
                            className="text-xs font-semibold text-brand hover:underline disabled:opacity-50"
                          >
                            Retry
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-[#6B7280]">
          <span>
            Auto listing: eBay {ebaySettings.enabled ? "on" : "off"} · Amazef{" "}
            {amazefSettings.enabled ? "on" : "off"}
          </span>
          {queuedCount > 0 ? (
            <span className="font-medium text-amber-600">{queuedCount} item(s) in queue</span>
          ) : null}
          <span>Paste a column of URLs into any URL cell to fill multiple rows.</span>
        </div>
      </div>
    </DashboardLayout>
  );
}
