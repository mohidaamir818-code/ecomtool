"use client";

import { useEffect, useState } from "react";
import { LearnMarketplaceIpSetupGuide } from "@/features/learn-marketplace/components/LearnMarketplaceIpSetupGuide";
import {
  LEARN_MARKETPLACE_COMPANY_COUNTRY_MATCH_KEY,
  LEARN_MARKETPLACE_ONBOARDING_COMPLETE_KEY,
  LearnMarketplaceOnboardingWizard,
} from "@/features/learn-marketplace/components/LearnMarketplaceOnboardingWizard";
import { LEARN_MARKETPLACE_IP_SETUP_GUIDE_ACK_KEY } from "@/features/learn-marketplace/components/LearnMarketplaceIpSetupGuide";

interface LearnMarketplaceExperienceGateProps {
  children: React.ReactNode;
}

type GatePhase = "loading" | "wizard" | "ip-guide" | "main";

function resolveGatePhase(): GatePhase {
  const onboardingComplete =
    sessionStorage.getItem(LEARN_MARKETPLACE_ONBOARDING_COMPLETE_KEY) === "true";
  const ipGuideComplete =
    sessionStorage.getItem(LEARN_MARKETPLACE_IP_SETUP_GUIDE_ACK_KEY) === "true";
  const needsIpGuide =
    sessionStorage.getItem(LEARN_MARKETPLACE_COMPANY_COUNTRY_MATCH_KEY) === "other";

  if (!onboardingComplete) return "wizard";
  if (needsIpGuide && !ipGuideComplete) return "ip-guide";
  return "main";
}

export function LearnMarketplaceExperienceGate({ children }: LearnMarketplaceExperienceGateProps) {
  const [phase, setPhase] = useState<GatePhase>("loading");

  useEffect(() => {
    setPhase(resolveGatePhase());
  }, []);

  if (phase === "loading") {
    return (
      <div className="flex min-h-[calc(100vh-52px)] items-center justify-center">
        <svg className="h-8 w-8 animate-spin text-[#3665f3]" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (phase === "wizard") {
    return (
      <LearnMarketplaceOnboardingWizard
        onComplete={() => setPhase(resolveGatePhase())}
      />
    );
  }

  if (phase === "ip-guide") {
    return <LearnMarketplaceIpSetupGuide onComplete={() => setPhase("main")} />;
  }

  return children;
}
