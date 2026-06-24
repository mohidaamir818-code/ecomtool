"use client";

import { LISTING_WIZARD_STEPS, type ListingPlatform } from "@/types/listing-generator";

const VOLUME_DISCOUNTS_STEP = 7;

function getWizardSteps(platform: ListingPlatform) {
  if (platform === "amazef") {
    return LISTING_WIZARD_STEPS.filter((_, index) => index !== VOLUME_DISCOUNTS_STEP);
  }
  return LISTING_WIZARD_STEPS;
}

function stepForProgressIndex(index: number, platform: ListingPlatform): number {
  if (platform !== "amazef") return index;
  return index >= VOLUME_DISCOUNTS_STEP ? index + 1 : index;
}

function progressIndexForStep(step: number, platform: ListingPlatform): number {
  if (platform !== "amazef") return step;
  return step > VOLUME_DISCOUNTS_STEP ? step - 1 : step;
}

interface ListingWizardProgressProps {
  currentStep: number;
  platform?: ListingPlatform;
  visibleSteps?: number[];
}

export function ListingWizardProgress({
  currentStep,
  platform = "ebay",
  visibleSteps,
}: ListingWizardProgressProps) {
  const useAutoMode = platform === "amazef" && visibleSteps && visibleSteps.length > 0;
  const sortedVisible = useAutoMode ? [...visibleSteps].sort((a, b) => a - b) : [];
  const steps = useAutoMode
    ? sortedVisible.map((stepId) => LISTING_WIZARD_STEPS[stepId])
    : getWizardSteps(platform);

  const displayIndex = useAutoMode
    ? Math.max(0, sortedVisible.indexOf(currentStep))
    : progressIndexForStep(currentStep, platform);

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between text-xs font-medium text-[#6B7280]">
        <span>
          Step {displayIndex + 1} of {steps.length}
          {useAutoMode ? " (auto listing)" : ""}
        </span>
        <span className="hidden sm:inline">{steps[displayIndex]}</span>
      </div>

      <div
        className={`grid gap-1 sm:gap-2 ${
          steps.length <= 5 ? "grid-cols-5" : steps.length <= 7 ? "grid-cols-7" : "grid-cols-9"
        }`}
      >
        {steps.map((label, index) => {
          const stepIndex = useAutoMode
            ? sortedVisible[index]
            : stepForProgressIndex(index, platform);
          const active = stepIndex === currentStep;
          const complete = stepIndex < currentStep;

          return (
            <div key={`${label}-${stepIndex}`} className="min-w-0">
              <div
                className={`h-2 rounded-full transition-colors ${
                  complete || active ? "bg-brand" : "bg-gray-200"
                }`}
              />
              <p
                className={`mt-2 hidden truncate text-[10px] lg:block ${
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
