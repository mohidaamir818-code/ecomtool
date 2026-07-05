"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LearnMarketplaceAnimatedCursor } from "@/features/learn-marketplace/components/LearnMarketplaceAnimatedCursor";
import {
  LearnMarketplacePhoneVerifyMethodGuide,
  PHONE_METHOD_CURSOR_KEY_PREFIX,
  PHONE_METHOD_GUIDE_KEY,
} from "@/features/learn-marketplace/components/LearnMarketplacePhoneVerifyMethodGuide";

const PRACTICE_PHONE_KEY = "learn_marketplace_practice_phone";

type VerifyMethod = "text" | "call";

function EcomtoolLogo() {
  return (
    <Link href="/dashboard/learn-ebay" className="text-2xl font-bold tracking-tight text-[#3665f3]">
      ecomtool
    </Link>
  );
}

function cursorGuideStorageKey(userId: string) {
  return `${PHONE_METHOD_CURSOR_KEY_PREFIX}${userId}`;
}

export function LearnMarketplacePhoneVerifyMethodPage() {
  const router = useRouter();
  const textOptionRef = useRef<HTMLButtonElement>(null);
  const [phoneDisplay, setPhoneDisplay] = useState("+44 ••••••••••");
  const [method, setMethod] = useState<VerifyMethod | null>(null);
  const [showCursor, setShowCursor] = useState(false);
  const [guideReady, setGuideReady] = useState(false);
  const [showIntroPopup, setShowIntroPopup] = useState(false);

  useEffect(() => {
    const storedPhone = sessionStorage.getItem(PRACTICE_PHONE_KEY);
    if (!storedPhone) {
      router.replace("/dashboard/learn-ebay/register/phone");
      return;
    }
    setPhoneDisplay(storedPhone);
    setShowIntroPopup(sessionStorage.getItem(PHONE_METHOD_GUIDE_KEY) !== "true");
    setGuideReady(true);
  }, [router]);

  const startCursorGuide = useCallback(() => {
    setShowCursor(true);
    setMethod("text");
  }, []);

  useEffect(() => {
    if (!guideReady || showIntroPopup) return;

    const userId = sessionStorage.getItem("ecomtools_user_id");
    const cursorSeen =
      userId != null && localStorage.getItem(cursorGuideStorageKey(userId)) === "true";
    if (!cursorSeen) {
      startCursorGuide();
    }
  }, [guideReady, showIntroPopup, startCursorGuide]);

  function replayCursorGuide() {
    startCursorGuide();
  }

  function completeCursorGuide() {
    const userId = sessionStorage.getItem("ecomtools_user_id");
    if (userId) {
      localStorage.setItem(cursorGuideStorageKey(userId), "true");
    }
    setShowCursor(false);
  }

  function handleContinue() {
    if (method !== "text") return;
    completeCursorGuide();
    router.push("/dashboard/learn-ebay/register/phone/verify");
  }

  const highlightTextOption = showCursor || method === "text";

  const canContinue = method === "text";

  const maskedPhone = useMemo(() => {
    const parts = phoneDisplay.trim().split(/\s+/);
    const dial = parts[0] ?? "";
    const number = parts.slice(1).join(" ").replace(/\D/g, "");
    if (number.length <= 3) return phoneDisplay;
    return `${dial} •••••${number.slice(-3)}`;
  }, [phoneDisplay]);

  if (!guideReady) {
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
    <div className="flex min-h-full flex-col bg-[#f7f7f7] text-[#191919]">
      <LearnMarketplacePhoneVerifyMethodGuide
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

      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[960px] items-center justify-between px-6 py-4">
          <EcomtoolLogo />
          <button type="button" className="text-sm text-[#3665f3] hover:underline">
            Tell us what you think
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[760px] flex-1 px-6 py-12">
        <div className="relative w-full rounded-xl border border-gray-200 bg-white px-8 py-10 shadow-sm">
          <h1 className="text-[2rem] font-bold tracking-tight">Verify your phone number</h1>
          <p className="mt-3 text-sm text-[#555]">
            We&apos;ll send a security code to <span className="font-semibold text-[#191919]">{maskedPhone}</span>
          </p>

          <p className="mt-8 text-sm font-semibold text-[#191919]">How should we send your security code?</p>

          <div className="mt-4 space-y-3">
            <button
              ref={textOptionRef}
              type="button"
              onClick={() => {
                setMethod("text");
                if (showCursor) completeCursorGuide();
              }}
              className={`relative z-[70] flex w-full items-start gap-4 rounded-xl border p-5 text-left transition ${
                highlightTextOption
                  ? "border-[#3665f3] bg-[#f0f6ff] ring-4 ring-[#3665f3]/20"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  method === "text" ? "border-[#3665f3] bg-[#3665f3]" : "border-gray-300 bg-white"
                }`}
              >
                {method === "text" ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
              </span>
              <span>
                <span className="block text-sm font-semibold text-[#191919]">Text message</span>
                <span className="mt-1 block text-sm leading-relaxed text-[#555]">
                  We&apos;ll text a code to {maskedPhone}
                </span>
              </span>
            </button>

            {showCursor ? (
              <span className="relative z-[70] -mt-1 mb-1 block rounded-xl border border-[#3665f3] bg-white p-3 text-left shadow-lg">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#3665f3]">
                  Select this option
                </span>
                <span className="block text-xs leading-relaxed text-[#555]">
                  Only choose <strong>Text message</strong> to continue your phone verification.
                </span>
              </span>
            ) : null}

            <button
              type="button"
              onClick={() => setMethod("call")}
              className={`flex w-full items-start gap-4 rounded-xl border p-5 text-left transition ${
                method === "call"
                  ? "border-[#767676] bg-[#f7f7f7]"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  method === "call" ? "border-[#767676] bg-[#767676]" : "border-gray-300 bg-white"
                }`}
              >
                {method === "call" ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
              </span>
              <span>
                <span className="block text-sm font-semibold text-[#191919]">Call me with a code</span>
                <span className="mt-1 block text-sm leading-relaxed text-[#555]">
                  We&apos;ll call you with a code
                </span>
              </span>
            </button>
          </div>

          <div className="mt-10 flex justify-end">
            <button
              type="button"
              disabled={!canContinue}
              onClick={handleContinue}
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

      <LearnMarketplaceAnimatedCursor targetRef={textOptionRef} visible={showCursor} />

      {showCursor ? (
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

      <footer className="border-t border-gray-200 bg-white px-6 py-6 text-center text-xs text-[#555]">
        <p>Copyright © 1995-2026 ecomtool Inc. All Rights Reserved.</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {["User Agreement", "Privacy", "Payments Terms of Use", "Cookies", "AdChoice"].map((link) => (
            <button key={link} type="button" className="hover:underline">
              {link}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
