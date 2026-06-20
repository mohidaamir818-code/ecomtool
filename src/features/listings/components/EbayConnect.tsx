"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { EbayConnectionStatus } from "@/types/listing-generator";

interface EbayConnectProps {
  userId: string;
  refreshKey?: string;
}

export function EbayConnect({ userId, refreshKey }: EbayConnectProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const oauthJustSucceeded = useRef(false);
  const oauthReturnHandled = useRef(false);
  const [status, setStatus] = useState<EbayConnectionStatus>({
    connected: false,
    ebayUsername: null,
    accessTokenExpiresAt: null,
  });
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [toast, setToast] = useState<{ message: string; isError: boolean } | null>(null);

  const loadStatus = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoadingStatus(true);
    try {
      const response = await fetch(`/api/ebay/status?userId=${encodeURIComponent(userId)}`);
      const data = await response.json();
      if (response.ok) {
        const nextStatus: EbayConnectionStatus = {
          connected: Boolean(data.connected),
          ebayUsername: data.ebayUsername ?? null,
          accessTokenExpiresAt: data.accessTokenExpiresAt ?? null,
        };
        setStatus((current) => {
          if (oauthJustSucceeded.current && !nextStatus.connected) {
            return current;
          }
          if (nextStatus.connected && nextStatus.ebayUsername) {
            oauthJustSucceeded.current = false;
          }
          return nextStatus;
        });
        return nextStatus;
      }
      return null;
    } finally {
      if (!options?.silent) setLoadingStatus(false);
    }
  }, [userId]);

  useEffect(() => {
    if (searchParams.get("connected") === "true") return;
    if (
      searchParams.get("error") === "connection_failed" ||
      searchParams.get("ebay") === "error"
    ) {
      return;
    }
    void loadStatus();
  }, [loadStatus, refreshKey, searchParams]);

  useEffect(() => {
    if (searchParams.get("connected") !== "true") return;
    if (oauthReturnHandled.current) return;
    oauthReturnHandled.current = true;

    oauthJustSucceeded.current = true;
    setLoadingStatus(false);
    setStatus((current) => ({ ...current, connected: true }));
    setToast({ message: "Successfully connected to eBay", isError: false });
    router.replace("/dashboard/listings");
  }, [searchParams, router]);

  useEffect(() => {
    if (!oauthJustSucceeded.current) return;

    let cancelled = false;

    async function pollForUsername() {
      for (let attempt = 0; attempt < 5; attempt++) {
        if (cancelled) return;
        const nextStatus = await loadStatus({ silent: true });
        if (nextStatus?.ebayUsername) return;
        if (attempt < 4) {
          await new Promise((resolve) => window.setTimeout(resolve, 1000));
        }
      }
    }

    void pollForUsername();
    return () => {
      cancelled = true;
    };
  }, [userId, loadStatus]);

  useEffect(() => {
    const connectionFailed =
      searchParams.get("error") === "connection_failed" ||
      searchParams.get("ebay") === "error";

    if (!connectionFailed) return;

    oauthJustSucceeded.current = false;
    setLoadingStatus(false);
    setToast({
      message: searchParams.get("message") ?? "eBay connection failed.",
      isError: true,
    });
    router.replace("/dashboard/listings");
  }, [searchParams, router]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const authUrl = `/api/ebay/auth?userId=${encodeURIComponent(userId)}`;

  if (status.connected) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
        <p className="text-sm font-medium text-emerald-800">
          <span className="mr-1">✓</span>
          Connected to eBay
          {status.ebayUsername ? ` as ${status.ebayUsername}` : " — loading your store name..."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#111827]">eBay connection</p>
            <p className="mt-1 text-xs text-[#6B7280]">
              {loadingStatus ? "Checking..." : "Connect before the final listing step"}
            </p>
          </div>

          <a
            href={authUrl}
            className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white no-underline hover:bg-brand-dark"
          >
            Connect eBay Account
          </a>
        </div>
      </div>

      {toast ? (
        <p
          className={`mt-3 rounded-lg px-4 py-3 text-sm font-medium ${
            toast.isError
              ? "border border-red-100 bg-red-50 text-red-600"
              : "border border-emerald-100 bg-emerald-50 text-emerald-700"
          }`}
        >
          {toast.message}
          {toast.isError ? (
            <>
              {" "}
              <a href={authUrl} className="font-semibold underline">
                Try again
              </a>
            </>
          ) : null}
        </p>
      ) : null}
    </>
  );
}
