"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const OTP_LENGTH = 6;
const PRACTICE_EMAIL_KEY = "learn_marketplace_practice_email";

function EcomtoolLogo() {
  return (
    <Link href="/dashboard/learn-ebay" className="text-2xl font-bold tracking-tight text-[#3665f3]">
      ecomtool
    </Link>
  );
}

export function LearnMarketplaceVerifyEmailPage() {
  const router = useRouter();
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [email, setEmail] = useState("your email address");
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));

  useEffect(() => {
    const storedEmail = sessionStorage.getItem(PRACTICE_EMAIL_KEY);
    if (storedEmail) {
      setEmail(storedEmail);
    }
  }, []);

  const updateDigit = (index: number, value: string) => {
    const next = value.replace(/\D/g, "").slice(-1);
    const updated = [...digits];
    updated[index] = next;
    setDigits(updated);

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
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH) - 1]?.focus();
  };

  return (
    <div className="flex min-h-full flex-col bg-[#f7f7f7] text-[#191919]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[960px] items-center justify-between px-6 py-4">
          <EcomtoolLogo />
          <button type="button" className="text-sm text-[#3665f3] hover:underline">
            Tell us what you think
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col items-center px-6 py-16 text-center">
        <h1 className="text-[2rem] font-bold tracking-tight">Verify your email address</h1>

        <p className="mt-4 text-sm leading-relaxed text-[#555]">
          We emailed a security code to <span className="font-semibold text-[#191919]">{email}</span>
        </p>

        <p className="mt-2 text-sm text-[#555]">
          If you can&apos;t find it, check your spam folder.{" "}
          <Link href="/dashboard/learn-ebay/register" className="text-[#3665f3] hover:underline">
            Wrong email?
          </Link>
        </p>

        <div className="mt-10 flex justify-center gap-3">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(element) => {
                inputRefs.current[index] = element;
              }}
              type="text"
              inputMode="numeric"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              maxLength={1}
              value={digit}
              onChange={(event) => updateDigit(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event.key)}
              onPaste={(event) => {
                event.preventDefault();
                handlePaste(event.clipboardData.getData("text"));
              }}
              className="h-14 w-12 rounded-md border border-[#767676] bg-white text-center text-xl font-semibold outline-none ring-[#3665f3] focus:border-[#3665f3] focus:ring-2"
              aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
            />
          ))}
        </div>

        <div className="mt-10 flex w-full max-w-[360px] gap-4">
          <button
            type="button"
            onClick={() => router.push("/dashboard/learn-ebay/register")}
            className="flex-1 rounded-full border-2 border-[#3665f3] bg-white px-6 py-3 text-sm font-semibold text-[#3665f3] transition hover:bg-[#f0f6ff]"
          >
            Cancel
          </button>
          <button
            type="button"
            className="flex-1 rounded-full bg-[#767676] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#5c5c5c]"
          >
            Verify
          </button>
        </div>

        <p className="mt-8 text-sm text-[#555]">
          Still no code?{" "}
          <button type="button" className="font-semibold text-[#3665f3] hover:underline">
            Get another one
          </button>
        </p>
      </main>

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
