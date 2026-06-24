"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_AMAZEF_AUTO_LISTING_SETTINGS,
  normalizeAutoListingSettings,
  validateAutoListingSettingsInput,
  type AmazefAutoListingSettings,
} from "@/features/listings/lib/amazef-auto-listing";

interface AmazefAutoListingSettingsModalProps {
  initialSettings: AmazefAutoListingSettings;
  onSave: (settings: AmazefAutoListingSettings) => void;
  onClose: () => void;
}

export function AmazefAutoListingSettingsModal({
  initialSettings,
  onSave,
  onClose,
}: AmazefAutoListingSettingsModalProps) {
  const [form, setForm] = useState<AmazefAutoListingSettings>(() =>
    normalizeAutoListingSettings(initialSettings),
  );
  const [error, setError] = useState("");
  const alreadyEnabled = initialSettings.enabled;

  useEffect(() => {
    setForm(normalizeAutoListingSettings(initialSettings));
  }, [initialSettings]);

  function updateField<K extends keyof AmazefAutoListingSettings>(key: K, value: AmazefAutoListingSettings[K]) {
    setForm((current) => normalizeAutoListingSettings({ ...current, [key]: value }));
    setError("");
  }

  function handleSubmit() {
    const next = normalizeAutoListingSettings(form);
    const validationError = validateAutoListingSettingsInput(next);
    if (validationError) {
      setError(validationError);
      return;
    }
    onSave(next);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-[#111827]">Auto listing settings</h2>
        <p className="mt-2 text-sm text-[#6B7280]">
          Set your rules once. AI will apply them automatically for every URL you submit.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-[#111827]">Min profit %</span>
            <input
              type="number"
              min={1}
              max={90}
              value={form.minProfitPercent}
              onChange={(event) => updateField("minProfitPercent", Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[#111827]">Max profit %</span>
            <input
              type="number"
              min={1}
              max={95}
              value={form.maxProfitPercent}
              onChange={(event) => updateField("maxProfitPercent", Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[#111827]">Min stock</span>
            <input
              type="number"
              min={1}
              value={form.minStock}
              onChange={(event) => updateField("minStock", Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[#111827]">Max stock</span>
            <input
              type="number"
              min={1}
              value={form.maxStock}
              onChange={(event) => updateField("maxStock", Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
            checked={form.listVeroProducts}
            onChange={(event) =>
              updateField("listVeroProducts", event.target.checked)
            }
          />
          <span>
            <span className="font-medium text-[#111827]">List VeRO products</span>
            <span className="mt-1 block text-xs text-[#6B7280]">
              When off, products that fail VeRO are stopped automatically.
            </span>
          </span>
        </label>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-[#374151] hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Save{alreadyEnabled ? " settings" : " & enable auto listing"}
          </button>
        </div>

        <p className="mt-4 text-xs text-[#9CA3AF]">
          Defaults: profit {DEFAULT_AMAZEF_AUTO_LISTING_SETTINGS.minProfitPercent}–
          {DEFAULT_AMAZEF_AUTO_LISTING_SETTINGS.maxProfitPercent}%, stock{" "}
          {DEFAULT_AMAZEF_AUTO_LISTING_SETTINGS.minStock}–{DEFAULT_AMAZEF_AUTO_LISTING_SETTINGS.maxStock}.
        </p>
      </div>
    </div>
  );
}
