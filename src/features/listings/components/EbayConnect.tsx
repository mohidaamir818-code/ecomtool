"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { EbayConnectionStatus } from "@/types/listing-generator";

interface EbayConnectProps {
  userId: string;
  refreshKey?: string;
}

export function EbayConnect({ userId, refreshKey }: EbayConnectProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<EbayConnectionStatus>({
    connected: false,
    ebayUsername: null,
    accessTokenExpiresAt: null,
  });
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [toast, setToast] = useState<{ message: string; isError: boolean } | null>(null);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const response = await fetch(`/api/ebay/status?userId=${encodeURIComponent(userId)}`);
      const data = await response.json();
      if (response.ok) {
        setStatus({
          connected: Boolean(data.connected),
          ebayUsername: data.ebayUsername ?? null,
          accessTokenExpiresAt: data.accessTokenExpiresAt ?? null,
        });
      }
    } finally {
      setLoadingStatus(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus, refreshKey]);

  useEffect(() => {
    if (searchParams.get("connected") === "true") {
      setToast({ message: "Successfully connected to eBay", isError: false });
      void loadStatus();
      router.replace("/dashboard/listings");
      return;
    }

    const connectionFailed =
      searchParams.get("error") === "connection_failed" ||
      searchParams.get("ebay") === "error";

    if (connectionFailed) {
      setToast({
        message: searchParams.get("message") ?? "eBay connection failed.",
        isError: true,
      });
      router.replace("/dashboard/listings");
    }
  }, [searchParams, loadStatus, router]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (status.connected) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
        <p className="text-sm font-medium text-emerald-800">
          <span className="mr-1">✓</span>
          Connected to eBay{status.ebayUsername ? ` as ${status.ebayUsername}` : ""}
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
            href={`/api/ebay/auth?userId=${encodeURIComponent(userId)}`}
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
        </p>
      ) : null}
    </>
  );
}
