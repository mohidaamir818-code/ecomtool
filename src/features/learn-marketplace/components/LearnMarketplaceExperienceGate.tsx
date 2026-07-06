"use client";

import { useEffect, useState } from "react";
import {
  LEARN_MARKETPLACE_ONBOARDING_COMPLETE_KEY,
  LearnMarketplaceOnboardingWizard,
} from "@/features/learn-marketplace/components/LearnMarketplaceOnboardingWizard";

interface LearnMarketplaceExperienceGateProps {
  children: React.ReactNode;
}

export function LearnMarketplaceExperienceGate({ children }: LearnMarketplaceExperienceGateProps) {
  const [ready, setReady] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  useEffect(() => {
    setOnboardingComplete(
      sessionStorage.getItem(LEARN_MARKETPLACE_ONBOARDING_COMPLETE_KEY) === "true",
    );
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-[calc(100vh-52px)] items-center justify-center">
        <svg className="h-8 w-8 animate-spin text-[#3665f3]" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!onboardingComplete) {
    return (
      <LearnMarketplaceOnboardingWizard onComplete={() => setOnboardingComplete(true)} />
    );
  }

  return children;
}
