"use client";

import { useEffect, useState } from "react";
import {
  AMAZEF_SELECTABLE_STEPS,
  CONFIRM_STEP,
  normalizeVisibleSteps,
} from "@/features/listings/lib/amazef-auto-listing";

interface AmazefAutoListingModalProps {
  initialVisibleSteps: number[];
  onConfirm: (visibleSteps: number[]) => void;
  onClose: () => void;
}

export function AmazefAutoListingModal({
  initialVisibleSteps,
  onConfirm,
  onClose,
}: AmazefAutoListingModalProps) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(initialVisibleSteps));

  useEffect(() => {
    setSelected(new Set(initialVisibleSteps));
  }, [initialVisibleSteps]);

  function toggleStep(stepId: number) {
    if (stepId === CONFIRM_STEP) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      next.add(CONFIRM_STEP);
      return next;
    });
  }

  function handleConfirm() {
    onConfirm(normalizeVisibleSteps([...selected]));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-100 bg-white p-6 shadow-xl"
        role="dialog"
        aria-labelledby="amazef-auto-listing-title"
      >
        <h2 id="amazef-auto-listing-title" className="text-lg font-bold text-[#111827]">
          Auto listing steps
        </h2>
        <p className="mt-2 text-sm text-[#6B7280]">
          Check the steps you want to review manually. Unchecked steps run automatically in the
          background when you click Next.
        </p>

        <ul className="mt-5 space-y-2">
          {AMAZEF_SELECTABLE_STEPS.map(({ id, label }) => {
            const locked = id === CONFIRM_STEP;
            const checked = selected.has(id);

            return (
              <li key={id}>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
                    checked
                      ? "border-brand/30 bg-brand-light/20 text-[#111827]"
                      : "border-gray-100 bg-gray-50 text-[#6B7280]"
                  } ${locked ? "cursor-default opacity-90" : ""}`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
                    checked={checked}
                    disabled={locked}
                    onChange={() => toggleStep(id)}
                  />
                  <span className="font-medium">{label}</span>
                  {locked ? (
                    <span className="ml-auto text-xs text-[#9CA3AF]">Required</span>
                  ) : checked ? (
                    <span className="ml-auto text-xs font-medium text-brand">Manual</span>
                  ) : (
                    <span className="ml-auto text-xs text-[#9CA3AF]">Auto</span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>

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
            onClick={handleConfirm}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Start auto listing
          </button>
        </div>
      </div>
    </div>
  );
}
