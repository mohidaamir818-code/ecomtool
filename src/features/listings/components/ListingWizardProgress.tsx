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
}

export function ListingWizardProgress({
  currentStep,
  platform = "ebay",
}: ListingWizardProgressProps) {
  const steps = getWizardSteps(platform);
  const displayIndex = progressIndexForStep(currentStep, platform);
  const progressPercent = Math.round(((displayIndex + 1) / steps.length) * 100);

  return (
    <div className="mb-8 overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50/60 via-white to-indigo-50/60 p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand">Listing wizard</p>
          <p className="mt-0.5 text-sm font-semibold text-[#111827]">
            Step {displayIndex + 1} of {steps.length}
            <span className="ml-2 hidden font-normal text-[#6B7280] sm:inline">· {steps[displayIndex]}</span>
          </p>
        </div>
        <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-bold text-brand">
          {progressPercent}%
        </span>
      </div>

      <div className="mb-1 h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand via-violet-500 to-indigo-500 transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-5 gap-1 sm:grid-cols-9 sm:gap-2">
        {steps.map((label, index) => {
          const stepIndex = stepForProgressIndex(index, platform);
          const active = stepIndex === currentStep;
          const complete = stepIndex < currentStep;

          return (
            <div key={label} className="min-w-0">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  complete
                    ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                    : active
                      ? "bg-gradient-to-r from-brand to-indigo-500 shadow-sm shadow-brand/30"
                      : "bg-gray-200"
                }`}
              />
              <p
                className={`mt-2 hidden truncate text-[10px] lg:block ${
                  active
                    ? "font-bold text-brand"
                    : complete
                      ? "font-medium text-emerald-600"
                      : "text-[#9CA3AF]"
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
