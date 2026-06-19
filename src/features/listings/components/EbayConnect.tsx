"use client";

import { useCallback, useEffect, useState } from "react";
import type { EbayConnectionStatus } from "@/types/listing-generator";

interface EbayConnectProps {
  userId: string;
  refreshKey?: string;
}

export function EbayConnect({ userId, refreshKey }: EbayConnectProps) {
  const [status, setStatus] = useState<EbayConnectionStatus>({
    connected: false,
    ebayUsername: null,
    accessTokenExpiresAt: null,
  });
  const [loadingStatus, setLoadingStatus] = useState(true);

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

  function handleConnect() {
    window.location.href = `/api/ebay/auth?userId=${encodeURIComponent(userId)}`;
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#111827]">eBay connection</p>
          <p className="mt-1 text-xs text-[#6B7280]">
            {loadingStatus
              ? "Checking..."
              : status.connected
                ? `Connected${status.ebayUsername ? ` · ${status.ebayUsername}` : ""}`
                : "Connect before the final listing step"}
          </p>
        </div>

        {!status.connected ? (
          <button
            type="button"
            disabled={loadingStatus}
            onClick={handleConnect}
            className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            Connect eBay Account
          </button>
        ) : (
          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Connected
          </span>
        )}
      </div>
    </div>
  );
}
