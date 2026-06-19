"use client";

import { useEffect, useState } from "react";
import type { CompetitorMatch, CompetitorWatch } from "@/types/competitor";
import { CompetitorMatchCard } from "./CompetitorMatchCard";

function scheduleLabel(watch: CompetitorWatch): string {
  if (watch.updateMode === "auto_24h") return "Checks every 24 hours";
  if (watch.updateMode === "custom") {
    return `Checks every ${watch.updateIntervalHours ?? "—"} hours`;
  }
  return "Manual checks";
}

export function CompetitorWatchCard({
  watch,
  onCheck,
  onRemove,
  onUpdated,
  checking,
  checkDisabled = false,
}: {
  watch: CompetitorWatch;
  onCheck: () => void;
  onRemove: () => void;
  onUpdated: (message?: string, watches?: CompetitorWatch[]) => void;
  checking: boolean;
  checkDisabled?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [matches, setMatches] = useState<CompetitorMatch[]>([]);
  const [message, setMessage] = useState("");
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState(String(watch.userPrice));
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeNotice, setUpgradeNotice] = useState("");

  useEffect(() => {
    setExpanded(false);
    setMatches([]);
    setMessage("");
    setEditingPrice(false);
    setUpgradeNotice("");
    setPriceInput(String(watch.userPrice));
  }, [watch.id]);

  useEffect(() => {
    setPriceInput(String(watch.userPrice));
  }, [watch.userPrice]);

  async function loadMatches() {
    const userId = sessionStorage.getItem("ecomtools_user_id");
    if (!userId) return;

    setLoadingMatches(true);

    try {
      const response = await fetch(
        `/api/competitors/watch?userId=${encodeURIComponent(userId)}&watchId=${encodeURIComponent(watch.id)}`,
      );
      const data = await response.json();

      if (response.ok) {
        setMatches(data.matches ?? []);
        setMessage(data.message ?? "");
      }
    } finally {
      setLoadingMatches(false);
    }
  }

  async function handleToggle() {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);

    if (nextExpanded && matches.length === 0 && watch.matchesFound > 0) {
      await loadMatches();
    }
  }

  async function handleUpgradePrice() {
    const userId = sessionStorage.getItem("ecomtools_user_id");
    if (!userId) return;

    const nextPrice = parseFloat(priceInput);
    if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
      setUpgradeNotice("Enter a valid selling price greater than 0.");
      return;
    }

    setUpgrading(true);
    setUpgradeNotice("");

    try {
      const response = await fetch("/api/competitors/watch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          watchId: watch.id,
          userPrice: nextPrice,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setUpgradeNotice(data.error ?? "Failed to upgrade price.");
        return;
      }

      setEditingPrice(false);
      setExpanded(true);
      setMatches(data.matches ?? []);
      setMessage(data.message ?? "");
      onUpdated(data.message ?? "Price updated and competitors rechecked.", data.watches);
    } catch {
      setUpgradeNotice("Network error while upgrading price.");
    } finally {
      setUpgrading(false);
    }
  }

  const alertClasses = watch.hasAlert
    ? "border-red-200 bg-red-50/40 hover:border-red-300"
    : "border-gray-100 bg-white hover:border-brand/20";

  const marketplace = watch.platform === "ebay" ? "eBay" : "Amazef";
  const viewLabel = watch.platform === "ebay" ? "View on eBay" : "View on Amazef";

  return (
    <article className={`flex h-full flex-col rounded-2xl border p-5 shadow-sm transition-all ${alertClasses}`}>
      <button
        type="button"
        onClick={handleToggle}
        className="w-full text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  watch.hasAlert ? "bg-red-100 text-red-700" : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {watch.hasAlert
                  ? `${watch.matchesFound} below your price`
                  : "No undercuts"}
              </span>
              <span className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-semibold text-brand">
                {scheduleLabel(watch)}
              </span>
            </div>
            <h3 className="line-clamp-2 text-base font-bold text-[#111827]">{watch.productQuery}</h3>
            <div className="mt-2">
              {editingPrice ? (
                <div className="space-y-2" onClick={(event) => event.stopPropagation()}>
                  <label className="block text-sm font-semibold text-[#374151]">Your selling price</label>
                  <div className="relative max-w-[180px]">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#6B7280]">
                      £
                    </span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={priceInput}
                      onChange={(event) => setPriceInput(event.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-7 pr-3 text-sm text-[#111827] outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleUpgradePrice}
                      disabled={upgrading}
                      className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
                    >
                      {upgrading ? "Upgrading..." : "Upgrade"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPrice(false);
                        setPriceInput(String(watch.userPrice));
                        setUpgradeNotice("");
                      }}
                      className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-[#374151] hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                  {upgradeNotice ? (
                    <p className="text-xs font-medium text-red-600">{upgradeNotice}</p>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-[#6B7280]">
                    Your price{" "}
                    <span className="font-semibold text-[#111827]">{watch.userPriceLabel}</span>
                  </p>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setEditingPrice(true);
                      setPriceInput(String(watch.userPrice));
                      setUpgradeNotice("");
                    }}
                    className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-[#374151] hover:border-brand/30 hover:text-brand"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-[#9CA3AF]">
              Last checked {watch.lastCheckedAt ?? "never"}
            </p>
          </div>
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            className={`mt-1 shrink-0 text-[#6B7280] transition-transform ${expanded ? "rotate-180" : ""}`}
            aria-hidden
          >
            <path d="M4.5 7.5 9 12l4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          {loadingMatches ? (
            <div className="flex justify-center py-8">
              <svg className="h-6 w-6 animate-spin text-brand" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : watch.matchesFound > 0 ? (
            <div className="space-y-4">
              {message && <p className="text-sm font-medium text-red-700">{message}</p>}
              {matches.map((match) => (
                <CompetitorMatchCard
                  key={match.id}
                  match={match}
                  userPriceLabel={watch.userPriceLabel}
                  viewLabel={viewLabel}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              No sellers on {marketplace} are listing below {watch.userPriceLabel}.
            </p>
          )}
        </div>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        {watch.updateMode === "manual" && (
          <button
            type="button"
            onClick={onCheck}
            disabled={checking || checkDisabled}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {checking ? "Checking..." : "Check now"}
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100"
        >
          Remove
        </button>
      </div>
    </article>
  );
}
