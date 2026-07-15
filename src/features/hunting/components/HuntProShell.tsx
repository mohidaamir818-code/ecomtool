"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import type { HuntProProduct, HuntProResult } from "@/types/huntpro";

const POLL_INTERVAL_MS = 4000;
const HUNT_TIMEOUT_MS = 120_000;

const GRABLEY_EXTENSION_URL =
  "https://chromewebstore.google.com/detail/grabley-product-search-to/hppdgjpcbnbfapnailmeiibngpolplao";
const HUNTPRO_CONNECT_URL = "/api/huntpro/connect";
const HUNTPRO_PING_TIMEOUT_MS = 4000;

function isHuntProDomReady(): boolean {
  try {
    return document.documentElement.getAttribute("data-ecomtool-huntpro") === "ready";
  } catch {
    return false;
  }
}

/** Detect EcomTool HuntPro bridge via DOM marker, CustomEvent, and postMessage. */
function detectHuntProExtension(): Promise<boolean> {
  if (isHuntProDomReady()) return Promise.resolve(true);

  return new Promise((resolve) => {
    let settled = false;

    function finish(ok: boolean) {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      window.removeEventListener("ecomtool-huntpro-pong", onCustomPong);
      resolve(ok);
    }

    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string } | null;
      if (data?.type === "HUNTPRO_PONG") finish(true);
    }

    function onCustomPong() {
      finish(true);
    }

    window.addEventListener("message", onMessage);
    window.addEventListener("ecomtool-huntpro-pong", onCustomPong);

    // Ping multiple ways / times — SPA and late-injected bridges.
    const ping = () => {
      if (isHuntProDomReady()) {
        finish(true);
        return;
      }
      window.postMessage({ type: "HUNTPRO_PING", source: "ecomtool" }, "*");
      try {
        window.dispatchEvent(new CustomEvent("ecomtool-huntpro-ping"));
      } catch {
        // ignore
      }
    };

    ping();
    window.setTimeout(ping, 300);
    window.setTimeout(ping, 900);
    window.setTimeout(() => finish(false), HUNTPRO_PING_TIMEOUT_MS);
  });
}

const GRABLEY_DONE_KEY = "ecomtools_grabley_done";
const HUNTPRO_ONBOARDED_KEY = "huntpro_onboarded";
const HUNT_ACTIVE_KEY = "ecomtools_random_hunt_active";
const RANDOM_HOT_KEYWORD = "random-hot";
const RANDOM_TARGET_COUNT = 20;

type OnboardStep = "grabley" | "huntpro" | "connect" | null;

function formatPrice(value: number): string {
  return `£${Number(value || 0).toFixed(2)}`;
}

function aliExpressSearchUrl(title: string): string {
  return `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(title)}`;
}

