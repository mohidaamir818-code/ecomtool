"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

const GUIDE_STEP_KEY = "learn_marketplace_guide_step";

type GuideStep = "loading" | "intro" | "register" | "done";

interface LearnMarketplacePageGuideProps {
  registerHref: string;
  children: (registerLink: ReactNode) => ReactNode;
}

export function LearnMarketplacePageGuide({ registerHref, children }: LearnMarketplacePageGuideProps) {
  const [guideStep, setGuideStep] = useState<GuideStep>("loading");

  useEffect(() => {
    const stored = sessionStorage.getItem(GUIDE_STEP_KEY);
    if (stored === "done") {
      setGuideStep("done");
    } else if (stored === "register") {
      setGuideStep("register");
    } else {
      setGuideStep("intro");
    }
  }, []);

  function acknowledgeIntro() {
    sessionStorage.setItem(GUIDE_STEP_KEY, "register");
    setGuideStep("register");
  }

  function completeGuide() {
    sessionStorage.setItem(GUIDE_STEP_KEY, "done");
    setGuideStep("done");
  }

  const registerLink =
    guideStep === "register" ? (
      <span className="relative inline-block">
        <Link
          href={registerHref}
          onClick={completeGuide}
          className="relative z-[70] rounded bg-white px-1 font-semibold text-[#3665f3] underline ring-4 ring-[#3665f3]/30 animate-pulse"
        >
          register
        </Link>
        <span className="absolute left-0 top-full z-[70] mt-3 w-[min(280px,calc(100vw-2rem))] rounded-xl border border-[#3665f3] bg-white p-4 text-left shadow-lg">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#3665f3]">
            Step 1
          </span>
          <span className="block text-sm font-semibold text-[#191919]">
            Click here to continue the first step
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-[#555]">
            Make your account to begin the marketplace practice journey.
          </span>
          <span className="absolute -top-2 left-6 h-4 w-4 rotate-45 border-l border-t border-[#3665f3] bg-white" />
        </span>
      </span>
    ) : (
      <Link href={registerHref} className="hover:underline">
        register
      </Link>
    );

  return (
    <>
      {children(registerLink)}

      {guideStep === "intro" ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="learn-guide-title"
            className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-xl"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3665f3]">
              Step 1 of your practice
            </p>
            <h2 id="learn-guide-title" className="mt-3 text-2xl font-bold tracking-tight text-[#191919]">
              Register your account
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#555]">
              Welcome to marketplace practice. Your first step is to create an account, just like a
              new seller would on a real marketplace.
            </p>
            <button
              type="button"
              onClick={acknowledgeIntro}
              className="mt-8 w-full rounded-full bg-[#3665f3] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2f56cc]"
            >
              OK
            </button>
          </div>
        </div>
      ) : null}

      {guideStep === "register" ? (
        <div className="pointer-events-none fixed inset-0 z-[60] bg-black/20" aria-hidden />
      ) : null}
    </>
  );
}
