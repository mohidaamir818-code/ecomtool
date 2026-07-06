"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LEARN_MARKETPLACE_COMPANY_COUNTRY_MATCH_KEY,
  LEARN_MARKETPLACE_ONBOARDING_COMPLETE_KEY,
  LearnMarketplaceOnboardingWizard,
} from "@/features/learn-marketplace/components/LearnMarketplaceOnboardingWizard";
import { LEARN_MARKETPLACE_IP_SETUP_GUIDE_ACK_KEY } from "@/features/learn-marketplace/components/LearnMarketplaceIpSetupGuide";

interface LearnMarketplaceExperienceGateProps {
  children: React.ReactNode;
}

type GatePhase = "loading" | "wizard" | "main";

function resolveGatePhase(): GatePhase {
  const onboardingComplete =
    sessionStorage.getItem(LEARN_MARKETPLACE_ONBOARDING_COMPLETE_KEY) === "true";

  if (!onboardingComplete) return "wizard";
  return "main";
}

export function LearnMarketplaceExperienceGate({ children }: LearnMarketplaceExperienceGateProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<GatePhase>("loading");

  useEffect(() => {
    const nextPhase = resolveGatePhase();

    if (nextPhase === "main") {
      const needsIpSetup =
        sessionStorage.getItem(LEARN_MARKETPLACE_COMPANY_COUNTRY_MATCH_KEY) === "other";
      const ipSetupComplete =
        sessionStorage.getItem(LEARN_MARKETPLACE_IP_SETUP_GUIDE_ACK_KEY) === "true";

      if (needsIpSetup && !ipSetupComplete) {
        router.replace("/dashboard/learn-ebay/ip-setup");
        return;
      }
    }

    setPhase(nextPhase);
  }, [router]);

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
        onComplete={() => setPhase("main")}
      />
    );
  }

  return children;
}
