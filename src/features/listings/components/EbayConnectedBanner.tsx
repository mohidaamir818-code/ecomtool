"use client";

import { useState } from "react";

interface EbayConnectedBannerProps {
  userId: string;
  ebayUsername: string | null;
  onDisconnected: () => void;
}

export function EbayConnectedBanner({
  userId,
  ebayUsername,
  onDisconnected,
}: EbayConnectedBannerProps) {
  const [disconnecting, setDisconnecting] = useState(false);

  async function handleDisconnect() {
    if (disconnecting) return;
    setDisconnecting(true);
    try {
      const response = await fetch("/api/ebay/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (response.ok) {
        onDisconnected();
      }
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="mb-6 flex flex-col gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-medium text-emerald-800">
        <span className="mr-1">✓</span>
        Connected to eBay
        {ebayUsername ? ` as ${ebayUsername}` : " — loading your store name..."}
      </p>
      <button
        type="button"
        disabled={disconnecting}
        onClick={() => void handleDisconnect()}
        className="text-sm font-semibold text-emerald-700 hover:text-emerald-900 hover:underline disabled:opacity-50"
      >
        {disconnecting ? "Disconnecting..." : "Disconnect"}
      </button>
    </div>
  );
}
