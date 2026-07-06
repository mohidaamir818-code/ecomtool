"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LEARN_MARKETPLACE_COMPANY_COUNTRY_MATCH_KEY,
  LEARN_MARKETPLACE_ONBOARDING_COMPLETE_KEY,
} from "@/features/learn-marketplace/components/LearnMarketplaceOnboardingWizard";
import { LEARN_MARKETPLACE_IP_SETUP_GUIDE_ACK_KEY } from "@/features/learn-marketplace/components/LearnMarketplaceIpSetupGuide";

const IPBURGER_CHROME_STORE_URL =
  "https://chromewebstore.google.com/detail/ipburger-proxy-vpn/kchocjcihdgkoplngjemhpplmmloanja";

export function LearnMarketplaceIpSetupPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onboardingComplete =
      sessionStorage.getItem(LEARN_MARKETPLACE_ONBOARDING_COMPLETE_KEY) === "true";
    const needsIpSetup =
      sessionStorage.getItem(LEARN_MARKETPLACE_COMPANY_COUNTRY_MATCH_KEY) === "other";
    const ipSetupComplete =
      sessionStorage.getItem(LEARN_MARKETPLACE_IP_SETUP_GUIDE_ACK_KEY) === "true";

    if (!onboardingComplete || !needsIpSetup || ipSetupComplete) {
      router.replace("/dashboard/learn-ebay");
      return;
    }

    setReady(true);
  }, [router]);

  function handleContinue() {
    sessionStorage.setItem(LEARN_MARKETPLACE_IP_SETUP_GUIDE_ACK_KEY, "true");
    router.push("/dashboard/learn-ebay");
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

  return (
    <div className="flex min-h-[calc(100vh-52px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-[760px] rounded-2xl border border-gray-200 bg-white p-8 shadow-sm sm:p-10">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3665f3]">
            Step 1 · IP setup
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#191919]">
            IPBurger setup
          </h1>
        </div>

        <div className="rounded-xl border border-[#3665f3]/20 bg-[#f0f6ff] p-5">
          <p className="text-sm text-[#555]">
            For IP setup, install the IPBurger extension to match your operating country.
          </p>
          <a
            href={IPBURGER_CHROME_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center rounded-full bg-[#3665f3] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2f56cc]"
          >
            Add IPBurger
          </a>
        </div>

        <div
          className="mt-6 flex aspect-video items-center justify-center rounded-xl border border-dashed border-gray-300 bg-[#f7f7f7] text-sm text-[#888]"
          aria-label="IP setup video placeholder"
        >
          Video will be added here
        </div>

        <div className="mt-8 flex justify-end border-t border-gray-100 pt-6">
          <button
            type="button"
            onClick={handleContinue}
            className="rounded-full bg-[#3665f3] px-8 py-3 text-sm font-semibold text-white transition hover:bg-[#2f56cc]"
          >
            Continue to marketplace practice
          </button>
        </div>
      </div>
    </div>
  );
}
