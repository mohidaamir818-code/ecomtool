"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LearnMarketplaceAnimatedCursor } from "@/features/learn-marketplace/components/LearnMarketplaceAnimatedCursor";
import {
  BUSINESS_TYPE_CURSOR_KEY_PREFIX,
  BUSINESS_TYPE_GUIDE_KEY,
  LearnMarketplaceBusinessTypeGuide,
  PRACTICE_BUSINESS_TYPE_KEY,
  type PracticeBusinessType,
} from "@/features/learn-marketplace/components/LearnMarketplaceBusinessTypeGuide";
import { PRACTICE_USERNAME_KEY } from "@/features/learn-marketplace/components/LearnMarketplaceUsernameGuide";

const businessOptions: Array<{
  value: PracticeBusinessType;
  title: string;
  description: string;
}> = [
  {
    value: "sole",
    title: "Sole tradership",
    description: "I'll sell under my own name or under the name of a non-registered business.",
  },
  {
    value: "registered",
    title: "Registered business",
    description:
      "My business is an LTD, Ltd., LLP, general partnership, publicly traded company, or other legal entity.",
  },
  {
    value: "charity",
    title: "Charity",
    description: "My business is a registered charity organisation.",
  },
];

function EcomtoolLogo() {
  return (
    <Link href="/dashboard/learn-ebay" className="text-2xl font-bold tracking-tight text-[#3665f3]">
      ecomtool
    </Link>
  );
}

function cursorGuideStorageKey(userId: string) {
  return `${BUSINESS_TYPE_CURSOR_KEY_PREFIX}${userId}`;
}

export function LearnMarketplaceBusinessTypePage() {
  const router = useRouter();
  const registeredOptionRef = useRef<HTMLButtonElement>(null);
  const [selected, setSelected] = useState<PracticeBusinessType | null>(null);
  const [ready, setReady] = useState(false);
  const [showIntroPopup, setShowIntroPopup] = useState(false);
  const [showCursor, setShowCursor] = useState(false);

  useEffect(() => {
    const username = sessionStorage.getItem(PRACTICE_USERNAME_KEY);
    if (!username) {
      router.replace("/dashboard/learn-ebay/register/username");
      return;
    }
    setShowIntroPopup(sessionStorage.getItem(BUSINESS_TYPE_GUIDE_KEY) !== "true");
    setReady(true);
  }, [router]);

  const startCursorGuide = useCallback(() => {
    setShowCursor(true);
    setSelected("registered");
  }, []);

  useEffect(() => {
    if (!ready || showIntroPopup) return;

    const userId = sessionStorage.getItem("ecomtools_user_id");
    const cursorSeen =
      userId != null && localStorage.getItem(cursorGuideStorageKey(userId)) === "true";
    if (!cursorSeen) {
      startCursorGuide();
    }
  }, [ready, showIntroPopup, startCursorGuide]);

  function completeCursorGuide() {
    const userId = sessionStorage.getItem("ecomtools_user_id");
    if (userId) {
      localStorage.setItem(cursorGuideStorageKey(userId), "true");
    }
    setShowCursor(false);
  }

  const canContinue = selected !== null;

  if (!ready) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#f7f7f7]">
        <svg className="h-8 w-8 animate-spin text-[#3665f3]" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-white text-[#191919]">
      <LearnMarketplaceBusinessTypeGuide
        visible={showIntroPopup}
        onDismiss={() => setShowIntroPopup(false)}
      />

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

      <header className="border-b border-gray-200">
        <div className="mx-auto max-w-[1200px] px-6 py-4">
          <EcomtoolLogo />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-10 px-6 py-12 lg:flex-row lg:gap-16">
        <div className="lg:w-[42%] lg:pt-8">
          <p className="text-sm text-[#555]">New seller sign-up</p>
          <h1 className="mt-4 text-[2.5rem] font-bold leading-tight tracking-tight">
            What type of business is this?
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[#555]">
            We&apos;ll use this to customise your sign-up experience.
          </p>
        </div>

        <div className="flex flex-1 flex-col lg:max-w-[520px]">
          <div className="space-y-3">
            {businessOptions.map((option) => {
              const isSelected = selected === option.value;
              const isRegistered = option.value === "registered";
              const highlight = isRegistered && (showCursor || isSelected);

              return (
                <button
                  key={option.value}
                  ref={isRegistered ? registeredOptionRef : undefined}
                  type="button"
                  onClick={() => {
                    setSelected(option.value);
                    if (showCursor && isRegistered) {
                      completeCursorGuide();
                    }
                  }}
                  className={`relative w-full rounded-xl border p-5 text-left transition ${
                    highlight
                      ? "z-[70] border-[#3665f3] bg-[#f0f6ff] ring-4 ring-[#3665f3]/20"
                      : isSelected
                        ? "border-[#191919] bg-white"
                        : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <p className="text-base font-semibold text-[#191919]">{option.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-[#555]">{option.description}</p>
                </button>
              );
            })}
          </div>

          {showCursor ? (
            <p className="relative z-[70] mt-4 rounded-xl border border-[#3665f3] bg-[#f0f6ff] px-4 py-3 text-xs leading-relaxed text-[#555]">
              Select <strong className="text-[#191919]">Registered business</strong> if you registered
              as a Ltd, LLC, or similar legal entity.
            </p>
          ) : null}

          <button type="button" className="mt-6 text-left text-sm text-[#3665f3] hover:underline">
            Help me choose
          </button>

          <div className="mt-auto flex justify-end pt-10">
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => {
                if (!selected) return;
                sessionStorage.setItem(PRACTICE_BUSINESS_TYPE_KEY, selected);
                completeCursorGuide();
                router.push("/dashboard/learn-ebay/register/complete");
              }}
              className={`rounded-full px-10 py-3 text-sm font-semibold text-white transition ${
                canContinue
                  ? "bg-[#3665f3] hover:bg-[#2f56cc]"
                  : "cursor-not-allowed bg-[#767676]"
              }`}
            >
              Continue
            </button>
          </div>
        </div>
      </main>

      <LearnMarketplaceAnimatedCursor targetRef={registeredOptionRef} visible={showCursor} />

      {showCursor ? (
        <div className="pointer-events-none fixed inset-0 z-[60] bg-black/20" aria-hidden />
      ) : null}

      <button
        type="button"
        onClick={() => {
          sessionStorage.removeItem(BUSINESS_TYPE_GUIDE_KEY);
          setShowIntroPopup(true);
        }}
        className="fixed bottom-20 right-6 z-[90] inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-[#555] shadow-lg transition hover:bg-gray-50"
      >
        Show business guide
      </button>

      <button
        type="button"
        onClick={startCursorGuide}
        className="fixed bottom-6 right-6 z-[90] inline-flex items-center gap-2 rounded-full border border-[#3665f3] bg-white px-4 py-2.5 text-sm font-semibold text-[#3665f3] shadow-lg transition hover:bg-[#3665f3] hover:text-white"
        aria-label="Show cursor guide again"
      >
        <span aria-hidden>🖱️</span>
        Cursor guide
      </button>

      <footer className="border-t border-gray-200 px-6 py-6 text-center text-xs text-[#555]">
        <p>Copyright © 1995-2026 ecomtool Inc. All Rights Reserved.</p>
      </footer>
    </div>
  );
}
