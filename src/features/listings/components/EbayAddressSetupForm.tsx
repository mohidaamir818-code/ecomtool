"use client";

import { useEffect, useRef, useState } from "react";

const COUNTRY_OPTIONS = [
  { value: "GB", label: "United Kingdom (GB)" },
  { value: "US", label: "United States (US)" },
  { value: "DE", label: "Germany (DE)" },
] as const;

interface InventoryLocationResponse {
  addressConfirmed?: boolean;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  error?: string;
}

const warehouseConfiguredKey = (userId: string) => `ebay-warehouse-configured-${userId}`;
const parentNotifiedKey = (userId: string) => `ebay-warehouse-parent-notified-${userId}`;

function readStoredConfigured(userId: string): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(warehouseConfiguredKey(userId)) === "1";
}

function storeConfigured(userId: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(warehouseConfiguredKey(userId), "1");
}

function hasNotifiedParent(userId: string): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(parentNotifiedKey(userId)) === "1";
}

function notifyParentOncePerSession(userId: string, notify: () => void): void {
  if (hasNotifiedParent(userId)) return;
  if (typeof window !== "undefined") {
    sessionStorage.setItem(parentNotifiedKey(userId), "1");
  }
  notify();
}

interface EbayAddressSetupFormProps {
  userId: string;
  mode: "setup" | "edit";
  initialCity?: string;
  initialPostalCode?: string;
  initialCountry?: string;
  onComplete: () => void;
  onCancel?: () => void;
}

export function EbayAddressSetupForm({
  userId,
  mode,
  initialCity = "",
  initialPostalCode = "",
  initialCountry = "GB",
  onComplete,
  onCancel,
}: EbayAddressSetupFormProps) {
  const isSetup = mode === "setup";
  const skipSetupUi =
    isSetup && (readStoredConfigured(userId) || hasNotifiedParent(userId));

  const [city, setCity] = useState(initialCity);
  const [postalCode, setPostalCode] = useState(initialPostalCode);
  const [country, setCountry] = useState(initialCountry);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [checkingExisting, setCheckingExisting] = useState(isSetup && !skipSetupUi);
  const [addressAlreadyExists, setAddressAlreadyExists] = useState(skipSetupUi);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    setCity(initialCity);
    setPostalCode(initialPostalCode);
    setCountry(initialCountry || "GB");
  }, [initialCity, initialPostalCode, initialCountry]);

  useEffect(() => {
    if (mode !== "setup") return;

    if (hasNotifiedParent(userId)) {
      setAddressAlreadyExists(true);
      setCheckingExisting(false);
      return;
    }

    let cancelled = false;

    async function checkExistingAddress() {
      try {
        const response = await fetch(
          `/api/ebay/inventory-location?userId=${encodeURIComponent(userId)}`,
        );
        const data = (await response.json()) as InventoryLocationResponse;

        if (cancelled) return;

        if (response.ok && data.addressConfirmed) {
          setAddressAlreadyExists(true);
          storeConfigured(userId);
          notifyParentOncePerSession(userId, () => onCompleteRef.current());
        }
      } catch {
        // Fall through to showing the setup form.
      } finally {
        if (!cancelled) {
          setCheckingExisting(false);
        }
      }
    }

    void checkExistingAddress();

    return () => {
      cancelled = true;
    };
  }, [userId, mode]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    const trimmedCity = city.trim();
    const trimmedPostal = postalCode.trim();
    const trimmedCountry = country.trim().toUpperCase();

    if (!trimmedCity || !trimmedPostal || !trimmedCountry) {
      setError("City, postal code, and country are all required.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/ebay/inventory-location", {
        method: mode === "setup" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          city: trimmedCity,
          postalCode: trimmedPostal,
          country: trimmedCountry,
        }),
      });

      const data = (await response.json()) as InventoryLocationResponse;

      if (!response.ok) {
        if (data.error?.includes("already set up")) {
          setAddressAlreadyExists(true);
          storeConfigured(userId);
          notifyParentOncePerSession(userId, () => onCompleteRef.current());
          return;
        }
        setError(data.error ?? "Failed to save warehouse address.");
        return;
      }

      storeConfigured(userId);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(parentNotifiedKey(userId), "1");
      }
      onComplete();
    } catch {
      setError("Network error while saving warehouse address.");
    } finally {
      setSubmitting(false);
    }
  }

  if (isSetup && (checkingExisting || addressAlreadyExists)) {
    return null;
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-[#111827]">
        {isSetup ? "Set up your warehouse address" : "Edit warehouse address"}
      </h2>
      <p className="mt-2 text-sm text-[#6B7280]">
        Enter the exact address you used when registering your eBay account.
        {isSetup ? " This is required before you can list products." : ""}
      </p>

      <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-4">
        <label className="block text-sm font-medium text-[#111827]">
          City *
          <input
            type="text"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            required
            className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
            placeholder="London"
          />
        </label>

        <label className="block text-sm font-medium text-[#111827]">
          Postal Code *
          <input
            type="text"
            value={postalCode}
            onChange={(event) => setPostalCode(event.target.value)}
            required
            className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
            placeholder="SW1A 1AA"
          />
        </label>

        <label className="block text-sm font-medium text-[#111827]">
          Country *
          <select
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            required
            className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
          >
            {COUNTRY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {submitting
              ? "Saving..."
              : isSetup
                ? "Save warehouse address"
                : "Update warehouse address"}
          </button>
          {!isSetup && onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-semibold text-[#374151] hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
