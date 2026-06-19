"use client";

import type { VeroCheckResult } from "@/types/listing-generator";

interface VeroBlockModalProps {
  result: VeroCheckResult;
  onClose: () => void;
}

export function VeroBlockModal({ result, onClose }: VeroBlockModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-600 text-lg font-bold text-white">
            !
          </span>
          <div>
            <h2 className="text-lg font-bold text-red-700">Do not list this product</h2>
            <p className="mt-2 text-sm text-red-700">
              This product may be counterfeit — Nike, Apple, and other branded items are high risk.
            </p>
            <p className="mt-2 text-sm font-medium text-red-800">
              Listing this may get your eBay account banned.
            </p>
            <p className="mt-3 text-sm text-[#374151]">{result.summary}</p>
            {result.warnings.length > 0 ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-red-700">
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
        >
          Close
        </button>
      </div>
    </div>
  );
}
