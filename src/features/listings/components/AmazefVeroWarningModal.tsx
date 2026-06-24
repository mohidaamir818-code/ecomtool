"use client";

import { useState } from "react";

interface AmazefVeroWarningModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function AmazefVeroWarningModal({ onConfirm, onCancel }: AmazefVeroWarningModalProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-red-100 bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-red-700">VeRO listing warning</h2>
        <p className="mt-3 text-sm text-[#374151]">
          Listing VeRO-restricted products can lead to account restrictions or a ban on Amazef and
          marketplaces. Only continue if you accept this risk.
        </p>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          <span className="font-medium text-[#111827]">
            I understand VeRO products can get my account banned
          </span>
        </label>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-[#374151] hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!acknowledged}
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            I accept the risk
          </button>
        </div>
      </div>
    </div>
  );
}
