"use client";

interface ListingWizardNavProps {
  currentStep: number;
  maxStep: number;
  nextDisabled?: boolean;
  nextLabel?: string;
  showBack?: boolean;
  onBack: () => void;
  onNext: () => void;
}

export function ListingWizardNav({
  currentStep,
  maxStep,
  nextDisabled = false,
  nextLabel = "Next",
  showBack = true,
  onBack,
  onNext,
}: ListingWizardNavProps) {
  if (currentStep >= maxStep) return null;

  return (
    <div className="sticky bottom-0 z-10 -mx-6 mt-8 border-t border-gray-100 bg-[#F9FAFB]/95 px-6 py-4 backdrop-blur lg:-mx-8 lg:px-8">
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {showBack && currentStep > 0 ? (
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#374151] hover:bg-gray-50"
          >
            Back
          </button>
        ) : (
          <span />
        )}

        <button
          type="button"
          disabled={nextDisabled}
          onClick={onNext}
          className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50 sm:ml-auto"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
