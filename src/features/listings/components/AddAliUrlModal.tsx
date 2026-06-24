"use client";

import { useState } from "react";
import type { StoreImportListing } from "@/types/store-import";

interface AddAliUrlModalProps {
  listing: StoreImportListing;
  userId: string;
  onClose: () => void;
  onLinked: () => void;
}

export function AddAliUrlModal({ listing, userId, onClose, onLinked }: AddAliUrlModalProps) {
  const [aliexpressUrl, setAliexpressUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!aliexpressUrl.trim()) {
      setError("Paste the AliExpress product URL.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/listings/import-store/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          listingId: listing.listingId,
          aliexpressUrl: aliexpressUrl.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Could not link this product.");
      }
      onLinked();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not link this product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-gray-100 bg-white shadow-2xl">
        <div className="border-b border-gray-100 px-5 py-4">
          <h3 className="text-base font-semibold text-[#111827]">Add AliExpress URL</h3>
          <p className="mt-1 line-clamp-2 text-xs text-[#6B7280]">{listing.title}</p>
        </div>

        <div className="space-y-4 px-5 py-4">
          <label className="block text-sm font-medium text-[#111827]">
            AliExpress product URL
            <input
              type="url"
              value={aliexpressUrl}
              onChange={(event) => setAliexpressUrl(event.target.value)}
              placeholder="https://www.aliexpress.com/item/..."
              className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
            />
          </label>
          <p className="text-xs text-[#6B7280]">
            We will check that this AliExpress product matches your eBay listing before enabling
            24h handling and auto price/stock updates.
          </p>
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-[#374151] hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
          >
            {saving ? "Checking…" : "Save & enable handling"}
          </button>
        </div>
      </div>
    </div>
  );
}
