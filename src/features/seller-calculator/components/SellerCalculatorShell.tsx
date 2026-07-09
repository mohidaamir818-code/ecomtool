"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { buildCalculatorCsv } from "@/lib/seller-calculator/export-csv";
import type { SellerCalculatorMonth, SellerCalculatorResponse } from "@/types/seller-calculator";

function currentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function lastYearMonth(): { year: number; month: number } {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function SellerCalculatorShell() {
  const now = currentYearMonth();
  const [userId, setUserId] = useState<string | null>(null);
  const [year, setYear] = useState(now.year);
  const [month, setMonth] = useState(now.month);
  const [connected, setConnected] = useState(false);
  const [sheet, setSheet] = useState<SellerCalculatorMonth | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  const monthOptions = useMemo(() => {
    const items: Array<{ year: number; month: number; label: string }> = [];
    for (let offset = 0; offset < 12; offset += 1) {
      const date = new Date(now.year, now.month - 1 - offset, 1);
      items.push({
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        label: date.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
      });
    }
    return items;
  }, [now.month, now.year]);

  const loadSheet = useCallback(async (id: string, selectedYear: number, selectedMonth: number) => {
    setLoading(true);
    setError("");

    try {
      const url = new URL("/api/seller-calculator", window.location.origin);
      url.searchParams.set("userId", id);
      url.searchParams.set("year", String(selectedYear));
      url.searchParams.set("month", String(selectedMonth));

      const response = await fetch(url.toString());
      const data = (await response.json()) as SellerCalculatorResponse;

      if (!response.ok) {
        setError(data.error ?? "Failed to load seller calculator.");
        return;
      }

      setConnected(Boolean(data.connected));
      setSheet(data.month ?? null);
    } catch {
      setError("Network error while loading seller calculator.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = sessionStorage.getItem("ecomtools_user_id");
    if (id) {
      setUserId(id);
      void loadSheet(id, year, month);
    } else {
      setLoading(false);
    }
  }, [loadSheet, year, month]);

  async function handleSyncForMonth(selectedYear: number, selectedMonth: number) {
    if (!userId) return;
    setSyncing(true);
    setNotice("");
    setError("");

    try {
      const response = await fetch("/api/seller-calculator/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, year: selectedYear, month: selectedMonth }),
      });
      const data = (await response.json()) as SellerCalculatorResponse;

      if (!response.ok) {
        setError(data.error ?? "Sync failed.");
        return;
      }

      setYear(selectedYear);
      setMonth(selectedMonth);
      setSheet(data.month ?? null);
      setNotice(data.message ?? "Sync completed.");
    } catch {
      setError("Network error while syncing orders.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleSync() {
    await handleSyncForMonth(year, month);
  }

  async function handleSyncLastMonth() {
    const last = lastYearMonth();
    await handleSyncForMonth(last.year, last.month);
  }

  async function handleCloseMonth() {
    if (!userId) return;
    setClosing(true);
    setNotice("");
    setError("");

    try {
      const response = await fetch("/api/seller-calculator/close-month", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, year, month }),
      });
      const data = (await response.json()) as SellerCalculatorResponse;

      if (!response.ok) {
        setError(data.error ?? "Failed to fetch remaining orders.");
        return;
      }

      setSheet(data.month ?? null);
      setNotice(data.message ?? "Month completed.");
    } catch {
      setError("Network error while closing month.");
    } finally {
      setClosing(false);
    }
  }

  function handleDownloadCsv() {
    if (!sheet) return;
    const csv = buildCalculatorCsv(sheet);
    downloadTextFile(
      `seller-calculator-${sheet.year}-${String(sheet.month).padStart(2, "0")}.csv`,
      csv,
      "text/csv;charset=utf-8",
    );
  }

  function handleDownloadPdf() {
    window.print();
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1400px] p-6 lg:p-8">
        <header className="mb-8">
          <span className="inline-flex rounded-full border border-[#DDD6FE] bg-brand-light px-3 py-1 text-xs font-semibold text-brand">
            Seller Calculator
          </span>
          <h1 className="mt-3 text-2xl font-bold text-[#111827] lg:text-3xl">Monthly Profit Sheet</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[#6B7280]">
            Pulls eBay order earnings and supplier cost from your order notes (e.g.{" "}
            <code className="rounded bg-gray-100 px-1">3074386016281530 2.79</code> or supplier ID and
            cost on separate lines). Orders without a note are skipped. Already imported orders are never
            duplicated.
          </p>
        </header>

        {!connected && !loading && (
          <div className="mb-6 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Connect eBay from{" "}
            <a href="/dashboard/listings" className="font-semibold text-brand hover:underline">
              AI Listing
            </a>{" "}
            first.
          </div>
        )}

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

        <div className="mb-6 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="calc-month" className="mb-1.5 block text-sm font-semibold text-[#374151]">
              Month
            </label>
            <select
              id="calc-month"
              value={`${year}-${month}`}
              onChange={(event) => {
                const [nextYear, nextMonth] = event.target.value.split("-").map(Number);
                setYear(nextYear);
                setMonth(nextMonth);
              }}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-[#111827] shadow-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
            >
              {monthOptions.map((option) => (
                <option key={`${option.year}-${option.month}`} value={`${option.year}-${option.month}`}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleSync}
            disabled={!userId || !connected || syncing || closing}
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {syncing ? "Syncing..." : "Sync new orders"}
          </button>

          <button
            type="button"
            onClick={handleSyncLastMonth}
            disabled={!userId || !connected || syncing || closing}
            className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-[#374151] hover:bg-gray-50 disabled:opacity-60"
          >
            {syncing ? "Syncing..." : "Sync last month"}
          </button>

          <button
            type="button"
            onClick={handleCloseMonth}
            disabled={!userId || !connected || syncing || closing}
            className="rounded-xl border border-brand/20 bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-light disabled:opacity-60"
          >
            {closing ? "Fetching..." : "Month complete — fetch remaining"}
          </button>

          {sheet && (
            <>
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-[#374151] hover:bg-gray-50"
              >
                Download CSV
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-[#374151] hover:bg-gray-50"
              >
                Download PDF
              </button>
            </>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <svg className="h-8 w-8 animate-spin text-brand" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : sheet ? (
          <div className="space-y-3">
            <div ref={printRef} className="seller-calculator-print overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[#FFF2A8] text-left font-semibold text-[#111827]">
                    <th className="border border-[#E8D98A] px-3 py-2">TOTAL</th>
                    <th className="border border-[#E8D98A] px-3 py-2" />
                    <th className="border border-[#E8D98A] px-3 py-2">{sheet.totals.costPriceLabel}</th>
                    <th className="border border-[#E8D98A] px-3 py-2" />
                    <th className="border border-[#E8D98A] px-3 py-2">{sheet.totals.sellingPriceLabel}</th>
                    <th className="border border-[#E8D98A] px-3 py-2">{sheet.totals.feesLabel}</th>
                    <th className="border border-[#E8D98A] px-3 py-2">{sheet.totals.netSaleLabel}</th>
                    <th className="border border-[#E8D98A] px-3 py-2 text-emerald-700">{sheet.totals.profitLabel}</th>
                    <th className="border border-[#E8D98A] px-3 py-2">{sheet.totals.roiLabel}</th>
                    <th className="border border-[#E8D98A] px-3 py-2">{sheet.totals.refundAmountLabel}</th>
                    <th className="border border-[#E8D98A] px-3 py-2" />
                  </tr>
                  <tr className="bg-[#F4A460] text-left text-[#111827]">
                    <th className="border border-[#E8C9A0] px-3 py-2 font-bold">Date</th>
                    <th className="border border-[#E8C9A0] px-3 py-2 font-bold">Order no / Name</th>
                    <th className="border border-[#E8C9A0] px-3 py-2 font-bold">Cost Price</th>
                    <th className="border border-[#E8C9A0] px-3 py-2 font-bold">eBay Order No</th>
                    <th className="border border-[#E8C9A0] px-3 py-2 font-bold">Selling Price</th>
                    <th className="border border-[#E8C9A0] px-3 py-2 font-bold">Fees</th>
                    <th className="border border-[#E8C9A0] px-3 py-2 font-bold">Net Sale</th>
                    <th className="border border-[#E8C9A0] px-3 py-2 font-bold">Profit</th>
                    <th className="border border-[#E8C9A0] px-3 py-2 font-bold">ROI</th>
                    <th className="border border-[#E8C9A0] px-3 py-2 font-bold">Refunds Amount</th>
                    <th className="border border-[#E8C9A0] px-3 py-2 font-bold">Payouts</th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.orders.map((row) => (
                    <tr
                      key={row.id}
                      className={
                        row.orderStatus === "cancelled" || row.orderStatus === "refunded"
                          ? "bg-red-50/60"
                          : row.orderStatus === "partial_refund"
                            ? "bg-amber-50/60"
                            : "bg-white"
                      }
                    >
                      <td className="border border-gray-200 px-3 py-2">{row.orderDateLabel}</td>
                      <td className="border border-gray-200 px-3 py-2">{row.supplierOrderId ?? "—"}</td>
                      <td className="border border-gray-200 px-3 py-2">{row.costPriceLabel}</td>
                      <td className="border border-gray-200 px-3 py-2">{row.ebayOrderId}</td>
                      <td className="border border-gray-200 px-3 py-2">{row.sellingPriceLabel}</td>
                      <td className="border border-gray-200 px-3 py-2">{row.feesLabel}</td>
                      <td className="border border-gray-200 px-3 py-2">{row.netSaleLabel}</td>
                      <td className="border border-gray-200 px-3 py-2">{row.profitLabel}</td>
                      <td className="border border-gray-200 px-3 py-2">
                        {row.roi == null ? "—" : `${row.roi.toFixed(2)}%`}
                      </td>
                      <td className="border border-gray-200 px-3 py-2">{row.refundAmountLabel}</td>
                      <td className="border border-gray-200 px-3 py-2">
                        {row.payoutAmount == null
                          ? row.netSaleLabel
                          : formatPayout(row.payoutAmount, row.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sheet.orders.length === 0 ? (
              <p className="text-center text-sm text-[#6B7280]">
                No orders with supplier notes yet. Add notes on eBay orders, then click Sync new orders.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-[#FAFAFA] px-6 py-12 text-center">
            <p className="text-sm font-semibold text-[#374151]">Select a month to view your profit sheet</p>
          </div>
        )}
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .seller-calculator-print,
          .seller-calculator-print * {
            visibility: visible;
          }
          .seller-calculator-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}

function formatPayout(amount: number, currency: string): string {
  if (currency === "GBP") return `£${amount.toFixed(2)}`;
  if (currency === "USD") return `$${amount.toFixed(2)}`;
  if (currency === "EUR") return `€${amount.toFixed(2)}`;
  return `${currency} ${amount.toFixed(2)}`;
}
