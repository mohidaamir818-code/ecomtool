"use client";

interface ListingWizardNavProps {
  currentStep: number;
  maxStep: number;
  nextDisabled?: boolean;
  hideNext?: boolean;
  nextLabel?: string;
  showBack?: boolean;
  onBack: () => void;
  onNext: () => void;
}

export function ListingWizardNav({
  currentStep,
  maxStep,
  nextDisabled = false,
  hideNext = false,
  nextLabel = "Next",
  showBack = true,
  onBack,
  onNext,
}: ListingWizardNavProps) {
  if (currentStep >= maxStep) return null;

  return (
    <div className="sticky bottom-0 z-10 -mx-6 mt-8 border-t border-violet-100 bg-gradient-to-r from-white/95 via-violet-50/90 to-indigo-50/90 px-6 py-4 backdrop-blur lg:-mx-8 lg:px-8">
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {showBack && currentStep > 0 ? (
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-[#374151] shadow-sm transition hover:border-violet-200 hover:bg-violet-50/50"
          >
            ← Back
          </button>
        ) : (
          <span />
        )}

        {hideNext ? null : (
          <button
            type="button"
            disabled={nextDisabled}
            onClick={onNext}
            className="rounded-xl bg-gradient-to-r from-brand to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand/25 transition hover:shadow-lg hover:shadow-brand/35 disabled:cursor-not-allowed disabled:opacity-50 sm:ml-auto"
          >
            {nextLabel} →
          </button>
        )}
      </div>
    </div>
  );
}
