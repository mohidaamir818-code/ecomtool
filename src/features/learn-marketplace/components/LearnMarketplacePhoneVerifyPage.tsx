"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LearnMarketplaceAnimatedCursor } from "@/features/learn-marketplace/components/LearnMarketplaceAnimatedCursor";
import {
  generatePracticePhoneOtp,
  LearnMarketplacePhoneVerifyGuide,
  PHONE_VERIFY_CURSOR_KEY_PREFIX,
  PHONE_VERIFY_GUIDE_KEY,
  PRACTICE_PHONE_OTP_KEY,
} from "@/features/learn-marketplace/components/LearnMarketplacePhoneVerifyGuide";

const PRACTICE_PHONE_KEY = "learn_marketplace_practice_phone";
const OTP_LENGTH = 6;

function EcomtoolLogo() {
  return (
    <Link href="/dashboard/learn-ebay" className="text-2xl font-bold tracking-tight text-[#3665f3]">
      ecomtool
    </Link>
  );
}

function cursorGuideStorageKey(userId: string) {
  return `${PHONE_VERIFY_CURSOR_KEY_PREFIX}${userId}`;
}

export function LearnMarketplacePhoneVerifyPage() {
  const router = useRouter();
  const firstOtpInputRef = useRef<HTMLInputElement>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [phone, setPhone] = useState("");
  const [practiceOtp, setPracticeOtp] = useState("");
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [formError, setFormError] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [ready, setReady] = useState(false);
  const [showIntroPopup, setShowIntroPopup] = useState(false);
  const [showCursor, setShowCursor] = useState(false);

  useEffect(() => {
    const storedPhone = sessionStorage.getItem(PRACTICE_PHONE_KEY);
    if (!storedPhone) {
      router.replace("/dashboard/learn-ebay/register/phone/verify-method");
      return;
    }

    let otp = sessionStorage.getItem(PRACTICE_PHONE_OTP_KEY);
    if (!otp || !/^\d{6}$/.test(otp)) {
      otp = generatePracticePhoneOtp();
      sessionStorage.setItem(PRACTICE_PHONE_OTP_KEY, otp);
    }

    setPhone(storedPhone);
    setPracticeOtp(otp);
    setShowIntroPopup(sessionStorage.getItem(PHONE_VERIFY_GUIDE_KEY) !== "true");
    setReady(true);
  }, [router]);

  const startCursorGuide = useCallback(() => {
    setShowCursor(true);
    firstOtpInputRef.current?.focus();
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

  const maskedPhone = useMemo(() => {
    const parts = phone.trim().split(/\s+/);
    const dial = parts[0] ?? "";
    const number = parts.slice(1).join(" ").replace(/\D/g, "");
    if (number.length <= 3) return phone;
    return `${dial} •••••${number.slice(-3)}`;
  }, [phone]);

  const updateDigit = (index: number, value: string) => {
    const next = value.replace(/\D/g, "").slice(-1);
    const updated = [...digits];
    updated[index] = next;
    setDigits(updated);
    setFormError("");

    if (next && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, key: string) => {
    if (key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (value: string) => {
    const pasted = value.replace(/\D/g, "").slice(0, OTP_LENGTH).split("");
    if (pasted.length === 0) return;

    const updated = Array(OTP_LENGTH).fill("");
    pasted.forEach((char, index) => {
      updated[index] = char;
    });
    setDigits(updated);
    setFormError("");
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH) - 1]?.focus();
  };

  function completeCursorGuide() {
    const userId = sessionStorage.getItem("ecomtools_user_id");
    if (userId) {
      localStorage.setItem(cursorGuideStorageKey(userId), "true");
    }
    setShowCursor(false);
  }

  function handleVerify() {
    const otp = digits.join("");
    if (!/^\d{6}$/.test(otp)) {
      setFormError("Please enter the 6-digit code sent to your phone.");
      return;
    }

    setIsVerifying(true);
    setFormError("");
    setResendMessage("");

    if (otp !== practiceOtp) {
      setFormError("Incorrect verification code. Please try again.");
      setIsVerifying(false);
      return;
    }

    completeCursorGuide();
    setIsVerifying(false);
    router.push("/dashboard/learn-ebay/register/username");
  }

  function handleResend() {
    const otp = generatePracticePhoneOtp();
    sessionStorage.setItem(PRACTICE_PHONE_OTP_KEY, otp);
    setPracticeOtp(otp);
    setDigits(Array(OTP_LENGTH).fill(""));
    setFormError("");
    setResendMessage(`New practice code: ${otp}. Enter it in the boxes below.`);
    inputRefs.current[0]?.focus();
  }

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
      <LearnMarketplacePhoneVerifyGuide
        visible={showIntroPopup}
        phone={maskedPhone}
        otp={practiceOtp}
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

      <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col items-center px-6 py-16 text-center">
        <h1 className="text-[2rem] font-bold tracking-tight">Verify your phone number</h1>

        <p className="mt-4 text-sm leading-relaxed text-[#555]">
          We texted a security code to <span className="font-semibold text-[#191919]">{maskedPhone}</span>
        </p>

        <p className="mt-2 text-sm text-[#555]">
          If you didn&apos;t receive it, wait a moment or request a new code.{" "}
          <Link href="/dashboard/learn-ebay/register/phone" className="text-[#3665f3] hover:underline">
            Wrong number?
          </Link>
        </p>

        <div className="relative z-[70] mt-10 flex justify-center gap-3">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(element) => {
                inputRefs.current[index] = element;
                if (index === 0) {
                  firstOtpInputRef.current = element;
                }
              }}
              type="text"
              inputMode="numeric"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              maxLength={1}
              value={digit}
              onChange={(event) => {
                updateDigit(index, event.target.value);
                if (showCursor && index === 0 && event.target.value) {
                  completeCursorGuide();
                }
              }}
              onKeyDown={(event) => handleKeyDown(index, event.key)}
              onPaste={(event) => {
                event.preventDefault();
                handlePaste(event.clipboardData.getData("text"));
              }}
              className={`h-14 w-12 rounded-md border bg-white text-center text-xl font-semibold outline-none ring-[#3665f3] focus:border-[#3665f3] focus:ring-2 ${
                showCursor && index === 0
                  ? "border-[#3665f3] ring-4 ring-[#3665f3]/20"
                  : "border-[#767676]"
              }`}
              aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
            />
          ))}
        </div>

        {showCursor ? (
          <p className="relative z-[70] mt-4 max-w-sm rounded-xl border border-[#3665f3] bg-white px-4 py-3 text-xs leading-relaxed text-[#555]">
            Enter the practice OTP from the guide popup:{" "}
            <strong className="tracking-widest text-[#191919]">{practiceOtp}</strong>
          </p>
        ) : null}

        {resendMessage ? (
          <p className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {resendMessage}
          </p>
        ) : null}

        {formError ? (
          <p className="mt-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {formError}
          </p>
        ) : null}

        <div className="mt-10 flex w-full max-w-[360px] gap-4">
          <button
            type="button"
            onClick={() => router.push("/dashboard/learn-ebay/register/phone/verify-method")}
            className="flex-1 rounded-full border-2 border-[#3665f3] bg-white px-6 py-3 text-sm font-semibold text-[#3665f3] transition hover:bg-[#f0f6ff]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleVerify}
            disabled={isVerifying}
            className="flex-1 rounded-full bg-[#767676] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#5c5c5c] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isVerifying ? "Verifying..." : "Verify"}
          </button>
        </div>

        <p className="mt-8 text-sm text-[#555]">
          Still no code?{" "}
          <button
            type="button"
            onClick={handleResend}
            className="font-semibold text-[#3665f3] hover:underline"
          >
            Get another one
          </button>
        </p>
      </main>

      <LearnMarketplaceAnimatedCursor targetRef={firstOtpInputRef} visible={showCursor} />

      {showCursor ? (
        <div className="pointer-events-none fixed inset-0 z-[60] bg-black/20" aria-hidden />
      ) : null}

      <button
        type="button"
        onClick={() => {
          setShowIntroPopup(true);
          sessionStorage.removeItem(PHONE_VERIFY_GUIDE_KEY);
        }}
        className="fixed bottom-20 right-6 z-[90] inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-[#555] shadow-lg transition hover:bg-gray-50"
      >
        Show OTP guide
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
