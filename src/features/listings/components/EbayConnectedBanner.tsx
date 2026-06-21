"use client";

import { useState } from "react";
import { EbayAddressSetupForm } from "./EbayAddressSetupForm";

interface EbayConnectedBannerProps {
  userId: string;
  ebayUsername: string | null;
  addressConfirmed?: boolean;
  onDisconnected: () => void;
  onAddressUpdated?: () => void;
}

export function EbayConnectedBanner({
  userId,
  ebayUsername,
  addressConfirmed = false,
  onDisconnected,
  onAddressUpdated,
}: EbayConnectedBannerProps) {
  const [disconnecting, setDisconnecting] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [addressDefaults, setAddressDefaults] = useState({
    city: "",
    postalCode: "",
    country: "GB",
  });

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

  async function openEditForm() {
    setLoadingAddress(true);
    try {
      const response = await fetch(`/api/ebay/inventory-location?userId=${encodeURIComponent(userId)}`);
      const data = await response.json();
      if (response.ok) {
        setAddressDefaults({
          city: data.city ?? "",
          postalCode: data.postalCode ?? "",
          country: data.country ?? "GB",
        });
        setShowEditForm(true);
      }
    } finally {
      setLoadingAddress(false);
    }
  }

  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-col gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-emerald-800">
          <span className="mr-1">✓</span>
          Connected to eBay
          {ebayUsername ? ` as ${ebayUsername}` : " — loading your store name..."}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {addressConfirmed ? (
            <button
              type="button"
              disabled={loadingAddress}
              onClick={() => void openEditForm()}
              className="text-sm font-semibold text-emerald-700 hover:text-emerald-900 hover:underline disabled:opacity-50"
            >
              {loadingAddress ? "Loading..." : "Edit warehouse address"}
            </button>
          ) : null}
          <button
            type="button"
            disabled={disconnecting}
            onClick={() => void handleDisconnect()}
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-900 hover:underline disabled:opacity-50"
          >
            {disconnecting ? "Disconnecting..." : "Disconnect"}
          </button>
        </div>
      </div>

      {showEditForm ? (
        <EbayAddressSetupForm
          userId={userId}
          mode="edit"
          initialCity={addressDefaults.city}
          initialPostalCode={addressDefaults.postalCode}
          initialCountry={addressDefaults.country}
          onComplete={() => {
            setShowEditForm(false);
            onAddressUpdated?.();
          }}
          onCancel={() => setShowEditForm(false)}
        />
      ) : null}
    </div>
  );
}
