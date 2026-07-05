"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LearnMarketplaceAnimatedCursor } from "@/features/learn-marketplace/components/LearnMarketplaceAnimatedCursor";

const GUIDE_STEP_KEY = "learn_marketplace_guide_step";

function cursorGuideStorageKey(userId: string) {
  return `learn_marketplace_cursor_guide_${userId}`;
}

type GuideStep = "loading" | "intro" | "register" | "done";

interface LearnMarketplacePageGuideProps {
  registerHref: string;
  children: (registerLink: ReactNode) => ReactNode;
}

export function LearnMarketplacePageGuide({ registerHref, children }: LearnMarketplacePageGuideProps) {
  const registerRef = useRef<HTMLSpanElement>(null);
  const [guideStep, setGuideStep] = useState<GuideStep>("loading");
  const [showCursor, setShowCursor] = useState(false);

  useEffect(() => {
    const userId = sessionStorage.getItem("ecomtools_user_id");
    const cursorAlreadySeen =
      userId != null && localStorage.getItem(cursorGuideStorageKey(userId)) === "true";

    if (cursorAlreadySeen) {
      setGuideStep("done");
      setShowCursor(false);
      return;
    }

    const stored = sessionStorage.getItem(GUIDE_STEP_KEY);
    if (stored === "done") {
      setGuideStep("done");
      setShowCursor(false);
    } else if (stored === "register") {
      setGuideStep("register");
      setShowCursor(true);
    } else {
      setGuideStep("intro");
      setShowCursor(false);
    }
  }, []);

  function acknowledgeIntro() {
    sessionStorage.setItem(GUIDE_STEP_KEY, "register");
    setGuideStep("register");
    setShowCursor(true);
  }

  function completeGuide() {
    const userId = sessionStorage.getItem("ecomtools_user_id");
    if (userId) {
      localStorage.setItem(cursorGuideStorageKey(userId), "true");
    }
    sessionStorage.setItem(GUIDE_STEP_KEY, "done");
    setGuideStep("done");
    setShowCursor(false);
  }

  function replayCursorGuide() {
    setShowCursor(true);
    if (guideStep === "done") {
      setGuideStep("register");
    }
  }

  const showRegisterHighlight = guideStep === "register" || showCursor;

  const registerLink = (
    <span ref={registerRef} className="relative inline-block">
      <Link
        href={registerHref}
        onClick={completeGuide}
        className={
          showRegisterHighlight
            ? "relative z-[70] rounded bg-white px-1 font-semibold text-[#3665f3] underline ring-4 ring-[#3665f3]/30 animate-pulse"
            : "hover:underline"
        }
      >
        register
      </Link>
      {guideStep === "register" ? (
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
      ) : null}
    </span>
  );

  return (
    <>
      <style jsx global>{`
        @keyframes learn-cursor-wiggle {
          0%,
          100% {
            transform: translate(0, 0) rotate(-8deg);
          }
          25% {
            transform: translate(6px, 4px) rotate(-2deg);
          }
          50% {
            transform: translate(2px, 8px) rotate(-12deg);
          }
          75% {
            transform: translate(8px, 2px) rotate(-4deg);
          }
        }
      `}</style>

      {children(registerLink)}

      <LearnMarketplaceAnimatedCursor targetRef={registerRef} visible={showCursor} />

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

      {showRegisterHighlight && guideStep !== "intro" ? (
        <div className="pointer-events-none fixed inset-0 z-[60] bg-black/20" aria-hidden />
      ) : null}

      <button
        type="button"
        onClick={replayCursorGuide}
        className="fixed bottom-6 right-6 z-[90] inline-flex items-center gap-2 rounded-full border border-[#3665f3] bg-white px-4 py-2.5 text-sm font-semibold text-[#3665f3] shadow-lg transition hover:bg-[#3665f3] hover:text-white"
        aria-label="Show cursor guide again"
      >
        <span aria-hidden>🖱️</span>
        Cursor guide
      </button>
    </>
  );
}
