"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { buildCalculatorCsv } from "@/lib/seller-calculator/export-csv";
import { formatMoney } from "@/lib/seller-calculator/format";
import type {
  SellerCalculatorMonth,
  SellerCalculatorOrderRow,
  SellerCalculatorResponse,
  SellerCalculatorTotals,
} from "@/types/seller-calculator";

type MonthKey = `${number}-${number}`;

function currentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function lastYearMonth(): { year: number; month: number } {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function toMonthKey(year: number, month: number): MonthKey {
  return `${year}-${month}`;
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

function computeRoi(profit: number, costPrice: number): number | null {
  if (costPrice <= 0) return null;
  return Math.round((profit / costPrice) * 10000) / 100;
}

function buildMergedTotals(orders: SellerCalculatorOrderRow[], currency: string): SellerCalculatorTotals {
  const costPrice = orders.reduce((sum, row) => sum + row.costPrice, 0);
  const sellingPrice = orders.reduce((sum, row) => sum + row.sellingPrice, 0);
  const fees = orders.reduce((sum, row) => sum + row.fees, 0);
  const netSale = orders.reduce((sum, row) => sum + row.netSale, 0);
  const profit = orders.reduce((sum, row) => sum + row.profit, 0);
  const refundAmount = orders.reduce((sum, row) => sum + row.refundAmount, 0);
  const roi = computeRoi(profit, costPrice);

  return {
    costPrice,
    sellingPrice,
    fees,
    netSale,
    profit,
    roi,
    refundAmount,
    costPriceLabel: formatMoney(costPrice, currency),
    sellingPriceLabel: formatMoney(sellingPrice, currency),
    feesLabel: formatMoney(fees, currency),
    netSaleLabel: formatMoney(netSale, currency),
    profitLabel: formatMoney(profit, currency),
    refundAmountLabel: formatMoney(refundAmount, currency),
    roiLabel: roi == null ? "—" : `${roi.toFixed(2)}%`,
  };
}

function mergeMonthSheets(
  sheets: SellerCalculatorMonth[],
  selected: Array<{ year: number; month: number; label: string }>,
): SellerCalculatorMonth {
  const seen = new Set<string>();
  const orders: SellerCalculatorOrderRow[] = [];

  for (const sheet of sheets) {
    for (const row of sheet.orders) {
      if (seen.has(row.ebayOrderId)) continue;
      seen.add(row.ebayOrderId);
      orders.push(row);
    }
  }

  orders.sort((a, b) => {
    if (a.orderDate === b.orderDate) return a.ebayOrderId.localeCompare(b.ebayOrderId);
    return a.orderDate.localeCompare(b.orderDate);
  });

  const currency = orders[0]?.currency ?? "GBP";
  const first = selected[0];
  const monthLabel =
    selected.length === 1
      ? selected[0].label
      : selected.map((item) => item.label).join(" + ");

  return {
    id: selected.map((item) => toMonthKey(item.year, item.month)).join("_"),
    year: first.year,
    month: first.month,
    monthLabel,
    status: sheets.every((sheet) => sheet.status === "closed") ? "closed" : "open",
    lastSyncedAt: sheets.map((sheet) => sheet.lastSyncedAt).filter(Boolean).sort().at(-1) ?? null,
    orderCount: orders.length,
    totals: buildMergedTotals(orders, currency),
    orders,
  };
}

export function SellerCalculatorShell() {
  const now = currentYearMonth();
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<MonthKey[]>([toMonthKey(now.year, now.month)]);
  const [monthsOpen, setMonthsOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [sheet, setSheet] = useState<SellerCalculatorMonth | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const printRef = useRef<HTMLDivElement>(null);
  const monthsDropdownRef = useRef<HTMLDivElement>(null);

  const monthOptions = useMemo(() => {
    const items: Array<{ year: number; month: number; label: string; key: MonthKey }> = [];
    for (let offset = 0; offset < 12; offset += 1) {
      const date = new Date(now.year, now.month - 1 - offset, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      items.push({
        year,
        month,
        key: toMonthKey(year, month),
        label: date.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
      });
    }
    return items;
  }, [now.month, now.year]);

  const selectedMonths = useMemo(() => {
    const keySet = new Set(selectedKeys);
    return monthOptions
      .filter((option) => keySet.has(option.key))
      .slice()
      .sort((a, b) => a.year - b.year || a.month - b.month);
  }, [monthOptions, selectedKeys]);

  const selectionLabel = useMemo(() => {
    if (selectedMonths.length === 0) return "Select months";
    if (selectedMonths.length === 1) return selectedMonths[0].label;
    if (selectedMonths.length <= 3) return selectedMonths.map((item) => item.label).join(", ");
    return `${selectedMonths.length} months selected`;
  }, [selectedMonths]);

  const loadSheet = useCallback(async (id: string, months: Array<{ year: number; month: number; label: string }>) => {
    if (months.length === 0) {
      setSheet(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const results = await Promise.all(
        months.map(async (item) => {
          const url = new URL("/api/seller-calculator", window.location.origin);
          url.searchParams.set("userId", id);
          url.searchParams.set("year", String(item.year));
          url.searchParams.set("month", String(item.month));

          const response = await fetch(url.toString());
          const data = (await response.json()) as SellerCalculatorResponse;
          if (!response.ok) {
            throw new Error(data.error ?? "Failed to load seller calculator.");
          }
          return data;
        }),
      );

      setConnected(results.every((result) => Boolean(result.connected)));
      const sheets = results
        .map((result) => result.month)
        .filter((month): month is SellerCalculatorMonth => Boolean(month));
      setSheet(sheets.length > 0 ? mergeMonthSheets(sheets, months) : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error while loading seller calculator.");
      setSheet(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = sessionStorage.getItem("ecomtools_user_id");
    if (id) {
      setUserId(id);
      void loadSheet(id, selectedMonths);
    } else {
      setLoading(false);
    }
  }, [loadSheet, selectedMonths]);

  useEffect(() => {
    if (!monthsOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (!monthsDropdownRef.current?.contains(event.target as Node)) {
        setMonthsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [monthsOpen]);

  function toggleMonth(key: MonthKey) {
    setSelectedKeys((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== key);
      }
      return [...prev, key];
    });
  }

  async function handleSyncForMonths(months: Array<{ year: number; month: number }>) {
    if (!userId || months.length === 0) return;
    setSyncing(true);
    setNotice("");
    setError("");

    try {
      let addedTotal = 0;
      const messages: string[] = [];

      for (const item of months) {
        const response = await fetch("/api/seller-calculator/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, year: item.year, month: item.month }),
        });
        const data = (await response.json()) as SellerCalculatorResponse;

        if (!response.ok) {
          setError(data.error ?? "Sync failed.");
          return;
        }

        addedTotal += data.addedCount ?? 0;
        if (data.message) messages.push(data.message);
      }

      await loadSheet(userId, selectedMonths);
      setNotice(
        months.length > 1
          ? `Synced ${months.length} months. Added ${addedTotal} new order${addedTotal === 1 ? "" : "s"}.`
          : messages[0] ?? "Sync completed.",
      );
    } catch {
      setError("Network error while syncing orders.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleSync() {
    await handleSyncForMonths(selectedMonths);
  }

  async function handleSyncLastMonth() {
    const last = lastYearMonth();
    const key = toMonthKey(last.year, last.month);
    if (!selectedKeys.includes(key)) {
      setSelectedKeys((prev) => [...prev, key]);
    }
    await handleSyncForMonths([last]);
  }

  async function handleCloseMonth() {
    if (!userId || selectedMonths.length === 0) return;
    setClosing(true);
    setNotice("");
    setError("");

    try {
      let addedTotal = 0;

      for (const item of selectedMonths) {
        const response = await fetch("/api/seller-calculator/close-month", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, year: item.year, month: item.month }),
        });
        const data = (await response.json()) as SellerCalculatorResponse;

        if (!response.ok) {
          setError(data.error ?? "Failed to fetch remaining orders.");
          return;
        }

        addedTotal += data.addedCount ?? 0;
      }

      await loadSheet(userId, selectedMonths);
      setNotice(
        selectedMonths.length > 1
          ? `Closed ${selectedMonths.length} months. Added ${addedTotal} remaining order${addedTotal === 1 ? "" : "s"}.`
          : addedTotal > 0
            ? `Month closed. Added ${addedTotal} remaining order${addedTotal === 1 ? "" : "s"}.`
            : "Month closed. No remaining orders with notes.",
      );
    } catch {
      setError("Network error while closing month.");
    } finally {
      setClosing(false);
    }
  }

  function handleDownloadCsv() {
    if (!sheet) return;
    const csv = buildCalculatorCsv(sheet);
    const filename =
      selectedMonths.length === 1
        ? `seller-calculator-${sheet.year}-${String(sheet.month).padStart(2, "0")}.csv`
        : `seller-calculator-${selectedMonths.map((item) => `${item.year}-${String(item.month).padStart(2, "0")}`).join("_")}.csv`;
    downloadTextFile(filename, csv, "text/csv;charset=utf-8");
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
            Pulls eBay order earnings plus whatever note is on the order. If the note has a supplier ID
            and cost, profit uses that; otherwise cost is 0. Check one or more months to build a
            combined date-wise sheet. Orders without any note are skipped. Already imported orders are
            never duplicated.
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
          <div className="relative" ref={monthsDropdownRef}>
            <label htmlFor="calc-month" className="mb-1.5 block text-sm font-semibold text-[#374151]">
              Months
            </label>
            <button
              id="calc-month"
              type="button"
              onClick={() => setMonthsOpen((open) => !open)}
              className="flex min-w-[220px] items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-left text-sm font-medium text-[#111827] shadow-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
            >
              <span className="truncate">{selectionLabel}</span>
              <span className="text-[#9CA3AF]" aria-hidden>
                ▾
              </span>
            </button>
            {monthsOpen && (
              <div className="absolute z-20 mt-2 max-h-72 w-72 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                <p className="px-2 py-1.5 text-xs font-medium text-[#6B7280]">
                  Check months to combine into one sheet
                </p>
                {monthOptions.map((option) => {
                  const checked = selectedKeys.includes(option.key);
                  return (
                    <label
                      key={option.key}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-[#111827] hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMonth(option.key)}
                        className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
                      />
                      <span>{option.label}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleSync}
            disabled={!userId || !connected || syncing || closing || selectedMonths.length === 0}
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
            disabled={!userId || !connected || syncing || closing || selectedMonths.length === 0}
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

        {sheet && selectedMonths.length > 1 && !loading && (
          <p className="mb-3 text-sm font-medium text-[#374151]">
            Combined sheet: {sheet.monthLabel} · {sheet.orderCount} orders (date-wise)
          </p>
        )}

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
                No orders with notes yet. Add any note on eBay orders, then click Sync new orders.
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
