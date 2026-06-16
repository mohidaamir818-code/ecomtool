"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import type { CompetitorCheck, CompetitorCheckResponse, CompetitorMatch } from "@/types/competitor";
import { CompetitorCheckForm } from "./CompetitorCheckForm";
import { CompetitorMatchCard } from "./CompetitorMatchCard";
import { CompetitorResultBanner } from "./CompetitorResultBanner";
import { RecentCompetitorChecks } from "./RecentCompetitorChecks";

type CheckResult = {
  message: string;
  userPriceLabel: string;
  matches: CompetitorMatch[];
  totalSearched: number;
};

export function CompetitorsShell() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recentChecks, setRecentChecks] = useState<CompetitorCheck[]>([]);
  const [selectedCheckId, setSelectedCheckId] = useState<string | null>(null);
  const [loadingCheckId, setLoadingCheckId] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);

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

  useEffect(() => {
    const id = sessionStorage.getItem("ecomtools_user_id");
    if (id) {
      setUserId(id);
      loadRecentChecks(id);
    } else {
      setLoading(false);
    }
  }, [loadRecentChecks]);

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

  function handleSuccess(data: CompetitorCheckResponse) {
    setResult({
      message: data.message ?? "",
      userPriceLabel: data.userPriceLabel ?? "",
      matches: data.matches ?? [],
      totalSearched: data.totalSearched ?? 0,
    });
    setRecentChecks(data.recentChecks ?? []);
    setSelectedCheckId(data.check?.id ?? null);
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
            Enter your product and selling price. We scan Amazef listings and instantly show if any
            seller is undercutting you.
          </p>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {userId && <CompetitorCheckForm userId={userId} onSuccess={handleSuccess} />}

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
                  <p className="text-sm font-medium text-brand">
                    Viewing selected check only
                  </p>
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
          </div>

          <div>
            {loading ? (
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
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
