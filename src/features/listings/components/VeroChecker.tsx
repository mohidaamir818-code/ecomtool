"use client";

import type { VeroCheckResult } from "@/types/listing-generator";

interface VeroCheckerProps {
  result: VeroCheckResult | null;
  loading?: boolean;
}

export function VeroChecker({ result, loading = false }: VeroCheckerProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-sm text-[#6B7280]">Running VeRO safety check...</p>
      </div>
    );
  }

  if (!result) return null;

  if (!result.safe) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
            !
          </span>
          <div>
            <p className="text-sm font-semibold text-red-800">
              Do not list — account may get banned
            </p>
            <p className="mt-1 text-sm text-red-700">{result.summary}</p>
            {result.warnings.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm text-white">
          ✓
        </span>
        <div>
          <p className="text-sm font-semibold text-emerald-800">Safe to list</p>
          <p className="mt-1 text-sm text-emerald-700">{result.summary}</p>
        </div>
      </div>
    </div>
  );
}
