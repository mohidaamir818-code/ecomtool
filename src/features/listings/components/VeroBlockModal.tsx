"use client";

import { useState } from "react";

import type { VeroCheckResult } from "@/types/listing-generator";

interface VeroBlockModalProps {
  result: VeroCheckResult;
  onProceed: () => void;
  onStartNew: () => void;
}

export function VeroBlockModal({ result, onProceed, onStartNew }: VeroBlockModalProps) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-600 text-lg font-bold text-white">
            !
          </span>
          <div>
            <h2 className="text-lg font-bold text-red-700">VeRO warning</h2>
            <p className="mt-3 whitespace-pre-line text-sm text-red-800">{result.summary}</p>
            {result.warnings.length > 0 ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-red-700">
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
            <p className="mt-4 text-sm font-medium text-red-800">
              Listing this may result in your eBay account being suspended or the listing being
              removed by eBay.
            </p>
          </div>
        </div>

        <label className="mt-5 flex items-start gap-2 text-sm text-gray-800">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>I acknowledge the risk and want to list this item at my own risk.</span>
        </label>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onProceed}
            disabled={!checked}
            className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            List at my own risk
          </button>
          <button
            type="button"
            onClick={onStartNew}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Start New Listing
          </button>
        </div>
      </div>
    </div>
  );
}
