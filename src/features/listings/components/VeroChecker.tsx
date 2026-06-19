"use client";

import type { VeroCheckResult } from "@/types/listing-generator";

interface VeroCheckerProps {
  result: VeroCheckResult | null;
  loading?: boolean;
}

export function VeroChecker({ result, loading = false }: VeroCheckerProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <svg className="h-5 w-5 animate-spin text-brand" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-[#6B7280]">Running VeRO safety check...</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-sm text-[#6B7280]">
        Paste an AliExpress URL and click Start to run the VeRO safety check.
      </div>
    );
  }

  if (!result.safe) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-semibold text-red-800">VeRO check failed</p>
        <p className="mt-1 text-sm text-red-700">{result.summary}</p>
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
