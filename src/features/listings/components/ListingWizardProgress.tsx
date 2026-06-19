"use client";

import { LISTING_WIZARD_STEPS } from "@/types/listing-generator";

interface ListingWizardProgressProps {
  currentStep: number;
}

export function ListingWizardProgress({ currentStep }: ListingWizardProgressProps) {
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between text-xs font-medium text-[#6B7280]">
        <span>
          Step {currentStep + 1} of {LISTING_WIZARD_STEPS.length}
        </span>
        <span className="hidden sm:inline">{LISTING_WIZARD_STEPS[currentStep]}</span>
      </div>

      <div className="grid grid-cols-6 gap-1 sm:gap-2">
        {LISTING_WIZARD_STEPS.map((label, index) => {
          const active = index === currentStep;
          const complete = index < currentStep;

          return (
            <div key={label} className="min-w-0">
              <div
                className={`h-2 rounded-full transition-colors ${
                  complete || active ? "bg-brand" : "bg-gray-200"
                }`}
              />
              <p
                className={`mt-2 hidden truncate text-[10px] sm:block ${
                  active ? "font-semibold text-brand" : "text-[#9CA3AF]"
                }`}
              >
                {label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
