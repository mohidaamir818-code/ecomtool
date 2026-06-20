"use client";

import type { ListingDraft } from "@/types/listing-generator";
import { computeListingQualityScore } from "@/features/listings/lib/listing-quality";

interface ListingQualityScoreStepProps {
  draft: ListingDraft;
}

export function ListingQualityScoreStep({ draft }: ListingQualityScoreStepProps) {
  const score = computeListingQualityScore(draft);
  const pct = score.maxTotal > 0 ? Math.round((score.total / score.maxTotal) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-[#111827]">Listing Quality Score</h2>
        <p className="mt-1 text-sm text-[#6B7280]">
          Higher scores improve eBay visibility. Review the checklist before publishing.
        </p>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-20 w-20 items-center justify-center rounded-full text-xl font-bold ${
              pct >= 80
                ? "bg-emerald-50 text-emerald-700"
                : pct >= 60
                  ? "bg-amber-50 text-amber-700"
                  : "bg-red-50 text-red-700"
            }`}
          >
            {score.total}
          </div>
          <div>
            <p className="text-2xl font-bold text-[#111827]">Your Listing Score: {score.total}/{score.maxTotal}</p>
            <p className="text-sm text-[#6B7280]">{pct}% quality — {pct >= 80 ? "Great!" : "Room to improve"}</p>
          </div>
        </div>

        <ul className="mt-6 space-y-3">
          {score.checks.map((check) => (
            <li key={check.id} className="flex items-start justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-[#374151]">
                <span className={check.passed ? "text-emerald-600" : "text-red-500"}>
                  {check.passed ? "✓" : "✗"}
                </span>
                {check.label}
              </span>
              <span className="font-medium text-[#6B7280]">
                {check.points}/{check.maxPoints}
              </span>
            </li>
          ))}
        </ul>

        {score.tips.length > 0 ? (
          <div className="mt-6 rounded-lg bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">Tips to improve your score</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
              {score.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