export function HuntProShell() {
  const searchParams = useSearchParams();
  const resultIdFromEmail = searchParams.get("resultId")?.trim() || null;

  const [userId, setUserId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [searching, setSearching] = useState(false);
  const [randomHunting, setRandomHunting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<HuntProResult | null>(null);
  const [onboardStep, setOnboardStep] = useState<OnboardStep>(null);
  const [connecting, setConnecting] = useState(false);
  const [days, setDays] = useState(7);
  const [resultDays, setResultDays] = useState(7);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baselineResultIdRef = useRef<string | null>(null);
  const huntStartedAtRef = useRef<number>(0);

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

  const applyHuntResult = useCallback(
    (latest: HuntProResult) => {
      setResult(latest);
      setSearching(false);
      setRandomHunting(false);
      setError("");
      setNotice("Hunt complete — hot products are ready below.");
      try {
        localStorage.removeItem(HUNT_ACTIVE_KEY);
      } catch {
        // ignore
      }
      stopPolling();
    },
    [stopPolling],
  );

  const fetchLatest = useCallback(
    async (
      id: string,
      options?: { keyword?: string; resultId?: string },
    ): Promise<HuntProResult | null> => {
      const params = new URLSearchParams({ userId: id });
      if (options?.resultId) params.set("resultId", options.resultId);
      else if (options?.keyword) params.set("keyword", options.keyword);

      const response = await fetch(`/api/hunting/receive?${params.toString()}`);
      const data = (await response.json()) as { result?: HuntProResult | null; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load hunting results.");
      }
      return data.result ?? null;
    },
    [],
  );

  const startResultPolling = useCallback(
    (id: string, preferredKeyword?: string) => {
      stopPolling();
      pollRef.current = setInterval(() => {
        void (async () => {
          try {
            const preferred = preferredKeyword?.trim() || RANDOM_HOT_KEYWORD;
            const latest =
              (await fetchLatest(id, { keyword: preferred })) ?? (await fetchLatest(id));
            if (!latest || (latest.products?.length ?? 0) === 0) return;
            if (latest.id === baselineResultIdRef.current) return;
            const createdAt = Date.parse(latest.createdAt);
            if (
              Number.isFinite(createdAt) &&
              huntStartedAtRef.current > 0 &&
              createdAt + 2000 < huntStartedAtRef.current
            ) {
              return;
            }
            applyHuntResult(latest);
          } catch {
            // keep polling
          }
        })();
      }, POLL_INTERVAL_MS);

      timeoutRef.current = setTimeout(() => {
        setRandomHunting(false);
        setSearching(false);
        setNotice("");
        setError(
          "Hunt timed out with no products. Reload EcomTool HuntPro extension (v1.0.2), keep Chrome open, sign into eBay.co.uk, then try again.",
        );
        try {
          localStorage.removeItem(HUNT_ACTIVE_KEY);
        } catch {
          // ignore
        }
        stopPolling();
      }, HUNT_TIMEOUT_MS);
    },
    [applyHuntResult, fetchLatest, stopPolling],
  );

  const startRandomHunt = useCallback(
    async (id: string) => {
      setError("");
      setOnboardStep(null);
      huntStartedAtRef.current = Date.now();

      try {
        const existing = await fetchLatest(id, { keyword: RANDOM_HOT_KEYWORD });
        baselineResultIdRef.current = existing?.id ?? null;
      } catch {
        baselineResultIdRef.current = null;
      }

      const present = await detectHuntProExtension();
      setNotice(
        present
          ? "Sending start signal to HuntPro…"
          : "Extension ping weak — still sending hunt start. Watch for eBay tabs opening…",
      );

      try {
        localStorage.setItem(HUNT_ACTIVE_KEY, "true");
        localStorage.setItem(HUNTPRO_ONBOARDED_KEY, "true");
      } catch {
        // ignore
      }
      setRandomHunting(true);
      setKeyword(RANDOM_HOT_KEYWORD);
      setResultDays(7);

      window.postMessage(
        {
          type: "HUNTPRO_RANDOM_HUNT",
          source: "ecomtool",
          userId: id,
          keyword: RANDOM_HOT_KEYWORD,
          targetCount: RANDOM_TARGET_COUNT,
          minDailySales: 1,
          lookbackDays: 7,
          useGrableyHistory: true,
          appBaseUrl: window.location.origin,
        },
        "*",
      );

      startResultPolling(id, RANDOM_HOT_KEYWORD);
    },
    [fetchLatest, startResultPolling],
  );

  const completeOnboarding = useCallback(
    (id?: string | null) => {
      try {
        localStorage.setItem(HUNTPRO_ONBOARDED_KEY, "true");
        localStorage.setItem(GRABLEY_DONE_KEY, "true");
      } catch {
        // ignore
      }
      setConnecting(false);
      setOnboardStep(null);
      const uid = id ?? userId ?? sessionStorage.getItem("ecomtools_user_id");
      if (uid) void startRandomHunt(uid);
    },
    [startRandomHunt, userId],
  );

  useEffect(() => {
    const id = sessionStorage.getItem("ecomtools_user_id");
    if (id) setUserId(id);

    const grableyDone = localStorage.getItem(GRABLEY_DONE_KEY) === "true";
    const onboarded = localStorage.getItem(HUNTPRO_ONBOARDED_KEY) === "true";
    const huntActive = localStorage.getItem(HUNT_ACTIVE_KEY) === "true";

    if (!grableyDone) {
      setOnboardStep("grabley");
      return;
    }
    if (!onboarded) {
      // If extension already injected, skip the scary install wall.
      if (isHuntProDomReady()) {
        try {
          localStorage.setItem(HUNTPRO_ONBOARDED_KEY, "true");
        } catch {
          // ignore
        }
        setOnboardStep("connect");
        return;
      }
      setOnboardStep("huntpro");
      void detectHuntProExtension().then((ok) => {
        if (!ok) return;
        try {
          localStorage.setItem(HUNTPRO_ONBOARDED_KEY, "true");
        } catch {
          // ignore
        }
        setOnboardStep((step) => (step === "huntpro" ? "connect" : step));
      });
      return;
    }
    if (huntActive && id) {
      setRandomHunting(true);
      setNotice("Random hunt still running in the background via HuntPro…");
      void startRandomHunt(id);
    }
    // Only on first mount — resume active hunt / show onboarding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!userId) return;
    if (!resultIdFromEmail && !userId) return;

    void (async () => {
      try {
        const latest = await fetchLatest(userId, {
          resultId: resultIdFromEmail ?? undefined,
          keyword: resultIdFromEmail ? undefined : RANDOM_HOT_KEYWORD,
        });
        if (latest) {
          setResult(latest);
          setResultDays(7);
          if (resultIdFromEmail) {
            setNotice("Showing hunted products from your email link.");
            try {
              localStorage.removeItem(HUNT_ACTIVE_KEY);
            } catch {
              // ignore
            }
            setRandomHunting(false);
          }
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load hunt results.");
      }
    })();
  }, [userId, resultIdFromEmail, fetchLatest]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  useEffect(() => {
    function onConnectMessage(event: MessageEvent) {
      const data = event.data as { type?: string; userId?: string } | null;
      if (!data || data.type !== "ECOMTOOL_HUNTPRO_CONNECT") return;
      if (data.userId) setUserId(data.userId);
      try {
        localStorage.setItem(HUNTPRO_ONBOARDED_KEY, "true");
        localStorage.setItem(GRABLEY_DONE_KEY, "true");
      } catch {
        // ignore
      }
      completeOnboarding(data.userId);
    }

    window.addEventListener("message", onConnectMessage);
    return () => window.removeEventListener("message", onConnectMessage);
  }, [completeOnboarding]);

  // Any live HuntPro signal means it's installed — never force the install popup again.
  useEffect(() => {
    function markFromHuntProStep() {
      try {
        localStorage.setItem(HUNTPRO_ONBOARDED_KEY, "true");
      } catch {
        // ignore
      }
      setOnboardStep((step) => (step === "huntpro" ? "connect" : step));
    }

    function markConnectedFromSignal(event: MessageEvent) {
      const data = event.data as { type?: string; source?: string } | null;
      if (!data?.type) return;
      const types = new Set([
        "HUNTPRO_PONG",
        "HUNTPRO_STATUS",
        "HUNTPRO_RESULTS",
        "HUNTPRO_ERROR",
        "ECOMTOOL_HUNTPRO_CONNECT",
      ]);
      if (!types.has(data.type) && data.source !== "huntpro-extension") return;
      markFromHuntProStep();
    }

    window.addEventListener("message", markConnectedFromSignal);
    window.addEventListener("ecomtool-huntpro-pong", markFromHuntProStep);
    return () => {
      window.removeEventListener("message", markConnectedFromSignal);
      window.removeEventListener("ecomtool-huntpro-pong", markFromHuntProStep);
    };
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as {
        type?: string;
        error?: string;
        message?: string;
        status?: string;
        keyword?: string;
      } | null;
      if (!data?.type) return;

      if (data.type === "HUNTPRO_STATUS") {
        if (data.message) setNotice(data.message);
        else if (data.status) setNotice(`HuntPro: ${data.status}`);
        return;
      }

      if (data.type === "HUNTPRO_ERROR") {
        setRandomHunting(false);
        setSearching(false);
        setNotice("");
        setError(data.error || "HuntPro failed while hunting.");
        try {
          localStorage.removeItem(HUNT_ACTIVE_KEY);
        } catch {
          // ignore
        }
        stopPolling();
        return;
      }

      if (data.type !== "HUNTPRO_RESULTS") return;
      if (!userId) return;
      void (async () => {
        try {
          const latest =
            (await fetchLatest(userId, {
              keyword: data.keyword || RANDOM_HOT_KEYWORD,
            })) ?? (await fetchLatest(userId));
          if (latest && (latest.products?.length ?? 0) > 0) {
            applyHuntResult(latest);
          }
        } catch (loadError) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load hunt results.");
        }
      })();
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [userId, fetchLatest, stopPolling, applyHuntResult]);

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

    setError("");
    setResult(null);
    setSearching(true);
    setNotice("Sending keyword hunt to HuntPro…");
    setResultDays(days);
    huntStartedAtRef.current = Date.now();

    try {
      const existing = await fetchLatest(userId, { keyword: trimmed });
      baselineResultIdRef.current = existing?.id ?? null;
    } catch {
      baselineResultIdRef.current = null;
    }

    window.postMessage(
      {
        type: "HUNTPRO_SEARCH",
        source: "ecomtool",
        userId,
        keyword: trimmed,
        days,
        appBaseUrl: window.location.origin,
      },
      "*",
    );

    startResultPolling(userId, trimmed);
  }

  const statistics = result?.statistics;
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
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-flex rounded-full border border-[#DDD6FE] bg-brand-light px-3 py-1 text-xs font-semibold text-brand">
              Product Discovery
            </span>
            <h1 className="mt-3 text-2xl font-bold text-[#111827] lg:text-3xl">Product Hunting</h1>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-[#6B7280]">
              Install Grabley + HuntPro, connect once, then auto-hunt random hot eBay products (1+
              sales/day, strong last 7 days). We email you when ready.
            </p>
          </div>
          {userId && onboardStep === null ? (
            <button
              type="button"
              onClick={() => void startRandomHunt(userId)}
              disabled={randomHunting}
              className="inline-flex items-center justify-center rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(88,66,244,0.28)] transition-all hover:bg-brand-dark disabled:opacity-60"
            >
              {randomHunting ? "Hunting…" : "Start random hunt"}
            </button>
          ) : null}
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
              value={keyword === RANDOM_HOT_KEYWORD ? "" : keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Optional keyword search, e.g. wireless earbuds"
              className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm font-medium text-[#374151] outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
            />
          </div>
          <select
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-[#374151] outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 sm:w-auto"
          >
            {[7, 10, 15, 20, 30].map((option) => (
              <option key={option} value={option}>
                Last {option} days
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={searching || !userId}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-[#374151] transition-all hover:bg-gray-50 disabled:opacity-60"
          >
            {searching ? "Searching…" : "Keyword search"}
          </button>
        </form>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-brand/20 bg-brand-light px-4 py-3 text-sm font-medium text-brand">
            {(searching || randomHunting) && (
              <svg className="mt-0.5 h-4 w-4 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            <span>{notice}</span>
          </div>
        ) : null}

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
        ) : !searching && !randomHunting ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#374151]">No hunted products yet</p>
            <p className="mt-1 text-xs text-[#6B7280]">
              Finish Grabley + HuntPro setup, or tap Start random hunt. Results also open from your
              email &quot;View Products&quot; button.
            </p>
          </div>
        ) : null}
      </div>

      {onboardStep === "grabley" ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-2xl">
            <h3 className="text-lg font-bold text-[#111827]">Install Grabley</h3>
            <p className="mt-2 text-sm text-[#6B7280]">
              Grabley adds the <strong>[history]</strong> button on eBay listings so HuntPro can
              read sold history and find hot products.
            </p>
            <a
              href={GRABLEY_EXTENSION_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-dark"
            >
              Add Grabley extension
            </a>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.setItem(GRABLEY_DONE_KEY, "true");
                } catch {
                  // ignore
                }
                setOnboardStep("huntpro");
              }}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#374151] transition-all hover:bg-gray-50"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}

      {onboardStep === "huntpro" ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-2xl">
            <h3 className="text-lg font-bold text-[#111827]">Install EcomTool HuntPro</h3>
            <p className="mt-2 text-left text-sm text-[#6B7280]">
              Load folder <code className="rounded bg-gray-100 px-1">extension/huntpro</code>, set Site
              access to On all sites, then continue. If HuntPro is already working, skip this step.
            </p>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-left text-sm text-[#374151]">
              <li>
                Open <code className="rounded bg-gray-100 px-1">chrome://extensions</code>
              </li>
              <li>Developer mode → Load unpacked → <code className="rounded bg-gray-100 px-1">extension/huntpro</code></li>
              <li>Site access → <strong>On all sites</strong>, then Reload</li>
            </ol>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.setItem(HUNTPRO_ONBOARDED_KEY, "true");
                } catch {
                  // ignore
                }
                setError("");
                setOnboardStep("connect");
              }}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-dark"
            >
              Continue to connect
            </button>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.setItem(HUNTPRO_ONBOARDED_KEY, "true");
                  localStorage.setItem(GRABLEY_DONE_KEY, "true");
                } catch {
                  // ignore
                }
                setError("");
                setOnboardStep(null);
                const uid = userId ?? sessionStorage.getItem("ecomtools_user_id");
                if (uid) void startRandomHunt(uid);
              }}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#374151] transition-all hover:bg-gray-50"
            >
              Already connected — start hunting
            </button>
          </div>
        </div>
      ) : null}

      {onboardStep === "connect" ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-2xl">
            <h3 className="text-lg font-bold text-[#111827]">Connect HuntPro</h3>
            <p className="mt-2 text-sm text-[#6B7280]">
              Link HuntPro to your EcomTool account. Random hunting starts automatically right after
              connect.
            </p>
            <a
              href={HUNTPRO_CONNECT_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setConnecting(true)}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-dark"
            >
              {connecting ? "Connecting…" : "Connect HuntPro"}
            </a>
            <button
              type="button"
              onClick={() => completeOnboarding()}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#374151] transition-all hover:bg-gray-50"
            >
              Done — start hunting
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
