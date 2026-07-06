"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LEARN_MARKETPLACE_COMPANY_COUNTRY_MATCH_KEY,
  LEARN_MARKETPLACE_ONBOARDING_COMPLETE_KEY,
} from "@/features/learn-marketplace/components/LearnMarketplaceOnboardingWizard";
import { LEARN_MARKETPLACE_IP_SETUP_GUIDE_ACK_KEY } from "@/features/learn-marketplace/components/LearnMarketplaceIpSetupGuide";
import { LEARN_MARKETPLACE_IP_SETUP_INSTALL_DONE_KEY } from "@/features/learn-marketplace/components/LearnMarketplaceIpSetupPage";

const IPBURGER_SIGN_IN_URL = "https://secure.ipburger.com/aff.php?aff=3047";

const IP_SIGN_IN_VIDEO_SRC = "/videos/ipburger-signin.mp4";

export function LearnMarketplaceIpSignInPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasSignInVideo, setHasSignInVideo] = useState(false);

  useEffect(() => {
    const onboardingComplete =
      sessionStorage.getItem(LEARN_MARKETPLACE_ONBOARDING_COMPLETE_KEY) === "true";
    const needsIpSetup =
      sessionStorage.getItem(LEARN_MARKETPLACE_COMPANY_COUNTRY_MATCH_KEY) === "other";
    const ipSetupComplete =
      sessionStorage.getItem(LEARN_MARKETPLACE_IP_SETUP_GUIDE_ACK_KEY) === "true";
    const installDone =
      sessionStorage.getItem(LEARN_MARKETPLACE_IP_SETUP_INSTALL_DONE_KEY) === "true";

    if (!onboardingComplete || !needsIpSetup || ipSetupComplete) {
      router.replace("/dashboard/learn-ebay");
      return;
    }

    if (!installDone) {
      router.replace("/dashboard/learn-ebay/ip-setup");
      return;
    }

    fetch(IP_SIGN_IN_VIDEO_SRC, { method: "HEAD" })
      .then((response) => setHasSignInVideo(response.ok))
      .catch(() => setHasSignInVideo(false));

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
            Step 2 · IP setup
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#191919]">
            Sign in to IPBurger
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#555]">
            Watch the guide below, then sign in to your IPBurger account and connect to your
            operating country before you continue to marketplace practice.
          </p>
        </div>

        {hasSignInVideo ? (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-black">
            <video
              className="aspect-video w-full"
              controls
              playsInline
              preload="metadata"
              src={IP_SIGN_IN_VIDEO_SRC}
            >
              Your browser does not support the video tag.
            </video>
          </div>
        ) : (
          <div
            className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-gray-300 bg-[#f7f7f7] px-6 text-center text-sm text-[#888]"
            aria-label="IPBurger sign-in video placeholder"
          >
            Sign-in video will be added here. Replace{" "}
            <span className="font-mono text-xs">public/videos/ipburger-signin.mp4</span> when ready.
          </div>
        )}

        <div className="mt-6 rounded-xl border border-[#3665f3]/20 bg-[#f0f6ff] p-5">
          <p className="text-sm font-semibold text-[#191919]">Sign in</p>
          <p className="mt-2 text-sm leading-relaxed text-[#555]">
            Open IPBurger, sign in to your account, and select the country where you will operate
            your marketplace selling activity.
          </p>
          <a
            href={IPBURGER_SIGN_IN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center rounded-full bg-[#3665f3] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2f56cc]"
          >
            Sign in to IPBurger
          </a>
        </div>

        <div className="mt-8 flex justify-end border-t border-gray-100 pt-6">
          <button
            type="button"
            onClick={handleContinue}
            className="rounded-full bg-[#3665f3] px-8 py-3 text-sm font-semibold text-white transition hover:bg-[#2f56cc]"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
