"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LearnMarketplaceAnimatedCursor } from "@/features/learn-marketplace/components/LearnMarketplaceAnimatedCursor";
import {
  LearnMarketplaceUsernameGuide,
  PRACTICE_USERNAME_KEY,
  USERNAME_CURSOR_KEY_PREFIX,
  USERNAME_GUIDE_KEY,
} from "@/features/learn-marketplace/components/LearnMarketplaceUsernameGuide";

const PRACTICE_PHONE_KEY = "learn_marketplace_practice_phone";

function EcomtoolLogo() {
  return (
    <Link href="/dashboard/learn-ebay" className="text-2xl font-bold tracking-tight text-[#3665f3]">
      ecomtool
    </Link>
  );
}

function cursorGuideStorageKey(userId: string) {
  return `${USERNAME_CURSOR_KEY_PREFIX}${userId}`;
}

export function LearnMarketplaceUsernamePage() {
  const router = useRouter();
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState("");
  const [ready, setReady] = useState(false);
  const [showIntroPopup, setShowIntroPopup] = useState(false);
  const [showCursor, setShowCursor] = useState(false);

  useEffect(() => {
    const phone = sessionStorage.getItem(PRACTICE_PHONE_KEY);
    if (!phone) {
      router.replace("/dashboard/learn-ebay/register/phone/verify");
      return;
    }
    setShowIntroPopup(sessionStorage.getItem(USERNAME_GUIDE_KEY) !== "true");
    setReady(true);
  }, [router]);

  const startCursorGuide = useCallback(() => {
    setShowCursor(true);
    usernameInputRef.current?.focus();
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

  const sanitized = username.replace(/[^a-zA-Z0-9]/g, "");
  const canContinue = sanitized.length >= 6;

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
    <div className="flex min-h-full flex-col bg-[#f7f7f7] text-[#191919]">
      <LearnMarketplaceUsernameGuide visible={showIntroPopup} onDismiss={() => setShowIntroPopup(false)} />

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
        <div className="w-full rounded-xl border border-gray-200 bg-white px-8 py-10 shadow-sm">
          <h1 className="text-[2rem] font-bold tracking-tight">Create your username</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#555]">
            Your username is how other members identify you on the marketplace. Choose something
            professional that represents your business.
          </p>

          <div className="relative z-[70] mt-8">
            <label htmlFor="practice-username" className="text-xs text-[#767676]">
              Username
            </label>
            <input
              ref={usernameInputRef}
              id="practice-username"
              type="text"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value.replace(/[^a-zA-Z0-9]/g, ""));
                if (showCursor && event.target.value.length > 0) {
                  completeCursorGuide();
                }
              }}
              autoComplete="username"
              maxLength={64}
              className={`mt-2 w-full rounded-xl border bg-[#f7f7f7] px-4 py-3.5 text-sm outline-none ring-[#3665f3] transition focus:bg-white focus:ring-2 ${
                showCursor
                  ? "border-[#3665f3] ring-4 ring-[#3665f3]/20"
                  : "border-[#767676]"
              }`}
              placeholder="yourbusinessname"
            />

            {showCursor ? (
              <p className="mt-3 rounded-xl border border-[#3665f3] bg-[#f0f6ff] px-4 py-3 text-xs leading-relaxed text-[#555]">
                <strong className="text-[#191919]">Write your username here.</strong> Use at least 6
                letters or numbers — for example your company or brand name.
              </p>
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-[#555]">
                Letters and numbers only. Minimum 6 characters.
              </p>
            )}
          </div>

          <div className="mt-10 flex justify-end">
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => {
                sessionStorage.setItem(PRACTICE_USERNAME_KEY, sanitized);
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

      <LearnMarketplaceAnimatedCursor targetRef={usernameInputRef} visible={showCursor} />

      {showCursor ? (
        <div className="pointer-events-none fixed inset-0 z-[60] bg-black/20" aria-hidden />
      ) : null}

      <button
        type="button"
        onClick={() => {
          sessionStorage.removeItem(USERNAME_GUIDE_KEY);
          setShowIntroPopup(true);
        }}
        className="fixed bottom-20 right-6 z-[90] inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-[#555] shadow-lg transition hover:bg-gray-50"
      >
        Show username guide
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
