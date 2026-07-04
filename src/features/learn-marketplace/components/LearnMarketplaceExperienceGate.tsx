"use client";

import { useEffect, useState } from "react";
import {
  LEARN_MARKETPLACE_EXPERIENCE_KEY,
  LearnMarketplaceExperiencePage,
  type MarketplaceExperience,
} from "@/features/learn-marketplace/components/LearnMarketplaceExperiencePage";

interface LearnMarketplaceExperienceGateProps {
  children: React.ReactNode;
}

export function LearnMarketplaceExperienceGate({ children }: LearnMarketplaceExperienceGateProps) {
  const [ready, setReady] = useState(false);
  const [experience, setExperience] = useState<MarketplaceExperience | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(LEARN_MARKETPLACE_EXPERIENCE_KEY);
    if (stored === "new" || stored === "experienced") {
      setExperience(stored);
    }
    setReady(true);
  }, []);

  function handleContinue(value: MarketplaceExperience) {
    sessionStorage.setItem(LEARN_MARKETPLACE_EXPERIENCE_KEY, value);
    setExperience(value);
  }

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

  if (!experience) {
    return <LearnMarketplaceExperiencePage onContinue={handleContinue} />;
  }

  return children;
}
